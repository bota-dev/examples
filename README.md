# Bota Examples

Demo/sample/template code for developers building end-user applications with the
public Bota API and App SDK.

The foundation is **Bota Recordings**: one integrated recording sample with
copyable features, one shared customer backend and clients for React web,
React Native, Flutter, native Android/Kotlin and Apple/Swift. Use normal platform
UI and the published SDK; each client exposes its actual supported capabilities.

**The foundation is partially implemented.** The [combined backend](end-to-end/recordings/README.md)
now provides one Node listener for the existing Web cookie and mobile Bearer
adapters, with shared recording, upload/playback, transcription/general-notes
and Ask features. The three original journals and response contracts remain
separate; webhook and native service modules retain their compatibility paths.
Flutter and React Native have complete install roots under
`end-to-end/recordings/clients/`, alongside small Kotlin and Swift cloud readers.
Web retains its existing path and adds optional device connection/status with
public SDK beta.20. The ten existing SDK roots retain exact public beta.19.
Native identities, backend launch bases and journal
locations are unchanged.

There are exactly two product layers: **general platform capabilities now**,
then **vertical and app-type examples later**. The integrated sample and its
focused guides/quickstarts belong to the general layer. `api/`, `app-sdk/` and
`end-to-end/` are current source formats, not extra product layers.

## Start with Bota Recordings

| Client | Run and adapt | Implemented today |
| --- | --- | --- |
| React web | [Web sample](end-to-end/web-reference/README.md) | Audio import, ordinary-import playback, library, Transcript/Summary/Ask; optional desktop Chromium device connection/status |
| React Native Android / iOS | [RN sample](end-to-end/recordings/clients/react-native/README.md) | File import, ordinary-import playback, library and Transcript/Summary/Ask; encrypted device sync is Android-only |
| Flutter Android / iOS | [Flutter sample](end-to-end/recordings/clients/flutter/README.md) | File import, ordinary-import playback, library and AI views; optional device connection/status |
| Kotlin / Android | [Cloud reader](end-to-end/recordings/clients/android-kotlin/README.md); [SDK connection](app-sdk/android-device-connect/README.md) / [device catalog](app-sdk/android-recording-catalog/README.md) | Native sample/live recording library, transcript and existing general notes; separate device starters |
| Swift / iOS and macOS | [Cloud reader](end-to-end/recordings/clients/apple-swift/README.md); [SDK connection](app-sdk/apple-device-connect/README.md) / [device catalog](app-sdk/apple-recording-catalog/README.md) | SwiftUI sample/live recording library, transcript and existing general notes; separate device starters |

Try the web sample without credentials or hardware using Node **22.23.2+**:

Use a full repository checkout. The combined server needs the Web installation,
mobile backend source and integrated backend; copying one old folder is
insufficient. Express/Vite resolve from the existing Web install rather than a
duplicate runtime dependency graph. No root legacy workspace install is required.

```sh
cd end-to-end/web-reference
npm ci
cd ../recordings
npm ci
npm run demo
```

Open **http://127.0.0.1:5173** and select **Open demo**. Native client READMEs cover
their own builds and local sample modes. Sample content/actions are synthetic
and make no external calls; they establish no live upload, provider or hardware
success.

The recording experience connects audio input, library, supported audio playback
and source review, transcript, general notes and recording-scoped Ask. Current
Web and mobile playback support authorized unencrypted imports. Mobile file import
and playback use the same backend features, with platform-native pickers and
temporary media. Standalone device connection/status needs no backend.
Cloud features and authorized device upload need the customer backend; device
presence never gates browsing existing cloud recordings.

The Kotlin and Swift readers are smaller starting points: read the first page of
recordings, select one and view its existing transcript and general notes. Their
sample mode needs no server; live mode uses the same backend and separate app
token. They add no upload, playback, processing writes, Ask or device SDK dependency.
See the [native read contract](end-to-end/recordings/contracts/native-library-read.md).

