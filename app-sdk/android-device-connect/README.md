# Connect to a device with Kotlin

A minimal native Android app using the public Maven Central artifact `dev.bota:bota-app-sdk:2.0.0-beta.8` (beta). Scan, select, verify the exact serial through the SDK, read status, disconnect. No backend, API key, provisioning, or recording operations.

## Run

Requires JDK 17, Android SDK 36/build tools, and an Android 8+ (API 26+) phone with Bluetooth. Open this directory in Android Studio and run `app`, or configure `ANDROID_HOME` and use:

```sh
./gradlew :app:assembleDebug
./gradlew :app:installDebug
```

On Windows use `gradlew.bat`. The wrapper pins Gradle 8.13 with a checksum; dependencies resolve from Google/Maven Central. Launch **Bota Connect**, enable Bluetooth access, enter the exact printed device serial, and scan. Wait for the ten-second scan to finish before selecting a candidate. Android 12+ uses Nearby Devices permissions; older versions use location permission (and may need system Location enabled for scanning). Read status after connection; disconnect when finished.

The application ID is `dev.bota.examples.kotlinconnect`, distinct from the React Native and Flutter samples so they can be installed together.

The SDK rejects a mismatching identity. Discovery names are display-only. Operations are serialized, and a failed status read after disconnection does not rebind or retry device operations. Teardown cancels UI jobs and destroys the SDK. This foreground sample has no background-service behavior.

The beta.8 dependency upgrade is undergoing fresh build and device checks;
previous dated results below describe beta.7. See the [current review](../../docs/independent-examples-review.md#beta8-adoption).

## Verify

```sh
./gradlew :app:assembleDebug
```

Build and phone-test evidence is in the [implementation review](../../docs/independent-examples-review.md). APK assembly alone does not prove a verified BLE session. [Public SDK reference](https://docs.bota.dev/api-reference/client-sdks).

2026-09-29 device check: Samsung SM-A166U1, Android 16/API 36, source `50ddf37`, App SDK beta.7, Bota Pin `4KF6NOHWX0` / firmware `1.0.19`. Installation, permission denial/recovery, discovery, wrong-serial rejection, exact-serial connection, status, explicit disconnect/reconnect, and manual recovery after phone Bluetooth off/on passed. A status read while the radio was off failed; selecting the candidate after radio-on restored connection and a fresh status. The beta.7 test did not establish automatic radio-loss reporting. Out-of-range recovery, other phones, and other firmware remain unverified.

## Connection events

The sample observes the public `connectionUpdates()` stream in its UI scope.
A verified connection displays its serial; a null event clears old status and
shows the reconnect instruction. Activity teardown cancels observation before
SDK destruction. Reconnect remains an explicit user action.

Beta.8 includes the Android loss-delivery fix. The listener clears stale status
on a confirmed disconnect; reconnect remains explicit. Fresh beta.8 physical
acceptance is tracked in the review.

The updated listener was phone-tested separately at `416d27c` with beta.7 on the
same Samsung / firmware 1.0.19 pair: verified connection, status, explicit
disconnect clearing the status, reconnect and final disconnect passed using
the preserved CI APK. Automatic radio-loss recovery remains pending beta.8.

The Kotlin GitHub Actions workflow preserves `app-debug.apk` as
`kotlin-device-connect-<commit>`. Use that exact artifact for source-matched
phone checks. CI debug signing keys can differ from local or previous builds;
uninstall only this sample if Android reports a signature mismatch, then
install the verified new APK. Uninstalling the sample clears its local app data.
