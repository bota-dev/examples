# Connect to a device with Flutter

An Android Flutter application using published `bota_app_sdk: 2.0.0-beta.7` (beta). Scan, select, verify the exact serial through the SDK, read status, and disconnect. No backend, API key, binding, or recording operations.

## Run

Use Flutter **3.47.5**, JDK 17, Android SDK 37 tooling, and an Android 8+ (API 26+) phone with Bluetooth. Flutter 3.44 cannot resolve this SDK's `meta` dependency. This example includes an Android host only; SDK iOS support is not an iOS example acceptance claim.

From this directory:

```sh
flutter precache --android
flutter pub get --enforce-lockfile
flutter run
```

Enable Bluetooth access, enter the exact printed device serial, scan, and select a candidate. Android 12+ prompts for Nearby Devices access; earlier releases require location permission and may need Location enabled. Denied access can be granted in system Settings before retrying. Close other apps connected to the device. Read status and disconnect when done.

The SDK verifies connected identity, not the advertised name. Selection cancels scanning before connecting. Connection events clear stale selection when delivered; teardown cancels subscriptions and destroys the SDK. On the tested Android phone, beta.7 did not report radio loss through the connection stream, leaving the selection visible. Tap Disconnect to clear it even when the SDK call fails, then restore Bluetooth and reconnect. Automatic radio-loss recovery remains a known limitation. This is a foreground development app; configure your own signing before distribution.

## Verify

2026-09-29 partial device check: the CI APK from source `50ddf37` installed and launched on Samsung SM-A166U1 (Android 16/API 36). Permission denial and recovery to SDK-ready state passed. Discovery, exact identity, status, and disconnect/reconnect remain open; see the [review](../../docs/independent-examples-review.md#android-device-acceptance).

The example workflow preserves `flutter-connect-debug-apk` for on-device testing when a local Flutter build is unavailable. Download it from a successful run of the exact source revision, install with `adb install -r app-debug.apk`, and launch **Bota Connect**. This debug artifact is for testing, not distribution.

```sh
flutter analyze
flutter build apk --debug
```

`permission_handler_android` requires compile SDK 37; the minimum device API stays 26. The dependency lock was resolved by hosted Flutter 3.47.5. Run `flutter precache --android` first: beta.7 compiles against the cached Android embedding JAR; a fresh Git-based Flutter installation does not download it automatically during `flutter build`. See [implementation review](../../docs/independent-examples-review.md) for install, analyzer, and native build evidence. Windows Application Control blocked the newer Dart tool during local verification; hosted Linux CI supplies the Flutter checks. Permission denial/recovery passed on the phone above; discovery, correct/wrong serial, status, disconnect/reconnect, and firmware coverage remain unverified. [Public SDK reference](https://docs.bota.dev/api-reference/client-sdks).
