# Encrypted recording sync with React Native and a backend

Select a recording on an already-provisioned Bota device, upload it through the
public App SDK's encrypted-v2 workflow, and request a transcription after cloud
publication. This independent example has an Android Expo application and a
local, authenticated Node backend. Install each from its own directory.

**Status:** implemented with 18 backend, 10 native adapter and nine app tests
passing. The local Android APK built and installed; phone startup, backend
authorization and Bluetooth scanning passed. Hosted backend tests and Android
tests/assembly also [passed at `1145dff`](https://github.com/bota-dev/examples/actions/runs/37038166401).
Exact-device connection/catalog and physical upload checks remain unverified.
Do not treat the earlier connection examples' phone tests as upload acceptance.
Current evidence and remaining checks are recorded in
[the implementation review](../../docs/independent-examples-review.md).

## Scope

- One server-configured project, end user and already-bound device. The app
  verifies the exact SDK-read serial against the authorized backend context.
- Encrypted-v2 recordings only. The SDK checks fresh device capabilities before
  requesting upload material; unsupported devices fail without a legacy fallback.
- SDK-owned Bluetooth transfer, native files/checkpoints and signed-receipt
  device confirmation. Successful verified sync removes the device source.
- Application-owned native HTTP callbacks and scope/session metadata, plus a
  backend journal that retains cloud IDs and ambiguous outcomes.
- Explicit transcription after publication; cloud commitment, device cleanup
  and AI processing are separate outcomes.

This example does not pair or provision new devices, start/stop recording,
implement WiFi/4G fallback, reset devices, or replace the legacy example app.
The target opaque first-bind contract and wider lifecycle acceptance remain
separate prerequisites. Android is the only included native host.

## Prerequisites

- Node 22.23.2+, npm, JDK 17 and Android SDK tooling compatible with Expo 57.
- Android 8+ (API 26+) phone with Bluetooth. Use a USB connection with `adb` for
  the loopback backend instructions below.
- Exact public `@bota.dev/react-native-app-sdk@2.0.0-beta.10` and its matching
  Maven package, pinned by this example. No sibling repositories or unpublished
  SDK overrides are required.
- A disposable project and end user, an already-provisioned/bound device, and a
  synthetic or consented encrypted-v2 recording on it. Firmware version text
  alone does not establish encrypted-v2 capability or hardware qualification.
- A project API key kept only in the backend environment, and a separately
  generated application token. Follow [backend setup](backend/README.md) for
  exact environment variables and API permissions.
- Effective automatic transcription disabled for the test device. The backend
  verifies this before requesting explicit processing. Your project must have
  a permitted transcription provider configured.

## Start the backend

```sh
cd backend
npm ci
# Copy .env.example to .env and set the required test configuration.
npm start
```

The default listener is `127.0.0.1:8787`. In another terminal, forward the phone's
loopback port to that listener:

```sh
adb reverse tcp:8787 tcp:8787
```

The fixed server device/end-user/project mapping authorizes the workflow;
client-supplied IDs do not grant access. The application token is a local
development credential, not a production user-authentication system.
Use HTTPS and replace this fixed identity mode before hosting for multiple users.

## Run the Android application

```sh
cd app
npm ci
npm run android
```

For USB Metro access, also run `adb reverse tcp:8081 tcp:8081` and ensure Metro
is reachable on IPv4 loopback. This app contains a native upload module, so Expo
Go cannot run it. The app ID is `dev.bota.examples.recordingsync`; do not uninstall
an unrelated application if a debug signing key differs.

1. Enter `http://127.0.0.1:8787` and the separate backend application token.
   Credentials stay in memory. Restart the app to change identity or environment.
2. Authorize, allow Bluetooth permission, scan and select the expected device.
   Its connected serial must match the server-authorized serial.
3. List encrypted recordings. Legacy recordings are counted but excluded.
4. Choose a consented recording and select **Sync selected recording**. A fresh
   status must report idle and no active device upload. Signed material, staging headers,
   receipts and recording bytes remain native; only metadata crosses JavaScript.
5. Wait for the SDK operation to finish. It obtains the signed publication
   receipt and performs device confirmation before the app reports completion.
6. Select **Transcribe or check existing job** for the cloud recording. The app
   polls for up to five minutes and displays the text only after completion.

No progress message or successful PUT is authority to delete the source. The
app never issues its own recording-confirm or recording-delete command.

## Recovery and cleanup

Stop cancels the local operation; it does not cancel a cloud processing job or
delete retained data. After Bluetooth loss, restore Bluetooth, scan, connect,
and list recordings again. Late results cannot restore a retired connection's
UI. Allow local cancellation to finish before starting another operation.

Reuse the same backend journal and scope on restart. Refresh cloud recordings
to recover IDs even if device cleanup already completed. A repeated transcription
request checks the backend's recorded job instead of blindly starting another.
Unknown create or staging outcomes stop with retained state for reconciliation;
they are not automatically retried as new uploads. Session expiry and binding
changes can require operator reconciliation. See the backend and native module
notes for the exact supported recovery paths and remaining verification.

Do not delete the backend state directory or native journal to force a retry.
Cloud recordings/transcriptions and any device source not yet confirmed remain
after a failed test. Delete disposable cloud test resources deliberately through
the platform after reviewing their IDs. This app does not provide bulk cleanup.
Stop the app/backend when done and remove the temporary port forwarding:

```sh
adb reverse --remove tcp:8787
adb reverse --remove tcp:8081
```

## Verify locally

```sh
cd backend
npm ci
npm test
cd ../app
npm ci
npm run typecheck
npm test
npm run export
npx expo prebuild --platform android --no-install
cd android
./gradlew :recording-sync:testDebugUnitTest :app:assembleDebug --no-daemon -PreactNativeArchitectures=arm64-v8a
```

The native module's tests cover its HTTP, cancellation and journal obligations.
Mocked tests and native builds do not establish physical upload/receipt/deletion
ordering. Acceptance must identify the exact device, firmware, public package,
backend environment and recording, and preserve failures as well as successes.

The locally assembled and installed APK has SHA-256
`b0b817ef61890410d75e70839372fa838e179fc06ac34296d348b04157fc5f88`.
Its startup/authorization/scan observations do not establish encrypted transfer,
receipt validation, source deletion or live transcription. Physical upload awaits
selection of a synthetic or explicitly consented test recording.

Public references: [App SDK](https://docs.bota.dev/api-reference/client-sdks),
[API reference](https://docs.bota.dev/api-reference/introduction).
