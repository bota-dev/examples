# Bota Recordings with Flutter

A common Android recording-app template: browse cloud recordings, read a
transcript, create a general summary and ask about one recording. It shares
the [shared customer backend](../../README.md) with the web and React Native
clients in Bota Recordings. The UI uses normal Flutter Material navigation and a
small Sample/Live label; API recipes live in this README and source.

**Included host:** Android 8+ (API 26), compile SDK 37. An iOS host is not included
in this pass. The Dart UI is not evidence for native iOS, desktop or browser
support. This is a development template, not a production authentication system.

## Try it

Use Flutter **3.47.5**, JDK 17 and Android SDK 37. The direct SDK dependency is
exact public `bota_app_sdk: 2.0.0-beta.18` (beta); no private packages or sibling
repositories are required. The regenerated pub lock selects archive SHA-256
`30441cc7c83bb9cef7fddac19d047a59b4ad38c4a3dcb27de3dad4700613ab4a`.
Only the Bota version/hash changes; all other locked packages and application
code remain. See the [beta.18 qualification](../../../../docs/design-reviews/2026-10-14-native-sdk-beta18-adoption.md).
New hosted and physical-device acceptance remain separate.

Historical [beta.17 qualification](../../../../docs/design-reviews/2026-10-14-native-sdk-adoption.md)
and its [passing hosted job at a7b34175](https://github.com/bota-dev/examples/actions/runs/38654533509/job/116161047923)
retain their original source/package limits. The `6dd54747` snapshot also retained
Flutter beta.17 before beta.18 appeared on pub.dev. Those results do not qualify
this new package.

Run the commands below from this client directory.

```sh
flutter precache --android
flutter pub get --enforce-lockfile
flutter run
```

Select **Try sample recordings**, then a recording. Choose **Create transcript**,
the **Summary** tab and **Create summary**, then **Ask**. This mode uses synthetic
fixtures in [sample_api.dart](lib/sample_api.dart). It makes no HTTP/provider
calls, initializes no device SDK and requests no Bluetooth permissions. Its
in-memory recordings and requests reset when you leave the sample session.
It contains no audio files, playback or fabricated device receipts.

## Connect your customer backend

Start the [combined backend](../../README.md), using its fixed project
and end-user mapping and separate `APP_ACCESS_TOKEN`. Bota secret/restricted
keys stay only on that backend. For a USB Android phone:

```sh
adb reverse tcp:5173 tcp:5173
```

Replace the prefilled `8787` backend URL with `http://127.0.0.1:5173`, then choose
**Connect** with the application token. The
app sends that token as Bearer to the customer backend, keeps it only in memory,
and closes pending HTTP work/clears content on signout. Never enter a Bota API
key. HTTPS is required except on loopback; the Android debug host permits
cleartext only for loopback. Configure signing and a real user-authentication
system before distributing or hosting for multiple users.

Live mode reads the first bounded page of cloud recordings and labels truncated
results. It does not import audio or create recordings itself. Use the combined
React Native encrypted-upload path, or another authorized upload workflow, to
populate the library. This Flutter app can then demonstrate API processing of
existing uploaded recordings without depending on SDK transfer availability.

| Recipe | Customer-backend call | Public API taught on the backend |
| --- | --- | --- |
| Recording library/detail | `GET /api/library/recordings`, `GET /api/library/recordings/:id` | `GET /v1/recordings`, `GET /v1/recordings/:id` |
| Transcript | `GET/POST /api/library/recordings/:id/transcriptions` | `GET /v1/transcriptions`, `POST /v1/transcriptions` |
| General summary | `GET/POST /api/library/transcriptions/:id/summaries` | `GET /v1/summaries`, `POST /v1/summaries` |
| Recording-scoped Ask | `POST /api/library/recordings/:id/ask` | `POST /v1/ask/sessions`, `POST /v1/ask/sessions/:id/messages` |
| Known-request recovery | `GET /api/library/operations`, `GET /api/library/operations/:id` | Backend journal and scoped resource GETs |

The calls live in [recordings_controller.dart](lib/recordings_controller.dart)
and the bounded HTTP adapter [api.dart](lib/api.dart); the
[shared backend](../../backend/) holds the common public Bota calls;
its [mobile route adapter](../../../react-native-recording-sync/backend/README.md)
documents authorization and the retained library/native journal contracts.
Its standalone `8787` launcher remains available for compatibility; this guide
uses the combined backend on `5173`.
The [UI](lib/main.dart) contains library/detail and Transcript/Summary/Ask tabs.
[Public API and SDK reference](https://docs.bota.dev/api-reference/client-sdks).

Processing is explicit. Completed requests without errors have no detail recovery
panel, leaving transcript, notes and answer content in focus. Busy, uncertain
and failed requests retain their notices. Completed request metadata remains in
the initially collapsed **Recent requests** section.

Failed, timed-out or ambiguous writes remain locked
when navigating among tabs or recordings. **Recent requests** and **Refresh
request** use GET only and never repeat POST. A known request can be reconciled;
a request without a known resource may stay uncertain and need operator
investigation. Restarting or signing out does not erase the backend journal.
Only the two backend readiness rejections (`upload_unverified` and
`transcription_incomplete`) with no operation field permit another explicit
action. Changing accounts or recordings fences late results; recovered metadata
never injects old answer content. Refresh recording/summary to read current
source content. No automatic processing polling is added in this template.

## Optional device connection

Live mode's settings menu includes **Device connection**. Enter the printed
serial, explicitly enable Bluetooth access, scan, select and read status. This
secondary [screen](lib/device_page.dart) calls only the public beta.18
`BotaDeviceClient.configure`, `devices.scan/connect/readStatus/disconnect` and
`destroy`. SDK identity reads verify the serial; advertised names are not identity.
Connection loss clears/fences stale metadata. Restore Bluetooth and reconnect
explicitly. Returning from this page drains subscriptions and pending SDK
configuration, then awaits client destruction before another device page may
open. If destruction fails, the safe error remains visible and new device
admission stays blocked until an app restart; cloud recording screens remain
available. Ending the session disposes its client and fences remaining work.

The published Dart facade lacks the fresh pairing-state gate and encrypted-v2
host callback/receipt workflow needed for the combined upload contract. Therefore
this screen does not list/transfer/delete device recordings, pair/provision,
control recording, reset or emulate completion. A connection snapshot is not
cloud ownership or upload authorization. SDK iOS support does not imply this
Android-only host has passed iOS acceptance.

## Checks and evidence

```sh
node --test scripts/test-flutter-licenses.mjs
node scripts/check-flutter-licenses.mjs
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug
```

Local tests exercise the synthetic journey, phone-size navigation, signout,
stale account/recording/read results, retained write locks, wrong source and
citation rejection, GET-only recovery, actual loopback HTTP authorization,
redirect refusal, response bounds and deadlines. Connection lifecycle tests use
the published SDK's testing boundary. None of these establishes physical device,
live Bota API, provider or native iOS acceptance. Local/hosted check results are
recorded in the [combined implementation review](../../../../docs/independent-examples-review.md).

Local qualification on October 12, 2026: frozen pub install, formatting,
analysis and **38 tests** pass (9 HTTP, 15 controller, 10 device lifecycle,
4 app widgets). The final-source Android debug APK also builds with Flutter
3.47.5/JDK 17/SDK 37. Its application ID is
`dev.bota.examples.mobile_recordings_flutter`. The public beta.18 plugin still
uses Kotlin Gradle Plugin and produces Flutter's migration warning; this build
does not establish compatibility with a later Flutter toolchain. Hosted results
and any phone UI observations require their separate exact-source evidence.

This package reuses the exact dependency graph of the existing Flutter connection
sample; it adds no third-party dependency. CI checks resolved package-root license
texts using this client's [license script](scripts/check-flutter-licenses.mjs)
after frozen pub installation. Its current
44-notice check passes; this is not a recursive native Maven, CocoaPods, Rust,
Gradle or Flutter-binary license audit. The implementation review records that gate's
qualification and limits. Flutter-generated host files retain their notices;
Bota-authored code uses the root [MIT license](../../../../LICENSE).
