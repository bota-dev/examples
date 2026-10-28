import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_recordings_flutter/api.dart';
import 'package:mobile_recordings_flutter/models.dart';
import 'package:mobile_recordings_flutter/main.dart';
import 'package:mobile_recordings_flutter/recording_media.dart';
import 'package:mobile_recordings_flutter/recordings_controller.dart';
import 'package:mobile_recordings_flutter/sample_api.dart';

class MediaApi extends SampleApi implements MediaRecordingsApi {
  Completer<Uint8List>? pendingAudio;
  Future<Json> Function()? onUpload;
  int uploads = 0, reads = 0;
  @override
  Future<Json> upload(AudioImport file) {
    uploads++;
    return onUpload?.call() ??
        Future.value({
          'operation': {
            'id': 'op_upload',
            'kind': 'upload',
            'state': 'complete',
            'resource_id': 'rec_sample1',
            'updated_at': '2026-10-20T00:00:00Z',
          },
        });
  }

  @override
  Future<Uint8List> audio(String id) {
    reads++;
    return pendingAudio?.future ?? Future.value(Uint8List(44));
  }
}

class MediaPort implements RecordingMedia {
  int picks = 0, loads = 0, resets = 0, plays = 0;
  Completer<AudioImport?>? pendingPick;
  Completer<void>? pendingReset;
  Completer<void>? pendingLoad;
  Completer<void>? pendingPlay;
  bool failReset = false;
  bool failPlay = false;
  @override
  Future<AudioImport?> pick() async {
    picks++;
    return pendingPick?.future ??
        AudioImport('sample.wav', 'audio/wav', Uint8List(44));
  }

  @override
  Future<void> load(Uint8List bytes) async {
    loads++;
    await pendingLoad?.future;
  }

  @override
  Future<void> reset() async {
    resets++;
    if (failReset) throw StateError('cleanup');
    await pendingReset?.future;
  }

  @override
  Future<void> play() async {
    plays++;
    if (failPlay) throw StateError('decoder');
    await pendingPlay?.future;
  }

  @override
  Future<void> pause() async {}
}

