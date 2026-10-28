import 'package:flutter/foundation.dart' show ChangeNotifier;
import 'api.dart';
import 'models.dart';
import 'recording_media.dart';

class WriteIntent {
  bool busy = false;
  String error = '';
  Operation? operation;
  bool get needsNotice =>
      busy || error.isNotEmpty || operation?.state != 'complete';
}

/// App-owned presentation state. Bota keys and authorization stay on the backend.
class RecordingsController extends ChangeNotifier {
  RecordingsController({RecordingMedia? media})
    : _media = media ?? NativeRecordingMedia();
  final RecordingMedia _media;
  Future<void> _mediaCleanup = Future<void>.value();
  Future<void> _nativeLoad = Future<void>.value();
  Future<void> _pickerDrain = Future<void>.value();
  int _audioRead = 0;
  int _playRead = 0;
  bool audioLoading = false;
  bool audioReady = false;
  bool playing = false;
  bool mediaBlocked = false;
  bool picking = false;
  String audioError = '';
  bool get canUseMedia =>
      !sample && _api is MediaRecordingsApi && !mediaBlocked;

  void _clearAudio() {
    _audioRead++;
    _playRead++;
    audioLoading = audioReady = playing = false;
    audioError = mediaBlocked
        ? 'Audio cleanup failed. Restart the sample before loading audio.'
        : '';
    _mediaCleanup = _nativeLoad.then((_) => _media.reset()).catchError((
      Object _,
    ) {
      mediaBlocked = true;
      audioError =
          'Audio cleanup failed. Restart the sample before loading audio.';
      _notify();
    });
  }

  void stopAudio() {
    _clearAudio();
    _notify();
  }

  Future<void> importAudio() async {
    final api = _api;
    if (!canUseMedia ||
        api is! MediaRecordingsApi ||
        picking ||
        locked('upload')) {
      return;
    }
    final account = _account;
    picking = true;
    _notify();
    try {
      await Future.wait([_mediaCleanup, _pickerDrain]);
      if (!_current(account) || mediaBlocked) return;
      final picker = _media.pick();
      _pickerDrain = picker.then<void>((_) {}, onError: (Object _) {});
      final file = await picker;
      if (file == null || !_current(account)) return;
      final intent = WriteIntent()..busy = true;
      intents['upload'] = intent;
      _notify();
      try {
        final response = await api.upload(file);
        final operation = Operation.fromJson(object(response['operation']));
        if (operation.kind != 'upload') {
          throw const FormatException('Wrong upload operation.');
        }
        if (!_current(account)) return;
        intent.operation = operation;
        _record(operation);
        if (operation.state == 'complete') intents.remove('upload');
        await refreshLibrary();
      } catch (e) {
        if (!_current(account)) return;
        intent.error = _message(e);
        if (e is ApiException && e.operation?.kind == 'upload') {
          intent.operation = e.operation;
          _record(e.operation!);
        }
        _failure(e, account);
      } finally {
        if (_current(account)) intent.busy = false;
      }
    } catch (_) {
      if (_current(account)) {
        error = 'Choose a supported audio file up to 25 MiB.';
      }
    } finally {
      if (_current(account)) {
        picking = false;
        _notify();
      }
    }
  }

  Future<void> loadAudio() async {
    final api = _api, recordingId = selectedId;
    if (!canUseMedia ||
        api is! MediaRecordingsApi ||
        recordingId == null ||
        audioLoading) {
      return;
    }
    _clearAudio();
    final account = _account, selection = _selection, read = _audioRead;
    bool current() => _current(account, selection) && read == _audioRead;
    audioLoading = true;
    _notify();
    try {
      await Future.wait([_mediaCleanup, _pickerDrain]);
      if (!current() || mediaBlocked) return;
      final bytes = await api.audio(recordingId);
      if (!current()) return;
      final loading = _media.load(bytes);
      _nativeLoad = loading.catchError((Object _) {});
      await loading;
      if (current()) audioReady = true;
    } catch (e) {
      if (current()) {
        _clearAudio();
        audioError =
            'Audio unavailable. Only verified ordinary imports support playback.';
        _failure(e, account, selection);
      }
    } finally {
      if (current()) {
        audioLoading = false;
        _notify();
      }
    }
  }

  Future<void> togglePlayback() async {
    if (!audioReady || mediaBlocked || !canUseMedia) return;
    final account = _account, selection = _selection, read = _audioRead;
    final play = ++_playRead;
    final wasPlaying = playing;
    playing = !playing;
    _notify();
    try {
      if (wasPlaying) {
        await _media.pause();
      } else {
        await _media.play();
      }
    } catch (_) {
      if (_current(account, selection) &&
          read == _audioRead &&
          play == _playRead) {
        _clearAudio();
        audioError = 'Audio could not play. Reload audio to try again.';
        _notify();
      }
    } finally {
      if (_current(account, selection) &&
          read == _audioRead &&
          play == _playRead &&
          !wasPlaying) {
        playing = false;
        _notify();
      }
    }
  }

