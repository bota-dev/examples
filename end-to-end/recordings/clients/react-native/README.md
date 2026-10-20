# Bota Recordings — React Native Android and iOS app

A common recording app template with a library, recording detail and
**Transcript / Summary / Ask** tabs. Customers can adapt its ordinary React
Native screens and narrow customer-backend interface. It is a general platform
sample, not a vertical product or production authentication system.

This complete install root is now inside the integrated
[Bota Recordings sample](../../README.md). The former
`end-to-end/react-native-recording-sync/app` entry forwards here. Moving the
client changes no SDK pin, native identity, backend launch base or journal.

The cloud library, ordinary file import, playback and result screens target
**Android and iOS**. **Device encrypted-v2 sync remains Android only**: its local
Kotlin host is never loaded or offered by the iOS UI. The public npm package and
native Maven host both pin SDK **2.0.0-beta.19**. Existing native adapter,
journals and dependency guards are retained. Native iOS builds and actual media
decoding need separate macOS/device qualification; a Metro export is source evidence.

This package update uses the public `BotaClient` / `BotaDeviceSDK`
native-workflow compatibility entry. It does not migrate to the generated
JavaScript `/runtime` entry or its OS ports. The native material registry,
backend origin, capture journals and SDK receipt/cleanup authority stay intact.
See the [published SDK adoption review](../../../../docs/design-reviews/2026-10-14-beta18-sdk-adoption.md)
for current qualification; earlier device/build results remain historical.

## Run the sample

Use Node 22.23.2+, JDK 17 and the Android SDK required by Expo 57 for Android:

On Windows, use a short checkout/build path for native assembly. Deep worktree
paths can exceed CMake's object-path limit even when JavaScript checks pass.

```sh
cd end-to-end/recordings/clients/react-native
npm ci
npm run android
```

For iOS, use macOS with Xcode and CocoaPods 1.13+. Expo generates the ignored
native host reproducibly from [app.json](app.json), then installs its public
native dependencies. No sibling SDK checkout is required:

```sh
npm ci
npm run prebuild:ios
npm run ios
```

The simulator can use the Mac's `http://127.0.0.1:8787` backend. An iPhone needs
an HTTPS backend origin reachable from the phone; HTTP LAN origins remain
rejected. The config permits local-network development, disables microphone
permissions and background recording/playback, and requests no iOS Bluetooth
permission because this host implements cloud flows only. No iCloud entitlement,
media-library permission or production account configuration is needed for the
system file picker. Build a new app after native dependency/config changes.

Run these commands from a repository checkout. When adapting the client, copy
this entire install root, including `modules/`, `scripts/`, `vendor/` and the
lockfile. Copying only the screens omits its native host and mandatory dependency
guards. Do not copy generated `android/`, `ios/`, `.expo/`, `dist/` or
`node_modules/`; regenerate them in the destination.

Choose **Try sample recordings**. This mode uses two synthetic recordings and
in-memory results. It does not import the Device screen, configure the SDK,
request Bluetooth permissions, record audio or call `fetch`. One recording
already has a transcript; the other lets you start a simulated transcription.
Use **Refresh results** to advance synthetic transcription/summary jobs.
Ask returns a clearly labelled fixed answer for every question, with a sample
timestamp. No provider, publication receipt or device cleanup is simulated.
**Exit sample** clears results and starts a fresh fixture set next time.

The Android application includes a custom native device module. Use development
builds; Expo Go does not qualify the complete app. Sample mode contains synthetic
text only; import and playback are live-backend actions.

## Connect a customer backend

