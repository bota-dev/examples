# Connect to a device with Kotlin

A minimal native Android app using the public Maven Central artifact `dev.bota:bota-app-sdk:2.0.0-beta.7` (beta). Scan, select, verify the exact serial through the SDK, read status, disconnect. No backend, API key, provisioning, or recording operations.

## Run

Requires JDK 17, Android SDK 36/build tools, and an Android 8+ (API 26+) phone with Bluetooth. Open this directory in Android Studio and run `app`, or configure `ANDROID_HOME` and use:

```sh
./gradlew :app:assembleDebug
./gradlew :app:installDebug
```

On Windows use `gradlew.bat`. The wrapper pins Gradle 8.13 with a checksum; dependencies resolve from Google/Maven Central. Launch **Bota Connect**, enable Bluetooth access, enter the exact printed device serial, and scan. Wait for the ten-second scan to finish before selecting a candidate. Android 12+ uses Nearby Devices permissions; older versions use location permission (and may need system Location enabled for scanning). Read status after connection; disconnect when finished.

The SDK rejects a mismatching identity. Discovery names are display-only. Operations are serialized, and a failed status read after disconnection does not rebind or retry device operations. Teardown cancels UI jobs and destroys the SDK. This foreground sample has no background-service behavior.

## Verify

```sh
./gradlew :app:assembleDebug
```

Build evidence is in the [implementation review](../../docs/independent-examples-review.md). Physical permission denial/grant, scan, matching/wrong serial, status, radio-off and reconnect checks remain unverified; APK assembly proves linkage, not a BLE session. [Public SDK reference](https://docs.bota.dev/api-reference/client-sdks).
