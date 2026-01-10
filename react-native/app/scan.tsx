/**
 * Scan Page - Device discovery and connection
 */

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {Stack, router} from 'expo-router';

import {
  BotaClient,
  type DiscoveredDevice,
} from '@bota/react-native-sdk';
import {useBota} from '../src/context/BotaContext';
import {useAuth} from '../src/context/AuthContext';
import {registerDevice} from '../src/api/backend';

export default function ScanScreen() {
  const {user} = useAuth();
  const {
    isScanning,
    discoveredDevices,
    startScan,
    stopScan,
    connect,
    isConnecting,
    error,
    clearError,
  } = useBota();

  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(
    null,
  );
  const [provisioningStatus, setProvisioningStatus] = useState<string | null>(
    null,
  );

  useEffect(() => {
    // Start scanning when screen mounts
    startScan();

    return () => {
      // Stop scanning when screen unmounts
      stopScan();
    };
  }, [startScan, stopScan]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{text: 'OK', onPress: clearError}]);
    }
  }, [error, clearError]);

  async function handleDevicePress(device: DiscoveredDevice) {
    if (isConnecting) return;

    setConnectingDeviceId(device.id);
    stopScan();

    try {
      // Connect to the device
      setProvisioningStatus('Connecting...');
      const connectedDevice = await connect(device);

      // Check if provisioning is needed
      if (!connectedDevice.isProvisioned) {
        setProvisioningStatus('Registering device...');

        // Register device with our backend
        const {deviceToken} = await registerDevice({
          serialNumber: connectedDevice.serialNumber,
          deviceType: connectedDevice.deviceType,
          firmwareVersion: connectedDevice.firmwareVersion,
          endUserId: user?.id || 'demo_user',
        });

        // Provision the device with the token
        setProvisioningStatus('Provisioning device...');
        await BotaClient.devices.provision(
          connectedDevice,
          deviceToken,
          'sandbox', // Use sandbox for demo
        );

        setProvisioningStatus('Device ready!');
      }

      // Subscribe to status updates
      BotaClient.devices.subscribeToStatus(connectedDevice, status => {
        console.log('Device status:', status);
      });

      // Navigate to home screen
      setTimeout(() => {
        router.replace('/home');
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      Alert.alert('Connection Error', message);
    } finally {
      setConnectingDeviceId(null);
      setProvisioningStatus(null);
    }
  }

  function renderDevice({item}: {item: DiscoveredDevice}) {
    const isConnectingThis = connectingDeviceId === item.id;

    return (
      <TouchableOpacity
        style={[styles.deviceCard, isConnectingThis && styles.deviceCardActive]}
        onPress={() => handleDevicePress(item)}
        disabled={isConnecting}>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{item.name}</Text>
          <Text style={styles.deviceType}>{item.deviceType}</Text>
          <View style={styles.deviceMeta}>
            <Text style={styles.metaText}>FW: {item.firmwareVersion}</Text>
            <Text style={styles.metaText}>RSSI: {item.rssi} dBm</Text>
          </View>
          <View style={styles.deviceStatus}>
            <View
              style={[
                styles.statusDot,
                item.pairingState === 'paired'
                  ? styles.statusPaired
                  : styles.statusUnpaired,
              ]}
            />
            <Text style={styles.statusLabel}>
              {item.pairingState === 'paired' ? 'Previously Paired' : 'New Device'}
            </Text>
          </View>
        </View>
        {isConnectingThis ? (
          <View style={styles.connectingContainer}>
            <ActivityIndicator color="#007AFF" />
            {provisioningStatus && (
              <Text style={styles.connectingText}>{provisioningStatus}</Text>
            )}
          </View>
        ) : (
          <Text style={styles.chevron}>›</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <>
      <Stack.Screen options={{title: 'Scan for Devices'}} />
      <View style={styles.container}>
        {/* Scanning status */}
        <View style={styles.header}>
          {isScanning ? (
            <View style={styles.scanningRow}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.scanningText}>Scanning for devices...</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.rescanButton} onPress={startScan}>
              <Text style={styles.rescanText}>Tap to scan again</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Device list */}
        {discoveredDevices.length > 0 ? (
          <FlatList
            data={discoveredDevices}
            keyExtractor={item => item.id}
            renderItem={renderDevice}
            contentContainerStyle={styles.list}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No devices found</Text>
            <Text style={styles.emptyText}>
              Make sure your Bota device is powered on and nearby.
            </Text>
          </View>
        )}

        {/* Cancel button when connecting */}
        {isConnecting && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setConnectingDeviceId(null);
              setProvisioningStatus(null);
            }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  rescanButton: {
    alignItems: 'center',
  },
  rescanText: {
    fontSize: 14,
    color: '#007AFF',
  },
  list: {
    padding: 16,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceCardActive: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deviceType: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  deviceMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  deviceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusPaired: {
    backgroundColor: '#34C759',
  },
  statusUnpaired: {
    backgroundColor: '#FF9500',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
  },
  chevron: {
    fontSize: 24,
    color: '#999',
  },
  connectingContainer: {
    alignItems: 'center',
  },
  connectingText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  cancelButton: {
    position: 'absolute',
    bottom: 32,
    left: 32,
    right: 32,
    height: 48,
    backgroundColor: '#FF3B30',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
