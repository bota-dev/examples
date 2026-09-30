import 'dart:async';

import 'package:bota_app_sdk/bota_app_sdk.dart';
// The published SDK's forTesting constructor accepts this test boundary.
// Production code only imports the public SDK barrel.
// ignore: implementation_imports
import 'package:bota_app_sdk/src/platform.dart';
import 'package:bota_connect/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

const _connected = BotaConnectedDevice(
  id: 'test-device',
  serialNumber: 'EXAMPLE123',
  deviceType: BotaDeviceType.botaPin,
  firmwareVersion: '1.0.19',
  isProvisioned: false,
  connectionState: BotaConnectionState.connected,
  mtu: 512,
);

const _status = BotaDeviceStatus(
  batteryLevel: 72,
  storageTotalMegabytes: 1024,
  storageUsedMegabytes: 0,
  state: BotaDeviceState.idle,
  pendingRecordings: 0,
  flags: BotaDeviceFlags(
    charging: false,
    lowBattery: false,
    storageFull: false,
    wifiConnected: false,
    lteConnected: false,
    syncActive: false,
  ),
  timestamp: 1,
  lteState: BotaLteState.off,
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(
      const MethodChannel('dev.fluttercommunity.plus/device_info'),
      (_) async => <String, Object>{
        'version': {
          'sdkInt': 36,
          'release': '16',
          'codename': 'REL',
          'incremental': '1',
        },
        for (final field in [
          'board',
          'bootloader',
          'brand',
          'device',
          'display',
          'fingerprint',
          'hardware',
          'host',
          'id',
          'manufacturer',
          'model',
          'product',
          'tags',
          'type',
        ])
          field: 'test',
        'isPhysicalDevice': false,
        'freeDiskSize': 1024,
        'totalDiskSize': 1024,
        'isLowRamDevice': false,
        'physicalRamSize': 1024,
        'availableRamSize': 1024,
      },
    );
    messenger.setMockMethodCallHandler(
      const MethodChannel('flutter.baseflow.com/permissions/methods'),
      (call) async => <int, int>{
        for (final permission in call.arguments as List<Object?>)
          permission! as int: 1,
      },
    );
  });

  testWidgets('late connect completion cannot restore a lost connection', (
    tester,
  ) async {
    final platform = await _prepare(tester);
    await _select(tester);
    platform.connection.add(_connected);
    await tester.pump();
    platform.connection.add(null);
    await tester.pump();
    platform.connectResult.complete(_connected);
    await tester.pumpAndSettle();

    _expectDisconnected(tester);
    expect(find.text('Verified serial: EXAMPLE123'), findsNothing);
    expect(
      find.text('Disconnected. Restore Bluetooth and reconnect.'),
      findsOneWidget,
    );
  });

  testWidgets('late status result cannot replace connection loss', (
    tester,
  ) async {
    final platform = await _prepare(tester);
    await _connect(tester, platform);
    await tester.tap(find.widgetWithText(FilledButton, 'Read status'));
    await tester.pump();
    platform.connection.add(null);
    await tester.pump();
    platform.statusResult.complete(_status);
    await tester.pumpAndSettle();

    _expectDisconnected(tester);
    expect(find.textContaining('Battery: 72%'), findsNothing);
    expect(
      find.text('Disconnected. Restore Bluetooth and reconnect.'),
      findsOneWidget,
    );
  });

  testWidgets('connection stream error invalidates a pending connect', (
    tester,
  ) async {
    final platform = await _prepare(tester);
    await _select(tester);
    platform.connection.addError(StateError('connection observation failed'));
    await tester.pump();
    platform.connectResult.complete(_connected);
    await tester.pumpAndSettle();
    _expectDisconnected(tester);
    expect(find.text('Connection lost. Scan to reconnect.'), findsOneWidget);
    expect(find.text('Verified serial: EXAMPLE123'), findsNothing);
  });

  for (final duringConnect in [true, false]) {
    testWidgets(
      'late ${duringConnect ? 'connect' : 'status'} failure preserves connection loss',
      (tester) async {
        final platform = await _prepare(tester);
        if (duringConnect) {
          await _select(tester);
          platform.connection.add(_connected);
          await tester.pump();
        } else {
          await _connect(tester, platform);
          await tester.tap(find.widgetWithText(FilledButton, 'Read status'));
          await tester.pump();
        }
        platform.connection.add(null);
        await tester.pump();
        if (duringConnect) {
          platform.connectResult.completeError(
            StateError('old connect failed'),
          );
        } else {
          platform.statusResult.completeError(StateError('old status failed'));
        }
        await tester.pumpAndSettle();
        _expectDisconnected(tester);
        expect(
          find.text('Disconnected. Restore Bluetooth and reconnect.'),
          findsOneWidget,
        );
        expect(find.textContaining('Operation failed.'), findsNothing);
      },
    );
  }

  testWidgets(
    'normal connection and explicit recovery still show fresh status',
    (tester) async {
      final platform = await _prepare(tester);
      await _connect(tester, platform);
      expect(find.text('Verified serial: EXAMPLE123'), findsOneWidget);
      platform.connection.add(null);
      await tester.pumpAndSettle();
      _expectDisconnected(tester);

      platform.connectResult = Completer<BotaConnectedDevice>();
      await _connect(tester, platform);
      await tester.tap(find.widgetWithText(FilledButton, 'Read status'));
      await tester.pump();
      platform.statusResult.complete(_status);
      await tester.pumpAndSettle();
      expect(find.textContaining('Battery: 72%'), findsOneWidget);
      expect(platform.serials, ['EXAMPLE123', 'EXAMPLE123']);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Read status'),
            )
            .onPressed,
        isNotNull,
      );
    },
  );
}

