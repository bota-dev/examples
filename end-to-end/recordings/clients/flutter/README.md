# Bota Recordings with Flutter

The device-info dependency is pinned to public `device_info_plus` 13.3.0.
Its Android response includes the required integer build `time`; synthetic
platform fixtures include that field so the Bluetooth lifecycle tests exercise
initialization and cleanup with the native plugin's response shape. The reviewed
archive identity and BSD license are recorded in `dependency-provenance.json`.

A common Android and iOS recording-app template: import ordinary audio, play
verified imports, browse cloud recordings, read a
transcript, create a general summary and ask about one recording. It shares
the [shared customer backend](../../README.md) with the web and React Native
clients in Bota Recordings. The UI uses normal Flutter Material navigation and a
small Sample/Live label; API recipes live in this README and source.

**Included hosts:** Android 8+ (API 26), compile SDK 37, and normal Flutter iOS
15+ Runner (`dev.bota.examples.mobileRecordingsFlutter`). Hosted Android/iOS
build evidence is recorded below; physical behavior remains unverified. Desktop/browser hosts
are not included. This is a development template, not a production authentication system.

## Try it

Use Flutter **3.47.5**, JDK 17 and Android SDK 37. Android media plugins also need
SDK Platform 35, NDK `28.2.13676358` and CMake `3.22.1` installed through your
licensed Android SDK Manager. The direct SDK dependency is
exact public `bota_app_sdk: 2.0.0-beta.20` (beta); no private packages or sibling
repositories are required. The regenerated pub lock selects archive SHA-256
`62a29ec4bf6e60dc1a7e98b8741e1201a8ab936b70090c7f9684fc7267bf11e5`.
The October 20 source adds public `file_selector: 1.1.0` (BSD),
`just_audio: 0.10.6` (MIT) and `path_provider: 2.1.6` (BSD) plus their frozen
dependencies. Existing non-SDK lock entries stay unchanged. See the historical
[beta.18 qualification](../../../../docs/design-reviews/2026-10-14-native-sdk-beta18-adoption.md)
for that earlier package; it does not qualify this new source.

[Public dependency provenance](dependency-provenance.json) matches the frozen
archive hashes, publication times and licenses. The October 20 media review
retained compatible `file_selector_ios 0.5.3+6` and `file_selector_macos 0.9.5+1`
while their newer releases were younger than seven days. This SDK update keeps
those non-SDK pins. The beta.20 SDK archive was
published on October 21 and meets the seven-day age floor at the October 28 update review. Earlier beta.19 acceptance remains
historical evidence for its recorded source and package.

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

For iOS, use macOS, Xcode and CocoaPods, run `flutter precache --ios`, then the
same frozen install. `flutter build ios --debug --no-codesign` checks native
composition; choose your own signing team in `ios/Runner.xcworkspace` before
`flutter run -d <iphone-id>`. Bluetooth needs a real iPhone. The host declares
only foreground Bluetooth usage and permits local-network development access;
use HTTPS for a remote customer backend. It adds no microphone/background mode.

Select **Try sample recordings**, then a recording. Choose **Create transcript**,
the **Summary** tab and **Create summary**, then **Ask**. This mode uses synthetic
fixtures in [sample_api.dart](lib/sample_api.dart). It makes no HTTP/provider
calls, initializes no device SDK and requests no Bluetooth permissions. Its
in-memory recordings and requests reset when you leave the sample session.
It contains no audio files, playback or fabricated device receipts. Import and
playback controls appear only after connecting a live customer backend.

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
results. Choose **Import audio** to pick one WAV, MP3, M4A, OGG, Opus, WebM or
FLAC file up to 25 MiB. The picker streams bounded bytes before one authenticated
raw-body upload. The backend journals intent and verifies storage completion;
transcription remains an explicit later action. A lost/invalid upload response
keeps its UI lock and only **Recent requests** GET recovery is available. Do not
repeat an uncertain upload by restarting/signing out or deleting its journal.

Open a recording and choose **Load audio**, then **Play audio**. Only authorized,
verified ordinary imports supported by the backend WAV export can play. Device
and encrypted sources stay unavailable. The app never gives the native player
an app token, Bota key or signed URL: it fetches at most 25 MiB of validated WAV
through the customer backend, then uses an app-private temporary cache file.
There is no autoplay. Source refresh, selection/Back, signout, disposal and
backgrounding stop/dispose the player and delete that temporary file. Pending
picker/load work drains before replacement media; cleanup failure blocks new
media until restart. An OS/process crash may leave app cache for the OS to evict;
this is foreground playback, with no durable offline library.

