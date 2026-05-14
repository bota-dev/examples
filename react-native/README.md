# Bota React Native SDK Example

This example app demonstrates how to integrate the [@bota.dev/react-native-sdk](https://www.npmjs.com/package/@bota.dev/react-native-sdk) into a React Native application.

## Features Demonstrated

- **SDK Initialization** - Configure the SDK with environment settings
- **Device Scanning** - Discover nearby Bota devices via Bluetooth
- **Device Connection** - Connect to and read info from Bota devices
- **Device Status** - Read battery level, storage, and recording state
- **Event Handling** - Subscribe to SDK events (device discovered, connected, etc.)

## Prerequisites

- Node.js 18+
- iOS: Xcode 15+, CocoaPods
- Android: Android Studio, SDK 24+
- A physical device (Bluetooth doesn't work in simulators)

## Getting Started

```bash
# Install dependencies
npm install

# iOS: Install pods
cd ios && pod install && cd ..

# Run on iOS
npx expo run:ios

# Run on Android
npx expo run:android
```

## Project Structure

```
app/
├── (tabs)/
│   ├── _layout.tsx    # Tab navigation setup
│   ├── index.tsx      # Devices tab - scan and connect
│   └── two.tsx        # About tab - SDK info
└── device/
    └── [id].tsx       # Device detail screen
```

## Key Code Examples

### Initialize the SDK

```typescript
import { BotaClient } from '@bota.dev/react-native-sdk';

await BotaClient.configure({
  environment: 'sandbox', // or 'production'
  logLevel: 'debug',
});
```

### Scan for Devices

```typescript
// Listen for discovered devices
BotaClient.devices.on('deviceDiscovered', (device) => {
  console.log('Found:', device.name, device.id);
});

// Start scanning
await BotaClient.devices.startScan({ timeout: 10000 });

// Stop scanning
BotaClient.devices.stopScan();
```

### Connect to a Device

```typescript
const connectedDevice = await BotaClient.devices.connect(discoveredDevice);
console.log('Connected to:', connectedDevice.serialNumber);
console.log('Firmware:', connectedDevice.firmwareVersion);
console.log('Provisioned:', connectedDevice.isProvisioned);
```

### Read Device Status

```typescript
const status = await BotaClient.devices.getStatus(device);
console.log('Battery:', status.batteryLevel);
console.log('Recording:', status.isRecording);

// Subscribe to status updates
BotaClient.devices.subscribeToStatus(device, (status) => {
  console.log('Status updated:', status);
});
```

### Provision a Device (Requires Backend)

```typescript
// Get device token from your backend
const token = await yourBackend.getDeviceToken(userId);

// Provision the device
await BotaClient.devices.provision(device, token, 'production');
```

## What's Not Included

This example demonstrates SDK integration patterns but does **not** include:

- **Device Provisioning** - Requires a device token from your backend
- **Recording Sync** - Requires backend integration for uploads
- **Transcription/Summary** - Requires Bota API access

See [docs.bota.dev](https://docs.bota.dev) for the full integration guide.

## Learn More

- [Bota Documentation](https://docs.bota.dev)
- [React Native SDK on npm](https://www.npmjs.com/package/@bota.dev/react-native-sdk)
- [GitHub Repository](https://github.com/bota-dev/react-native-sdk)