For configured use, follow the [combined setup](end-to-end/recordings/README.md).
Default startup requires explicit original launch bases and existing journals
whose paths, schema and scopes validate. `--initialize` is only for a fresh
all-missing journal set. Stop the old listeners before using the combined one.
Fresh processing/Ask claims refuse a matching peer intent, including complete
or known work; they never adopt a peer ID to create a new Web intent. Existing
own GET recovery and native/library exact-known-ID paths remain available.
These in-process guards do not coordinate other writers or make file races
atomic. SDK receipts and exact-generation gates still govern cleanup. The complete
Flutter and RN install roots, including their required helpers/guards, now live
under `recordings/clients/`. Their old [Flutter](end-to-end/react-native-recording-sync/flutter/README.md)
and [RN](end-to-end/react-native-recording-sync/app/README.md) READMEs forward to
the new setup. Both clients retain `8787` defaults. Fresh cloud setup may explicitly
use the combined launcher's `5173`; retained native capture recovery must keep its
original backend origin. Configure the combined host with `PORT=8787` and
`APP_ORIGIN=http://127.0.0.1:8787` when preserving that original origin. Do not reset
journals or change capture identity to fit a new port. Web/backend paths, catalog
IDs and journal locations stay. See the [design](DESIGN.md), [roadmap](ROADMAP.md) and
[approved decision](docs/design-decisions/2026-10-12-integrated-recordings.md).
The [combined-listener review](docs/design-reviews/2026-10-12-unified-recordings.md)
records qualification separately from earlier core extraction and client evidence.

## Focused recipes

Find the feature's public call, run the relevant sample path, then copy the
feature with its complete imports. These maintained modules are the starting
points for focused guides/snippets; they are not standalone files to paste
without their HTTP, authorization, ownership and durable-state helpers.

| Feature | Public API/SDK boundary | Current public-call source |
| --- | --- | --- |
| List/read recordings | `GET /v1/recordings`, `GET /v1/recordings/{id}` | [Shared recordings](end-to-end/recordings/backend/features/recordings.mjs); [React library](end-to-end/web-reference/web/features/recordings/Recordings.tsx) |
| Import audio | Create recording, get upload URL, storage `PUT`, verified upload completion | [Shared upload](end-to-end/recordings/backend/features/upload.mjs); [Web upload](end-to-end/web-reference/web/features/uploads/Upload.tsx); [RN media](end-to-end/recordings/clients/react-native/media-controller.ts); [Flutter media](end-to-end/recordings/clients/flutter/lib/recording_media.dart) |
| Play imported audio | Authorized WAV export, bounded storage `GET`, authenticated app media | [Shared playback](end-to-end/recordings/backend/features/playback.mjs); [Web player](end-to-end/web-reference/web/features/playback/AudioPlayer.tsx); mobile media files above |
| Transcribe/read text and create general notes | Public transcription/summary GET/POST calls | [Shared processing](end-to-end/recordings/backend/features/processing.mjs); [Transcript](end-to-end/web-reference/web/features/transcription/Transcript.tsx) / [Summary](end-to-end/web-reference/web/features/summaries/Summaries.tsx) |
| Ask about one recording | Recording-scoped session/message calls and source/citation checks | [Shared Ask](end-to-end/recordings/backend/features/ask.mjs); [React Ask](end-to-end/web-reference/web/features/ask/Ask.tsx) |
| Receive events and recover known operations | Signed customer webhook; GET-only saved-operation refresh | [Webhook receiver](end-to-end/web-reference/server/features/webhooks.mjs); [Activity](end-to-end/web-reference/web/features/webhooks/Activity.tsx) |
| Sync a supported device recording | Published RN encrypted-v2 SDK plus authorized native host/backend | [DeviceSync.tsx](end-to-end/recordings/clients/react-native/DeviceSync.tsx); [setup and complete dependency boundary](end-to-end/react-native-recording-sync/README.md) |

