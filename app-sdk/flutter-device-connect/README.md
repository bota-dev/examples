# Connect to a device with Flutter

An Android Flutter application using published `bota_app_sdk: 2.0.0-beta.13` (beta). Scan, select, verify the exact serial through the SDK, read status, and disconnect. No backend, API key, binding, or recording operations.

## Current beta.13 adoption

The exact pub.dev pin and archive lock select beta.13; its Android Maven and
Apple CocoaPods dependencies select that same version. The dependency update
changes only the SDK entry, leaving the existing six UI lifecycle regressions
and application code unchanged. Frozen-lock installation, analysis and all six
widget tests pass on Flutter 3.47.5. Native build and physical acceptance remain
separate; no beta.13 phone test was performed. The beta.10/9/8 outcomes below
retain their original versions and limits. See the
[adoption review](../../docs/independent-examples-review.md#beta13-adoption).

## Run

Use Flutter **3.47.5**, JDK 17, Android SDK 37 tooling, and an Android 8+ (API 26+) phone with Bluetooth. Flutter 3.44 cannot resolve this SDK's `meta` dependency. This example includes an Android host only; SDK iOS support is not an iOS example acceptance claim.

From this directory:

```sh
flutter precache --android
flutter pub get --enforce-lockfile
flutter run
```

Enable Bluetooth access, enter the exact printed device serial, scan, and select a candidate. Android 12+ prompts for Nearby Devices access; earlier releases require location permission and may need Location enabled. Denied access can be granted in system Settings before retrying. Close other apps connected to the device. Read status and disconnect when done.

The SDK verifies connected identity, not the advertised name. Selection cancels scanning before connecting. Connection events clear stale selection and status; teardown cancels subscriptions and destroys the SDK. Beta.9 handles Android adapter shutdown even when the platform omits its GATT disconnect callback. After connection loss, restore Bluetooth, scan, and select the device to reconnect explicitly. The SDK does not reconnect automatically. Explicit Disconnect also clears selection if its SDK call fails. This is a foreground development app; configure your own signing before distribution.

## Verify

The connection listener replaces old status text on a connected-to-null event.
Initial null events retain the setup instruction. A connection epoch prevents a
pending connect or status request from restoring stale UI after a loss event;
late errors also preserve the loss message. Six widget tests cover stale
successes and failures, a connection stream error, and explicit reconnect with
fresh status. These tests use a fake SDK platform; they do not establish the cause of the
physical GATT 8/133 failures below or fix their first-attempt reliability.

Historical beta.10's public pub.dev archive matches its registry SHA-256 and all 59 files
in the preserved release inventory. Its Android and Apple dependencies select
exact beta.10 artifacts. This adoption changes only the direct SDK version and
archive hash; the six UI lifecycle regressions and runtime source are unchanged.
See [beta.10 adoption](../../docs/independent-examples-review.md#beta10-adoption)
for its recorded local, hosted, and physical checks; earlier results below remain
historical.

Historical beta.9's public pub.dev archive was downloaded and verified against its registry SHA-256, and its Android and Apple dependencies select the same exact beta.9 version. The beta.9 adoption changed only the direct SDK version and archive hash. The widget suite adds `flutter_test` and its locked testing dependencies without changing existing package versions. See the [current review](../../docs/independent-examples-review.md#beta9-adoption) for installation, analysis, build, and physical-device evidence.

Beta.9 verification, 2026-09-30 UTC: locked installation, original-config
analysis, and the isolated local APK build passed; [CI 36768188319](https://github.com/bota-dev/examples/actions/runs/36768188319)
also passed at `a5c36b08`. On Samsung SM-A166U1 / Android 16 and SDK-verified
serial `4KF6NOHWX0` / firmware `1.0.19`, all three radio shutdowns cleared stale
UI automatically. Two first reconnects passed. The third dropped with GATT 8,
an immediate retry failed with 133, and a fresh scan/reconnect recovered identity
and status in the same app session without another Bluetooth cycle. Initial
connection and final disconnect passed. First-attempt reliability remains
partial; see [exact public-package evidence and limits](../../docs/independent-examples-review.md#public-beta9-flutter-acceptance-2026-09-30).
The lab changes only its app ID and identity diagnostics; it uses public packages
without a native override or recovery workaround.

Historical beta.8 checks: on 2026-09-30 UTC, locked installation, analysis and APK assembly passed in [CI 36661667401](https://github.com/bota-dev/examples/actions/runs/36661667401). Its exact APK connected and read fresh status after an additional phone Bluetooth cycle, but automatic radio-off cleanup failed and later reconnect remained unsuccessful. Android logs showed cleanup without a disconnect callback. Those failures motivated the beta.9 native transport fix; see the [beta.8 review](../../docs/independent-examples-review.md#beta8-adoption).

2026-09-29 device check: Samsung SM-A166U1 (Android 16/API 36), Bota Pin `4KF6NOHWX0` / firmware `1.0.19`, App SDK beta.7. The original source `50ddf37` passed permission denial/recovery, discovery, wrong-serial rejection, exact identity, status, and explicit disconnect/reconnect. The updated APK from source `61a7471` passed connection, Bluetooth-off failed-disconnect cleanup, radio-on reconnect, fresh status, and final explicit disconnect; see the [review](../../docs/independent-examples-review.md#firmware-1019-physical-test-continuation). Automatic radio-loss notification failed as described above; other phones/firmware and out-of-range recovery remain unverified.

The example workflow preserves `flutter-connect-debug-apk` for on-device testing when a local Flutter build is unavailable. Download it from a successful run of the exact source revision, install with `adb install --no-streaming -r app-debug.apk`, and launch **Bota Connect**. Separate CI runs may use different debug signing keys. If installation reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, uninstall only this test sample with `adb uninstall dev.bota.examples.bota_connect`, then install the new APK; this clears its local app data and permissions. This debug artifact is for testing, not distribution.

```sh
flutter analyze
flutter test
flutter build apk --debug
```

`permission_handler_android` requires compile SDK 37; the minimum device API stays 26. The dependency lock uses Flutter 3.47.5. Run `flutter precache --android` first: the SDK compiles against the cached Android embedding JAR; a fresh Git-based Flutter installation does not download it automatically during `flutter build`. Flutter 3.47.5 now runs on the Windows test host; the earlier local Dart startup limitation is historical. See [implementation review](../../docs/independent-examples-review.md) for install, analyzer, native-build, and bounded phone-test evidence. Other phones/firmware, background use, and out-of-range recovery remain unverified. [Public SDK reference](https://docs.bota.dev/api-reference/client-sdks).
