# Use Bota examples with an AI coding tool

Give your coding tool this repository URL, the task and target language/platform.
The same files work with Claude Code, Codex, Cursor and other tools that can read
source. No Bota skill/plugin, tool-specific integration or root install is needed.
If your tool has relevant installed skills, use them as workflow guidance; the
selected public API/SDK contract still defines the supported integration.

API recipes, SDK starters and optional app references are formats in the current
general-capability layer. Vertical/use-case and app-type demos form the later
layer; these are the repository's two product layers.

## Select by task

Use the [README starting points](../README.md#choose-your-starting-point), then
the selected README and source. You do not need to study the entire repository
design to use one recipe. Before editing this repository, read
[AGENTS.md](../AGENTS.md) and the local instructions; follow their design,
architecture, verification and delivery rules.

| Task | Start here | Public-call source |
| --- | --- | --- |
| Import audio, verify completion and transcribe | [Node recipe](../api/upload-and-transcribe-node/README.md); Python alternative in the catalog | [index.mjs](../api/upload-and-transcribe-node/index.mjs), `uploadAndTranscribe` |
| List cloud recordings | [Node recipe](../api/list-recordings-node/README.md) | [index.mjs](../api/list-recordings-node/index.mjs), `listRecordings` |
| Create general notes | [Node recipe](../api/summarize-transcription-node/README.md) | [index.mjs](../api/summarize-transcription-node/index.mjs), `summarize` |
| Ask about one recording | [Node recipe](../api/ask-recording-node/README.md) | [index.mjs](../api/ask-recording-node/index.mjs), session/message and recovery flow |
| Receive processing events | [Node webhook](../api/webhook-receiver-node/README.md); Python alternative in the catalog | [server.mjs](../api/webhook-receiver-node/server.mjs), raw-byte verification/durable inbox |
| Download original bytes | [Node](../api/download-recording-node/README.md) or [Python](../api/download-recording-python/README.md) | Selected recipe's source; original bytes are not necessarily playable audio |

API recipes are server/development-machine workflows. Their fixed configured
owner is a teaching scope, not a multi-user application's authorization layer.
Replace that scope with the customer's verified identity mapping when adapting.

## Select by SDK platform

Native Kotlin and Swift are first-class choices alongside RN, Flutter and Web.
Use the [coverage table](../README.md#current-platform-coverage) and the exact
published facade; do not require another platform's complete app UI first.

| Platform | Starter | Public-call source / current host |
| --- | --- | --- |
| Kotlin / Android | [Connection/status](../app-sdk/android-device-connect/README.md); [recording catalog](../app-sdk/android-recording-catalog/README.md) | [MainActivity.kt](../app-sdk/android-device-connect/app/src/main/java/dev/bota/examples/connect/MainActivity.kt); Android |
| Swift / Apple | [Connection/status](../app-sdk/apple-device-connect/README.md); [recording catalog](../app-sdk/apple-recording-catalog/README.md) | [App.swift](../app-sdk/apple-device-connect/Sources/BotaConnect/App.swift); macOS hosts, no native iOS starter yet |
| React Native | [Connection/status](../app-sdk/react-native-device-connect/README.md) | [App.tsx](../app-sdk/react-native-device-connect/App.tsx); Android/iOS connection hosts |
| Flutter | [Connection/status](../app-sdk/flutter-device-connect/README.md) | [main.dart](../app-sdk/flutter-device-connect/lib/main.dart); Android host only |
| Web / Chromium | [Connection/status](../app-sdk/web-device-connect/README.md) | [page.ts](../app-sdk/web-device-connect/page.ts) plus [main.ts](../app-sdk/web-device-connect/main.ts); supported Web Bluetooth/secure context |

For the supported Android device-to-backend workflow, use the
[RN encrypted-sync reference](../end-to-end/react-native-recording-sync/README.md).
[DeviceSync.tsx](../end-to-end/react-native-recording-sync/app/DeviceSync.tsx)
calls the public SDK and depends on its native host, authorization/backend and
lifecycle helpers; it is not a standalone file to paste. Flutter beta.13 lacks
the fresh-pairing/encrypted-v2 interfaces needed for that workflow. Native
Windows/Electron SDK support is planned upstream. Missing public capability,
missing host and missing verification are different gaps.

## Use a whole-app reference when useful

[Bota Recordings web](../end-to-end/web-reference/README.md) and
[Android RN/Flutter](../end-to-end/react-native-recording-sync/README.md)
illustrate familiar end-user recording flows and customer-backend composition.
Their recipe tables/source identify complete features and helpers to copy.
They are optional templates, not prerequisites for a small SDK/API example.

Web supports import/library/Transcript/Summary/Ask but no playback. Mobile reads
existing cloud recordings with the same AI views, but has no ordinary import or
playback and its recording hosts are Android only. Sample mode uses synthetic
content with no external/device calls. RN/Flutter share the mobile backend; web
has a separate backend. Reuse can be scoped within the reference family without
forcing every platform through one UI, complete journey or shared backend DTO.

## Inspect, run and copy

1. Read the chosen README's prerequisites, exact commands, public calls and
   evidence. Inspect source, complete imports, manifest and lockfile.
2. Install only in the documented root(s). Keep lifecycle scripts enabled and
   all mandatory postinstall/security checks; do not use a root legacy install
   for an independent recipe or bypass scripts to get a clean build.
3. Identify the files to copy and the application-owned inputs/auth adapter to
   replace. Keep feature logic plain and visible; do not add a universal wrapper
   SDK, hidden cross-example imports or private Bota One/sibling dependencies.
4. Keep keys server-side, identities configurable and owner/source checks intact.
   Retain write intent and known-resource GET recovery. An uncertain response
   does not permit another POST/PUT/command or journal deletion.
5. Preserve upload commitment, device receipt/cleanup and processing boundaries.
   Do not infer cleanup authority from `uploaded`, metadata or a synthetic action.
6. Run the selected appropriate checks and report exactly what they establish.
   Source/syntax, unit, native build, live API and physical evidence are distinct.
   Use the [implementation review](independent-examples-review.md) for versioned
   evidence; historical phone results do not qualify a different source or SDK.

Independent device examples currently pin beta.13. The selected manifest/lockfile
takes precedence over historical prose. Report a missing public contract and the
closest supported path rather than inventing a method or upgrading speculatively.
See [CONTRIBUTING.md](../CONTRIBUTING.md) and
[example contracts](example-contracts.md) for repository changes.

## Read the index

[examples.json](../examples.json) uses `schema_version: 1`. Match `purpose`,
`category`, `language`, optional `platform` and `physical_device_required`.
`path`, `readme`, `setup_reference`, `verification_reference` and optional
`workflow` are repository-relative. Read the linked README for commands, API
permissions and package versions; the index does not embed them.

Presence means source exists, not that live behavior passed. The legacy `apps/`
workspace is excluded. Cloud metadata readers do not require hardware and do not
prove physical observations. Keep the schema and existing IDs stable; update
index/catalog/workflow paths together only when an install root is added/moved.
Catalog CI checks paths and metadata, not example execution:

```sh
node scripts/check-catalog.mjs
node --test scripts/test-catalog.mjs
```

## Copy this prompt

```text
Use the Bota examples repository to implement <task> in <language/platform/host>.
Hardware available: <none or device/platform details; no credentials>.
Requested verification: <source, unit, build, live API or physical>.

Start with the README workflow/platform tables and select the smallest relevant
API recipe or SDK starter. Use Bota Recordings only if whole-app composition is
useful. Read the selected README, public-call source, complete imports, manifest
and lockfile. If editing this repository, read AGENTS.md and follow its local
design/architecture/check rules; otherwise follow my application's instructions.

Report the selected path, exact public call/SDK pin, setup and copy boundary.
Install only in documented roots with scripts enabled. Keep features readable,
server-derived authorization, keys server-side and uncertain-write GET recovery.
Preserve device receipt/cleanup gates. Do not use private helpers, hardcoded
devices or invented facade methods. Full app parity/shared backend is not needed
for a useful platform example. Report public-contract gaps and actual checks;
keep live/hardware evidence distinct from synthetic tests and builds.
```
