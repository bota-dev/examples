import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import {
  BotaClient,
  type DiscoveredDevice,
  type ConnectedDevice,
} from '@bota-dev/react-native-sdk';

export default function DevicesScreen() {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connected, setConnected] = useState<ConnectedDevice | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Initialize the SDK
    const init = async () => {
      try {
        await BotaClient.configure({
          environment: 'sandbox',
          logLevel: 'debug',
        });
        setInitialized(true);

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
      } catch (error: any) {
        Alert.alert('SDK Error', error.message);
      }
    };

    init();

    return () => {
      BotaClient.destroy();
    };
  }, []);

  const startScan = async () => {
    if (!initialized) {
      Alert.alert('Error', 'SDK not initialized');
      return;
    }

    setScanning(true);
    setDevices([]);

    try {
      await BotaClient.devices.startScan();
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
    try {
      const connectedDevice = await BotaClient.devices.connect(device);
      setConnected(connectedDevice);
      Alert.alert('Connected', `Connected to ${device.name || device.id}`);
    } catch (error: any) {
      Alert.alert('Connection Error', error.message);
    }
  };

  const disconnectDevice = async () => {
    if (connected) {
      await BotaClient.devices.disconnect(connected);
      setConnected(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bota Devices</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, scanning && styles.buttonActive]}
          onPress={scanning ? stopScan : startScan}
          disabled={!initialized}
        >
          <Text style={styles.buttonText}>
            {scanning ? 'Stop Scan' : 'Scan for Devices'}
          </Text>
        </TouchableOpacity>

        {connected && (
          <TouchableOpacity
            style={[styles.button, styles.disconnectButton]}
            onPress={disconnectDevice}
          >
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      {!initialized && (
        <Text style={styles.initText}>Initializing SDK...</Text>
      )}

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        style={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.deviceItem,
              connected?.id === item.id && styles.deviceConnected
            ]}
            onPress={() => connectDevice(item)}
          >
            <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
            <Text style={styles.deviceId}>{item.id}</Text>
            <Text style={styles.deviceType}>{item.deviceType}</Text>
            {connected?.id === item.id && (
              <Text style={styles.connectedLabel}>Connected</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {scanning ? 'Scanning...' : 'No devices found. Tap "Scan for Devices" to start.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: '80%',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonActive: {
    backgroundColor: '#FF3B30',
  },
  disconnectButton: {
    backgroundColor: '#8E8E93',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  initText: {
    color: '#666',
    marginBottom: 10,
  },
  list: {
    width: '100%',
    paddingHorizontal: 20,
  },
  deviceItem: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 10,
  },
  deviceConnected: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
    borderWidth: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  deviceType: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  connectedLabel: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '600',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 40,
  },
});
