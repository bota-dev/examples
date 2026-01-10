/**
 * Root Layout - Expo Router
 * Sets up providers and navigation structure
 */

import React, {useEffect, useState} from 'react';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {BotaClient} from '@bota/react-native-sdk';
import {AuthProvider} from '../src/context/AuthContext';
import {BotaProvider} from '../src/context/BotaContext';

export default function RootLayout() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  useEffect(() => {
    initializeSdk();
  }, []);

  async function initializeSdk() {
    try {
      await BotaClient.configure({
        environment: 'sandbox',
        logLevel: 'debug',
        debug: true,
      });

      // Wait for Bluetooth
      await BotaClient.waitForBluetooth(5000);

      setSdkReady(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('SDK initialization failed:', message);
      setSdkError(message);

      Alert.alert(
        'Bluetooth Error',
        `Failed to initialize: ${message}\n\nPlease ensure Bluetooth is enabled and permissions are granted.`,
      );
    }
  }

  if (sdkError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>SDK Error</Text>
        <Text style={styles.errorMessage}>{sdkError}</Text>
        <Text style={styles.errorHint}>
          Please enable Bluetooth and restart the app.
        </Text>
      </View>
    );
  }

  if (!sdkReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing SDK...</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <BotaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: {backgroundColor: '#007AFF'},
            headerTintColor: '#fff',
            headerTitleStyle: {fontWeight: 'bold'},
          }}
        />
      </BotaProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
