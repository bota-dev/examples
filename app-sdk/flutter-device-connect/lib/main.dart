import 'dart:async';
import 'package:bota_app_sdk/bota_app_sdk.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

void main() => runApp(const MaterialApp(home: ConnectPage()));

class ConnectPage extends StatefulWidget {
  const ConnectPage({super.key});
  @override
  State<ConnectPage> createState() => _ConnectPageState();
}

class _ConnectPageState extends State<ConnectPage> {
  final client = BotaDeviceClient();
  final serial = TextEditingController();
  final devices = <String, BotaDiscoveredDevice>{};
  StreamSubscription<BotaConnectedDevice?>? connection;
  StreamSubscription<BotaDiscoveredDevice>? scan;
  BotaConnectedDevice? connected;
  bool ready = false;
  bool busy = false;
  String message = 'Read-only discovery and status. No API key required.';

  Future<void> run(Future<void> Function() action) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await action();
    } catch (_) {
      if (mounted) {
        setState(
          () => message =
              'Operation failed. Check Bluetooth, permissions, and exact serial.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> initialize() async {
    final info = await DeviceInfoPlugin().androidInfo;
    final permissions = info.version.sdkInt >= 31
        ? [Permission.bluetoothScan, Permission.bluetoothConnect]
        : [Permission.locationWhenInUse];
    final grants = await permissions.request();
    if (grants.values.any((status) => !status.isGranted)) {
      if (mounted) {
        setState(
          () => message = 'Grant Bluetooth access in Settings, then retry.',
        );
      }
      return;
    }
    if (!mounted) return;
    await client.configure();
    if (!mounted) {
      await client.destroy();
      return;
    }
    connection = client.devices.connections.listen(
      (device) {
        if (mounted) setState(() => connected = device);
      },
      onError: (Object error) {
        if (mounted) {
          setState(() {
            connected = null;
            message = 'Connection lost. Scan to reconnect.';
          });
        }
      },
    );
    setState(() {
      ready = true;
      message = 'Enter the exact printed serial and scan.';
    });
  }

  Future<void> startScan() async {
    await scan?.cancel();
    if (!mounted) return;
    setState(() {
      devices.clear();
      message = 'Scanning for ten seconds...';
    });
    scan = client.devices.scan().listen(
      (device) {
        if (mounted) setState(() => devices[device.id] = device);
      },
      onError: (Object error) {
        if (mounted) {
          setState(
            () => message = 'Scan failed. Check Bluetooth and permissions.',
          );
        }
      },
      onDone: () {
        if (mounted) {
          setState(() => message = 'Scan finished. Select a device.');
        }
      },
    );
  }

  @override
  void dispose() {
    unawaited(scan?.cancel());
    unawaited(connection?.cancel());
    unawaited(client.destroy());
    serial.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Connect to Bota')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        TextField(
          controller: serial,
          enabled: !busy && connected == null,
          decoration: const InputDecoration(
            labelText: 'Exact serial printed on device',
          ),
        ),
        FilledButton(
          onPressed: busy || ready ? null : () => run(initialize),
          child: const Text('Enable Bluetooth access'),
        ),
        FilledButton(
          onPressed: busy || !ready || connected != null
              ? null
              : () => run(startScan),
          child: const Text('Scan for 10 seconds'),
        ),
        if (connected == null)
          ...devices.values.map(
            (candidate) => TextButton(
              onPressed: busy
                  ? null
                  : () => run(() async {
                      final expected = serial.text.trim();
                      if (expected.isEmpty) {
                        setState(
                          () =>
                              message = 'Enter the exact device serial first.',
                        );
                        return;
                      }
                      await scan?.cancel();
                      if (!mounted) return;
                      final device = await client.devices.connect(
                        candidate,
                        serialNumber: expected,
                      );
                      if (mounted) {
                        setState(() {
                          connected = device;
                          message = 'Verified serial: ${device.serialNumber}';
                        });
                      }
                    }),
              child: Text(
                '${candidate.name ?? 'Bota device'} - ${candidate.rssi} dBm',
              ),
            ),
          ),
        FilledButton(
          onPressed: busy || connected == null
              ? null
              : () => run(() async {
                  final status = await client.devices.readStatus();
                  if (mounted) {
                    setState(
                      () => message =
                          'Battery: ${status.batteryLevel}%\nState: ${status.state}\nPending recordings: ${status.pendingRecordings}',
                    );
                  }
                }),
          child: const Text('Read status'),
        ),
        TextButton(
          onPressed: busy || connected == null
              ? null
              : () => run(() async {
                  try {
                    await client.devices.disconnect();
                  } finally {
                    if (mounted) setState(() => connected = null);
                  }
                  if (mounted) setState(() => message = 'Disconnected.');
                }),
          child: const Text('Disconnect'),
        ),
        SelectableText(message),
      ],
    ),
  );
}
