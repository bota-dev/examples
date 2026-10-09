# Bota Examples

Examples for integrating the Bota backend API and Bota App SDK into your own applications. API examples demonstrate server-side workflows; App SDK examples demonstrate communication with physical Bota devices; end-to-end examples connect the two.

Each independent example has its own setup, dependencies, verification steps, and compatibility notes. You do not need Bota's internal application repositories to run an example.

## Current status

The catalog contains seventeen independent examples. Node and Python upload/transcription examples are live-verified with a test key and synthetic speech. The API examples also cover Node/Python webhooks, paginated recording metadata, original-file download, transcript search, structured summaries, recording-scoped Ask and subtitle export. The three newest examples are implemented with syntax checks and source review; live behavior is unverified. Five focused App SDK connection examples, Android encrypted recording sync and Android recording metadata listing are implemented; exact evidence is recorded in the [implementation review](docs/independent-examples-review.md). The full replacement, including target secure pairing and wider recovery acceptance, remains incomplete. The existing React Native/backend pair remains until replacement acceptance gates pass.

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

Each linked example installs independently. All seven device examples (the five
connection examples, Android catalog and encrypted recording sync) pin published
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
| [React Native connect](app-sdk/react-native-device-connect/README.md) | Discover, verify serial, connect, read status, disconnect | Yes |
| [Web connect](app-sdk/web-device-connect/README.md) | Browser picker and identity verification with Web Bluetooth and WASM | Yes |
| [Apple connect](app-sdk/apple-device-connect/README.md) | SwiftUI macOS application using the public Swift package | Yes |
| [Android connect](app-sdk/android-device-connect/README.md) | Kotlin Android application using Maven Central | Yes |
| [Android recording catalog](app-sdk/android-recording-catalog/README.md) | Verify exact serial and list legacy/encrypted-v2 metadata without audio transfer | Yes |
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
