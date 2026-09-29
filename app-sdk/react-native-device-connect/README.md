# Connect to a device with React Native

Scan → select → verify the **GATT-read serial** against the serial you enter → read status → disconnect. Uses the published beta `@bota.dev/react-native-app-sdk@2.0.0-beta.7`. No API key, backend, binding, recording, or upload is needed.

## Run

Prerequisites: Node 22.23.2+, npm, Android Studio/JDK 17 or macOS 26/Xcode 26.6, and a physical Bota device. This app uses Expo 57 / React Native 0.86.3, Android API 26+, and iOS 16.4+ (Expo's floor). Expo Go cannot load the native SDK.

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

2026-09-29: public frozen install, typecheck, exact-serial/mismatch tests, and Android Metro export pass locally. `xcode`'s UUID dependency is overridden to 11.1.1 to address its transitive advisory; npm audit reports no vulnerabilities. Android debug APK assembly and iOS Simulator native application linking pass in [CI at source `9e33809`](https://github.com/bota-dev/examples/actions/runs/36608472277); see the [implementation review](../../docs/independent-examples-review.md). Physical BLE permission/scan/connect/status/reconnect checks remain unverified. A native build does not establish hardware acceptance.

For hardware acceptance record OS, phone, device model, firmware, SDK version, permission grant/denial, correct and incorrect serial, status, radio-off/disconnect behavior, and reconnect result. [Public SDK docs](https://docs.bota.dev/api-reference/client-sdks).

### iOS native build gate

CI explicitly selects the installed CocoaPods gem (`pod _1.16.2_`) because the runner may also contain a newer version.

The example workflow generates the iOS host on macOS 26, installs CocoaPods 1.16.2 dependencies, and builds the application against the published SDK using Xcode 26.6 and a generic iOS Simulator destination. Xcode 26.3 fails while compiling Expo's `RuntimeScheduler` ownership annotations ([upstream report](https://github.com/expo/expo/issues/50067)); use the documented toolchain without patching Expo's native memory ownership. The generated Xcode project, Pods, and local signing state remain untracked. Build evidence is preserved as a CI artifact; the [review](../../docs/independent-examples-review.md) records the result. This unsigned simulator build does not test Bluetooth or establish physical iPhone acceptance.
