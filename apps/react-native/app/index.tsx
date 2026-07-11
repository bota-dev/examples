import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BotaClient,
  type ConnectedDevice,
  type DeviceRecording,
  type DeviceStatus,
  type DiscoveredDevice,
  type SyncProgress,
} from '@bota.dev/react-native-sdk';
import { getUploadInfo, registerDevice, requestRecordingGrant } from '@/src/api';

type SdkState = 'initializing' | 'ready' | 'bluetooth_off' | 'error';

export default function HomeScreen() {
  const [sdkState, setSdkState] = useState<SdkState>('initializing');
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<ConnectedDevice | null>(null);
  const [platformDeviceId, setPlatformDeviceId] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [recordings, setRecordings] = useState<DeviceRecording[]>([]);
  const [scanActive, setScanActive] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [recordingMessage, setRecordingMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function configure() {
      try {
        await BotaClient.configure({ environment: 'development', logLevel: 'debug' });
        if (!mounted) return;

        setSdkState(BotaClient.isBluetoothReady ? 'ready' : 'bluetooth_off');
        BotaClient.on('bluetoothStateChanged', (state) => {
          setSdkState(state === 'poweredOn' ? 'ready' : 'bluetooth_off');
        });
        BotaClient.devices.on('deviceDiscovered', (device) => {
          setDevices((current) => {
            const next = current.filter((item) => item.id !== device.id);
            return [...next, device].sort((a, b) => b.rssi - a.rssi);
          });
        });
        BotaClient.devices.on('scanStopped', () => setScanActive(false));
      } catch (error) {
        console.error(error);
        if (mounted) setSdkState('error');
      }
    }

    configure();

    return () => {
      mounted = false;
      BotaClient.destroy();
    };
  }, []);

  const statusText = useMemo(() => {
    if (sdkState === 'initializing') return 'Initializing SDK';
    if (sdkState === 'bluetooth_off') return 'Bluetooth is not ready';
    if (sdkState === 'error') return 'SDK failed to initialize';
    return connectedDevice ? `Connected to ${connectedDevice.serialNumber}` : 'Ready to scan';
  }, [connectedDevice, sdkState]);

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    setBusyLabel(label);
    try {
      return await fn();
    } catch (error) {
      Alert.alert(label, error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setBusyLabel(null);
    }
  }

  async function startScan() {
    if (sdkState !== 'ready') {
      Alert.alert('Bluetooth required', 'Enable Bluetooth before scanning.');
      return;
    }

    setDevices([]);
    setScanActive(true);
    await run('Scan failed', () => BotaClient.devices.startScan({ timeout: 10000 }));
  }

  function stopScan() {
    BotaClient.devices.stopScan();
    setScanActive(false);
  }

  async function connect(device: DiscoveredDevice) {
    const connected = await run('Connection failed', async () => {
      const result = await BotaClient.devices.connect(device);
      stopScan();
      return result;
    });

    if (!connected) return;
    setConnectedDevice(connected);
    setPlatformDeviceId(null);
    await refreshDevice(connected);
  }

  async function refreshDevice(device = connectedDevice) {
    if (!device) return;
    const result = await run('Refresh failed', async () => {
      const [status, deviceRecordings] = await Promise.all([
        BotaClient.devices.getStatus(device),
        BotaClient.recordings.listRecordings(device),
      ]);
      return { status, deviceRecordings };
    });

    if (!result) return;
    setDeviceStatus(result.status);
    setRecordings(result.deviceRecordings);
  }

  async function provision() {
    if (!connectedDevice) return;
    const result = await run('Provisioning failed', () =>
      registerDevice({
        serialNumber: connectedDevice.serialNumber,
        deviceType: connectedDevice.deviceType,
      })
    );

    if (!result) return;
    setPlatformDeviceId(result.deviceId);
    const provisioned = await run('Token write failed', async () => {
      await BotaClient.devices.provision(connectedDevice, result.token);
      return true;
    });
    if (!provisioned) return;
    Alert.alert('Provisioned', 'Device token was written over Bluetooth.');
  }

  async function startDeviceRecording() {
    if (!connectedDevice || !platformDeviceId) {
      Alert.alert('Provision first', 'Provision or register the device so the backend can issue recording grants.');
      return;
    }

    const result = await run('Start recording failed', () =>
      BotaClient.devices.requestStartRecording(connectedDevice, (nonce) =>
        requestRecordingGrant(platformDeviceId, nonce)
      )
    );

    if (!result) return;
    if (!result.success) {
      Alert.alert('Start recording failed', result.error ?? 'Device rejected the command.');
      return;
    }

    setRecordingMessage('Recording started on device.');
    await refreshDevice(connectedDevice);
  }

  async function stopDeviceRecording() {
    if (!connectedDevice || !platformDeviceId) {
      Alert.alert('Provision first', 'Provision or register the device so the backend can issue recording grants.');
      return;
    }

    const result = await run('Stop recording failed', () =>
      BotaClient.devices.requestStopRecording(connectedDevice, (nonce) =>
        requestRecordingGrant(platformDeviceId, nonce)
      )
    );

    if (!result) return;
    if (!result.success) {
      Alert.alert('Stop recording failed', result.error ?? 'Device rejected the command.');
      return;
    }

    setRecordingMessage('Recording stopped. Refresh or sync to see the saved file.');
    await refreshDevice(connectedDevice);
  }

  async function sync(recording: DeviceRecording) {
    if (!connectedDevice) return;

    setSyncProgress({ stage: 'preparing', progress: 0 });
    await run('Sync failed', async () => {
      const uploadInfo = await getUploadInfo(recording, connectedDevice);
      for await (const progress of BotaClient.recordings.syncRecording(
        connectedDevice,
        recording,
        uploadInfo
      )) {
        setSyncProgress(progress);
      }
      await refreshDevice(connectedDevice);
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bota SDK Example</Text>
          <Text style={styles.subtitle}>{statusText}</Text>
        </View>

        <View style={styles.actions}>
          <ActionButton title={scanActive ? 'Stop' : 'Scan'} onPress={scanActive ? stopScan : startScan} />
          <ActionButton title="Read Status" onPress={() => refreshDevice()} disabled={!connectedDevice} />
          <ActionButton title="Provision" onPress={provision} disabled={!connectedDevice} />
        </View>

        {busyLabel ? (
          <View style={styles.banner}>
            <ActivityIndicator />
            <Text style={styles.bannerText}>{busyLabel}</Text>
          </View>
        ) : null}

        {connectedDevice ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Connected Device</Text>
            <Text style={styles.muted}>Serial: {connectedDevice.serialNumber}</Text>
            {platformDeviceId ? <Text style={styles.muted}>Backend ID: {platformDeviceId}</Text> : null}
            <Text style={styles.muted}>Firmware: {connectedDevice.firmwareVersion}</Text>
            {deviceStatus ? (
              <View style={styles.statusGrid}>
                <StatusItem label="State" value={deviceStatus.state} />
                <StatusItem label="Battery" value={`${deviceStatus.batteryLevel}%`} />
                <StatusItem label="Storage" value={`${deviceStatus.storageUsedMb}/${deviceStatus.storageTotalMb} MB`} />
                <StatusItem label="Pending" value={String(deviceStatus.pendingRecordings)} />
                <StatusItem label="WiFi" value={deviceStatus.wifiStatus ?? 'unknown'} />
                <StatusItem label="LTE" value={deviceStatus.lteStatus ?? 'unknown'} />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Device Recording Control</Text>
          <Text style={styles.muted}>
            Uses a backend-issued recording grant, then writes the start/stop command over BLE.
          </Text>
          {recordingMessage ? <Text style={styles.successText}>{recordingMessage}</Text> : null}
          <View style={styles.actions}>
            <ActionButton title="Start Recording" onPress={startDeviceRecording} disabled={!connectedDevice} />
            <ActionButton title="Stop Recording" onPress={stopDeviceRecording} disabled={!connectedDevice} />
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Nearby Devices</Text>
          <FlatList
            scrollEnabled={false}
            data={devices}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.muted}>No devices found yet.</Text>}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => connect(item)}>
                <View>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.muted}>
                    {item.deviceType} · RSSI {item.rssi}
                  </Text>
                </View>
                <Text style={styles.link}>Connect</Text>
              </Pressable>
            )}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Device Recordings</Text>
          {syncProgress ? (
            <Text style={styles.muted}>
              Sync: {syncProgress.stage} {Math.round(syncProgress.progress * 100)}%
            </Text>
          ) : null}
          <FlatList
            scrollEnabled={false}
            data={recordings}
            keyExtractor={(item) => item.uuid}
            ListEmptyComponent={<Text style={styles.muted}>Connect and refresh to list recordings.</Text>}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => sync(item)}>
                <View style={styles.recordingText}>
                  <Text style={styles.rowTitle}>{item.uuid}</Text>
                  <Text style={styles.muted}>
                    {Math.round(item.durationMs / 1000)}s · {Math.round(item.fileSizeBytes / 1024)} KB
                  </Text>
                </View>
                <Text style={styles.link}>Sync</Text>
              </Pressable>
            )}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled ? styles.buttonDisabled : null]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusItem}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8f5',
  },
  container: {
    padding: 20,
    gap: 16,
  },
  header: {
    gap: 6,
    paddingVertical: 8,
  },
  title: {
    color: '#18201d',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#5c6962',
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  button: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#1f6f61',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    backgroundColor: '#e8f1ee',
    padding: 12,
  },
  bannerText: {
    color: '#24453e',
  },
  panel: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#d9dfd9',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 14,
  },
  panelTitle: {
    color: '#18201d',
    fontSize: 17,
    fontWeight: '700',
  },
  row: {
    minHeight: 64,
    borderTopWidth: 1,
    borderColor: '#eef1ee',
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowTitle: {
    color: '#18201d',
    fontSize: 15,
    fontWeight: '600',
  },
  recordingText: {
    flex: 1,
  },
  muted: {
    color: '#657169',
    fontSize: 13,
  },
  successText: {
    color: '#1f6f61',
    fontSize: 13,
    fontWeight: '600',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  statusItem: {
    width: '48%',
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#f3f6f3',
    padding: 10,
  },
  statusLabel: {
    color: '#657169',
    fontSize: 12,
  },
  statusValue: {
    color: '#18201d',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  link: {
    color: '#1f6f61',
    fontWeight: '700',
  },
});
