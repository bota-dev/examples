# Connect to a device with React Native

Scan → select → verify the **GATT-read serial** against the serial you enter → read status → disconnect. Uses the published beta `@bota.dev/react-native-app-sdk@2.0.0-beta.8`. No API key, backend, binding, recording, or upload is needed.

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

### Android USB development on Windows

A debug APK needs Metro running. If streamed installation stalls, use `adb install --no-streaming -r android/app/build/outputs/apk/debug/app-debug.apk`. For an isolated USB session, start Metro from this directory in PowerShell:

```powershell
$env:NODE_OPTIONS = '--dns-result-order=ipv4first'
npm start -- --localhost --port 8083 --max-workers 2
# In another terminal, target the intended phone:
adb -s <phone-id> reverse tcp:8081 tcp:8083
```

Check that `http://127.0.0.1:8083/status` returns `packager-status:running`, then launch the app. On this Windows test host, `--localhost` otherwise bound only to `::1`, which the IPv4 USB forwarding could not reach. Remove the temporary forwarding with `adb -s <phone-id> reverse --remove tcp:8081` when finished. This does not make a debug APK standalone; a release build must bundle JavaScript. If Metro file watching times out on this Windows host, start the same command with `$env:CI = '1'` to disable watching/hot reload for the bounded test. Restart Metro after source changes and remove the temporary variable afterward.

CI preserves the arm64 Android debug APK as
`react-native-connect-android-<commit>`. Use the same source revision for Metro
when testing that artifact. If a CI debug signing key differs from the installed
sample, uninstall only `dev.bota.examples.connect` before installing the APK;
this clears the sample's local app data. Artifact creation is build evidence,
not physical Bluetooth acceptance.

Operations are serialized. Disconnection events clear selection when delivered. Beta.8 delivered radio-off loss and cleared selection/status on the tested Android phone, but subsequent reconnect failed with GATT error 133. If no loss event arrives, Disconnect still clears the local selection even when the SDK call fails. Restore Bluetooth before explicitly reconnecting; successful recovery is not guaranteed by the notification fix. SDK teardown removes subscriptions when the app component unmounts. After permission denial, reopen the app to retry the system prompt; if Android no longer offers it, grant access in system settings and reopen. This sample does not provision, unbind, reset, start recording, or delete files.

2026-09-30 UTC, beta.8: Android and iOS Simulator builds passed in [CI 36661341921](https://github.com/bota-dev/examples/actions/runs/36661341921). On Samsung SM-A166U1 / Android 16 and Bota Pin firmware 1.0.19, exact-serial connection, status, and automatic radio-off UI cleanup passed. Explicit reconnect failed twice with GATT error 133, including after a fresh scan. Full recovery is therefore **partial**. See the [current review](../../docs/independent-examples-review.md#beta8-adoption); the dated beta.7 checks below remain historical.

The connection-loss listener also replaces the previous status text with a
reconnect instruction, so an old battery or recording state is not left visible
after the SDK invalidates the connection.

## Verify

```sh
npm run typecheck
npm test
npm run export
```

Historical beta.7 results, 2026-09-29: public frozen install, typecheck, exact-serial/mismatch tests, and Android Metro export pass locally. `xcode`'s UUID dependency is overridden to 11.1.1 to address its transitive advisory; npm audit reports no vulnerabilities. Android debug APK assembly and iOS Simulator native application linking pass in [CI at source `9e33809`](https://github.com/bota-dev/examples/actions/runs/36608472277); see the [implementation review](../../docs/independent-examples-review.md). On a Samsung SM-A166U1 (Android 16/API 36), the debug app loaded through IPv4 Metro, permission denial disabled scanning, and reopening/granting permission enabled scanning. On Bota Pin `4KF6NOHWX0` / firmware `1.0.19`, discovery, wrong-serial rejection, exact identity, status, explicit disconnect/reconnect, and manual radio-off recovery passed. Automatic radio-loss notification failed in that beta.7 run; physical iOS and out-of-range recovery remain unverified. A native build alone does not establish hardware acceptance.

For hardware acceptance record OS, phone, device model, firmware, SDK version, permission grant/denial, correct and incorrect serial, status, radio-off/disconnect behavior, and reconnect result. [Public SDK docs](https://docs.bota.dev/api-reference/client-sdks).

### iOS native build gate

CI explicitly selects the installed CocoaPods gem (`pod _1.16.2_`) because the runner may also contain a newer version.

The example workflow generates the iOS host on macOS 26, installs CocoaPods 1.16.2 dependencies, and builds the application against the published SDK using Xcode 26.6 and a generic iOS Simulator destination. Xcode 26.3 fails while compiling Expo's `RuntimeScheduler` ownership annotations ([upstream report](https://github.com/expo/expo/issues/50067)); use the documented toolchain without patching Expo's native memory ownership. The generated Xcode project, Pods, and local signing state remain untracked. Build evidence is preserved as a CI artifact; the [review](../../docs/independent-examples-review.md) records the result. This unsigned simulator build does not test Bluetooth or establish physical iPhone acceptance.
