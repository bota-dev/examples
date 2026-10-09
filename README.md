# Bota Examples

Examples for integrating the Bota backend API and Bota App SDK into your own applications. API examples demonstrate server-side workflows; App SDK examples demonstrate communication with physical Bota devices; end-to-end examples connect the two.

Each independent example has its own setup, dependencies, verification steps, and compatibility notes. You do not need Bota's internal application repositories to run an example.

## Find an example

Use the [machine-readable index](examples.json) to filter by task, language and
hardware requirement. For Claude Code, Codex, Cursor, Copilot or another coding
agent, start with the [AI quick-start guide](docs/using-examples-with-ai.md) and
[AGENTS.md](AGENTS.md). Every entry points to its own setup and evidence.

| Your task | Start here |
| --- | --- |
| Upload audio and get a transcript | [Node.js](api/upload-and-transcribe-node/README.md) or [Python](api/upload-and-transcribe-python/README.md) |
| Receive processing events | [Node.js webhook](api/webhook-receiver-node/README.md) or [Python webhook](api/webhook-receiver-python/README.md) |
| Connect to a physical device | Choose your platform under `app-sdk/` in the [catalog](#example-catalog) |
| Inspect processing inheritance | [Project](api/project-processing-config-node/README.md), [end user](api/end-user-processing-config-python/README.md) or [device](api/processing-config-python/README.md) |
| Inspect existing upload or conversation metadata | [Encrypted upload](api/watch-encrypted-upload-node/README.md) or [Ask session](api/inspect-ask-session-python/README.md) |
| Check API health without a key | [Python health probe](api/api-health-python/README.md) |
| Inspect firmware bytes | [Python download](api/download-firmware-python/README.md); no installation |
| Export timestamped transcripts | [CSV](api/export-transcription-csv-python/README.md), [SRT](api/export-transcription-node/README.md) or [WebVTT](api/export-transcription-vtt-python/README.md) |

1. Pick one example and read its README, including prerequisites and current evidence.
2. Work inside that example directory; install only its dependencies. Root npm commands apply to the retained legacy sample.
3. Configure your own authorized IDs and server-side secrets, then use its documented commands. Syntax, live API and physical-device checks are separate evidence.

## Current status

The catalog contains seventy-five independent examples. Node and Python upload/transcription examples are live-verified with a test key and synthetic speech. The API examples also cover Node/Python webhooks, transcript search and recording pagination, original-file download, structured summaries, recording-scoped Ask and session/history listings, subtitle/plain-text/Markdown/JSON export, cloud device status, bounded device inventory, command history, existing transcription/summary monitoring and linked processing snapshots, end-user onboarding and directory traversal, custom prompts, firmware discovery, OTA history and assignment monitoring, transcription of existing uploads and configuration discovery/observations. Recent expansions add fleet counters, scoped job directories, transcript JSON export, durable empty Ask sessions/title changes, exact release metadata, private Ask Markdown, cloud device-name changes, exact external-ID lookup, ordinary-command observation, upload-security policy, WebVTT export, project/end-user processing readers, exact encrypted-upload observation, Ask metadata inspection, firmware BIN downloads, project upload settings, recording integrity metadata and transcript CSV. Ten more cases add project/end-user configuration observations, a summary snapshot, private NDJSON/HTML exports and a credential-free health probe. The recent sixty API examples have syntax checks and source review; live behavior is unverified. Five focused App SDK connection examples, Android encrypted recording sync and Android/macOS recording catalogs are implemented; the Apple catalog passed hosted macOS compilation; physical acceptance remains unverified. Exact evidence is recorded in the [implementation review](docs/independent-examples-review.md). The full replacement, including target secure pairing and wider recovery acceptance, remains incomplete. The existing React Native/backend pair remains until replacement acceptance gates pass.

| Existing source | Purpose | Status |
| --- | --- | --- |
| [React Native app](apps/react-native/README.md) | Device discovery, connection, status, recording control, provisioning, and sync | App SDK beta.6 compatibility sample; Android native build verified by prior migration CI; physical-device acceptance remains open |
| [Express backend](apps/backend/README.md) | Server-side Bota API calls supporting the app | Local development sample; no caller authentication or per-user resource authorization |

The existing app pins `@bota.dev/react-native-app-sdk@2.0.0-beta.6` (beta), app version 0.2.0. Rebuild native apps after installing. Its immediate binding/raw-token provisioning flow remains a compatibility gap, not the current target lifecycle. The existing backend uses one configured end user. Use it only in an isolated local test environment; it is not a multi-user backend template.

See [Architecture](ARCHITECTURE.md) for the target design and migration gates. [SDK migration and verification](docs/app-sdk-migration.md) records successful all-platform exports and an Android native build, superseding the historical Hermes export failure. [Dependency security](DEPENDENCY_SECURITY.md) records required installation patches and regression checks. For the legacy workspace, iOS native linking and physical-device acceptance remain unverified.

Keep install scripts enabled in the three affected React Native install roots;
they apply a pinned [node-forge parser mitigation](docs/node-forge-parser-mitigation.md)
for Expo signing tools. The unchanged 1.4.0 scanner alerts remain open.

## Example catalog

Each linked example installs independently. All eight device examples (the five
connection examples, Android/Apple catalogs and encrypted recording sync) pin published
**2.0.0-beta.13**. The [current adoption review](docs/independent-examples-review.md#beta13-adoption)
records public package availability and example checks. Beta.13 physical-device
acceptance has not been performed for these examples.

The [historical beta.10 review](docs/independent-examples-review.md#beta10-adoption)
retains the earlier native builds and phone evidence. On the recorded
Samsung/Bota Pin pair, RN beta.10 passed
three radio-loss/first-reconnect cycles and graceful disconnect/reconnect.
Flutter's six widget tests and hosted APK build passed. Its phone run passed
three loss/eventual-reconnect cycles, with delayed rediscovery in the first
cycle; consistently prompt recovery remains unverified.
Beta.10 adds Android explicit-disconnect timeout cleanup and retains beta.9
adapter-off handling. Restore Bluetooth, scan and reconnect explicitly.
The earlier Flutter GATT 8/133 reconnect issue is not established as fixed;
its beta.9 results and six UI ordering tests remain in the review.
Physical acceptance for other platforms and devices remains open. The
[public catalog](https://docs.bota.dev/api-reference/client-sdks#example-apps)
provides public installation and example guidance.

The Flutter sample also guards against delayed connect/status results overwriting
a newer disconnect. Its [UI ordering review](docs/independent-examples-review.md#flutter-ui-completion-ordering-2026-09-30)
separates widget regression evidence from the remaining native reconnect limitation.

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
| [React Native encrypted recording sync](end-to-end/react-native-recording-sync/README.md) | Already-provisioned Android device → encrypted upload → transcription; authenticated local backend; [scope and evidence](docs/independent-examples-review.md#pre-provisioned-recording-sync) | Yes |

Native SDK smoke samples used to develop the SDK itself belong in the SDK source repository. These customer-facing examples consume published artifacts.

## Run the existing sample

These commands apply only to the legacy `apps/` workspace. For an independent example, use its README instead.

Prerequisites: Node 22.23.2 or newer, npm, a Bota API key and test end user in the intended project, and native Android/iOS development tooling for the mobile app. Android requires API 26 or newer; iOS builds require macOS and Xcode. BLE requires a native development build; Expo Go is insufficient.

From the repository root:

```sh
npm ci
```

Copy `apps/backend/.env.example` to `apps/backend/.env`. Set `BOTA_API_KEY`, `BOTA_END_USER_ID`, and the intended `BOTA_API_BASE_URL` (the current code expects the `/v1` suffix). The current default reaches the production API; explicitly select your intended environment and disposable test resources.

In one terminal:

```sh
npm run dev:backend
```

Set `EXPO_PUBLIC_EXAMPLE_API_URL` to the backend URL in the mobile terminal. On a physical phone, use a reachable development-machine address, such as `http://192.168.1.20:4000`, not the phone's `localhost`.

```sh
npm run android -w @bota-dev/example-react-native
# Or, on macOS:
npm run ios -w @bota-dev/example-react-native
```

For an already installed compatible development build, `npm run dev:react-native` starts Metro. Existing native build limitations still apply; these commands were checked against manifests, not executed as part of the architecture work.

Lifecycle scripts must be enabled for `npm ci`. If installation scripts were disabled, run `npm run postinstall` before using the sample; see [dependency security](DEPENDENCY_SECURITY.md).

## Verification

The [catalog workflow](.github/workflows/catalog.yml) runs on every push and pull
request, independently of the example checks. Run the same dependency-free
command locally with Node.js 22.23.2 or newer:

```sh
node scripts/check-catalog.mjs
```

It validates the index's IDs/types and paths, all independent directories,
ordered README catalog consistency, and local inline file links in the root
entry documents, AI guide and indexed README/setup/evidence Markdown files.
It ignores fenced snippets, remote URLs and heading fragments; it does not
validate anchors, reference-style links, HTML links or example behavior. No
package installation, API key or hardware is needed.
The current root CI runs:

```sh
npm test
npm run typecheck
npm run build
```

These commands cover dependency and upload-completion regression checks, workspace typechecks, and the backend build. CI also runs all-platform Expo exports and a separate Android native build. See [migration evidence](docs/app-sdk-migration.md) for prior results; pairing, iOS native linking, and live API/device workflows remain separate gates. Independent examples have their own path-filtered workflows and README commands; none need a root npm install. See [current evidence](docs/independent-examples-review.md).

## Integration boundary

- Keep Bota secret and restricted API keys on your server, never in mobile/browser code or public environment variables.
- A customer backend authenticates app users and authorizes their resources before calling Bota's public API. It is not an unrestricted API proxy.
- Apps may upload bytes directly to scoped storage URLs issued through the backend. That does not grant access to the Bota secret API key.
- Use synthetic or explicitly consented test audio. Do not commit recordings, credentials, signed URLs, or device provisioning material.

## Documentation

- [Architecture](ARCHITECTURE.md): repository structure, integration contracts, migration, and acceptance gates.
- [Contributor and agent instructions](AGENTS.md): how to add and verify examples.
- [Claude Code entry point](CLAUDE.md): shared instructions for Claude Code.
- [Bota public documentation](https://docs.bota.dev): API and SDK integration contracts.

Start with [upload and transcribe](api/upload-and-transcribe-node/README.md) for a standalone API integration. Complete each example's acceptance gates before expanding its support claims.

## October 7 scoped braces source guard

The legacy root and both independent React Native apps retain their existing
query-string/Forge hooks and add standalone mandatory guarded `braces` 3.0.3
installation. Locks/public SDKs/device and HTTP code remain unchanged. Root
`npm test` and each independent app test chain require 16 installer/parser/actual
micromatch controls. Source qualification, scanner identity, hosted native builds
and physical installation remain separate. See [review](docs/braces-depth-mitigation.md).

## October 7 new build-dependency fixes

Four independent locks select source-map-js 1.2.2; the legacy root also selects
shell-quote 1.11.0 and a qualified parent-scoped selector-parser 7.1.6 override.
Each install root has required public-consumer tests; Web CI now runs `npm test`.
See the [source compatibility review](docs/build-dependency-remediation.md) for aged tarballs, tests and
bundled-parser limits. Hosted/scanner and physical acceptance remain separate.
