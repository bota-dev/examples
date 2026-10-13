import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_recordings_flutter/api.dart';
import 'package:mobile_recordings_flutter/models.dart';
import 'package:mobile_recordings_flutter/recordings_controller.dart';
import 'package:mobile_recordings_flutter/sample_api.dart';

Json recording(String recordingId) => {
  'id': recordingId,
  'name': recordingId,
  'status': 'uploaded',
  'created_at': '2026-10-12T09:00:00Z',
  'duration_seconds': 42,
  'upload_verified': true,
};
Json operation({
  String operationId = 'op_1',
  String kind = 'transcription',
  String state = 'complete',
}) => {
  'id': operationId,
  'kind': kind,
  'state': state,
  'resource_id': 'txn_1',
  'updated_at': '2026-10-12T09:00:00Z',
};

class ControlledApi implements RecordingsApi {
  final sample = SampleApi();
  Future<Json> Function(String)? onGet;
  Future<Json> Function(String, Json)? onPost;
  final gets = <String>[];
  final posts = <String>[];
  bool closed = false;
  @override
  Future<Json> get(String path) {
    gets.add(path);
    return onGet?.call(path) ?? sample.get(path);
  }

  @override
  Future<Json> post(String path, Json body) {
    posts.add(path);
    return onPost?.call(path, body) ?? sample.post(path, body);
  }

  @override
  void close() {
    closed = true;
    sample.close();
  }
}

