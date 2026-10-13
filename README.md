# Bota Examples

Runnable examples and copyable sample code for developers building applications
with the public Bota API and App SDK. Choose the workflow or platform you need;
no private Bota app, special coding tool or repository-wide install is required.

## Choose your starting point

| You want to… | Start here |
| --- | --- |
| Call the backend API from your server | [API workflow recipes](#focused-recipes): upload/transcribe, recordings, notes, Ask and webhooks |
| Embed device capabilities in your app | [Platform SDK starters](#current-platform-coverage): Kotlin, Swift, React Native, Flutter or Web |
| See how app UI and a customer backend fit together | [Optional Bota Recordings references](#whole-app-references): React web or Android mobile |

This is one repository with exactly two product layers: **general platform
capabilities now**, then **vertical and app-type examples later**. API recipes,
SDK starters and combined references are three formats within the general layer,
stored under `api/`, `app-sdk/` and `end-to-end/`; they are not three layers.

## Focused recipes

Use a bounded workflow rather than installing a separate example for every
method. These recipes run on a server or development machine; Bota keys stay
there.

| Workflow | Setup and limits | Public-call source |
| --- | --- | --- |
| Import audio, verify completion and transcribe | [Node.js](api/upload-and-transcribe-node/README.md) or [Python](api/upload-and-transcribe-python/README.md) | [Node workflow](api/upload-and-transcribe-node/index.mjs), `uploadAndTranscribe` |
| Find/read recordings and retrieve original bytes | [Recording list](api/list-recordings-node/README.md), [Node download](api/download-recording-node/README.md) or [Python download](api/download-recording-python/README.md) | [List workflow](api/list-recordings-node/index.mjs), `listRecordings`; [download workflow](api/download-recording-node/index.mjs) |
| Create general notes from a completed transcript | [Node.js summaries](api/summarize-transcription-node/README.md) | [Summary workflow](api/summarize-transcription-node/index.mjs), `summarize` |
| Ask about one recording | [Node.js recording-scoped Ask](api/ask-recording-node/README.md) | [Ask workflow](api/ask-recording-node/index.mjs) |
| Receive processing events and refresh existing jobs | [Node.js webhook](api/webhook-receiver-node/README.md), [Python webhook](api/webhook-receiver-python/README.md) or [transcription watcher](api/watch-transcription-python/README.md) | [Raw-byte receiver](api/webhook-receiver-node/server.mjs); [GET watcher](api/watch-transcription-python/main.py) |

Each README identifies the public calls, prerequisites, expected result and
verification limits. Copy the integration with its complete imports and required
HTTP, authorization and durable-state helpers; replace the application-owned
identity mapping. An original download is not necessarily playable or decrypted
audio. Use the [extended catalog](#example-catalog) for advanced readers/exports.

## Current platform coverage

Kotlin, Swift, React Native, Flutter and Web are first-class SDK entry points.
The direction is one small starter per published facade, with plain feature
modules for useful supported workflows. Existing connection/catalog paths remain
in place. A starter needs only enough UI to run its workflow; it does not need a
complete recording app, common backend DTOs or another platform's UI.

| Platform | Start here | Current host and capability limits |
| --- | --- | --- |
| Kotlin / Android | [Connection/status](app-sdk/android-device-connect/README.md); [recording catalog](app-sdk/android-recording-catalog/README.md) | Native Android hosts, API 26+; catalog reads metadata, not audio transfer |
| Swift / Apple | [Connection/status](app-sdk/apple-device-connect/README.md); [recording catalog](app-sdk/apple-recording-catalog/README.md) | Current SwiftUI hosts are macOS; no native iOS starter host yet; catalog does not transfer audio |
| React Native | [Connection/status](app-sdk/react-native-device-connect/README.md); [encrypted-sync workflow](end-to-end/react-native-recording-sync/README.md) | Connection starter has Android/iOS hosts; encrypted sync is Android-only, already-provisioned encrypted-v2 with its documented backend/firmware gates |
| Flutter | [Connection/status](app-sdk/flutter-device-connect/README.md) | Android host only; beta.13 facade lacks the fresh-pairing/encrypted-v2 interfaces needed for the RN sync workflow; no iOS starter host yet |
| Web / desktop Chromium | [Connection/status](app-sdk/web-device-connect/README.md) | Supported Web Bluetooth, secure context and firmware identity service required; separate from the API web reference |
| Windows | The API web reference; Chromium SDK connection where supported | Native Windows/Electron App SDK support is planned upstream; no public native host is supplied here |

All eight independent device examples pin published **2.0.0-beta.13**. Read the
selected manifest/lockfile and README for exact tooling, host support and public
methods. Missing facade capability, missing host and missing verification are
different gaps. Do not fill them with private transports or an unofficial SDK.

[Adoption evidence](docs/independent-examples-review.md#beta13-adoption) and the
[implementation review](docs/independent-examples-review.md) distinguish source,
native builds, live API and physical acceptance. Historical phone results apply
only to their tested source/SDK/firmware/device; beta.13 physical acceptance is
not inferred from them.

## Whole-app references

**Bota Recordings** illustrates a familiar recording experience inspired by Demo
and Bota One. These optional references show how selected integrations fit an
end-user app; use them as templates or copy a feature with its helpers.

| Reference | Run and adapt | Current scope |
| --- | --- | --- |
| React web | [Web reference](end-to-end/web-reference/README.md) | Audio import, library, Transcript/Summary/Ask; API-only |
| React Native Android | [RN reference](end-to-end/react-native-recording-sync/app/README.md) | Sample/live cloud library, Transcript/Summary/Ask; optional encrypted device sync |
| Flutter Android | [Flutter reference](end-to-end/react-native-recording-sync/flutter/README.md) | Same sample/live library and AI views; optional device connection/status |

Try the web reference without credentials or hardware using Node **22.23.2+**:

```sh
cd end-to-end/web-reference
npm ci
npm run demo
```

Open **http://127.0.0.1:5173** and select **Open demo**. The mobile READMEs cover
native builds and **Try sample recordings**. Sample actions/content are synthetic
and make no external calls; they establish no live upload, provider or hardware
success.

These references are runnable partial implementations. Web has no audio playback;
mobile has no ordinary audio import/playback and its recording hosts are Android
only. RN/Flutter share the mobile backend; web has a separate backend. Concrete
backend reuse may improve that reference family when its compatibility gates
pass. Full UI parity, a complete import/playback journey and backend consolidation
are not prerequisites for a useful API recipe or SDK feature.

Choose one directory, install only its documented dependencies and inspect the
public call before adapting it. The [AI guide](docs/using-examples-with-ai.md) and
[machine-readable index](examples.json) help tools find source and setup.
[DESIGN.md](DESIGN.md) and [ROADMAP.md](ROADMAP.md) describe contributor direction;
[AGENTS.md](AGENTS.md) governs repository changes. Catalog count is not a delivery
goal.

## Example catalog

The extended inventory retains focused and advanced references. Its entries
install independently and have different verification levels; many readers and
exports have source/syntax evidence only. Follow the selected README rather than
inferring runtime support from inclusion in this table.
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
| [Apple connect](app-sdk/apple-device-connect/README.md) | SwiftUI macOS application using the public Swift package | Yes |
| [Android connect](app-sdk/android-device-connect/README.md) | Kotlin Android application using Maven Central | Yes |
| [Android recording catalog](app-sdk/android-recording-catalog/README.md) | Verify exact serial and list legacy/encrypted-v2 metadata without audio transfer | Yes |
| [Apple recording catalog](app-sdk/apple-recording-catalog/README.md) | Verify exact serial and fresh pairing, then list legacy/encrypted-v2 metadata in a macOS app | Yes |
| [Flutter connect](app-sdk/flutter-device-connect/README.md) | Flutter Android application using pub.dev | Yes |
| [Mobile recording apps](end-to-end/react-native-recording-sync/README.md) | React Native + Flutter Android library, Transcript/Summary/Ask; one authenticated backend; synthetic mode; optional RN encrypted sync and Flutter connection/status | No; device path optional |
| [Bota Recordings web sample](end-to-end/web-reference/README.md) | Common recording app template: React + Node, audio import, Transcript/Summary/Ask and webhook/recovery recipes; API-only synthetic demo and scoped live mode | No |

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
[Forge mitigation](docs/node-forge-parser-mitigation.md),
[braces mitigation](docs/braces-depth-mitigation.md) and
[build-dependency review](docs/build-dependency-remediation.md) record scope,
scanner limits and required checks. Passing a source guard or CI does not close
an unchanged dependency alert or prove physical installation.

## Retained legacy workspace

The [legacy RN app](apps/react-native/README.md) and
[backend](apps/backend/README.md) under `apps/` remain compatibility examples,
not the recommended customer template. They pin SDK beta.6. The backend has no
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

## Documentation

- [Design](DESIGN.md): product purpose, two layers and recipe/starter/reference formats.
- [Roadmap](ROADMAP.md): ordered remaining work and acceptance criteria.
- [Architecture](ARCHITECTURE.md): technical boundaries and implementation status.
- [Plan reset review](docs/design-reviews/2026-10-12-plan-reset.md): design decisions,
  source evidence and remaining verification.
- [Contributing](CONTRIBUTING.md): readability, focused validation and documentation.
- [AI guide](docs/using-examples-with-ai.md), [AGENTS.md](AGENTS.md) and
  [CLAUDE.md](CLAUDE.md): entry points for coding tools.
- [Public Bota docs](https://docs.bota.dev): API and SDK contracts.

## License

Bota-authored sample code uses the [MIT license](LICENSE). Third-party
dependencies and vendored files retain their own licenses and notices.

Current Node signing-tool source removes Forge from the three RN install roots
through self-contained public-upstream development-tool archives. Public SDK and
Expo pins stay fixed. See [local qualification and remaining hosted/scanner
gates](docs/native-expo-signing-replacement.md); this does not qualify mobile
binaries, devices, EAS or certificate management. The retained 985 qualification
and fresh 934 documentation-only reconciliation preserve the current optional
reference and first-class workflow/platform-starter architecture.
