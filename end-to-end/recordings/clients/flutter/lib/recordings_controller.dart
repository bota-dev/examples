import 'package:flutter/foundation.dart' show ChangeNotifier;
import 'api.dart';
import 'models.dart';

class WriteIntent {
  bool busy = false;
  String error = '';
  Operation? operation;
  bool get needsNotice =>
      busy || error.isNotEmpty || operation?.state != 'complete';
}

/// App-owned presentation state. Bota keys and authorization stay on the backend.
class RecordingsController extends ChangeNotifier {
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
    loading = detailLoading = summaryLoading = false;
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