The web [recipe table](end-to-end/web-reference/README.md#pick-a-recipe) and
[mobile setup](end-to-end/react-native-recording-sync/README.md) explain the
required helpers and limits. Replace the customer auth adapter with your
application's verified identity mapping. Keep Bota keys server-side and preserve
source checks and durable-before-write ordering. Include the canonical core,
compatibility shim/projection, HTTP/auth adapter and store used by that feature.
The web shim explicitly tolerates omitted `project_id` while retaining supplied
project and exact owner/source checks; mobile uses strict default recording/job
project checks. Do not broaden either policy while copying.

A few standalone quickstarts remain useful for distinct languages/runtimes:
[Node upload/transcribe](api/upload-and-transcribe-node/README.md),
[Python upload/transcribe](api/upload-and-transcribe-python/README.md) and
[Node](api/webhook-receiver-node/README.md)/[Python](api/webhook-receiver-python/README.md)
webhooks. Existing advanced API/SDK examples remain in the
[catalog](#example-catalog); there is no mass deletion or move. Add shared features
and guides before another install root for overlapping behavior.

## Current platform coverage

Web, RN, Flutter, Kotlin and Swift are integrated-client targets with ordinary
platform UI and copyable public-call files. Current device sources below also
run independently: discovery/identity/status does not require a backend.
Different public SDK capabilities do not imply identical UI or full device parity.

| Platform | Current SDK public-call source | Current host and capability limits |
| --- | --- | --- |
| Kotlin / Android | [MainActivity.kt](app-sdk/android-device-connect/app/src/main/java/dev/bota/examples/connect/MainActivity.kt); [cloud reader](end-to-end/recordings/clients/android-kotlin/README.md) | Device starters: API 26+; GET-only cloud library: Android 10 / API 29+ |
| Swift / Apple | [ConnectModel.swift](app-sdk/apple-device-connect/Sources/BotaConnect/ConnectModel.swift); [cloud reader](end-to-end/recordings/clients/apple-swift/README.md) | iOS/macOS connection/status, separate device metadata catalog and GET-only cloud library |
| React Native | [App.tsx](app-sdk/react-native-device-connect/App.tsx); [recording app](end-to-end/recordings/clients/react-native/README.md) | Android/iOS connection and cloud app hosts; encrypted-v2 sync remains Android-only with documented backend/firmware gates |
| Flutter | [main.dart](app-sdk/flutter-device-connect/lib/main.dart); [setup](app-sdk/flutter-device-connect/README.md) | Android/iOS hosts; the selected Dart facade does not supply this sample's RN encrypted-v2 host workflow |
| Web / desktop Chromium | [device-session.ts](end-to-end/web-reference/web/features/devices/device-session.ts); [standalone setup](app-sdk/web-device-connect/README.md) | Optional connection/status in the recording app; supported Web Bluetooth, secure context and firmware identity service required |
| Windows | API web client; Chromium device connection where supported | Native Windows/Electron App SDK support is planned upstream; no public native host here |

The ten existing device SDK roots pin public **2.0.0-beta.19**; the new optional
Web recording-app integration pins public **2.0.0-beta.20**. The Kotlin/Swift
cloud readers use HTTP and have no Bota SDK dependency. Each client installs
independently; manifests/locks declare its exact public version.
npm's `latest` tag remains beta.0. Native RN workflows use the compatibility
factory; this package update does not migrate them to generated JS `/runtime`.
Inspect the selected manifest/lockfile and README for tooling and public methods.
Missing facade capability, missing host and missing verification are different
gaps; do not fill them with private transports or an unofficial SDK.

[Adoption evidence](docs/design-reviews/2026-10-14-beta18-sdk-adoption.md) and the
[implementation review](docs/independent-examples-review.md) distinguish source,
native builds, live API and physical acceptance. Historical phone results apply
only to their tested source/SDK/firmware/device. The [iOS/mobile-flow review](docs/design-reviews/2026-10-20-ios-mobile-recording-flows.md)
separates new host/build checks from media/device acceptance. The
[remaining SDK/catalog review](docs/design-reviews/2026-10-20-sdk19-catalog-ios.md)
records the other six SDK upgrades and Swift iOS catalog host. The [AI guide](docs/using-examples-with-ai.md) helps tools
locate feature code and setup; [AGENTS.md](AGENTS.md) governs repository changes.

## Example catalog

The extended inventory retains focused and advanced references. Entries have
documented install roots and different verification levels; many readers and
exports have source/syntax evidence only. Follow the selected README rather than
inferring runtime support from inclusion in this table.
Integrated web/mobile roots require the shared core in the same checkout;
standalone API/App SDK quickstarts remain self-contained.
The [public example guide](https://docs.bota.dev/api-reference/client-sdks#example-apps)
provides API/SDK installation guidance.

<details>
<summary>Full example inventory</summary>

| Example | What it teaches | Physical device |
| --- | --- | --- |
| [Upload and transcribe (Node.js)](api/upload-and-transcribe-node/README.md) | Server-side upload, verified completion, transcription; live-verified | No |
| [Webhook receiver (Node.js)](api/webhook-receiver-node/README.md) | Authenticate raw bytes; durably deduplicate receipts in SQLite | No |
| [Upload and transcribe (Python)](api/upload-and-transcribe-python/README.md) | Same server-side workflow using the standard library; live-verified | No |
| [Structured summaries (Node.js)](api/summarize-transcription-node/README.md) | Summarize a completed transcription; retain creation intent and resume the saved job; live-verified with Gemini | No |
| [List recordings (Node.js)](api/list-recordings-node/README.md) | Follow cursor pagination with a page cap and print selected cloud recording metadata | No |
| [Download a recording (Node.js)](api/download-recording-node/README.md) | Retrieve original stored bytes with bounded size, credential isolation and no file overwrite | No |
| [Search transcript excerpts (Node.js)](api/search-transcripts-node/README.md) | Retrieve timestamped excerpts and verify returned recordings belong to the configured end user | No |
| [Ask about a recording (Node.js)](api/ask-recording-node/README.md) | Ask one question in a recording-scoped session and retain uncertain requests for reconciliation | No |
| [Export subtitles (Node.js)](api/export-transcription-node/README.md) | Convert an existing completed transcription into a local SRT file | No |
| [Webhook receiver (Python)](api/webhook-receiver-python/README.md) | Verify raw-byte signatures and commit events to a durable SQLite inbox using the standard library | No |
| [Cloud device status (Node.js)](api/device-status-node/README.md) | Verify an owned device and read its last reported runtime snapshot | No |
| [Device command history (Python)](api/list-device-commands-python/README.md) | Read bounded recent command metadata without sending commands or printing grants | No |
| [Search transcript excerpts (Python)](api/search-transcripts-python/README.md) | Retrieve timestamped excerpts and check recording ownership using the standard library | No |
| [Device inventory (Node.js)](api/list-devices-node/README.md) | Read one bounded selection of an end user's devices without claiming a complete inventory | No |
| [Watch a transcription (Python)](api/watch-transcription-python/README.md) | Observe an existing job through bounded GET polling without starting processing | No |
| [Export summary notes (Node.js)](api/export-summary-node/README.md) | Export an existing completed general-notes summary as a local Markdown file | No |
| [List recordings (Python)](api/list-recordings-python/README.md) | Follow bounded cursor pagination for a fixed end user and report incomplete traversal | No |
| [Export a summary (Python)](api/export-summary-python/README.md) | Export an existing completed structured summary as private JSON without overwriting | No |
| [Read Ask history (Node.js)](api/read-ask-history-node/README.md) | Read bounded messages from an existing owned recording-scoped session without generating answers | No |
| [Export transcript text (Python)](api/export-transcription-python/README.md) | Save existing completed full text as UTF-8 without overwriting | No |
| [Recording pipeline snapshot (Node.js)](api/recording-pipeline-node/README.md) | Read linked recording, transcription and summary statuses without inferring overall completion | No |
| [Create an end user (Node.js)](api/create-end-user-node/README.md) | Link an application external ID, retaining create intent and reconciling uncertainty through GET | No |
| [Custom summary (Python)](api/custom-summary-python/README.md) | Generate from a completed transcription using a prompt file and resume a saved job | No |
| [Firmware catalog (Python)](api/list-firmware-python/README.md) | Inspect project-selected release metadata for an owned device without downloading or installing | No |
| [End-user directory (Node.js)](api/list-end-users-node/README.md) | Traverse bounded project end-user pages and print selected identity metadata | No |
| [OTA history (Python)](api/list-ota-history-python/README.md) | Read bounded assignment metadata for an owned device without delivering firmware | No |
| [Transcribe an existing recording (Node.js)](api/transcribe-existing-node/README.md) | Request one explicit transcription, retain intent and resume its saved job | No |
| [Configuration schema (Node.js)](api/config-schema-node/README.md) | Discover section names, allowed levels and merge strategies without printing defaults | No |
| [Processing configuration (Python)](api/processing-config-python/README.md) | Read selected effective processing settings for an owned device without changing them | No |
| [Ask session directory (Python)](api/list-ask-sessions-python/README.md) | Traverse bounded sessions for a fixed end user without fetching conversation text | No |
| [Download a recording (Python)](api/download-recording-python/README.md) | Save original bytes using trusted storage hosts, isolated credentials and no file overwrite | No |
| [Watch a summary (Node.js)](api/watch-summary-node/README.md) | Observe an existing exact summary job without generating output or starting processing | No |
| [Watch an OTA assignment (Node.js)](api/watch-ota-node/README.md) | Observe one exact existing assignment without delivering or installing firmware | No |
| [Fleet health (Node.js)](api/fleet-health-node/README.md) | Read project fleet counters without exposing individual device rows or claiming live hardware health | No |
| [Connection settings (Python)](api/connection-config-python/README.md) | Observe resolved network preferences and idle settings for an owned device | No |
| [Upload settings (Node.js)](api/upload-config-node/README.md) | Read effective upload settings while distinguishing resolution from firmware enforcement | No |
| [OTA settings (Python)](api/ota-config-python/README.md) | Observe automatic-selection settings without assigning or installing firmware | No |
| [Transcription directory (Node.js)](api/list-transcriptions-node/README.md) | Traverse bounded jobs for one owned recording without emitting transcript text | No |
| [Summary directory (Python)](api/list-summaries-python/README.md) | Traverse bounded summary metadata for one exact transcription and owned recording | No |
| [Transcript JSON export (Node.js)](api/export-transcription-json-node/README.md) | Publish completed text and segments as private JSON without overwriting files | No |
| [Create an empty Ask session (Python)](api/create-ask-session-python/README.md) | Retain creation intent for a recording-scoped session without calling a model | No |
| [Rename an Ask session (Node.js)](api/rename-ask-session-node/README.md) | Change one owned session title with durable intent and GET-only uncertain recovery | No |
| [Firmware release details (Node.js)](api/firmware-detail-node/README.md) | Inspect one exact release's declared artifact metadata without downloading or installing | No |
| [Export Ask history (Node.js)](api/export-ask-markdown-node/README.md) | Publish escaped conversation text and recording citations as private Markdown without overwriting | No |
| [Rename a device (Python)](api/rename-device-python/README.md) | Update only a cloud display name with durable intent and GET-only uncertain recovery | No |
| [Look up an end user (Node.js)](api/lookup-end-user-node/README.md) | Resolve an exact external identifier without creating a user or exposing profile data | No |
| [Watch a device command (Node.js)](api/watch-device-command-node/README.md) | Observe one exact ordinary command without relaying, acknowledging or cancelling it | No |
| [Upload-security policy (Python)](api/upload-security-config-python/README.md) | Read effective encrypted-upload policy without claiming applied protection or changing it | No |
| [Export WebVTT (Python)](api/export-transcription-vtt-python/README.md) | Publish escaped timestamped transcript cues as a private WebVTT file without overwriting | No |
| [Project processing settings (Node.js)](api/project-processing-config-node/README.md) | Observe project-resolved automation flags without applying child overrides or starting jobs | No |
| [End-user processing settings (Python)](api/end-user-processing-config-python/README.md) | Observe one end user's resolved automation flags without device overrides or profile output | No |
| [Watch encrypted upload (Node.js)](api/watch-encrypted-upload-node/README.md) | Observe one exact existing encrypted-v2 session without verifying receipts or authorizing cleanup | No |
| [Inspect an Ask session (Python)](api/inspect-ask-session-python/README.md) | Read selected exact recording-scoped session metadata with surrounding owner-filtered membership checks | No |
| [Download firmware (Python)](api/download-firmware-python/README.md) | Inspect private BIN bytes against declared size and SHA-256 without installing firmware | No |
| [Project upload settings (Node.js)](api/project-upload-config-node/README.md) | Observe project-resolved upload intent without child overrides or device-enforcement claims | No |
| [Recording integrity metadata (Python)](api/inspect-recording-integrity-python/README.md) | Inspect server-reported hash-verification metadata without downloading bytes or authorizing cleanup | No |
| [Export transcript CSV (Python)](api/export-transcription-csv-python/README.md) | Publish supplied transcript segments as private CSV with explicit string-cell transformation and no overwrite | No |
| [End-user upload settings (Python)](api/end-user-upload-config-python/README.md) | Observe one end user's resolved upload intent without device overrides or enforcement claims | No |
| [Project connection settings (Node.js)](api/project-connection-config-node/README.md) | Observe project-resolved radio preferences and idle values without claiming available physical links | No |
| [Project OTA settings (Python)](api/project-ota-config-python/README.md) | Observe project automatic-selection intent without promoting or installing firmware | No |
| [End-user connection settings (Node.js)](api/end-user-connection-config-node/README.md) | Observe one end user's resolved radio preferences between identity and lineage checks | No |
| [End-user OTA settings (Python)](api/end-user-ota-config-python/README.md) | Observe one end user's automatic-selection intent without device overrides or OTA delivery | No |
| [Project upload-security policy (Node.js)](api/project-upload-security-node/README.md) | Observe project-resolved downgrade policy without claiming applied encryption or cleanup authority | No |
| [Summary metadata snapshot (Python)](api/inspect-summary-python/README.md) | Inspect one exact summary and its transcription-recording source chain without emitting generated content | No |
| [Export transcript NDJSON (Node.js)](api/export-transcription-ndjson-node/README.md) | Publish selected timed segments as private JSON lines without overwriting or starting processing | No |
| [Export transcript HTML (Python)](api/export-transcription-html-python/README.md) | Publish escaped timed segments as a private script-free HTML document without overwriting | No |
| [API health probe (Python)](api/api-health-python/README.md) | Make one credential-free health observation without claiming whole-system or device availability | No |
| [React Native connect](app-sdk/react-native-device-connect/README.md) | Discover, verify serial, connect, read status, disconnect | Yes |
| [Web connect](app-sdk/web-device-connect/README.md) | Browser picker and identity verification with Web Bluetooth and WASM | Yes |
| [Apple connect](app-sdk/apple-device-connect/README.md) | SwiftUI iOS/macOS connection/status using the public Swift package | Yes |
| [Android connect](app-sdk/android-device-connect/README.md) | Kotlin Android application using Maven Central | Yes |
| [Android recording catalog](app-sdk/android-recording-catalog/README.md) | Verify exact serial and list legacy/encrypted-v2 metadata without audio transfer | Yes |
| [Apple recording catalog](app-sdk/apple-recording-catalog/README.md) | Verify exact serial and fresh pairing, then list legacy/encrypted-v2 metadata on iOS/macOS | Yes |
| [Flutter connect](app-sdk/flutter-device-connect/README.md) | Flutter Android/iOS connection/status using pub.dev | Yes |
| [Mobile recording apps](end-to-end/react-native-recording-sync/README.md) | Retained backend and setup; RN/Flutter Android/iOS recording apps with import/playback and optional supported device paths | No; device path optional |
| [Bota Recordings web sample](end-to-end/web-reference/README.md) | React + Node recording app with import/playback, Transcript/Summary/Ask and optional desktop Chromium device connection/status | No; device feature requires hardware |
| [Integrated Recordings sample](end-to-end/recordings/README.md) | Shared backend, RN/Flutter apps and small Kotlin Android/Swift iOS/macOS cloud readers | No |

</details>

SDK development smoke samples belong in the SDK source repository. These
customer-facing examples consume published artifacts.

## Integration and installation boundaries

- Keep Bota secret and restricted keys on your server. The customer backend
  authenticates app users and authorizes their resources before calling Bota.
- Storage URLs grant bounded access to bytes; never forward Bota API credentials
  to storage or expose signed URLs in logs/source.
- Preserve upload verification, device cleanup and processing as separate
  phases. Keep uncertain write intent; a failed response does not permit a
  replacement POST.
- Use synthetic or consented test audio. Do not commit credentials, recordings,
  signed URLs or device provisioning material.

Keep lifecycle scripts enabled in affected npm install roots. Required
query-string, native Expo signing, braces and build-dependency guards are part of their
documented installation/test chains; do not remove them to simplify a template.
[Dependency security](DEPENDENCY_SECURITY.md),
[native Expo signing replacement](docs/native-expo-signing-replacement.md),
[historical Forge mitigation](docs/node-forge-parser-mitigation.md),
[braces mitigation](docs/braces-depth-mitigation.md) and
[build-dependency review](docs/build-dependency-remediation.md) record scope,
scanner limits and required checks. Passing a source guard or CI does not close
an unchanged dependency alert or prove physical installation.

## Retained legacy workspace

The [legacy RN app](apps/react-native/README.md) and
[backend](apps/backend/README.md) under `apps/` remain compatibility examples,
not the recommended customer template. They pin SDK beta.19 using the native
compatibility path. The backend has no
caller authentication or per-user authorization and uses one configured end
user. The immediate raw-token binding/provisioning flow is a target-lifecycle
gap. Use this pair only in an isolated local test environment.

If maintaining that workspace, install with root `npm ci` and keep scripts
enabled; if they were disabled, run `npm run postinstall` before use. Copy
`apps/backend/.env.example` to `apps/backend/.env`, configure the authorized
test key/end user and explicitly choose `BOTA_API_BASE_URL` ending in `/v1`.
The default reaches production. Run `npm run dev:backend`, set
`EXPO_PUBLIC_EXAMPLE_API_URL` to a phone-reachable backend address, then run
`npm run android -w @bota-dev/example-react-native` or, on macOS,
`npm run ios -w @bota-dev/example-react-native`.
BLE needs a native development build; Expo Go is insufficient. Android requires
API 26+. iOS native linking and broader physical acceptance remain separate
gates. See [migration evidence](docs/app-sdk-migration.md) and the client README.

## Verification

[Catalog CI](.github/workflows/catalog.yml) checks the index, ordered README
catalog and local file links on Linux and Windows without package installation,
keys or hardware:

```sh
node scripts/check-catalog.mjs
node --test scripts/test-catalog.mjs
```

It checks metadata and paths, not example behavior, heading anchors, remote URLs,
reference-style/HTML links or fenced snippets.

Use the selected example's own README and path-filtered CI for behavioral tests,
typechecks and platform builds. Root `npm test`, `npm run typecheck` and
`npm run build` cover the legacy workspace; its CI also exports Expo platforms
and builds Android. Source/build checks, authorized live API checks and
physical-device scenarios establish different evidence. See the
[implementation review](docs/independent-examples-review.md) for current results
and open acceptance gaps.

`npm run test:integration` runs the existing independent Node API and integrated
backend suites without installing the legacy workspace. First run
`npm ci --prefix end-to-end/web-reference` to install the backend host and
development-server test dependencies. It discovers the `api/*-node/*.test.mjs`
suites (currently download, list, search, summarize, upload/transcribe and webhook
receiver), shared backend contracts, Web server and mobile backend suites. It
preserves their transport, authorization, integrity and durability
checks, including real localhost CLI/HTTP and SQLite persistence scenarios.
Use Node 22.23.2 or newer. These local fixtures do not establish live cloud or
physical-device acceptance.

The all-PR and branch-push `Integration tests` check runs these suites and retains
`test-results/api-integration.xml` for 90 days. Existing path-filtered checks and
platform-specific acceptance gates still apply to each changed example.

## Documentation

- [Design](DESIGN.md): the integrated sample foundation and its two product layers.
- [Roadmap](ROADMAP.md): ordered remaining work and acceptance criteria.
- [Architecture](ARCHITECTURE.md): technical boundaries and implementation status.
- [Integrated recordings decision](docs/design-decisions/2026-10-12-integrated-recordings.md):
  approved structure, current gaps and migration boundaries.
- [Contributing](CONTRIBUTING.md): readability, focused validation and documentation.
- [AI guide](docs/using-examples-with-ai.md), [AGENTS.md](AGENTS.md) and
  [CLAUDE.md](CLAUDE.md): entry points for coding tools.
- [Public Bota docs](https://docs.bota.dev): API and SDK contracts.

## Security scanning

The pinned `Semgrep` workflow runs the read-only `Scan` check on every PR,
including drafts and any target branch, merge queues, pushes to `main`, manual
dispatches and the weekly schedule. It scans the full source checkout without
installing dependencies or requiring a Semgrep token. Findings, scanner errors
and an empty scan fail the check. Existing CodeQL default analysis continues
separately.

Semgrep's ordinary dependency-directory defaults omit `vendor`. The same required
check also analyzes exact maintained vendor source views under the same rules.
The reviewed [inventory](.github/sast-maintained-vendor.json) freezes every tracked
vendor file and classifies current payloads, official provenance and retired
evidence. It selects retained source files and maintained archive patch members;
each view preserves the original Git blob or archive-member bytes and records
its source path, SHA-256 and size. Unknown or changed vendor inventory, unsafe
archives, missing views, findings and analyzer errors fail the check. The policy
is captured from the current workflow before any historical checkout. No vendor
source is executed or repacked, and existing payload-integrity checks remain.

Rules include security-audit, OWASP, JavaScript, TypeScript, Node.js, React,
Python, Kotlin, Swift, Ruby and GitHub Actions. This is the configured community
rule coverage; it does not establish complete language coverage for Dart or
Objective-C. Each run retains JSON/SARIF results, scanned-file counts, immutable
source/workflow identities and exact rule snapshots with SHA-256 hashes for 90
days. Maintainers register the literal `Scan` check name for SAST enforcement.

Manual dispatch accepts an optional full 40-character `revision` commit SHA.
That scan is labeled retrospective and does not establish that the original
PR passed SAST before merge.

The [review and source-bound dispositions](docs/design-reviews/2026-10-27-sast-coverage.md)
record the audit annotations and canonical shell coverage. Unannotated historical
source receives ordinary analysis; annotations without a matching review ledger
or changes to reviewed sources fail until reviewed.

## License

Bota-authored sample code uses the [MIT license](LICENSE). Third-party
dependencies and vendored files retain their own licenses and notices.

Current Node signing-tool source removes Forge from the three RN install roots
through self-contained public-upstream development-tool archives. Public SDK and
Expo pins stay fixed. See [local qualification and remaining hosted/scanner
gates](docs/native-expo-signing-replacement.md); this does not qualify mobile
binaries, devices, EAS or certificate management. The retained 985 qualification
and 934 documentation-only reconciliation remain historical source/installation
evidence; they do not verify shared-core extraction, listener consolidation or integrated native clients.

The current legacy workspace source replaces Braces/Micromatch through maintained
owning public parents, including the actual bundled Metro 0.84.6 route. Run its
mandatory install attestation and 20-case suite with ordinary lifecycle scripts.
See [current source, checks and delivery limits](docs/legacy-public-parent-matching-removal.md).
Independent install roots, SDK/runtime pins and all workflows remain conserved;
local output checks do not establish scanner or installed/native acceptance.


October 13 Chokidar public-boundary correction: the original maintained parent
nomination remains historical and held. The corrected 3.6.0 archive preflights
selected normalized brace selectors before public watch/add state or async work,
with prospective full-array ignore ordering and unchanged literal/non-glob paths.
Run the required public-boundary cases through `npm run test:braces-security`;
independent shared component clearance does not replace current-owner source,
normal/frozen, hosted/native/scanner or production gates. See [the bounded review](docs/legacy-public-parent-matching-removal.md#october-13-public-chokidar-boundary-correction).
