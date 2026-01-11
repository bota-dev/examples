import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Text, View } from '@/components/Themed';
import {
  BotaClient,
  type DiscoveredDevice,
  type ConnectedDevice,
} from '@bota-dev/react-native-sdk';

type SdkStatus = 'initializing' | 'ready' | 'error' | 'bluetooth_off';

export default function DevicesScreen() {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<ConnectedDevice | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [sdkStatus, setSdkStatus] = useState<SdkStatus>('initializing');

  useEffect(() => {
    initializeSdk();

    return () => {
      BotaClient.destroy();
    };
  }, []);

  const initializeSdk = async () => {
    try {
      await BotaClient.configure({
        environment: 'sandbox',
        logLevel: 'debug',
      });

      // Check bluetooth state
      if (!BotaClient.isBluetoothReady) {
        setSdkStatus('bluetooth_off');
      } else {
        setSdkStatus('ready');
      }

      // Listen for Bluetooth state changes
      BotaClient.on('bluetoothStateChanged', (state) => {
        if (state === 'poweredOn') {
          setSdkStatus('ready');
        } else if (state === 'poweredOff' || state === 'unauthorized') {
          setSdkStatus('bluetooth_off');
        }
      });

      // Listen for discovered devices
      BotaClient.devices.on('deviceDiscovered', (device: DiscoveredDevice) => {
        setDevices((prev) => {
          const exists = prev.find((d) => d.id === device.id);
          if (exists) return prev;
          return [...prev, device];
        });
      });

      BotaClient.devices.on('scanStopped', () => {
        setScanning(false);
      });

      BotaClient.devices.on('deviceDisconnected', (deviceId) => {
        if (connectedDevice?.id === deviceId) {
          setConnectedDevice(null);
        }
      });
    } catch (error: any) {
      console.error('SDK init error:', error);
      setSdkStatus('error');
    }
  };

  const startScan = async () => {
    if (sdkStatus !== 'ready') {
      Alert.alert('Bluetooth Required', 'Please enable Bluetooth to scan for devices.');
      return;
    }

    setScanning(true);
    setDevices([]);

    try {
      await BotaClient.devices.startScan({ timeout: 10000 });
    } catch (error: any) {
      Alert.alert('Scan Error', error.message);
      setScanning(false);
    }
  };

  const stopScan = () => {
    BotaClient.devices.stopScan();
    setScanning(false);
  };

  const connectDevice = async (device: DiscoveredDevice) => {
    if (connecting) return;

    setConnecting(device.id);
    try {
      const connected = await BotaClient.devices.connect(device);
      setConnectedDevice(connected);
      stopScan();

      // Navigate to device detail
      router.push({
        pathname: '/device/[id]',
        params: { id: device.id },
      });
    } catch (error: any) {
      Alert.alert('Connection Failed', error.message);
    } finally {
      setConnecting(null);
    }
  };

  const renderStatusBanner = () => {
    if (sdkStatus === 'initializing') {
      return (
        <View style={styles.banner}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.bannerText}>Initializing SDK...</Text>
        </View>
      );
    }

    if (sdkStatus === 'bluetooth_off') {
      return (
        <View style={[styles.banner, styles.bannerWarning]}>
          <Text style={styles.bannerText}>
            Bluetooth is off. Enable Bluetooth to scan for devices.
          </Text>
        </View>
      );
    }

    if (sdkStatus === 'error') {
      return (
        <View style={[styles.banner, styles.bannerError]}>
          <Text style={styles.bannerText}>SDK initialization failed</Text>
        </View>
      );
    }

    return null;
  };

  const renderDevice = ({ item }: { item: DiscoveredDevice }) => {
    const isConnecting = connecting === item.id;
    const isConnected = connectedDevice?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.deviceCard, isConnected && styles.deviceCardConnected]}
        onPress={() => connectDevice(item)}
        disabled={isConnecting || isConnected}
      >
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{item.name || 'Bota Device'}</Text>
          <Text style={styles.deviceType}>{item.deviceType}</Text>
          <Text style={styles.deviceId}>{item.id}</Text>
        </View>
        <View style={styles.deviceAction}>
          {isConnecting ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : isConnected ? (
            <Text style={styles.connectedBadge}>Connected</Text>
          ) : (
            <Text style={styles.connectText}>Connect</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      {scanning ? (
        <>
          <ActivityIndicator size="large" color="#007AFF" style={styles.scanningIndicator} />
          <Text style={styles.emptyTitle}>Scanning for devices...</Text>
          <Text style={styles.emptySubtitle}>
            Make sure your Bota device is powered on and nearby
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.emptyTitle}>No devices found</Text>
          <Text style={styles.emptySubtitle}>
            Tap "Scan" to search for nearby Bota devices
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {renderStatusBanner()}

      <View style={styles.header}>
        <Text style={styles.title}>Nearby Devices</Text>
        <TouchableOpacity
          style={[styles.scanButton, scanning && styles.scanButtonActive]}
          onPress={scanning ? stopScan : startScan}
          disabled={sdkStatus !== 'ready'}
        >
          <Text style={styles.scanButtonText}>
            {scanning ? 'Stop' : 'Scan'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderDevice}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={devices.length === 0 ? styles.listEmpty : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={startScan}
            tintColor="#007AFF"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#E8F4FD',
    gap: 8,
  },
  bannerWarning: {
    backgroundColor: '#FFF3CD',
  },
  bannerError: {
    backgroundColor: '#F8D7DA',
  },
  bannerText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scanButtonActive: {
    backgroundColor: '#FF3B30',
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 20,
  },
  listEmpty: {
    flex: 1,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  deviceCardConnected: {
    backgroundColor: '#D4EDDA',
    borderWidth: 1,
    borderColor: '#28A745',
  },
  deviceInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  deviceName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  deviceType: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  deviceId: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'SpaceMono',
  },
  deviceAction: {
    backgroundColor: 'transparent',
  },
  connectText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  connectedBadge: {
    color: '#28A745',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  scanningIndicator: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
});
