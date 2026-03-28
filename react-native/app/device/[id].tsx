import { useState, useEffect } from 'react';
import { ScrollView, Alert, ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    Alert.alert(
      'Provisioning',
      'To provision this device, you need a device token from your backend.\n\n' +
        'See the code example below for the pattern.',
      [{ text: 'OK' }]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
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
      <ScrollView className="flex-1 bg-background">
        <View className="p-5 gap-6">
          {/* Device Info */}
          <Card>
            <CardHeader>
              <CardTitle>Device Information</CardTitle>
            </CardHeader>
            <CardContent className="gap-3">
              <InfoRow label="Serial Number" value={device.serialNumber} mono />
              <InfoRow label="Device Type" value={device.deviceType} />
              <InfoRow label="Firmware" value={device.firmwareVersion} />
              {device.hardwareRevision && (
                <InfoRow label="Hardware" value={device.hardwareRevision} />
              )}
              <InfoRow
                label="Provisioned"
                value={device.isProvisioned ? 'Yes' : 'No'}
                valueClassName={device.isProvisioned ? 'text-green-600' : 'text-orange-500'}
              />
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Device Status</CardTitle>
            </CardHeader>
            <CardContent className="gap-3">
              {status ? (
                <>
                  <InfoRow
                    label="Battery"
                    value={`${status.batteryLevel}%`}
                    valueClassName={status.batteryLevel < 20 ? 'text-red-500' : 'text-green-600'}
                  />
                  <InfoRow
                    label="Recording"
                    value={status.isRecording ? 'Yes' : 'No'}
                    valueClassName={status.isRecording ? 'text-orange-500' : undefined}
                  />
                  {status.storageUsed !== undefined && status.storageTotal !== undefined && (
                    <InfoRow
                      label="Storage"
                      value={`${Math.round(status.storageUsed / 1024 / 1024)}MB / ${Math.round(status.storageTotal / 1024 / 1024)}MB`}
                    />
                  )}
                </>
              ) : (
                <Text className="text-muted-foreground italic">
                  Status not available
                </Text>
              )}
            </CardContent>
          </Card>

          {/* Provisioning */}
          {!device.isProvisioned && (
            <Card>
              <CardHeader>
                <CardTitle>Setup Required</CardTitle>
              </CardHeader>
              <CardContent className="gap-4">
                <Text className="text-muted-foreground">
                  This device is not provisioned. To complete setup, provision it with a device
                  token from your backend.
                </Text>
                <Button onPress={handleProvision}>
                  <Text>How to Provision</Text>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Code Example */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">SDK Code Example</CardTitle>
            </CardHeader>
            <CardContent>
              <Text className=" text-xs text-zinc-300 leading-5">
{`// Connect to device
const device = await BotaClient.devices.connect(discovered);

// Read device status
const status = await BotaClient.devices.getStatus(device);
console.log('Battery:', status.batteryLevel);

// Subscribe to status updates
BotaClient.devices.subscribeToStatus(device, (status) => {
  console.log('Status updated:', status);
});

// Provision (requires backend token)
// const token = await yourBackend.getDeviceToken();
// await BotaClient.devices.provision(device, token);`}
              </Text>
            </CardContent>
          </Card>

          {/* Disconnect Button */}
          <Button
            variant="destructive"
            className="mt-2"
            onPress={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text>Disconnect</Text>
            )}
          </Button>
        </View>
      </ScrollView>
    </>
  );
}

function InfoRow({
  label,
  value,
  mono,
  valueClassName,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClassName?: string;
}) {
  return (
    <View className="flex-row justify-between items-center py-2 border-b border-border">
      <Text className="text-foreground">{label}</Text>
      <Text
        className={`text-muted-foreground ${mono ? 'text-sm' : ''} ${valueClassName || ''}`}
      >
        {value}
      </Text>
    </View>
  );
}
