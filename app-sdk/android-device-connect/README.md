# Connect to a device with Kotlin

A minimal native Android app using the public Maven Central artifact `dev.bota:bota-app-sdk:2.0.0-beta.13` (beta). Scan, select, verify the exact serial through the SDK, read status, disconnect. No backend, API key, provisioning, or recording operations.

## Current beta.13 adoption

The exact public Maven pin and dependency lock select beta.13. This release
includes the SDK's Android connect/MTU failure cleanup; transport recovery remains
the SDK's responsibility. The example adds no retries or GATT workaround.
Local public-package resolution and frozen-lock Android APK assembly pass with
JDK 17 and Android SDK 36. Hosted build and physical beta.13 acceptance are separate gates;
the older device results below do not qualify this version. See the
[adoption review](../../docs/independent-examples-review.md#beta13-adoption).

## Run

Requires JDK 17, Android SDK 36/build tools, and an Android 8+ (API 26+) phone with Bluetooth. Open this directory in Android Studio and run `app`, or configure `ANDROID_HOME` and use:

```sh
./gradlew :app:assembleDebug
./gradlew :app:installDebug
```

On Windows use `gradlew.bat`. The wrapper pins Gradle 8.13 with a checksum; dependencies resolve from Google/Maven Central. Launch **Bota Connect**, enable Bluetooth access, enter the exact printed device serial, and scan. Wait for the ten-second scan to finish before selecting a candidate. Android 12+ uses Nearby Devices permissions; older versions use location permission (and may need system Location enabled for scanning). Read status after connection; disconnect when finished.

The application ID is `dev.bota.examples.kotlinconnect`, distinct from the React Native and Flutter samples so they can be installed together.

The SDK rejects a mismatching identity. Discovery names are display-only. Operations are serialized, and a failed status read after disconnection does not rebind or retry device operations. Teardown cancels UI jobs and destroys the SDK. This foreground sample has no background-service behavior.

2026-10-01 UTC, beta.10: public Maven resolution, a targeted Bota-only lock update, and a separate frozen-lock Android build passed locally with JDK 17 and Android SDK 36. The resolved AAR SHA-256 is `a8fffe299c6ba02e1ac5a808785c68e5c85c093b1ab093e78bb923a2461514de` and POM SHA-256 is `2c980d25bbadfc7721549eaaa09125feb2af015f468d3abd47083aa8ee625e75`, matching the published artifacts from SDK source `f5c6482ac4378a2f35e902ade172a5cb779dffa6`. Hosted APK assembly passed in [CI 36893071809](https://github.com/bota-dev/examples/actions/runs/36893071809) at examples source `54237e14014f914270ec3c3b7648a82f2e97b9c5`. Phone installation was blocked by a signing-key mismatch, so beta.10 physical acceptance remains unverified. See the [current review](../../docs/independent-examples-review.md).

Historical beta.9 evidence, 2026-09-30 UTC: public Maven resolution, a targeted Bota-only lock update, and a separate frozen-lock Android build passed locally with JDK 17 and Android SDK 36. The resolved AAR SHA-256 was `dc90f8815f38efeaed88b45e89bf5bcd8991efff7b8f6e8453f90fc58b8eb4a1`, matching the released artifact. Hosted APK assembly passed in [CI 36766071441](https://github.com/bota-dev/examples/actions/runs/36766071441) at source `43a5bd3521fdbc9d24dcfea7e8d714f08359f681`. This sample's beta.9 physical-device checks were not performed.

Historical beta.8 evidence, 2026-09-30 UTC: [CI 36660614376](https://github.com/bota-dev/examples/actions/runs/36660614376) passed. Its preserved APK passed exact-serial connection, status, automatic radio-off UI cleanup without Read status or Disconnect, explicit reconnect after radio restoration, fresh status, and final disconnect on Samsung SM-A166U1 / Android 16 and Bota Pin firmware 1.0.19. See the [beta.8 review](../../docs/independent-examples-review.md#beta8-adoption); earlier dated beta.7 checks below remain historical.

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

Beta.10 retains confirmed-disconnect and Android adapter-off cleanup, and adds
cleanup when an explicit disconnect times out or is cancelled without a GATT
callback. The listener clears stale status; reconnect remains explicit. The
historical beta.8 foreground radio-off and explicit-reconnect check passed on
the recorded phone/firmware pair. It does not establish this example's beta.10
physical acceptance or a fix for native reconnect failures.

The updated listener was phone-tested separately at `416d27c` with beta.7 on the
same Samsung / firmware 1.0.19 pair: verified connection, status, explicit
disconnect clearing the status, reconnect and final disconnect passed using
the preserved CI APK. That historical beta.7 run did not test automatic radio-loss delivery; the beta.8 result above supersedes that pending gate for this phone/firmware pair.

The Kotlin GitHub Actions workflow preserves `app-debug.apk` as
`kotlin-device-connect-<commit>`. Use that exact artifact for source-matched
phone checks. CI debug signing keys can differ from local or previous builds;
uninstall only this sample if Android reports a signature mismatch, then
install the verified new APK. Uninstalling the sample clears its local app data.
