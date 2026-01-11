import { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Text, View } from '@/components/Themed';
import {
  BotaClient,
  type ConnectedDevice,
  type DeviceStatus,
} from '@bota-dev/react-native-sdk';

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [device, setDevice] = useState<ConnectedDevice | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    loadDevice();

    return () => {
      // Cleanup status subscription if any
    };
  }, [id]);

  const loadDevice = async () => {
    try {
      // Find connected device
      const connectedDevices = BotaClient.devices.getConnectedDevices();
      const found = connectedDevices.find((d) => d.id === id);

      if (found) {
        setDevice(found);
        await loadStatus(found);
      } else {
        Alert.alert('Error', 'Device not found');
        router.back();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async (dev: ConnectedDevice) => {
    try {
      const deviceStatus = await BotaClient.devices.getStatus(dev);
      setStatus(deviceStatus);

      // Subscribe to status updates
      BotaClient.devices.subscribeToStatus(dev, (newStatus) => {
        setStatus(newStatus);
      });
    } catch (error: any) {
      console.log('Could not load status:', error.message);
    }
  };

  const handleDisconnect = async () => {
    if (!device) return;

    setDisconnecting(true);
    try {
      await BotaClient.devices.disconnect(device);
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setDisconnecting(false);
    }
  };

  const handleProvision = () => {
    // This shows the pattern - actual provisioning requires a device token from your backend
    Alert.alert(
      'Provisioning',
      'To provision this device, you need a device token from your backend.\n\n' +
        'Example code:\n\n' +
        '// Get token from your backend\n' +
        'const token = await api.getDeviceToken(userId);\n\n' +
        '// Provision device\n' +
        "await BotaClient.devices.provision(device, token, 'production');",
      [{ text: 'OK' }]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!device) {
    return null;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: device.serialNumber || 'Device',
          headerBackTitle: 'Devices',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Device Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Information</Text>
          <View style={styles.card}>
            <InfoRow label="Serial Number" value={device.serialNumber} mono />
            <InfoRow label="Device Type" value={device.deviceType} />
            <InfoRow label="Firmware" value={device.firmwareVersion} />
            {device.hardwareRevision && (
              <InfoRow label="Hardware" value={device.hardwareRevision} />
            )}
            <InfoRow
              label="Provisioned"
              value={device.isProvisioned ? 'Yes' : 'No'}
              valueColor={device.isProvisioned ? '#28A745' : '#FF9500'}
            />
          </View>
        </View>

        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Status</Text>
          <View style={styles.card}>
            {status ? (
              <>
                <InfoRow
                  label="Battery"
                  value={`${status.batteryLevel}%`}
                  valueColor={status.batteryLevel < 20 ? '#FF3B30' : '#28A745'}
                />
                <InfoRow
                  label="Recording"
                  value={status.isRecording ? 'Yes' : 'No'}
                  valueColor={status.isRecording ? '#FF9500' : undefined}
                />
                {status.storageUsed !== undefined && status.storageTotal !== undefined && (
                  <InfoRow
                    label="Storage"
                    value={`${Math.round(status.storageUsed / 1024 / 1024)}MB / ${Math.round(status.storageTotal / 1024 / 1024)}MB`}
                  />
                )}
              </>
            ) : (
              <Text style={styles.noStatus}>Status not available</Text>
            )}
          </View>
        </View>

        {/* Provisioning Section */}
        {!device.isProvisioned && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Setup</Text>
            <View style={styles.card}>
              <Text style={styles.provisionText}>
                This device is not provisioned. To complete setup, provision it with a device
                token from your backend.
              </Text>
              <TouchableOpacity style={styles.provisionButton} onPress={handleProvision}>
                <Text style={styles.provisionButtonText}>How to Provision</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Code Example Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SDK Code Example</Text>
          <View style={styles.codeCard}>
            <Text style={styles.codeText}>
              {`// Connect to device
const device = await BotaClient.devices.connect(discoveredDevice);

// Read device status
const status = await BotaClient.devices.getStatus(device);
console.log('Battery:', status.batteryLevel);

// Subscribe to status updates
BotaClient.devices.subscribeToStatus(device, (status) => {
  console.log('Status updated:', status);
});

// Provision (requires backend token)
// const token = await yourBackend.getDeviceToken();
// await BotaClient.devices.provision(device, token, 'production');`}
            </Text>
          </View>
        </View>

        {/* Disconnect Button */}
        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={handleDisconnect}
          disabled={disconnecting}
        >
          {disconnecting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

function InfoRow({
  label,
  value,
  mono,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          mono && styles.infoValueMono,
          valueColor && { color: valueColor },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    backgroundColor: 'transparent',
  },
  infoLabel: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  infoValue: {
    fontSize: 15,
    color: '#666666',
  },
  infoValueMono: {
    fontFamily: 'SpaceMono',
    fontSize: 13,
  },
  noStatus: {
    fontSize: 15,
    color: '#999999',
    fontStyle: 'italic',
  },
  provisionText: {
    fontSize: 15,
    color: '#666666',
    lineHeight: 22,
    marginBottom: 16,
  },
  provisionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  provisionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  codeCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  codeText: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    color: '#E8E8E8',
    lineHeight: 20,
  },
  disconnectButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  disconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
