/**
 * Device Page - Connected device details and actions
 */

import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {Stack, router, useLocalSearchParams} from 'expo-router';

import {
  BotaClient,
  type DeviceStatus,
} from '@bota/react-native-sdk';
import {useBota} from '../src/context/BotaContext';

export default function DeviceScreen() {
  const {connectedDevice, disconnect} = useBota();
  const params = useLocalSearchParams();

  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const device = connectedDevice;

  useEffect(() => {
    if (!device) {
      router.replace('/home');
      return;
    }

    // Subscribe to status updates
    const unsubscribe = BotaClient.devices.subscribeToStatus(device, newStatus => {
      setStatus(newStatus);
    });

    // Fetch initial status
    fetchStatus();

    return () => {
      unsubscribe();
    };
  }, [device]);

  async function fetchStatus() {
    if (!device) return;
    try {
      const currentStatus = await BotaClient.devices.getStatus(device);
      setStatus(currentStatus);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  }, []);

  async function handleDisconnect() {
    Alert.alert(
      'Disconnect Device',
      'Are you sure you want to disconnect from this device?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnect();
              router.replace('/home');
            } catch (err) {
              const message =
                err instanceof Error ? err.message : 'Disconnect failed';
              Alert.alert('Error', message);
            }
          },
        },
      ],
    );
  }

  function handleViewRecordings() {
    if (device) {
      router.push({
        pathname: '/recordings',
        params: {deviceId: device.id},
      });
    }
  }

  function getBatteryColor(level: number): string {
    if (level > 50) return '#34C759';
    if (level > 20) return '#FF9500';
    return '#FF3B30';
  }

  function formatStorageSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(0)} MB`;
  }

  if (!device) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{title: 'Device'}} />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* Device Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Device Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{device.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>{device.deviceType}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Serial Number</Text>
            <Text style={styles.infoValue}>{device.serialNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Firmware</Text>
            <Text style={styles.infoValue}>{device.firmwareVersion}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Provisioned</Text>
            <Text style={styles.infoValue}>
              {device.isProvisioned ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>

        {/* Status Card */}
        {status && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Device Status</Text>

            {/* Battery */}
            <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>Battery</Text>
              <View style={styles.batteryContainer}>
                <View style={styles.batteryOuter}>
                  <View
                    style={[
                      styles.batteryInner,
                      {
                        width: `${status.batteryLevel}%`,
                        backgroundColor: getBatteryColor(status.batteryLevel),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.batteryText}>{status.batteryLevel}%</Text>
                {status.isCharging && (
                  <Text style={styles.chargingText}>Charging</Text>
                )}
              </View>
            </View>

            {/* Storage */}
            <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>Storage</Text>
              <View style={styles.storageContainer}>
                <View style={styles.storageOuter}>
                  <View
                    style={[
                      styles.storageInner,
                      {
                        width: `${
                          ((status.storageTotal - status.storageAvailable) /
                            status.storageTotal) *
                          100
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.storageText}>
                  {formatStorageSize(status.storageAvailable)} available of{' '}
                  {formatStorageSize(status.storageTotal)}
                </Text>
              </View>
            </View>

            {/* Recording Count */}
            <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>Recordings</Text>
              <Text style={styles.recordingCount}>
                {status.recordingCount} recording
                {status.recordingCount !== 1 ? 's' : ''} on device
              </Text>
            </View>

            {/* Recording State */}
            <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>Recording State</Text>
              <View style={styles.stateRow}>
                <View
                  style={[
                    styles.stateDot,
                    status.isRecording ? styles.stateRecording : styles.stateIdle,
                  ]}
                />
                <Text style={styles.stateText}>
                  {status.isRecording ? 'Recording' : 'Idle'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsCard}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleViewRecordings}>
            <Text style={styles.actionButtonText}>View Recordings</Text>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.disconnectButton]}
            onPress={handleDisconnect}>
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statusSection: {
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryOuter: {
    flex: 1,
    height: 20,
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  batteryInner: {
    height: '100%',
    borderRadius: 10,
  },
  batteryText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 40,
  },
  chargingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#34C759',
  },
  storageContainer: {},
  storageOuter: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  storageInner: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  storageText: {
    fontSize: 12,
    color: '#666',
  },
  recordingCount: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  stateRecording: {
    backgroundColor: '#FF3B30',
  },
  stateIdle: {
    backgroundColor: '#34C759',
  },
  stateText: {
    fontSize: 14,
    color: '#333',
  },
  actionsCard: {
    margin: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  actionButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  actionChevron: {
    fontSize: 24,
    color: '#999',
  },
  disconnectButton: {
    justifyContent: 'center',
  },
  disconnectButtonText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },
});
