import { StyleSheet, ScrollView, Linking } from 'react-native';
import { Text, View } from '@/components/Themed';

export default function AboutScreen() {
  const openDocs = () => {
    Linking.openURL('https://docs.bota.dev');
  };

  const openGitHub = () => {
    Linking.openURL('https://github.com/bota-dev/react-native-sdk');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Bota SDK Example</Text>
        <Text style={styles.subtitle}>@bota-dev/react-native-sdk</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About This App</Text>
        <Text style={styles.paragraph}>
          This example app demonstrates how to integrate the Bota React Native SDK into your
          mobile application.
        </Text>
        <Text style={styles.paragraph}>
          The SDK enables communication with Bota wearable devices (Bota Pin, Bota Note) via
          Bluetooth Low Energy (BLE).
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What This Example Shows</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• SDK initialization with BotaClient.configure()</Text>
          <Text style={styles.bullet}>• Bluetooth device scanning</Text>
          <Text style={styles.bullet}>• Connecting to Bota devices</Text>
          <Text style={styles.bullet}>• Reading device info and status</Text>
          <Text style={styles.bullet}>• Event-driven architecture patterns</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What Requires a Backend</Text>
        <Text style={styles.paragraph}>
          Some features require a backend server with a Bota API key:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• Device provisioning (needs device token)</Text>
          <Text style={styles.bullet}>• Recording sync and upload</Text>
          <Text style={styles.bullet}>• Transcription and summary retrieval</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Start</Text>
        <View style={styles.codeBlock}>
          <Text style={styles.code}>
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
        </View>
      </View>

      <View style={styles.links}>
        <Text style={styles.link} onPress={openDocs}>
          Documentation
        </Text>
        <Text style={styles.link} onPress={openGitHub}>
          GitHub Repository
        </Text>
      </View>

      <Text style={styles.footer}>
        Bota Inc.
      </Text>
    </ScrollView>
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'SpaceMono',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    color: '#444444',
    lineHeight: 24,
    marginBottom: 8,
  },
  bulletList: {
    marginTop: 4,
  },
  bullet: {
    fontSize: 15,
    color: '#444444',
    lineHeight: 28,
  },
  codeBlock: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  code: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    color: '#E8E8E8',
    lineHeight: 20,
  },
  links: {
    marginTop: 16,
    marginBottom: 32,
    gap: 16,
  },
  link: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
  },
  footer: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    marginTop: 20,
  },
});
