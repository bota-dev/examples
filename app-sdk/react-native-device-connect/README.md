# Connect to a device with React Native

Scan → select → verify the **GATT-read serial** against the serial you enter → read status → disconnect. Uses the published beta `@bota.dev/react-native-app-sdk@2.0.0-beta.7`. No API key, backend, binding, recording, or upload is needed.

## Run

Prerequisites: Node 22.23.2+, npm, Android Studio/JDK 17 or macOS/Xcode, and a physical Bota device. This app uses Expo 57 / React Native 0.86.3, Android API 26+, and iOS 16.4+ (Expo's floor). Expo Go cannot load the native SDK.

From this directory:

```sh
npm ci
npm run android
# Or on macOS with Xcode:
npm run ios
```

Grant Bluetooth permissions (location on Android 11 and older), turn Bluetooth on, enter the exact printed device serial, and scan. Stop other apps from holding the device connection. Select a candidate to connect. Advertised names are display hints, not identity; a mismatch disconnects. On success, read status and disconnect. No environment configuration is needed. Rebuild native apps after changing the SDK.

Operations are serialized. Unexpected disconnection clears selection. SDK teardown removes subscriptions when the app component unmounts. Permission denial requires granting access in system settings and reopening the app. This sample does not provision, unbind, reset, start recording, or delete files.

## Verify

```sh
npm run typecheck
npm test
npm run export
```

2026-09-29: public frozen install, typecheck, exact-serial/mismatch tests, and Android Metro export pass locally. `xcode`'s UUID dependency is overridden to 11.1.1 to address its transitive advisory; npm audit reports no vulnerabilities. Native build evidence is in the [implementation review](../../docs/independent-examples-review.md). iOS linking and physical BLE permission/scan/connect/status/reconnect checks remain unverified. A bundle export alone does not prove native module linkage.

For hardware acceptance record OS, phone, device model, firmware, SDK version, permission grant/denial, correct and incorrect serial, status, radio-off/disconnect behavior, and reconnect result. [Public SDK docs](https://docs.bota.dev/api-reference/client-sdks).