Use the [combined backend setup](../../README.md#run-an-application), or the
retained [companion launcher](../../../react-native-recording-sync/backend/README.md).
The combined backend requires the Web installation and both service adapters;
copy the full repository family described there. For existing native captures,
retain `http://127.0.0.1:8787`: set the combined host's `PORT=8787` and
`APP_ORIGIN=http://127.0.0.1:8787`, then forward it with
`adb reverse tcp:8787 tcp:8787`. Enter its origin and separate
`APP_ACCESS_TOKEN` under **Connect backend**. Keep the Bota project key on the
server. HTTPS is required except loopback development; URL credentials, paths,
query strings and Bota token prefixes are rejected before an app request.
The app keeps its application token in memory and sends it only as a bearer
credential to that origin; it has no cookie or persistent credential store.

The app's initial/reset origin remains `http://127.0.0.1:8787`. Fresh cloud-only
setup may explicitly use the combined default `5173` origin with matching port
forwarding. The native journal includes the backend origin in its recovery
identity; changing ports is not a migration of retained captures. Do not reset
journals or rewrite their scope to follow the folder move.

The library reads the backend's fixed authorized end user. It does not require
a Bluetooth connection. Select a recording, refresh its current state, then
explicitly start transcription, summary or Ask when its source is ready.
Summary uses `tmpl_general_notes`; Ask is scoped to one recording and validates
returned citation recording IDs. Source/job IDs are projected into bounded
typed objects; arbitrary backend error text is never displayed.

The independent [library adapter](library-api.ts) calls these customer-owned
routes; they are wrappers around public Bota APIs, not Bota endpoints themselves:

| Customer route | App action |
| --- | --- |
| `POST /api/library/uploads` | Explicit ordinary file import, raw file body and encoded `X-File-Name`. |
| `GET /api/library/recordings/:id/audio` | Authorized bounded WAV bytes; no signed URL enters the app. |
| `GET /api/library/recordings` and `GET /api/library/recordings/:id` | Library and current detail; explicit cursor pagination. |
| `GET/POST /api/library/recordings/:id/transcriptions` | Read transcripts or explicitly request one. |
| `GET/POST /api/library/transcriptions/:id/summaries` | Read general notes or explicitly request a summary. |
| `POST /api/library/recordings/:id/ask` | Send one trimmed question. |
| `GET /api/library/operations` and `GET /api/library/operations/:id` | Saved request metadata and GET-only reconciliation. |

The live library uses official `expo/fetch`, requests `redirect:error`, rejects
a differing exposed response URL, limits normal requests to 30 seconds, upload
to 180 seconds, playback to 120 seconds and Ask to 210 seconds. JSON has a 2 MiB
declared/content text cap. The WAV reader checks `audio/wav`, explicit no-store,
matching declared and received size (44 bytes–25 MiB), exact RIFF/WAVE bytes and
the RIFF size (including the exporter's unknown-size sentinel), before creating
a private cache file. Its streamed body cap bounds bytes accumulated in app
code; it does not qualify platform buffering or audio decoding. The companion
server also bounds its upstream requests and does not issue redirects. Native fetch redirect
enforcement remains a platform qualification check; a final URL check cannot
undo a native redirect already followed. No app request automatically retries.

## Ordinary audio import and playback

[native-media.ts](native-media.ts) contains the small OS ports: the system
document picker copies one audio file into private cache, `expo-file-system`
supplies its native File body (no base64), and `expo-audio` plays a private WAV
cache file. [audio-player.ts](audio-player.ts) uses its public loaded/error events
and native-resource release. [picked-audio.ts](picked-audio.ts) validates metadata
and removes an invalid picker cache copy even before returning it to the controller.
[library-api.ts](library-api.ts) holds the two customer-backend calls;
[media-controller.ts](media-controller.ts) owns per-account async fences, local
cleanup and upload uncertainty; [MediaControls.tsx](MediaControls.tsx) is the UI,
using the shared leaf [Action](Action.tsx) button with the recording screens.
These files plus their documented imports are the copy boundary.

Select **Choose and upload audio** for WAV/MP3/M4A/OGG/Opus/WebM/FLAC up to 25 MiB.
Known audio MIME aliases are normalized; missing/octet-stream types use only
the documented audio extensions. This classifies the request and proves no
codec, plaintext or integrity property. Other explicit MIME types are refused.
The server verifies original upload before admitting
processing. Refresh the library to read its recording, then choose transcription,
summary or Ask separately. A saved upload can be refreshed only by its known ID.
An uncertain write locks that intent; there is no resend button. **Import another
file** is offered only after exact completed-upload metadata and a fresh matching,
upload-verified recording read. Identical-file deduplication remains server-owned.

Select a recording and **Load audio**, then **Play audio**. Loading never autoplays.
Readiness waits for Expo's public `playbackStatusUpdate`/`isLoaded` event or an
already-loaded `currentStatus`, with a ten-second local decoder deadline.
Unsupported/failed audio shows a sanitized message and releases the exact cache
and native player; an asynchronous error after loading also clears readiness.
The retained status subscription is removed before both registry removal and
public `SharedObject.release()`. A synchronous `play()` result alone is not
decoder acceptance. Reload is explicit after a decoder error or media reset.
The backend checks fresh ownership and explicit ordinary-import/plaintext evidence;
device/encrypted recordings remain unavailable. The app never treats API job status
as device-cleanup authority. Switching recordings, refreshing detail, returning
to the library, leaving for Device, sign-out and unmount retire the player, pause,
release and delete its private cache. Late network/native/picker results are fenced
to their original account/selection and cleaned up. The user's original picked
file is never deleted. Backgrounding pauses audio. A failed release blocks more
playback until restart. Sign-out joins pending picker/player finalizers before
admitting another account; close a still-open picker to finish that cleanup.
An OS kill may leave cache files for OS cache reclamation;
this example does not promise secure erasure or process-crash cleanup.

The exact public [media dependency receipt](media-dependencies.json) records
MIT licenses, registry publication dates, URLs and SRI. Asset/constants are
explicit Expo 57 peers so npm cannot silently choose SDK 58 for `expo-audio`.
The original signing/Metro/source-map guards remain required.

## Device recordings

On Android in live mode, choose **Device** to load [DeviceSync.tsx](DeviceSync.tsx). That
explicit action is the only entry into SDK/native code and Bluetooth permission
requests. The retained encrypted-v2 path requires the backend's separately
configured, already-bound device, a fresh SDK-read serial/pairing check,
compatible capabilities and inactive direct upload. It does not provision,
reset, rebind or start/stop recording. Read the enclosing
[device prerequisites and evidence](../../../react-native-recording-sync/README.md)
before syncing real audio.
New App SDK acceptance is encrypted-upload-v2 only: require exact capture
identity/ciphertext integrity, authoritative cloud verification, a signed
completion receipt and receipt-gated cleanup. Ordinary import/playback and
historical legacy transfer results do not qualify this physical device path.
Preserve retained unknown device uploads and journals.
Device uses the live session's origin/token; select **Enable device access** to
authorize that configured device and request permissions. Changing credentials
requires returning to the library and signing out, rather than entering another
token inside the Device panel.

Successful verified sync removes the recording's physical device source only
through the SDK's receipt/confirmation workflow. The app issues no separate
delete or confirm command. Select **Back to recordings** to cancel local work,
wait for any in-flight action and its finalizers, then await final native host
disposal and the public SDK's asynchronous destruction before the cloud library
refreshes. If disposal fails, further device actions remain blocked and the app
asks for a restart; journals are retained. Processing happens in the library,
separately from upload and device cleanup.
The [device session gate](device-session.ts) also serializes owners after an
unmount or expired-account transition, so an old late configure/finalizer cannot
dispose a replacement screen's native host. It registers only on an explicit
action, not during rendering. A failed final cleanup blocks subsequent device
admission until restart.
Cleanup also retires the screen's owner identity before waiting; old SDK events
cannot update a replacement owner. An effect setup after a development cleanup
creates a fresh owner on its next explicit action.

## Interrupted work and adaptation

[RecordingsController](recordings-controller.ts) is used directly by
[Recordings.tsx](Recordings.tsx). Session-level action locks survive tabs,
recording selection and returning to the library. Ask locks use the exact
trimmed question in memory; the backend owns its durable hash/intent. An
uncertain POST is not sent again from that session. The only unlocks are the
backend's known preclaim upload/transcription readiness failures without an
operation property. Known request IDs can be refreshed by GET; unknown IDs
require backend-journal inspection. Restarting or signing out does not delete
or reset the backend's durable operations.

Screen changes and question edits fence late content, including editing away
and back to the original question without unlocking its intent. Summary results
must retain both the exact selected recording and transcription IDs.
**Sign out** clears the application token,
recording text, questions, answers and local request maps, aborts pending local
requests and retires the adapter. Aborting an app request does not cancel a
cloud provider job or undo a POST. The secondary **Request status** panel shows
metadata only; it does not reveal recovered answers from unscoped saved rows.
Successful completed request metadata stays in that initially collapsed panel;
the main result view retains notices for active, uncertain, failed or
not-yet-ready actions. Hiding a completed notice does not unlock its intent or
change GET-only recovery.

Keep API credentials and authorization in a customer backend. Replace the
fixed local bearer mapping with your application's authenticated per-user
backend contract before hosting for customers. Device transport/files/receipts
remain SDK/native responsibilities; do not move them into JavaScript state.

## Verification

```sh
npm run typecheck
npm test
npm run export
npm run export:ios
npm run prebuild:ios
```

New focused tests exercise the real adapter/controller used by these screens:
synthetic flow without network, source/citation projection, stale content,
signout disposal, lasting action locks and GET-only known-request recovery.
Media cases cover raw upload, input limits, source denial, WAV bounds, exact
operation/recording recovery, late callbacks and player/cache retirement. The
existing identity/lifecycle, native signing, Metro/braces and source-map suites remain in
ordinary `npm test`. These are local synthetic tests and platform Metro
exports, separate from native assembly, rendered phone UI, live APIs, provider
configuration and physical upload/deletion acceptance.

October 20 local qualification: normal frozen install (477 packages, audit 0),
74 app/adapter/controller cases, strict types, 32 signing, 21 Metro and four
source-map cases pass, with a 450-package license scan. The eight public
dependency receipts match exact locked versions, tarballs and integrity.
The normal iOS prebuild command refuses Windows; native generation/build must
run on a supported macOS host. Installed UI, audio decoding and fresh physical
encrypted-v2 acceptance remain separate gates.

| Design requirement | Implementation and source evidence | Status |
| --- | --- | --- |
| Native clients over one customer backend | Android/iOS cloud screens and fixed Bearer import/audio routes; Android-only device entry/module | Matched in source; native iOS build separate |
| No replay of uncertain writes | Upload intent lock before POST, known-operation GET, exact complete operation and fresh verified recording before another import | Matched in synthetic controller/adapter tests |
| Account/selection lifecycle and local media | Public loaded/error/deadline gate, late results fenced, sequential replacement player admission, joined sign-out, immediate pause and private-cache/native shared-object release | Matched in synthetic tests; OS media behavior unverified |
| Public packages and dependency guards | Exact SDK beta.19 npm/Maven and Expo 57 media pins, normal frozen install, all existing mandatory chains | Matched locally; hosted checks separate |
| Encrypted device recording acceptance | Retained Android SDK receipt authority and journals; no iOS encrypted host | Unverified; ordinary imports do not qualify it |

The [relocation review](../../../../docs/design-reviews/2026-10-12-react-native-client-move.md)
records fresh install, source-preservation and native-build evidence separately.

## Node signing-tool dependency gate

Keep installation scripts enabled. This install root carries its own
`vendor/expo-native-signing` public-upstream sources, reproducible archives and
provenance. Its mandatory `verify-native-expo-signing.mjs` checks all 803 installed
CLI/provider assets and rejects Forge in the lock or physical tree; 32 native
contract/caller cases replace the previous Forge-only suite. Existing braces,
source-map, query-string and native checks remain required where applicable.
See [the exact scope and local/hosted limits](../../../../docs/native-expo-signing-replacement.md).
No public SDK/Expo version or application/device behavior is upgraded by this
development-tool replacement.

## Public Metro matching dependency gate

Keep normal installation scripts and every existing test chain enabled. These
reviewed downstream Metro parents retain their public names/versions and only
replace their internal micromatch `.some` import with its literal public source
and the same locked picomatch 2.3.2. The existing braces entry point now requires
21 zero-removal/asset checks; native signing still attests 803 assets and runs
32 cases. The dated dependency remediation preserved SDK beta.13;
the separate beta.18 upgrade retains application/device contracts and native/source-map tests.
See [exact local qualification and remaining source, hosted,
scanner and native gates](../../../../docs/metro-public-matching-removal.md). Local checks do not establish scanner
closure or physical acceptance.