void main() {
  late RecordingsController state;
  late ControlledApi api;
  setUp(() {
    state = RecordingsController();
    api = ControlledApi();
  });
  tearDown(() {
    state.dispose();
  });

  Future<void> open() async {
    await state.connect(api, isSample: false);
    await state.select('rec_sample1');
  }

  test(
    'complete local recording journey with explicit actions and GET recovery',
    () async {
      await open();
      expect(api.gets.where((path) => path.endsWith('/summaries')), isEmpty);
      await state.transcribe();
      await state.summarize();
      await state.ask(' What next? ');
      expect(state.transcript?.fullText, contains('Alex'));
      expect(state.summaries.single.recordingId, 'rec_sample1');
      expect(state.answer?.answer, contains('Friday'));
      expect(state.answer?.citations.single, const Duration(seconds: 12));
      final count = api.posts.length;
      await state.refreshOperation(state.operations.first);
      expect(api.posts.length, count);
      expect(state.answer?.answer, contains('Friday'));
    },
  );

  test('old recording read cannot replace a newer selection', () async {
    await state.connect(api, isSample: false);
    final pending = Completer<Json>();
    api.onGet = (path) => path == '/api/library/recordings/rec_sample1'
        ? pending.future
        : api.sample.get(path);
    final old = state.select('rec_sample1');
    await state.select('rec_sample2');
    pending.complete(recording('rec_sample1'));
    await old;
    expect(state.selected?.id, 'rec_sample2');
    expect(state.detailLoading, false);
  });

  test(
    'old account response and failure cannot restore or expire new session',
    () async {
      final pending = Completer<Json>();
      api.onGet = (_) => pending.future;
      final old = state.connect(api, isSample: false);
      await state.connect(SampleApi(), isSample: true);
      pending.completeError(const ApiException(401, 'expired', 'expired'));
      await old;
      expect(state.sample, true);
      expect(state.signedIn, true);
      expect(state.recordings.length, 2);
      expect(api.closed, true);
    },
  );

  test(
    'late POST after leaving detail retains lock but releases no old content',
    () async {
      await open();
      final pending = Completer<Json>();
      api.onPost = (_, _) => pending.future;
      final old = state.transcribe();
      state.leaveDetail();
      await state.select('rec_sample2');
      pending.complete({'operation': operation()});
      await old;
      await state.select('rec_sample1');
      await state.transcribe();
      expect(api.posts.length, 1);
      expect(state.intents['transcription:rec_sample1']?.operation?.id, 'op_1');
      expect(state.transcript, isNull);
    },
  );

  test(
    'unknown write remains locked across leaving and reopening detail',
    () async {
      await open();
      api.onPost = (_, _) async =>
          throw const ApiException(0, 'outcome_unknown', 'unknown');
      await state.transcribe();
      state.leaveDetail();
      await state.select('rec_sample1');
      await state.transcribe();
      expect(api.posts.length, 1);
      expect(state.locked('transcription:rec_sample1'), true);
    },
  );

  test(
    'only known preclaim readiness error without operation field unlocks',
    () async {
      await open();
      api.onPost = (_, _) async =>
          throw const ApiException(409, 'upload_unverified', 'not ready');
      await state.transcribe();
      expect(state.locked('transcription:rec_sample1'), false);
      api.onPost = (_, _) async => throw const ApiException(
        409,
        'upload_unverified',
        'ambiguous',
        operationPresent: true,
      );
      await state.transcribe();
      expect(state.locked('transcription:rec_sample1'), true);
      await state.transcribe();
      expect(api.posts.length, 2);
    },
  );

  test(
    'wrong summary recording is rejected without blocking Transcript or Ask',
    () async {
      await open();
      await state.transcribe();
      api.onGet = (path) async => path.endsWith('/summaries')
          ? {
              'data': [
                {
                  'id': 'sum_wrong',
                  'recording_id': 'rec_other',
                  'transcription_id': 'txn_rec_sample1',
                  'status': 'completed',
                  'template_id': 'tmpl_general_notes',
                  'output': {'overview': 'foreign'},
                },
              ],
            }
          : await api.sample.get(path);
      await state.refreshSummaries();
      expect(state.summaries, isEmpty);
      expect(state.transcript?.status, 'completed');
      await state.ask('Next?');
      expect(state.answer?.answer, contains('Alex'));
    },
  );

  test(
    'wrong citation is rejected while known operation remains recoverable',
    () async {
      await open();
      await state.transcribe();
      api.onPost = (_, _) async => {
        'operation': operation(kind: 'ask'),
        'answer': 'foreign',
        'citations': [
          {'recording_id': 'rec_other', 'start_ms': 0},
        ],
      };
      await state.ask('Next?');
      expect(state.answer, isNull);
      expect(state.intents['ask:rec_sample1:Next?']?.operation?.id, 'op_1');
      expect(state.intents['ask:rec_sample1:Next?']?.needsNotice, true);
    },
  );

  test(
    'GET operation recovery rejects a mismatched identity and never POSTs',
    () async {
      await open();
      await state.transcribe();
      final previous = state.operations.first;
      api.onGet = (_) async => {'operation': operation(operationId: 'wrong')};
      await state.refreshOperation(previous);
      expect(state.operations.single.id, previous.id);
      expect(api.posts.length, 1);
      expect(state.error, isNotEmpty);
    },
  );

  test(
    'editing question fences late answer while preserving original intent',
    () async {
      await open();
      await state.transcribe();
      final pending = Completer<Json>();
      api.onPost = (_, _) => pending.future;
      final old = state.ask('Original question?');
      state.setQuestion('Changed question?');
      pending.complete({
        'operation': operation(kind: 'ask'),
        'answer': 'Original answer',
        'citations': [
          {'recording_id': 'rec_sample1', 'start_ms': 0},
        ],
      });
      await old;
      expect(state.answer, isNull);
      expect(state.locked('ask:rec_sample1:Original question?'), true);
      expect(
        state.intents['ask:rec_sample1:Original question?']?.operation?.id,
        'op_1',
      );
    },
  );

  test(
    'completed source remains available beside a newer pending transcription',
    () async {
      await open();
      api.onGet = (path) async => path.endsWith('/transcriptions')
          ? {
              'data': [
                {
                  'id': 'txn_pending',
                  'recording_id': 'rec_sample1',
                  'status': 'processing',
                },
                {
                  'id': 'txn_completed',
                  'recording_id': 'rec_sample1',
                  'status': 'completed',
                  'full_text': 'Available text.',
                },
              ],
            }
          : await api.sample.get(path);
      await state.refreshDetail();
      expect(state.transcript?.id, 'txn_completed');
      expect(state.transcript?.fullText, 'Available text.');
      await state.refreshSummaries();
      expect(
        api.gets.last,
        '/api/library/transcriptions/txn_completed/summaries',
      );
    },
  );

  test(
    'retiring pending summary clears spinner and fences its late result',
    () async {
      await open();
      await state.transcribe();
      final pending = Completer<Json>();
      api.onGet = (path) =>
          path.endsWith('/summaries') ? pending.future : api.sample.get(path);
      final old = state.refreshSummaries();
      expect(state.summaryLoading, true);
      state.leaveDetail();
      await state.select('rec_sample2');
      expect(state.summaryLoading, false);
      pending.complete({'data': []});
      await old;
      expect(state.summaryLoading, false);
      expect(state.selected?.id, 'rec_sample2');
    },
  );

  test('dispose fences late account read and closes its API', () async {
    final localState = RecordingsController();
    final pending = Completer<Json>();
    api.onGet = (_) => pending.future;
    final old = localState.connect(api, isSample: false);
    localState.dispose();
    pending.complete({
      'data': [recording('rec_old')],
      'has_more': false,
    });
    await old;
    expect(localState.recordings, isEmpty);
    expect(api.closed, true);
  });

  test('dispose clears all prior content and account-owned locks', () async {
    final localState = RecordingsController();
    await localState.connect(SampleApi(), isSample: true);
    await localState.select('rec_sample1');
    await localState.transcribe();
    await localState.summarize();
    await localState.ask('Next?');
    localState.dispose();
    expect(localState.recordings, isEmpty);
    expect(localState.transcripts, isEmpty);
    expect(localState.summaries, isEmpty);
    expect(localState.answer, isNull);
    expect(localState.operations, isEmpty);
    expect(localState.intents, isEmpty);
    expect(localState.signedIn, false);
  });

  test(
    'signout clears every content field, lock and operation immediately',
    () async {
      await open();
      await state.transcribe();
      await state.summarize();
      await state.ask('Next?');
      state.signOut();
      expect(state.recordings, isEmpty);
      expect(state.transcripts, isEmpty);
      expect(state.summaries, isEmpty);
      expect(state.answer, isNull);
      expect(state.operations, isEmpty);
      expect(state.intents, isEmpty);
      expect(state.signedIn, false);
    },
  );
}
