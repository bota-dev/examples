# CLAUDE.md - Bota Examples

Read and follow [AGENTS.md](AGENTS.md), the canonical contributor and agent instructions for this repository.

Then read:

1. [README.md](README.md) for the independent examples, retained legacy sample, and entry points.
2. [ARCHITECTURE.md](ARCHITECTURE.md) for example boundaries, public API/SDK integration, migration, and acceptance gates.
3. The README of the example being changed and [DEPENDENCY_SECURITY.md](DEPENDENCY_SECURITY.md) when touching legacy dependencies or install scripts.

Bota One is an internal reference application built on the SDK and public backend API. Reimplement teaching examples from public contracts; do not copy private helpers or require access to Bota One to run an example.

New API examples cover [recording-scoped Ask](api/ask-recording-node/README.md),
[SRT export](api/export-transcription-node/README.md), and a standard-library
[Python webhook receiver](api/webhook-receiver-python/README.md). Preserve their
request intent, recording ownership, exclusive-file and durable-inbox boundaries.
Their current evidence is syntax checks and source review; live acceptance is
unverified at the owner's request to focus on creating examples.

The next API batch adds [cloud device status](api/device-status-node/README.md),
[Python command history](api/list-device-commands-python/README.md) and
[Python transcript search](api/search-transcripts-python/README.md). Cloud
snapshots do not prove live connectivity or physical execution. Keep command
credentials out of output and validate excerpt ownership before printing text.
These examples also have syntax/source evidence only.

[Device inventory](api/list-devices-node/README.md) is a bounded selection,
[transcription watching](api/watch-transcription-python/README.md) polls an
existing job, and [summary notes export](api/export-summary-node/README.md)
writes escaped general-notes Markdown without overwriting. Preserve their
scope checks and read-only cloud behavior. Offset pagination for owner-filtered
inventory is a tracked source/public-doc discrepancy; do not invent a paging loop.

New examples add [Python recording pagination](api/list-recordings-python/README.md),
[Python summary JSON export](api/export-summary-python/README.md), and a
[macOS recording catalog](app-sdk/apple-recording-catalog/README.md). Preserve
their owner/link checks and exclusive output. Apple metadata uses fresh pairing
and connection fencing; it does not establish cloud ownership or upload durability.
Public Web/Flutter beta.13 lacks gates needed for equivalent catalogs; those
examples remain deferred, with no private SDK workaround.

The [Node summary workflow](api/summarize-transcription-node/README.md) retains
creation intent and resumes the saved job through GET. Preserve that behavior:
another template-based POST can replace an existing summary. The
[Android catalog](app-sdk/android-recording-catalog/README.md) lists SDK metadata
only, with exact serial verification and connection-loss fencing; legacy catalog
entries must not be described as necessarily plaintext.

The ninth [encrypted recording-sync example](end-to-end/react-native-recording-sync/README.md)
uses public beta.13 with an already-provisioned Android device, a native HTTP
adapter and an authenticated local backend. Pairing, full automatic recovery and
legacy retirement remain outside its bounded scope. Follow the exact evidence in
the [scoped review](docs/independent-examples-review.md#pre-provisioned-recording-sync).

The first independent [Node API example](api/upload-and-transcribe-node/README.md) is implemented, locally tested, and live-verified with a test key and synthetic speech. Python is also live-verified; a webhook receiver and five read-only connection samples are implemented. All seven independent device examples pin public beta.13 after completed protected publication. See [current review](docs/independent-examples-review.md#beta13-adoption) for package/build checks and separate historical phone evidence. Beta.13 example hardware acceptance remains unverified. The existing `apps/backend` and `apps/react-native` workspace uses `@bota.dev/react-native-app-sdk@2.0.0-beta.6` and Node 22.23.2 or newer. Read [migration evidence](docs/app-sdk-migration.md): prior all-platform exports and Android native build passed, while authentication/provisioning compatibility gaps, iOS native linking, and physical-device acceptance remain. Keep design intent, source behavior, and verified results distinct.
## October 7 dependency tooling

Keep the three independently installed node-forge parser guards and their
mandatory tests intact; see [review](docs/node-forge-parser-mitigation.md).
Affected 1.4.0 scanner records remain open; public SDK/physical acceptance is separate.
