import { ScrollView, Linking, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AboutScreen() {
  const openDocs = () => {
    Linking.openURL('https://docs.bota.dev');
  };

  const openGitHub = () => {
    Linking.openURL('https://github.com/bota-dev/react-native-sdk');
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-5 gap-6">
        {/* Header */}
        <View className="items-center py-6">
          <Text variant="h3" className="text-center">
            Bota SDK Example
          </Text>
          <Text className="mt-2 font-mono text-muted-foreground">
            @bota-dev/react-native-sdk
          </Text>
        </View>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About This App</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            <Text className="text-muted-foreground leading-6">
              This example app demonstrates how to integrate the Bota React Native SDK into your
              mobile application.
            </Text>
            <Text className="text-muted-foreground leading-6">
              The SDK enables communication with Bota wearable devices (Bota Pin, Bota Note) via
              Bluetooth Low Energy (BLE).
            </Text>
          </CardContent>
        </Card>

        {/* What This Shows */}
        <Card>
          <CardHeader>
            <CardTitle>What This Example Shows</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="gap-2">
              <BulletItem text="SDK initialization with BotaClient.configure()" />
              <BulletItem text="Bluetooth device scanning" />
              <BulletItem text="Connecting to Bota devices" />
              <BulletItem text="Reading device info and status" />
              <BulletItem text="Event-driven architecture patterns" />
            </View>
          </CardContent>
        </Card>

        {/* Backend Required */}
        <Card>
          <CardHeader>
            <CardTitle>What Requires a Backend</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            <Text className="text-muted-foreground leading-6">
              Some features require a backend server with a Bota API key:
            </Text>
            <View className="gap-2">
              <BulletItem text="Device provisioning (needs device token)" />
              <BulletItem text="Recording sync and upload" />
              <BulletItem text="Transcription and summary retrieval" />
            </View>
          </CardContent>
        </Card>

        {/* Quick Start */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Quick Start</CardTitle>
          </CardHeader>
          <CardContent>
            <Text className="font-mono text-xs text-zinc-300 leading-5">
{`import { BotaClient } from '@bota-dev/react-native-sdk';

// Initialize SDK
await BotaClient.configure({
  environment: 'sandbox',
});

// Scan for devices
BotaClient.devices.on('deviceDiscovered', (device) => {
  console.log('Found device:', device.name);
});
await BotaClient.devices.startScan();

// Connect
const connected = await BotaClient.devices.connect(device);
console.log('Connected:', connected.serialNumber);`}
            </Text>
          </CardContent>
        </Card>

        {/* Links */}
        <View className="gap-3">
          <Button variant="outline" onPress={openDocs}>
            <Text>Documentation</Text>
          </Button>
          <Button variant="outline" onPress={openGitHub}>
            <Text>GitHub Repository</Text>
          </Button>
        </View>

        {/* Footer */}
        <Text className="text-center text-sm text-muted-foreground py-4">
          Bota Inc.
        </Text>
      </View>
    </ScrollView>
  );
}

function BulletItem({ text }: { text: string }) {
  return (
    <View className="flex-row gap-2">
      <Text className="text-muted-foreground">•</Text>
      <Text className="flex-1 text-muted-foreground">{text}</Text>
    </View>
  );
}
