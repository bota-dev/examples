import 'dart:async';
import 'package:bota_app_sdk/bota_app_sdk.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, TargetPlatform;
import 'package:permission_handler/permission_handler.dart';

void main() => runApp(const MaterialApp(home: ConnectPage()));

class ConnectPage extends StatefulWidget {
  const ConnectPage({super.key, this.client, this.onCleanup});
  final BotaDeviceClient? client;
  final void Function(Future<void>)? onCleanup;
  @override
  State<ConnectPage> createState() => _ConnectPageState();
}

class _ConnectPageState extends State<ConnectPage> {
  late final client = widget.client ?? BotaDeviceClient();
  final serial = TextEditingController();
  final devices = <String, BotaDiscoveredDevice>{};
  StreamSubscription<BotaConnectedDevice?>? connection;
  StreamSubscription<BotaDiscoveredDevice>? scan;
  BotaConnectedDevice? connected;
  bool ready = false;
  bool busy = false;
  bool closing = false;
  bool allowPop = false;
  bool observationEnded = false;
  bool cleanupFailed = false;
  bool closed = false;
  Future<void>? configuring;
  Future<void>? cleanup;
  int connectionEpoch = 0;
  String message = 'Read-only discovery and status. No API key required.';

  Future<void> run(Future<void> Function() action) async {
    if (busy || closing || observationEnded) return;
    final epoch = connectionEpoch;
    setState(() => busy = true);
    try {
      await action();
    } catch (_) {
      if (mounted && !closing && epoch == connectionEpoch) {
        setState(
          () => message =
              'Operation failed. Check Bluetooth, permissions, and exact serial.',
        );
      }
    } finally {
      if (mounted && !closing) setState(() => busy = false);
    }
  }

  Future<void> initialize() async {
    if (observationEnded || closing) return;
    final List<Permission> permissions;
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      permissions = [Permission.bluetooth];
    } else if (defaultTargetPlatform == TargetPlatform.android) {
      final info = await DeviceInfoPlugin().androidInfo;
      permissions = info.version.sdkInt >= 31
          ? [Permission.bluetoothScan, Permission.bluetoothConnect]
          : [Permission.locationWhenInUse];
    } else {
      throw UnsupportedError('Use the Android or iOS host.');
    }
    if (!mounted || closing) return;
    final grants = await permissions.request();
    if (grants.values.any((status) => !status.isGranted)) {
      if (mounted && !closing) {
        setState(
          () => message = 'Grant Bluetooth access in Settings, then retry.',
        );
      }
      return;
    }
    if (!mounted || closing) return;
    configuring = client.configure();
    await configuring;
    if (!mounted || closing) return;
    connection = client.devices.connections.listen(
      (device) {
        if (mounted && !closing) {
          setState(() {
            if (device == null || device.id != connected?.id) connectionEpoch++;
            if (connected != null && device == null) {
              message = 'Disconnected. Restore Bluetooth and reconnect.';
            }
            if (device != null) {
              message = 'Verified serial: ${device.serialNumber}';
            }
            connected = device;
          });
        }
      },
      onError: (Object error) {
        if (mounted && !closing) {
          setState(() {
            connectionEpoch++;
            connected = null;
            message = 'Connection lost. Scan to reconnect.';
          });
        }
      },
      onDone: () {
        if (mounted && !closing) {
          setState(() {
            connectionEpoch++;
            connected = null;
            ready = false;
            observationEnded = true;
            devices.clear();
            message =
                'Connection observation ended. Leave this screen before connecting again.';
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
    if (!mounted || closing || !ready || observationEnded) return;
    setState(() {
      devices.clear();
      message = 'Scanning for ten seconds...';
    });
    scan = client.devices.scan().listen(
      (device) {
        if (mounted && !closing && ready && !observationEnded) {
          setState(() => devices[device.id] = device);
        }
      },
      onError: (Object error) {
        if (mounted && !closing && ready && !observationEnded) {
          setState(
            () => message = 'Scan failed. Check Bluetooth and permissions.',
          );
        }
      },
      onDone: () {
        if (mounted && !closing && ready && !observationEnded) {
          setState(() => message = 'Scan finished. Select a device.');
        }
      },
    );
  }

  @override
  void dispose() {
    unawaited(closeClient().catchError((Object _) {}));
    serial.dispose();
    super.dispose();
  }

  Future<void> closeClient() {
    if (cleanup != null) return cleanup!;
    closing = true;
    connectionEpoch++;
    connected = null;
    cleanup = () async {
      try {
        await scan?.cancel();
      } catch (_) {}
      try {
        await connection?.cancel();
      } catch (_) {}
      try {
        await configuring;
      } catch (_) {}
      await client.destroy();
    }();
    widget.onCleanup?.call(cleanup!);
    return cleanup!;
  }

  Future<void> leave() async {
    if (closing) return;
    setState(() => busy = true);
    try {
      await closeClient();
    } catch (_) {
      if (mounted) {
        setState(() {
          cleanupFailed = true;
          message =
              'Device cleanup did not complete. Restart the sample before connecting again.';
        });
      }
      return;
    }
    finishLeave();
  }

  void finishLeave() {
    if (!mounted) return;
    if (!Navigator.of(context).canPop()) {
      setState(() => closed = true);
      return;
    }
    setState(() => allowPop = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.of(context).pop();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (closed) {
      return Scaffold(
        appBar: null,
        body: SafeArea(
          child: Center(
            child: Text(
              cleanupFailed
                  ? 'Device cleanup did not complete. Relaunch the sample before connecting again.'
                  : 'Device connection closed. Relaunch the sample to connect again.',
            ),
          ),
        ),
      );
    }
    return PopScope(
      canPop: allowPop,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(leave());
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Device connection'),
          leading: IconButton(
            tooltip: 'Close connection',
            onPressed: closing ? null : leave,
            icon: const Icon(Icons.arrow_back),
          ),
        ),
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
              onPressed: busy || ready || observationEnded
                  ? null
                  : () => run(initialize),
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
                  onPressed: busy || !ready || observationEnded
                      ? null
                      : () => run(() async {
                          final expected = serial.text.trim();
                          if (expected.isEmpty) {
                            setState(
                              () => message =
                                  'Enter the exact device serial first.',
                            );
                            return;
                          }
                          await scan?.cancel();
                          if (!mounted ||
                              closing ||
                              !ready ||
                              observationEnded) {
                            return;
                          }
                          final epoch = connectionEpoch;
                          final device = await client.devices.connect(
                            candidate,
                            serialNumber: expected,
                          );
                          if (mounted && epoch == connectionEpoch) {
                            setState(() {
                              connected = device;
                              message =
                                  'Verified serial: ${device.serialNumber}';
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
                      final epoch = connectionEpoch;
                      final status = await client.devices.readStatus();
                      if (mounted && epoch == connectionEpoch) {
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
            if (cleanupFailed)
              TextButton(
                onPressed: finishLeave,
                child: const Text('Close connection'),
              ),
          ],
        ),
      ),
    );
  }
}