| Recipe | Customer-backend call | Public API taught on the backend |
| --- | --- | --- |
| Recording library/detail | `GET /api/library/recordings`, `GET /api/library/recordings/:id` | `GET /v1/recordings`, `GET /v1/recordings/:id` |
| Ordinary audio import | `POST /api/library/uploads` | Create recording, obtain upload URL, PUT storage bytes, complete/verify upload |
| Ordinary-import playback | `GET /api/library/recordings/:id/audio` | Fixed WAV download/export with fresh owner/source/session checks |
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
The [native media ports](lib/recording_media.dart) hold the public picker/player
calls and transient-file lifetime. The [UI](lib/main.dart) contains import,
explicit audio controls and library/detail with Transcript/Summary/Ask tabs.
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
secondary [screen](lib/device_page.dart) calls only the public beta.20
`BotaDeviceClient.configure`, `devices.scan/connect/readStatus/disconnect` and
`destroy`. SDK identity reads verify the serial; advertised names are not identity.
Connection loss clears/fences stale metadata. Restore Bluetooth and reconnect
explicitly. Returning from this page drains subscriptions and pending SDK
configuration, then awaits client destruction. The public Flutter facade is a
process singleton and `destroy` is terminal, so device admission is single-session
per process: after leaving, **Device connection** stays disabled with a restart
notice. Cloud recording screens remain available. Failed destruction retains its
error and also blocks device admission. Restart the application process before
another device session; do not use test-only constructors or private factories
to bypass this public facade limit. Ending the session fences remaining work.

The published Dart facade lacks the fresh pairing-state gate and encrypted-v2
host callback/receipt workflow needed for the combined upload contract. Therefore
this screen does not list/transfer/delete device recordings, pair/provision,
control recording, reset or emulate completion. A connection snapshot is not
cloud ownership or upload authorization. The new iOS host does not establish
physical iOS or encrypted-upload-v2 acceptance.

## Checks and evidence

```sh
node --test scripts/test-flutter-licenses.mjs
node scripts/check-flutter-licenses.mjs
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --debug --no-codesign # macOS/Xcode/CocoaPods
```

Local tests exercise the synthetic journey, phone-size navigation, signout,
stale account/recording/read results, retained write locks, wrong source and
citation rejection, GET-only recovery, actual loopback HTTP authorization,
redirect refusal, response bounds and deadlines. Connection lifecycle tests use
the published SDK's testing boundary. None of these establishes physical device,
live Bota API, provider or native iOS acceptance. Local/hosted check results are
recorded in the [combined implementation review](../../../../docs/independent-examples-review.md).

October 20 local checks: the beta.19 frozen pub install, final formatting and
analysis, **61 tests**, **84 resolved package license notices** and the five
license-gate regressions pass on Flutter 3.47.5/Windows. These cover 15 actual
loopback HTTP cases, 15 existing recording controller cases, 13 media-port cases,
13 device lifecycle/admission cases and five UI widgets. Android debug assembly passes
through the normal Gradle host with JDK 17 and the installed SDK/NDK/CMake above.
At source `a10743d`, [hosted CI](https://github.com/bota-dev/examples/actions/runs/39517257471)
passes Android APK assembly and unsigned iOS simulator/device builds, with frozen
installation, analysis, tests and license gates. Native decoder output, real
picker behavior and physical-device behavior remain separate; see the
[current review](../../../../docs/design-reviews/2026-10-20-ios-mobile-recording-flows.md).

Local qualification on October 12, 2026: frozen pub install, formatting,
analysis and **38 tests** pass (9 HTTP, 15 controller, 10 device lifecycle,
4 app widgets). The final-source Android debug APK also builds with Flutter
3.47.5/JDK 17/SDK 37. Its application ID is
`dev.bota.examples.mobile_recordings_flutter`. The public beta.18 plugin still
uses Kotlin Gradle Plugin and produces Flutter's migration warning; this build
does not establish compatibility with a later Flutter toolchain. Hosted results
and any phone UI observations require their separate exact-source evidence.

This package adds the three public native-media dependencies above to the existing
connection graph. CI checks resolved package-root license
texts using this client's [license script](scripts/check-flutter-licenses.mjs)
after frozen pub installation. Its current
84-notice check passes; this is not a recursive native Maven, CocoaPods, Rust,
Gradle or Flutter-binary license audit. The implementation review records that gate's
qualification and limits. Flutter-generated host files retain their notices;
Bota-authored code uses the root [MIT license](../../../../LICENSE).
