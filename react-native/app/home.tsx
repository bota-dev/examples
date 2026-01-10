/**
 * Home Page
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {Stack, router} from 'expo-router';

import {useBota} from '../src/context/BotaContext';
import {useAuth} from '../src/context/AuthContext';

export default function HomeScreen() {
  const {user, logout} = useAuth();
  const {
    bluetoothState,
    isBluetoothReady,
    connectedDevice,
    deviceStatus,
    disconnect,
  } = useBota();

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <>
      <Stack.Screen options={{title: 'Bota Demo'}} />
      <ScrollView style={styles.container}>
        {/* User Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Signed in as</Text>
            <Text style={styles.value}>{user?.email}</Text>
            <TouchableOpacity style={styles.linkButton} onPress={handleLogout}>
              <Text style={styles.linkButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bluetooth Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bluetooth</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Status</Text>
              <View
                style={[
                  styles.statusBadge,
                  isBluetoothReady ? styles.statusOn : styles.statusOff,
                ]}>
                <Text style={styles.statusText}>
                  {isBluetoothReady ? 'Ready' : bluetoothState}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Connected Device */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device</Text>
          {connectedDevice ? (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Serial</Text>
                <Text style={styles.value}>{connectedDevice.serialNumber}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Type</Text>
                <Text style={styles.value}>{connectedDevice.deviceType}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Firmware</Text>
                <Text style={styles.value}>{connectedDevice.firmwareVersion}</Text>
              </View>
              {deviceStatus && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Battery</Text>
                    <Text style={styles.value}>{deviceStatus.batteryLevel}%</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Storage</Text>
                    <Text style={styles.value}>
                      {deviceStatus.storageUsedPercent}% used
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Pending</Text>
                    <Text style={styles.value}>
                      {deviceStatus.pendingRecordings} recordings
                    </Text>
                  </View>
                </>
              )}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={() =>
                    router.push({
                      pathname: '/recordings',
                      params: {deviceId: connectedDevice.id},
                    })
                  }>
                  <Text style={styles.buttonText}>View Recordings</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={disconnect}>
                  <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                    Disconnect
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.emptyText}>No device connected</Text>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, styles.buttonFull]}
                onPress={() => router.push('/scan')}
                disabled={!isBluetoothReady}>
                <Text style={styles.buttonText}>Scan for Devices</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        {!connectedDevice && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Getting Started</Text>
            <View style={styles.card}>
              <Text style={styles.instructions}>
                1. Make sure your Bota device is powered on{'\n'}
                2. Tap "Scan for Devices" above{'\n'}
                3. Select your device from the list{'\n'}
                4. Wait for pairing to complete
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusOn: {
    backgroundColor: '#34C759',
  },
  statusOff: {
    backgroundColor: '#FF3B30',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonFull: {
    marginTop: 16,
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonSecondary: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#666',
  },
  linkButton: {
    marginTop: 8,
  },
  linkButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    lineHeight: 24,
  },
});