  RecordingsApi? _api;
  int _account = 0;
  int _selection = 0;
  int _detailRead = 0;
  int _summaryRead = 0;
  int _questionRevision = 0;
  String _question = '';
  bool _disposed = false;
  bool sample = false;
  bool loading = false;
  bool detailLoading = false;
  bool summaryLoading = false;
  String error = '';
  String? selectedId;
  List<Recording> recordings = [];
  bool incomplete = false;
  Recording? selected;
  List<Transcript> transcripts = [];
  List<Summary> summaries = [];
  Answer? answer;
  List<Operation> operations = [];
  final intents = <String, WriteIntent>{};
  bool get signedIn => _api != null;
  Transcript? get transcript {
    for (final row in transcripts) {
      if (row.status == 'completed') return row;
    }
    return transcripts.isEmpty ? null : transcripts.first;
  }

  void setQuestion(String input) {
    final canonical = input.trim();
    if (canonical == _question) return;
    _question = canonical;
    _questionRevision++;
    answer = null;
    _notify();
  }

  bool locked(String key) => intents.containsKey(key);
  bool busy(String key) => intents[key]?.busy ?? false;
  bool _current(int account, [int? selection]) =>
      !_disposed &&
      account == _account &&
      (selection == null || selection == _selection);
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  String _message(Object exception) => exception is ApiException
      ? exception.message
      : 'The response did not match this recording. Refresh to check again.';
  void _failure(Object exception, int account, [int? selection]) {
    if (!_current(account)) return;
    if (exception is ApiException && exception.status == 401) {
      signOut();
      error = 'Your session ended. Connect again.';
    } else if (_current(account, selection)) {
      error = _message(exception);
    }
    _notify();
  }

  Future<void> connect(RecordingsApi api, {required bool isSample}) async {
    signOut();
    _api = api;
    sample = isSample;
    _notify();
    await refreshLibrary();
  }

  void signOut() {
    _clearAudio();
    _account++;
    _selection++;
    _detailRead++;
    _summaryRead++;
    _questionRevision++;
    _question = '';
    _api?.close();
    _api = null;
    sample = false;
    incomplete = false;
    loading = detailLoading = summaryLoading = picking = false;
    selectedId = null;
    selected = null;
    recordings = [];
    transcripts = [];
    summaries = [];
    answer = null;
    operations = [];
    intents.clear();
    error = '';
    _notify();
  }

  Future<void> refreshLibrary() async {
    final api = _api;
    if (api == null || loading) return;
    final account = _account;
    loading = true;
    error = '';
    _notify();
    try {
      final response = await api.get('/api/library/recordings');
      final rows = collection(response, Recording.fromJson);
      if (_current(account)) {
        recordings = rows;
        incomplete = response['has_more'] == true;
      }
    } catch (e) {
      _failure(e, account);
    } finally {
      if (_current(account)) {
        loading = false;
        _notify();
      }
    }
  }

  Future<void> select(String recordingId) async {
    validatedId(recordingId);
    _clearAudio();
    _selection++;
    _detailRead++;
    _summaryRead++;
    _questionRevision++;
    _question = '';
    summaryLoading = false;
    selectedId = recordingId;
    selected = null;
    transcripts = [];
    summaries = [];
    answer = null;
    error = '';
    await refreshDetail();
  }

  void leaveDetail() {
    _clearAudio();
    _selection++;
    _detailRead++;
    _summaryRead++;
    _questionRevision++;
    _question = '';
    summaryLoading = false;
    selectedId = null;
    selected = null;
    transcripts = [];
    summaries = [];
    answer = null;
    detailLoading = false;
    error = '';
    _notify();
    // Account-owned intents remain locked after navigating away.
  }

  Future<void> refreshDetail() async {
    final api = _api;
    final recordingId = selectedId;
    if (api == null || recordingId == null) return;
    _clearAudio();
    final account = _account, selection = _selection;
    final read = ++_detailRead;
    bool current() => _current(account, selection) && read == _detailRead;
    detailLoading = true;
    error = '';
    _notify();
    try {
      final recording = Recording.fromJson(
        await api.get('/api/library/recordings/$recordingId'),
      );
      if (!current()) return;
      if (recording.id != recordingId) {
        throw const FormatException('Wrong recording.');
      }
      final rows = collection(
        await api.get('/api/library/recordings/$recordingId/transcriptions'),
        Transcript.fromJson,
      );
      if (!current()) return;
      if (rows.any((row) => row.recordingId != recordingId)) {
        throw const FormatException('Wrong transcript.');
      }
      final oldSource = transcript?.id;
      transcripts = rows;
      if (transcript?.id != oldSource) {
        _summaryRead++;
        summaries = [];
        summaryLoading = false;
      }
      selected = recording;
    } catch (e) {
      if (current()) {
        selected = null;
        transcripts = [];
        summaries = [];
        answer = null;
        _failure(e, account, selection);
      }
    } finally {
      if (current()) {
        detailLoading = false;
        _notify();
      }
    }
  }

