# Bota Example Mobile App

Expo 57 app demonstrating `@bota.dev/react-native-app-sdk@2.0.0-beta.6`
(beta) with the existing local example backend. App/native runtime: 0.2.0.

## Run

```bash
EXPO_PUBLIC_EXAMPLE_API_URL=http://localhost:4000 npm start
```

Use a development build rather than Expo Go because BLE requires native modules.
Install from the repository root using Node 22.23.2+ and `npm ci`. Build with
`npm run android` or, on macOS, `npm run ios` from this directory. Android requires
API 26+ and the requested Bluetooth/location permissions. Set the API URL to a
LAN-reachable address for a physical phone.
The web route displays native-build instructions; it does not import the native
Bluetooth module or claim browser Bluetooth support.

The backend completion callback must succeed before the SDK confirms deletion.
See the [migration review](../../docs/app-sdk-migration.md) for verification and
the retained local-only authentication, provisioning and recovery limitations.