void main() {
  late MediaPort media;
  late MediaApi api;
  late RecordingsController state;
  setUp(() {
    media = MediaPort();
    api = MediaApi();
    state = RecordingsController(media: media);
  });
  tearDown(() => state.dispose());
  Future<void> open() async {
    await state.connect(api, isSample: false);
    await state.select('rec_sample1');
  }

  test('cancelled picker makes no upload claim', () async {
    await open();
    media.pendingPick = Completer()..complete(null);
    await state.importAudio();
    expect(api.uploads, 0);
    expect(state.locked('upload'), false);
  });
  test('signout fences an open native picker before HTTP write', () async {
    await open();
    media.pendingPick = Completer();
    final work = state.importAudio();
    await Future<void>.delayed(Duration.zero);
    state.signOut();
    media.pendingPick!.complete(
      AudioImport('sample.wav', 'audio/wav', Uint8List(44)),
    );
    await work;
    expect(api.uploads, 0);
    expect(state.recordings, isEmpty);
  });
  test(
    'replacement account waits for the old native picker to close',
    () async {
      await open();
      media.pendingPick = Completer();
      final oldPicker = media.pendingPick!;
      final work = state.importAudio();
      await Future<void>.delayed(Duration.zero);
      await state.connect(MediaApi(), isSample: false);
      await state.select('rec_sample1');
      final loading = state.loadAudio();
      await Future<void>.delayed(Duration.zero);
      expect(media.loads, 0);
      oldPicker.complete(null);
      await work;
      await loading;
      expect(media.loads, 1);
    },
  );

  test(
    'replacement audio waits for late native load and joined cleanup',
    () async {
      await open();
      media.pendingLoad = Completer();
      final gate = media.pendingLoad!;
      final oldLoad = state.loadAudio();
      await Future<void>.delayed(Duration.zero);
      expect(media.loads, 1);
      await state.select('rec_sample2');
      final resetCount = media.resets;
      final replacement = state.loadAudio();
      await Future<void>.delayed(Duration.zero);
      expect(media.loads, 1);
      gate.complete();
      await oldLoad;
      await replacement;
      expect(media.resets, greaterThan(resetCount));
      expect(media.loads, 2);
      expect(state.audioReady, true);
    },
  );
  test(
    'unknown upload remains locked without automatic or explicit resend',
    () async {
      await open();
      api.onUpload = () async =>
          throw const ApiException(0, 'outcome_unknown', 'Unknown');
      await state.importAudio();
      await state.importAudio();
      expect(api.uploads, 1);
      expect(state.locked('upload'), true);
    },
  );
  test(
    'completed upload refreshes library and permits a new explicit file',
    () async {
      await open();
      await state.importAudio();
      expect(api.uploads, 1);
      expect(state.operations.single.kind, 'upload');
      expect(state.locked('upload'), false);
    },
  );
  test(
    'late audio after selection change never reaches native decoder',
    () async {
      await open();
      api.pendingAudio = Completer();
      final work = state.loadAudio();
      await Future<void>.delayed(Duration.zero);
      await state.select('rec_sample2');
      api.pendingAudio!.complete(Uint8List(44));
      await work;
      expect(media.loads, 0);
      expect(state.audioReady, false);
    },
  );
  test('signout clears playback and fences late media bytes', () async {
    await open();
    api.pendingAudio = Completer();
    final work = state.loadAudio();
    await Future<void>.delayed(Duration.zero);
    final before = media.resets;
    state.signOut();
    api.pendingAudio!.complete(Uint8List(44));
    await work;
    expect(media.resets, greaterThan(before));
    expect(media.loads, 0);
    expect(state.audioReady, false);
  });
  test('loading never autoplays and back/refresh clear native media', () async {
    await open();
    await state.loadAudio();
    expect(state.audioReady, true);
    expect(media.plays, 0);
    await state.togglePlayback();
    expect(media.plays, 1);
    await state.refreshDetail();
    expect(state.audioReady, false);
    await state.loadAudio();
    state.leaveDetail();
    expect(state.audioReady, false);
  });
  test('failed cleanup blocks replacement media', () async {
    await open();
    media.failReset = true;
    state.stopAudio();
    await Future<void>.delayed(Duration.zero);
    await state.loadAudio();
    expect(state.mediaBlocked, true);
    expect(media.loads, 0);
  });

  test(
    'old play completion cannot overwrite a newer play after pause',
    () async {
      await open();
      await state.loadAudio();
      media.pendingPlay = Completer();
      final first = state.togglePlayback();
      expect(state.playing, true);
      await state.togglePlayback();
      expect(state.playing, false);
      final old = media.pendingPlay!;
      media.pendingPlay = Completer();
      final second = state.togglePlayback();
      old.complete();
      await first;
      expect(state.playing, true);
      media.pendingPlay!.complete();
      await second;
      expect(state.playing, false);
    },
  );
  test(
    'failed native playback retires the source before replacement',
    () async {
      await open();
      await state.loadAudio();
      final before = media.resets;
      media.failPlay = true;
      await state.togglePlayback();
      await Future<void>.delayed(Duration.zero);
      expect(state.audioReady, false);
      expect(state.playing, false);
      expect(media.resets, greaterThan(before));
    },
  );

  testWidgets(
    'phone UI imports, explicitly loads/plays and clears on signout',
    (tester) async {
      // Construct native drain Futures in the widget test's fake-async zone.
      state.dispose();
      state = RecordingsController(media: media);
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await state.connect(api, isSample: false);
      await tester.pumpWidget(RecordingsApp(controller: state));
      expect(state.canUseMedia, true);
      await tester.tap(find.text('Import audio'));
      await tester.pumpAndSettle();
      expect(api.uploads, 1);
      await tester.tap(find.text('Team catch-up'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Load audio'));
      await tester.pumpAndSettle();
      expect(media.loads, 1);
      expect(media.plays, 0);
      await tester.tap(find.byTooltip('Play audio'));
      await tester.pumpAndSettle();
      expect(media.plays, 1);
      await tester.tap(find.byTooltip('Sample settings'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      expect(state.signedIn, false);
      expect(state.audioReady, false);
      expect(
        find.text('Your recordings, transcripts and notes.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  test('sample mode never opens native picker or audio HTTP', () async {
    await state.connect(api, isSample: true);
    await state.select('rec_sample1');
    await state.importAudio();
    await state.loadAudio();
    expect(media.picks, 0);
    expect(api.uploads, 0);
    expect(api.reads, 0);
  });
}