Future<_FakePlatform> _prepare(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1000, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final platform = _FakePlatform();
  await tester.pumpWidget(
    MaterialApp(
      home: ConnectPage(client: BotaDeviceClient.forTesting(platform)),
    ),
  );
  await tester.tap(find.text('Enable Bluetooth access'));
  await tester.pumpAndSettle();
  expect(find.text('Enter the exact printed serial and scan.'), findsOneWidget);
  await tester.enterText(find.byType(TextField), 'EXAMPLE123');
  await tester.tap(find.text('Scan for 10 seconds'));
  await tester.pumpAndSettle();
  expect(find.text('Bota test - -40 dBm'), findsOneWidget);
  return platform;
}

Future<void> _select(WidgetTester tester) async {
  await tester.tap(find.text('Bota test - -40 dBm'));
  await tester.pumpAndSettle();
}

Future<void> _connect(WidgetTester tester, _FakePlatform platform) async {
  await _select(tester);
  expect(platform.serials, isNotEmpty);
  platform.connection.add(_connected);
  platform.connectResult.complete(_connected);
  await tester.pumpAndSettle();
}

void _expectDisconnected(WidgetTester tester) {
  expect(
    tester
        .widget<FilledButton>(find.widgetWithText(FilledButton, 'Read status'))
        .onPressed,
    isNull,
  );
  expect(
    tester
        .widget<TextButton>(find.widgetWithText(TextButton, 'Disconnect'))
        .onPressed,
    isNull,
  );
  expect(
    tester
        .widget<FilledButton>(
          find.widgetWithText(FilledButton, 'Scan for 10 seconds'),
        )
        .onPressed,
    isNotNull,
  );
}

class _FakePlatform implements BotaPlatform {
  final connection = StreamController<BotaConnectedDevice?>.broadcast();
  late final StreamController<BotaDiscoveredDevice> discovery =
      StreamController<BotaDiscoveredDevice>(
        onCancel: () async {},
        onListen: () => discovery.add(
          BotaDiscoveredDevice(
            id: 'test-device',
            name: 'Bota test',
            rssi: -40,
            discoveredAt: DateTime.utc(2026),
          ),
        ),
      );
  var connectResult = Completer<BotaConnectedDevice>();
  final statusResult = Completer<BotaDeviceStatus>();
  final serials = <String?>[];

  @override
  Future<void> configure(BotaConfiguration configuration) async {}
  @override
  Future<void> destroy() async {
    await connection.close();
    await discovery.close();
  }

  @override
  Stream<BotaConnectedDevice?> get connections => connection.stream;
  @override
  Stream<BotaDiscoveredDevice> scan({
    Duration timeout = const Duration(seconds: 10),
    bool allowDuplicates = false,
  }) => discovery.stream;
  @override
  Future<BotaConnectedDevice> connect(
    BotaDiscoveredDevice device, {
    String? serialNumber,
  }) {
    serials.add(serialNumber);
    return connectResult.future;
  }

  @override
  Future<BotaDeviceStatus> readStatus() => statusResult.future;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
