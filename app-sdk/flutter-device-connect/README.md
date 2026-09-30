# Connect to a device with Flutter

An Android Flutter application using published `bota_app_sdk: 2.0.0-beta.8` (beta). Scan, select, verify the exact serial through the SDK, read status, and disconnect. No backend, API key, binding, or recording operations.

## Run

Use Flutter **3.47.5**, JDK 17, Android SDK 37 tooling, and an Android 8+ (API 26+) phone with Bluetooth. Flutter 3.44 cannot resolve this SDK's `meta` dependency. This example includes an Android host only; SDK iOS support is not an iOS example acceptance claim.

From this directory:

```sh
flutter precache --android
flutter pub get --enforce-lockfile
flutter run
```

Enable Bluetooth access, enter the exact printed device serial, scan, and select a candidate. Android 12+ prompts for Nearby Devices access; earlier releases require location permission and may need Location enabled. Denied access can be granted in system Settings before retrying. Close other apps connected to the device. Read status and disconnect when done.

The SDK verifies connected identity, not the advertised name. Selection cancels scanning before connecting. Connection events clear stale selection when delivered; teardown cancels subscriptions and destroys the SDK. On the tested Android phone, beta.8 still missed one radio-off event and left the selected device and old status visible. Android logs showed GATT client cleanup without a disconnect callback; the current SDK relies on that callback. Tap Disconnect to clear local selection even when the SDK call fails, then restore Bluetooth and try an explicit reconnect. A later fresh-scan reconnect also failed, so full recovery remains unresolved. This is a foreground development app; configure your own signing before distribution.

## Verify

The connection listener replaces old status text on a connected-to-null event.
Initial null events retain the setup instruction. On 2026-09-30 UTC, beta.8 locked installation, analysis and APK assembly passed in [CI 36661667401](https://github.com/bota-dev/examples/actions/runs/36661667401). Its exact APK connected and read fresh status after an additional phone Bluetooth cycle, but automatic radio-off cleanup failed and later reconnect remained unsuccessful. See the [current review](../../docs/independent-examples-review.md#beta8-adoption) for exact evidence and limits.

2026-09-29 device check: Samsung SM-A166U1 (Android 16/API 36), Bota Pin `4KF6NOHWX0` / firmware `1.0.19`, App SDK beta.7. The original source `50ddf37` passed permission denial/recovery, discovery, wrong-serial rejection, exact identity, status, and explicit disconnect/reconnect. The updated APK from source `61a7471` passed connection, Bluetooth-off failed-disconnect cleanup, radio-on reconnect, fresh status, and final explicit disconnect; see the [review](../../docs/independent-examples-review.md#firmware-1019-physical-test-continuation). Automatic radio-loss notification failed as described above; other phones/firmware and out-of-range recovery remain unverified.

The example workflow preserves `flutter-connect-debug-apk` for on-device testing when a local Flutter build is unavailable. Download it from a successful run of the exact source revision, install with `adb install --no-streaming -r app-debug.apk`, and launch **Bota Connect**. Separate CI runs may use different debug signing keys. If installation reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, uninstall only this test sample with `adb uninstall dev.bota.examples.bota_connect`, then install the new APK; this clears its local app data and permissions. This debug artifact is for testing, not distribution.

```sh
flutter analyze
flutter build apk --debug
```

`permission_handler_android` requires compile SDK 37; the minimum device API stays 26. The dependency lock was resolved by hosted Flutter 3.47.5. Run `flutter precache --android` first: the SDK compiles against the cached Android embedding JAR; a fresh Git-based Flutter installation does not download it automatically during `flutter build`. See [implementation review](../../docs/independent-examples-review.md) for install, analyzer, and native build evidence. Windows Application Control blocked the newer Dart tool during local verification; hosted Linux CI supplies the Flutter checks. The phone checks above establish the recorded connection/manual-recovery scenarios only; automatic radio-loss delivery remains a known limitation. [Public SDK reference](https://docs.bota.dev/api-reference/client-sdks).
