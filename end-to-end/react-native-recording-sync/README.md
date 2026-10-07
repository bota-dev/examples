# Encrypted recording sync with React Native and a backend

Select a recording on an already-provisioned Bota device, upload it through the
public App SDK's encrypted-v2 workflow, and request a transcription after cloud
publication. This independent example has an Android Expo application and a
local, authenticated Node backend. Install each from its own directory.

**Status:** implemented with 22 backend, 10 native adapter and 15 app tests
passing. The local Android APK built and installed; phone startup, backend
authorization and Bluetooth scanning passed. Hosted backend tests and Android
tests/assembly also [passed at `4511f40`](https://github.com/bota-dev/examples/actions/runs/37081961685).
A read-only phone retest with the fresh pairing guard verified the exact device
serial, fresh paired state and an empty catalog. Physical upload and broader
pairing-failure/recovery checks remain unverified.
Do not treat the earlier connection examples' phone tests as upload acceptance.
Current evidence and remaining checks are recorded in
[the implementation review](../../docs/independent-examples-review.md).

The backend rechecks binding after recording/configuration/job reads before
releasing known identity or creating a recording/transcription. Four regression
tests cover rebinding during those reads. Separate API reads and writes still
leave a race window; this is not atomic generation fencing.

Expo's Node signing tools retain an [open node-forge security advisory](../../DEPENDENCY_SECURITY.md#node-forge-open-advisory) with no published fix; passing application checks do not establish that this dependency is safe or unreachable.

## Scope

- One server-configured project, end user and already-bound device. The app
  verifies the exact SDK-read serial against the authorized backend context,
  then requires a fresh SDK pairing-state check before enabling device access.
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
The backend reads the selected device's serial from its authorized API resource;
the app does not embed a particular hardware serial. Test fixtures use synthetic
identifiers. Device serials in dated verification notes identify only the tested
hardware and are not application defaults.
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
   Its connected serial must match the server-authorized serial, and a fresh
   `BotaDeviceSDK.controls.isProvisioned(device)` read must confirm paired state.
3. List encrypted recordings. Legacy recordings are counted but excluded.
4. Choose a consented recording and select **Sync selected recording**. A fresh
   pairing check must succeed again, and fresh status must report idle and no
   active device upload. Signed material, staging headers,
   receipts and recording bytes remain native; only metadata crosses JavaScript.
5. Wait for the SDK operation to finish. It obtains the signed publication
   receipt and performs device confirmation before the app reports completion.
6. Select **Transcribe or check existing job** for the cloud recording. The app
   polls for up to five minutes and displays the text only after completion.

No progress message or successful PUT is authority to delete the source. The
app never issues its own recording-confirm or recording-delete command.

The public Android beta.10 `ConnectedDevice.isProvisioned` snapshot defaults to
false; it is not a live provisioning observation. This app uses the public
`controls.isProvisioned` read after connection and before each catalog or sync
operation. False or failed reads block access and attempt disconnect, with no
reset or rebind. A false result means paired state was not confirmed; it does
not prove credential loss. Late results from a retired operation cannot enable
access. Device pairing and the backend's current binding generation are separate
checks, and neither replaces the SDK's encrypted capability/authorization gates.

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

### Fresh pairing guard review — 2026-10-02

| Requirement | Evidence | Status |
| --- | --- | --- |
| Already-provisioned scope uses current device evidence | Public SDK `controls.isProvisioned` after verified serial and before catalog/sync; six added regressions cover default snapshot, rejected/failed reads, late results and cleanup failure; successful read-only phone retest | Matched for tested connection/catalog path; physical rejection and sync unverified |
| Connection loss wins over late checks | Operation epoch is checked before accepting pairing or changing access | Matched in unit tests; physical race unverified |
| Ownership and encrypted protocol remain independently enforced | Existing backend scope comparison, fresh idle/no-active-upload status and SDK encrypted-v2 workflow remain in place | Matched in source; physical upload unverified |
| Exact installed-app evidence | Existing debug APK plus repository-matched Metro JavaScript with the fresh guard; one scan/first connection, paired check, empty catalog and graceful disconnect passed | Matched for this bounded phone run; no new native build claimed |

This review follows the repository architecture's identity, lifecycle and
verification requirements. Typecheck, all 15 app tests and Android Metro export
pass; these checks are separate from the existing APK/native adapter evidence.
The [recording-sync workflow](https://github.com/bota-dev/examples/actions/runs/37045526827)
also passed backend and Android native adapter/build checks at source `daabf16`.

The 2026-10-02 read-only retest used Samsung SM-A166U1 / Android 16 and SDK-read
serial `4KF6NOHWX0`, with the same APK hash above and updated JavaScript from
`daabf16`. The UI reported fresh paired state; listing performed another fresh
pairing read and returned zero encrypted and zero legacy recordings. Graceful
disconnect disabled listing. The app, backend and Metro were stopped, temporary
forwarding removed, and Bluetooth left on. Firmware text was not displayed by
this UI. No audio transfer, source confirmation, transcription, recording control
or provisioning mutation was exercised. The earlier catalog observation without
this guard remains separate evidence.

A later October 2 continuation first encountered a ten-second connection timeout
in the synthetic-fixture entrypoint, before connection or device commands. After
restoring repository-matched `App.tsx` and cycling phone Bluetooth OFF/ON once,
the public example connected on its first attempt after one fresh scan. Exact
serial and fresh paired state passed; the catalog again contained zero encrypted
and zero legacy recordings. The native APK was unchanged. No synthetic clip,
clock/action grant, recording control, upload, configuration or firmware change
was started. This recovery observation does not identify the timeout's cause or
establish upload acceptance. See the [continuation evidence](../../docs/independent-examples-review.md#read-only-phone-continuation--2026-10-02)
for the source hash and timing. Explicit disconnect and cleanup passed; journals
were retained. The synthetic clip still awaits device-positioning confirmation.

Public references: [App SDK](https://docs.bota.dev/api-reference/client-sdks),
[API reference](https://docs.bota.dev/api-reference/introduction).
## October 7 signing-tool dependency checkpoint

The app's ordinary `npm ci` now applies a pinned node-forge parser guard;
`npm test` includes nine Forge/Expo regressions. Keep install scripts enabled.
See [qualification](../../docs/node-forge-parser-mitigation.md); scanner alerts,
native delivery and physical acceptance remain separate.

## October 7 build dependency guard

Frozen app installation applies standalone Forge and scoped braces guards.
`npm test` requires `npm run test:braces-security`; package/lock/public SDK identity
is unchanged. See the [source review](../../docs/braces-depth-mitigation.md).
Hosted assembly and physical device/install acceptance remain separate.

## October 7 new build-dependency fixes

Four independent locks select source-map-js 1.2.2; the legacy root also selects
shell-quote 1.11.0 and a qualified parent-scoped selector-parser 7.1.6 override.
Each install root has required public-consumer tests; Web CI now runs `npm test`.
See the [source compatibility review](../../docs/build-dependency-remediation.md) for aged tarballs, tests and
bundled-parser limits. Hosted/scanner and physical acceptance remain separate.
