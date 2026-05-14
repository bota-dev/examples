import { useState, useEffect } from 'react';
import { FlatList, Alert, ActivityIndicator, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  BotaClient,
  type DiscoveredDevice,
  type ConnectedDevice,
} from '@bota.dev/react-native-sdk';

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

      if (!BotaClient.isBluetoothReady) {
        setSdkStatus('bluetooth_off');
      } else {
        setSdkStatus('ready');
      }

      BotaClient.on('bluetoothStateChanged', (state) => {
        if (state === 'poweredOn') {
          setSdkStatus('ready');
        } else if (state === 'poweredOff' || state === 'unauthorized') {
          setSdkStatus('bluetooth_off');
        }
      });

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
        <View className="flex-row items-center justify-center gap-2 bg-blue-50 px-4 py-3">
          <ActivityIndicator size="small" color="#007AFF" />
          <Text className="text-sm text-foreground">Initializing SDK...</Text>
        </View>
      );
    }

    if (sdkStatus === 'bluetooth_off') {
      return (
        <View className="bg-yellow-50 px-4 py-3">
          <Text className="text-center text-sm text-foreground">
            Bluetooth is off. Enable Bluetooth to scan for devices.
          </Text>
        </View>
      );
    }

    if (sdkStatus === 'error') {
      return (
        <View className="bg-red-50 px-4 py-3">
          <Text className="text-center text-sm text-destructive">
            SDK initialization failed
          </Text>
        </View>
      );
    }

    return null;
  };

  const renderDevice = ({ item }: { item: DiscoveredDevice }) => {
    const isConnecting = connecting === item.id;
    const isConnected = connectedDevice?.id === item.id;

    return (
      <Card
        className={`mb-3 ${isConnected ? 'border-green-500 bg-green-50' : ''}`}
      >
        <CardContent className="flex-row items-center justify-between py-4">
          <View className="flex-1">
            <Text className="text-base font-semibold">
              {item.name || 'Bota Device'}
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              {item.deviceType}
            </Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">
              {item.id}
            </Text>
          </View>
          <View>
            {isConnecting ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : isConnected ? (
              <Text className="text-sm font-semibold text-green-600">Connected</Text>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => connectDevice(item)}
              >
                <Text>Connect</Text>
              </Button>
            )}
          </View>
        </CardContent>
      </Card>
    );
  };

  const renderEmpty = () => (
    <View className="flex-1 items-center justify-center px-10">
      {scanning ? (
        <>
          <ActivityIndicator size="large" color="#007AFF" className="mb-5" />
          <Text className="text-center text-lg font-semibold">
            Scanning for devices...
          </Text>
          <Text className="mt-2 text-center text-muted-foreground">
            Make sure your Bota device is powered on and nearby
          </Text>
        </>
      ) : (
        <>
          <Text className="text-center text-lg font-semibold">
            No devices found
          </Text>
          <Text className="mt-2 text-center text-muted-foreground">
            Tap "Scan" to search for nearby Bota devices
          </Text>
        </>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      {renderStatusBanner()}

      <View className="flex-row items-center justify-between px-5 py-4">
        <Text className="text-xl font-semibold">Nearby Devices</Text>
        <Button
          variant={scanning ? 'destructive' : 'default'}
          size="sm"
          onPress={scanning ? stopScan : startScan}
          disabled={sdkStatus !== 'ready'}
        >
          <Text>{scanning ? 'Stop' : 'Scan'}</Text>
        </Button>
      </View>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderDevice}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
        }}
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
