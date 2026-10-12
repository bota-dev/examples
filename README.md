# Bota Examples

Demo apps, sample code and templates for customer developers building end-user
applications with the public Bota API and App SDK.

The main template is **Bota Recordings**, a familiar recording app inspired by
Demo and Bota One. The repository has exactly two layers: **general platform
capabilities now**, then **vertical and app-type examples later**. One recording
template family spans React web, React Native and Flutter; small SDK workflows
and API recipes support it. Read the [design](DESIGN.md) and [roadmap](ROADMAP.md)
for the target and remaining work.

## Start with Bota Recordings

| Client | Run and adapt | Current scope |
| --- | --- | --- |
| React web | [Web sample](end-to-end/web-reference/README.md) | Audio import, recording library, Transcript/Summary/Ask; API-only |
| React Native Android | [RN sample](end-to-end/react-native-recording-sync/app/README.md) | Sample/live cloud library, Transcript/Summary/Ask; optional encrypted device sync |
| Flutter Android | [Flutter sample](end-to-end/react-native-recording-sync/flutter/README.md) | Same sample/live library and AI views; optional device connection/status |

Try the web app without credentials or hardware:

```sh
cd end-to-end/web-reference
npm ci
npm run demo
```

Open **http://127.0.0.1:5173** and select **Open demo**. Use Node **22.23.2 or
newer**. The mobile READMEs explain their native builds and **Try sample
recordings** entry. Sample content/actions are synthetic and make no external
calls; they do not prove live API, provider or device behavior.

These apps are runnable **partial implementations**. The complete target is:

**Import ordinary audio → library → supported audio playback and source review
→ transcript → general notes → recording-scoped Ask.**

The web app does not yet play audio. The mobile clients do not yet import
ordinary audio or play it, and their current hosts are Android only. They can
use existing authorized cloud recordings; RN also supports its documented device
path. Microphone capture is optional later work.

RN and Flutter share the current mobile backend. The web backend is separate.
**One canonical customer feature backend is planned**, after defining common
DTOs, identity/authentication, uncertainty and playable-media contracts.
No runtime directories or journals move as part of this design reset.

## Focused recipes

Use a small recipe when you need one integration rather than an app template.

| Your task | Start here |
| --- | --- |
| Upload audio and get a transcript | [Node.js](api/upload-and-transcribe-node/README.md) or [Python](api/upload-and-transcribe-python/README.md) |
| List/read cloud recordings | [Node.js recording list](api/list-recordings-node/README.md) |
| Create general notes | [Node.js structured summaries](api/summarize-transcription-node/README.md) |
| Ask about one recording | [Node.js recording-scoped Ask](api/ask-recording-node/README.md) |
| Receive processing events | [Node.js webhook](api/webhook-receiver-node/README.md) or [Python](api/webhook-receiver-python/README.md) |
| Download authorized original bytes | [Node.js](api/download-recording-node/README.md) or [Python](api/download-recording-python/README.md); original bytes are not necessarily playable audio |
| Connect to a physical device | Choose the supported platform below |

Each README links the public calls and required helpers. Copy the feature with
the helpers it imports, and replace the customer identity adapter as documented.
These examples use published packages/public APIs; no private Bota application
repository is required.

Choose one example, install from its directory and follow its documented checks.
Root npm commands apply only to the retained legacy workspace. The
[machine-readable index](examples.json) and [AI guide](docs/using-examples-with-ai.md)
help coding tools find setup, source and evidence; [AGENTS.md](AGENTS.md) supplies
the repository instructions.

## Current platform coverage

| Platform | Available device example | Boundary |
| --- | --- | --- |
| React Native | [Android/iOS connection](app-sdk/react-native-device-connect/README.md), plus the optional Android sync path in Bota Recordings | The recording template has no iOS host yet; sync is already-provisioned encrypted-v2, not a complete provisioning lifecycle |
| Flutter | [Android connection](app-sdk/flutter-device-connect/README.md) | The published facade supports connection/status here, not the RN encrypted-sync workflow; no recording-template iOS host yet |
| Kotlin / Android | [Connection](app-sdk/android-device-connect/README.md) and [recording metadata](app-sdk/android-recording-catalog/README.md) | Focused SDK samples, not another full consumer app |
| Swift / Apple | [macOS connection](app-sdk/apple-device-connect/README.md) and [recording metadata](app-sdk/apple-recording-catalog/README.md) | Current sample hosts are macOS, not native iOS recording apps |
| Desktop Chromium | [Web SDK connection](app-sdk/web-device-connect/README.md) | Requires supported Web Bluetooth/browser/OS behavior; separate from the API web template |
| Windows | The API web template, and Chromium connection where supported | Native Windows/Electron App SDK support is planned upstream; no public native recording host is supplied here |

All eight independent device examples pin published **2.0.0-beta.13**.
Read each README for its actual build targets and device gates.
[Current adoption evidence](docs/independent-examples-review.md#beta13-adoption)
and [implementation reviews](docs/independent-examples-review.md) keep source,
native builds, live API and physical acceptance distinct. Earlier phone results
remain tied to the tested SDK/firmware/device versions; they do not establish
beta.13 physical acceptance.

Next work is to define the common backend/media contract, complete import and
playback across the existing clients, then add iOS hosts and bounded native SDK
workflows. Vertical/app-type demos follow the general baseline. See
[ROADMAP.md](ROADMAP.md); new catalog entries are not a completeness goal.

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
query-string, node-forge, braces and build-dependency guards are part of their
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

- [Design](DESIGN.md): product purpose, two layers and the Bota Recordings family.
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
