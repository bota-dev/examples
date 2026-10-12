import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_recordings_flutter/main.dart';
import 'package:mobile_recordings_flutter/recordings_controller.dart';
import 'package:mobile_recordings_flutter/sample_api.dart';

void main() {
  testWidgets(
    'local sample journey uses no permission channels and clears on signout',
    (tester) async {
      var permissionCalls = 0;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('flutter.baseflow.com/permissions/methods'),
            (_) async {
              permissionCalls++;
              return {};
            },
          );
      await tester.pumpWidget(const RecordingsApp());
      await tester.tap(find.text('Try sample recordings'));
      await tester.pumpAndSettle();
      expect(find.text('Sample'), findsOneWidget);
      expect(find.text('Team catch-up'), findsOneWidget);
      await tester.tap(find.text('Team catch-up'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Create transcript'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Alex will draft'), findsOneWidget);
      await tester.tap(find.text('Summary'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Create summary'));
      await tester.pumpAndSettle();
      expect(
        find.text('The team agreed on release notes and a Friday review.'),
        findsOneWidget,
      );
      await tester.tap(find.text('Ask').first);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'What next?');
      await tester.pump();
      await tester.tap(find.widgetWithText(FilledButton, 'Ask'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('This answer is a local sample fixture.'),
        findsOneWidget,
      );
      expect(find.text('Source: 0:12 in this recording'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'A different question?');
      await tester.pump();
      expect(
        find.textContaining('This answer is a local sample fixture.'),
        findsNothing,
      );
      await tester.tap(find.byTooltip('Sample settings'));
      await tester.pumpAndSettle();
      expect(find.text('Device connection'), findsNothing);
      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      expect(find.text('Try sample recordings'), findsOneWidget);
      expect(
        find.textContaining('This answer is a local sample fixture.'),
        findsNothing,
      );
      expect(permissionCalls, 0);
    },
  );

  testWidgets('phone-size library and detail retain readable navigation', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const RecordingsApp());
    await tester.tap(find.text('Try sample recordings'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Team catch-up'));
    await tester.pumpAndSettle();
    expect(find.text('Transcript'), findsOneWidget);
    expect(find.text('Summary'), findsOneWidget);
    expect(find.text('Ask'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.byTooltip('Back to recordings'));
    await tester.pumpAndSettle();
    expect(find.text('All recordings'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('external session expiry replaces detail and hides old content', (
    tester,
  ) async {
    final state = RecordingsController();
    addTearDown(state.dispose);
    await state.connect(SampleApi(), isSample: true);
    await state.select('rec_sample1');
    await state.transcribe();
    await tester.pumpWidget(RecordingsApp(controller: state));
    await tester.pumpAndSettle();
    expect(find.textContaining('Alex will draft'), findsOneWidget);
    state.signOut();
    await tester.pumpAndSettle();
    expect(find.textContaining('Alex will draft'), findsNothing);
    expect(find.text('Try sample recordings'), findsOneWidget);
  });
}
