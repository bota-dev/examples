# Bota React Native Example App

This example app demonstrates how to integrate the `@bota-dev/react-native-sdk` into a React Native application using Expo.

## Features

- Device discovery via BLE scanning
- Device connection and pairing
- Device provisioning with tokens
- Device status monitoring (battery, storage, recording state)
- Recording list and sync functionality
- Upload progress tracking

## Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Xcode 14+ (for iOS development builds)
- Android Studio (for Android development builds)
- A physical iOS/Android device (BLE is not available in simulators/emulators)

## Installation

```bash
cd examples/react-native

# Install dependencies
npm install

# Build the SDK first
cd ../../sdk/react-native
npm install
npm run build
cd ../../examples/react-native
```

## Running the App

### Development Build (Required for BLE)

Since BLE requires native code, you need to create a development build:

```bash
# Generate native projects
npx expo prebuild

# iOS
npx expo run:ios --device

# Android
npx expo run:android --device
```

### Expo Go (Limited - No BLE)

For UI development without BLE:

```bash
npx expo start
```

Note: BLE features won't work in Expo Go. Use a development build for full functionality.

## Project Structure

```
examples/react-native/
├── app/                    # Expo Router pages
│   ├── _layout.tsx         # Root layout with providers
│   ├── index.tsx           # Entry redirect
│   ├── login.tsx           # Login page
│   ├── home.tsx            # Dashboard page
│   ├── scan.tsx            # Device discovery page
│   ├── device.tsx          # Device details page
│   └── recordings.tsx      # Recording sync page
├── src/
│   ├── api/
│   │   └── backend.ts      # Mock backend API calls
│   └── context/
│       ├── AuthContext.tsx # Authentication state
│       └── BotaContext.tsx # SDK state management
├── assets/                 # App icons and splash
├── app.json               # Expo configuration
├── metro.config.js        # Metro bundler config
└── package.json
```

## Usage Flow

1. **Login**: Enter demo credentials (any email/password works)
2. **Home**: View connected device status or scan for devices
3. **Scan**: Discover nearby Bota devices via BLE
4. **Connect**: Tap a device to connect and provision
5. **Device**: View device info, battery, storage, recording state
6. **Recordings**: List and sync recordings from device to cloud

## SDK Integration

The app demonstrates key SDK integration patterns:

### Initialization (app/_layout.tsx)

```tsx
import { BotaClient } from '@bota-dev/react-native-sdk';

// Configure SDK
await BotaClient.configure({
  environment: 'sandbox',
  logLevel: 'debug',
});

// Wait for Bluetooth to be ready
await BotaClient.waitForBluetooth(5000);
```

### Context Provider (src/context/BotaContext.tsx)

```tsx
// Subscribe to SDK events
BotaClient.devices.on('deviceDiscovered', handleDeviceDiscovered);
BotaClient.devices.on('deviceConnected', handleDeviceConnected);

// Scanning
await BotaClient.devices.startScan({ timeout: 30000 });

// Connection
const connected = await BotaClient.devices.connect(device);

// Provisioning
await BotaClient.devices.provision(device, token, 'sandbox');
```

### Recording Sync (app/recordings.tsx)

```tsx
// List recordings
const recordings = await BotaClient.recordings.listRecordings(device);

// Sync with progress
for await (const progress of BotaClient.recordings.syncRecording(
  device,
  recording,
  uploadInfo
)) {
  console.log(progress.stage, progress.progress);
}
```

## Backend Integration

In a real app, you need to implement backend endpoints that:

1. **Register device**: Create device record and return device token
2. **Get upload info**: Return pre-signed S3 upload URLs

See `src/api/backend.ts` for the expected API shape.

## Permissions

Permissions are configured in `app.json` and applied during `expo prebuild`:

### iOS

- `NSBluetoothAlwaysUsageDescription`
- `NSBluetoothPeripheralUsageDescription`

### Android

- `BLUETOOTH`, `BLUETOOTH_ADMIN`
- `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`
- `ACCESS_FINE_LOCATION`

## Troubleshooting

### "BLE not available"

- Ensure you're using a development build (`expo run:ios` or `expo run:android`)
- BLE does not work in Expo Go or simulators
- Use a physical device

### Bluetooth not available

- Check that Bluetooth is enabled in device settings
- Grant Bluetooth permissions when prompted
- On Android 12+, location permission is required for BLE scanning

### Device not found

- Ensure the Bota device is powered on
- Move closer to the device
- Try restarting the scan

### Connection failed

- Ensure the device is not connected to another phone
- Try forgetting the device in Bluetooth settings and re-pairing

### Metro bundler issues

If you get module resolution errors:

```bash
# Clear cache and restart
npx expo start --clear
```

## License

MIT