  Future<void> refreshSummaries() async {
    final api = _api;
    final source = transcript;
    final recordingId = selectedId;
    if (api == null || source == null || recordingId == null) return;
    final account = _account, selection = _selection, read = ++_summaryRead;
    bool current() =>
        _current(account, selection) &&
        read == _summaryRead &&
        source.id == transcript?.id;
    summaryLoading = true;
    error = '';
    _notify();
    try {
      final notes = collection(
        await api.get('/api/library/transcriptions/${source.id}/summaries'),
        Summary.fromJson,
      );
      if (!current()) return;
      if (notes.any(
        (row) =>
            row.transcriptionId != source.id || row.recordingId != recordingId,
      )) {
        throw const FormatException('Wrong summary source.');
      }
      for (final note in notes) {
        note.overview;
        for (final key in [
          'key_points',
          'action_items',
          'participants',
          'decisions',
        ]) {
          note.lines(key);
        }
      }
      summaries = notes;
    } catch (e) {
      if (current()) {
        summaries = [];
        _failure(e, account, selection);
      }
    } finally {
      if (current()) {
        summaryLoading = false;
        _notify();
      }
    }
  }

  Future<void> transcribe() async {
    final recording = selected;
    if (recording == null || !recording.uploadVerified) return;
    await _write(
      'transcription:${recording.id}',
      'transcription',
      '/api/library/recordings/${recording.id}/transcriptions',
      {},
    );
  }

  Future<void> summarize() async {
    final row = transcript;
    if (row == null || row.status != 'completed') return;
    await _write(
      'summary:${row.id}',
      'summary',
      '/api/library/transcriptions/${row.id}/summaries',
      {},
    );
  }

  Future<void> ask(String input) async {
    final recording = selected;
    final question = input.trim();
    if (recording == null ||
        transcript?.status != 'completed' ||
        question.isEmpty ||
        question.length > 10000) {
      return;
    }
    setQuestion(question);
    await _write(
      'ask:${recording.id}:$question',
      'ask',
      '/api/library/recordings/${recording.id}/ask',
      {'question': question},
      questionRevision: _questionRevision,
    );
  }

  Future<void> _write(
    String key,
    String kind,
    String path,
    Json body, {
    int? questionRevision,
  }) async {
    final api = _api;
    if (api == null || intents.containsKey(key)) return;
    final account = _account, selection = _selection;
    final recordingId = selectedId;
    final intent = WriteIntent()..busy = true;
    intents[key] = intent;
    error = '';
    answer = null;
    _notify();
    try {
      final response = await api.post(path, body);
      final operation = Operation.fromJson(object(response['operation']));
      if (operation.kind != kind) {
        throw const FormatException('Wrong operation.');
      }
      if (!_current(account)) return;
      intent.operation = operation;
      _record(operation);
      if (_current(account, selection)) {
        if (kind == 'ask') {
          if (questionRevision == _questionRevision) {
            answer = Answer.fromJson(response, recordingId!);
          }
        } else if (kind == 'summary') {
          await refreshSummaries();
        } else {
          await refreshDetail();
        }
      }
    } catch (e) {
      if (!_current(account)) return;
      intent.error = _message(e);
      if (e is ApiException) {
        if (e.operation?.kind == kind) {
          intent.operation = e.operation;
          _record(e.operation!);
        }
        final rejectedBeforeClaim =
            e.status == 409 &&
            !e.operationPresent &&
            e.operation == null &&
            ((kind == 'transcription' && e.code == 'upload_unverified') ||
                (kind == 'summary' && e.code == 'transcription_incomplete'));
        if (rejectedBeforeClaim) intents.remove(key);
      }
      _failure(e, account, selection);
    } finally {
      if (_current(account)) {
        intent.busy = false;
        _notify();
      }
    }
  }

  void _record(Operation operation) {
    operations = [
      operation,
      ...operations.where((row) => row.id != operation.id),
    ];
  }

  Future<void> refreshOperations() async {
    final api = _api;
    if (api == null) return;
    final account = _account;
    try {
      final rows = collection(
        await api.get('/api/library/operations'),
        Operation.fromJson,
      );
      if (_current(account)) {
        operations = rows;
        _notify();
      }
    } catch (e) {
      _failure(e, account);
    }
  }

  Future<void> refreshOperation(Operation previous) async {
    final api = _api;
    if (api == null) return;
    final account = _account;
    try {
      final response = await api.get('/api/library/operations/${previous.id}');
      final operation = Operation.fromJson(object(response['operation']));
      if (operation.id != previous.id || operation.kind != previous.kind) {
        throw const FormatException('Wrong recovered operation.');
      }
      if (!_current(account)) return;
      _record(operation);
      for (final intent in intents.values) {
        if (intent.operation?.id == operation.id) {
          intent.operation = operation;
          intent.error = '';
        }
      }
      if (operation.kind == 'upload' &&
          operation.state == 'complete' &&
          intents['upload']?.operation?.id == operation.id) {
        intents.remove('upload');
      }
      // Recovery presents metadata. Read source tabs explicitly for content.
      _notify();
    } catch (e) {
      if (_current(account)) {
        for (final intent in intents.values) {
          if (intent.operation?.id == previous.id) intent.error = _message(e);
        }
      }
      _failure(e, account);
    }
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    signOut();
    super.dispose();
  }
}
