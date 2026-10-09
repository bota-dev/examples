# AGENTS.md - Bota Examples

October 7 braces #111/#112/#113: all three affected install roots own standalone
mandatory postinstall source guards, MIT/provenance assets and 16-case suites.
Keep public package/lock/SDK identities unchanged; do not import sibling helpers.
Root `npm test` and both independent app test chains require the guard. Vendor
bytes stay exact across checkouts; unknown source/identity fails. See
[review](docs/braces-depth-mitigation.md).

October 7 new #114–#119 records: keep the four standalone source-map-js suites
required by each root/app `npm test`, including Web CI. The root selector-parser
7.1.6 overrides are scoped to two reviewed parents; do not widen them or claim
the embedded Tailwind fallback was changed. Keep public SDK/native identities
fixed. See [qualification and limits](docs/build-dependency-remediation.md).

## Read first

Read [README.md](README.md) for current availability, [ARCHITECTURE.md](ARCHITECTURE.md) for target structure and acceptance gates, and the README of the example being changed. This file is the canonical contributor/agent instruction source; `CLAUDE.md` refers here.

The repository contains an existing npm workspace under `apps/`, migrated to `@bota.dev/react-native-app-sdk@2.0.0-beta.6` while retaining compatibility lifecycle flows. Read [migration evidence](docs/app-sdk-migration.md) before changing it. The independent `api/upload-and-transcribe-node/` example is implemented, locally tested, and live-verified with a test key and synthetic speech. Additional independent examples are implemented under `api/`, `app-sdk/` and `end-to-end/`; Python is also live-verified, and five connection samples consume exact public packages. All eight independent device examples pin public beta.13 after completed protected publication. Read [current evidence and blockers](docs/independent-examples-review.md#beta13-adoption); earlier phone results remain tied to their tested versions. The full recording-sync replacement is not implemented. Do not confuse a proposed directory or workflow with implemented code. Documentation-only work must not silently upgrade packages, move examples, or run device operations.

## Implementation rules

### Ten independent API cases

- Keep fleet output aggregate and operator-scoped. Connection/upload/OTA readers report server resolution, never applied firmware, radio availability or upload integrity.
- Transcription/summary directories retain exact source filters across bounded pages and recheck ownership; emit no content. JSON transcript export is separately authorized and private, with no overwrite.
- Empty Ask session creation and title rename keep intent durable before a single write. Uncertainty permits GET reconciliation only; preserve owner membership, immutable scope and private title material.
- Firmware detail is declared artifact metadata. Record source/syntax evidence and runtime limits in the [ten-case review](docs/independent-examples-review.md#ten-api-cases-october-8).

### Original downloads and existing-resource watchers

- [Python download](api/download-recording-python/README.md) isolates storage credentials, uses trusted exact hosts and publishes private original bytes without overwriting. Recheck ownership; URL issuance is not integrity proof.
- [Summary watching](api/watch-summary-node/README.md) retains exact project/source/owner scope and emits metadata only. Bounded GET failure never permits regeneration.
- [OTA watching](api/watch-ota-node/README.md) retains exact assignment/release identity. Current owner checks do not prove historical authorization; reported `applied` is not physical installation evidence. Perform no device writes.
- Keep creation-only evidence and runtime gaps in the [batch review](docs/independent-examples-review.md#download-summary-ota-watchers-october-8).

### Configuration and Ask session discovery

- [Schema discovery](api/config-schema-node/README.md) prints metadata only; no defaults, fixed section inventory or consumer-enforcement claim.
- [Processing observations](api/processing-config-python/README.md) retain current device-owner checks. Section `source` is not field provenance, job success or applied device state; perform no writes.
- Keep [Ask session traversal](api/list-ask-sessions-python/README.md) bounded with its fixed owner filter on every page. Session scope IDs are not recording access authorization; emit no conversation text.
- Record source/syntax evidence and runtime gaps in the [batch review](docs/independent-examples-review.md#configuration-ask-directory-october-8).

### Directory, OTA history and existing-upload transcription

- Keep [directory traversal](api/list-end-users-node/README.md) project-scoped, bounded and explicit about capped/non-atomic output; print no profile data.
- [OTA history](api/list-ota-history-python/README.md) is operator metadata. A timestamp cutoff and current-owner reads cannot prove historical assignment ownership; perform no device writes.
- Keep [transcription creation](api/transcribe-existing-node/README.md) intent durable, IDs immutable and uncertain recovery GET-only; another POST can replace an existing result. Use only public language/provider fields.
- Record creation-only evidence and runtime gaps in the [batch review](docs/independent-examples-review.md#directory-ota-transcription-october-8).

### Onboarding, custom summaries and firmware discovery

- Keep [end-user creation](api/create-end-user-node/README.md) pre-POST intent durable; uncertainty permits GET reconciliation only. Never replace a saved end-user ID after external-ID reuse.
- Keep [custom summarization](api/custom-summary-python/README.md) scoped to its saved source/prompt/provider and known job ID; never repeat an uncertain create.
- [Firmware discovery](api/list-firmware-python/README.md) uses public device filtering and owner observations only. Add no model filter, pagination, delivery or installation path.
- Record source/syntax evidence and unverified runtime acceptance in the [batch review](docs/independent-examples-review.md#onboarding-custom-firmware-october-8).

The next creation batch adds `api/read-ask-history-node`,
`api/export-transcription-python` and `api/recording-pipeline-node`. Preserve
fixed-owner session membership, recording ownership and exact citation scope
before emitting conversation text. Transcript export uses completed `full_text`
and private no-overwrite publication. Pipeline output projects independent
resource statuses and exact source links; it cannot authorize device cleanup or
establish an atomic snapshot. These are GET-only workflows with no model calls.
Keep syntax/source evidence separate from unverified runtime/live acceptance.

The next batch adds `api/list-recordings-python`, `api/export-summary-python`
and `app-sdk/apple-recording-catalog`. Python pagination preserves its fixed
owner on every cursor request and reports capped traversal; JSON export checks
the completed summary's project and source links, rejects invalid JSON and
publishes without overwriting. Apple uses exact public beta.13, fresh
`controls.readPairingState(from:)` and `recordings.listPendingRecordings(_:)`;
connection snapshots alone are insufficient. Clear/fence metadata after observed
status-stream failure/termination or disconnect; omitted OS callbacks remain
unverified. Never transfer/delete audio. Web/Flutter catalog proposals
were deferred because their published beta.13 surfaces lack the required gates;
do not import private transports or unpublished facade APIs to bypass them.
No functional/live/device tests were run in this creation batch; Apple native
build is unavailable locally on Windows; hosted macOS compilation passed at 9117760.

The inventory/watcher/notes batch adds `api/list-devices-node`,
`api/watch-transcription-python` and `api/export-summary-node`. Inventory is one
bounded end-user-filtered GET, not a paging loop: tracked backend does not honor
documented offset pagination for that filter. Always label the selection
incomplete. The watcher observes an existing configured transcription by GET;
failure/timeout must not create or replace jobs. Summary export accepts only
completed `tmpl_general_notes` output with exact project/transcription/recording
and owner links, escapes untrusted Markdown text, and preserves existing output
files. Keep this batch's syntax/source evidence separate from runtime acceptance;
the owner continues to request creation without functional/live testing.

The next October 8 creation batch adds `api/device-status-node`,
`api/list-device-commands-python` and `api/search-transcripts-python`. Device
readers use configured end-user ownership; snapshots and command timestamps are
cloud reports, not physical connection/execution proof. Command history is a
bounded newest-first list with no cursor support; exclude grants, parameters,
results and arbitrary error payloads. Python search checks every returned
recording's owner before printing excerpts, makes no automatic retries and
documents embedding-provider usage. Preserve independent standard-library
implementations. This batch also uses syntax/source review only under the owner's
creation-without-testing instruction; functional and live acceptance are unverified.

The October 8 API expansion adds `api/ask-recording-node`,
`api/export-transcription-node` and `api/webhook-receiver-python`. Keep each
independent. Ask retains durable pre-POST intent and uses GET-only reconciliation
after uncertain outcomes; never resend automatically. Export checks completed
transcription/recording/end-user identity and creates SRT without overwriting.
Python webhook acceptance requires verified raw bytes and a durable SQLite
commit before acknowledgment. The owner requested creation without testing for
this batch: evidence is syntax checks and source review, with runtime/live
acceptance unverified. Do not convert that limit into a verified workflow claim.

October 7 node-forge #108/#109/#110: each affected install root carries its
own mandatory, hash/version-pinned postinstall parser guard and nine real
Forge/Expo regressions. Keep package identity/locks unchanged; scanner and
native/runtime acceptance remain separate. See [mitigation review](docs/node-forge-parser-mitigation.md).

`api/download-recording-node` requests original stored bytes only. Keep API auth
off storage requests, reject redirects, preserve existing destinations and remove
incomplete files. Optional expected SHA-256 comes from a trusted caller fixture;
the download URL response supplies no checksum. Do not add conversion/decryption
or treat URL issuance as successful download.

`api/search-transcripts-node` retrieves excerpts under a fixed server-configured
end user and optional recording allowlist. Validate every result and check unique
recording ownership before emitting text. Keep the single deadline, bounded
responses and no automatic retry. Search may incur embedding-provider usage;
empty results are not evidence that indexing or nonempty retrieval works.

`api/list-recordings-node` teaches read-only cloud metadata pagination. Keep its
project key server-side, preserve the optional end-user filter on every page,
follow opaque cursors and enforce the page cap. Report incomplete traversal;
never silently treat a capped list as complete. Print only selected metadata,
not arbitrary API response fields, credentials, storage paths or signed URLs.
Run its independent syntax checks and pagination/failure tests. No hardware is
required; live API and mocked evidence remain separate.

The ninth example is `end-to-end/react-native-recording-sync`: Android with an
already-provisioned device and encrypted-v2 recordings only, using public beta.13.
Its native module owns authenticated HTTP callbacks and scope/session metadata;
SDK code owns recording bytes, transport and receipt confirmation. Keep the backend's
fixed project/end-user/device checks, explicit app authentication, exact binding
generation and durable uncertainty journal. Run backend tests, app tests/typecheck/
export, `:recording-sync:testDebugUnitTest` and Android assembly. Never weaken the
fresh idle/no-active-upload check or repeat uncertain writes to make the example
look recoverable. Physical and full-replacement acceptance are separate gates.

The catalog also includes `api/summarize-transcription-node` and
`app-sdk/android-recording-catalog`. Summary POST can replace an existing result;
keep durable pre-POST intent and GET-only resume, and never discard an uncertain
journal to force another create. Its tests use Node built-ins and SQLite. The
Android catalog calls public SDK metadata APIs only, labels legacy separately
from encryption, and fences late results after connection loss. Run its own
Gradle unit tests and APK build; neither mocks nor assembly prove physical reads.
In public Android beta.13, the connection snapshot's `isProvisioned` defaults to
false. Gate already-provisioned workflows with a fresh public SDK pairing-state
read, fenced to that connection; false/error means paired state was not confirmed,
not proof of missing credentials. A pairing read does not replace backend ownership
or encrypted-upload capability/authorization checks.

1. One example teaches one bounded workflow. Use the simplest structure that exposes the public integration clearly.
2. New examples install independently, with their own manifest/lockfile and README. An end-to-end example may have a local app/backend workspace. Do not extend the legacy root workspace to all examples.
3. Consume published Bota SDK packages and public `/v1/*` APIs. Pin direct SDK dependencies exactly and record the release channel. Verify availability and methods before choosing a version. Never assume private source HEAD is published.
4. Bota One is the primary internal integration reference. Read it to understand behavior and boundaries, then reimplement from public contracts. Do not import or copy private app helpers, native modules, comments, transforms, auth wrappers, account configuration, or infrastructure. No dependency on sibling repositories is allowed at runtime or install time.
5. No new GATT protocol implementation, custom crypto, generic SDK wrapper framework, or private `/dashboard/*` calls. If public SDK support is missing, document the blocker rather than building a hidden alternative SDK.
6. Do not share runtime code between independent examples. Avoid speculative examples, empty scaffolds, and a global package manager requirement for non-JavaScript examples.
7. Preserve unrelated source and dependency security fixes. Read [DEPENDENCY_SECURITY.md](DEPENDENCY_SECURITY.md) before changing the legacy workspace lockfile, overrides, or postinstall adapter.

## Trust and lifecycle boundaries

- Bota secret/restricted API keys remain in server environments. Never put them in mobile/browser configuration, committed fixtures, screenshots, or logs.
- New app-facing backends authenticate callers and authorize every resource against server-derived identity/project/end-user context. Do not treat IDs or workspace headers supplied by a client as authorization.
- If using the architecture's local single-user mode, require its separately configured app token and clearly document the fixed test identity and deployment limits. Do not copy the existing unauthenticated backend into a new example.
- Apps may relay scoped grants/opaque provisioning envelopes and use scoped upload URLs. Avoid logging those values.
- Use SDK identity reads to verify devices. Follow prepare/provision/confirm binding and exact-attempt abort/recovery; do not describe raw-token compatibility paths as target conformance.
- Preserve the selected upload protocol's durability and deletion requirements. Unknown outcomes require reconciliation; disconnection alone must not trigger concurrent BLE fallback while direct upload may remain active.
- Unbind is not factory reset. If device mutation is in scope, read the relevant runbook/design first and compare its gates with the command before execution.
- Use synthetic or consented audio. Do not commit real customer data or build automatic cleanup that can delete unrelated recordings/devices.

## Workflow

Before editing, state scope and assumptions, inspect the relevant public API/SDK contract, and define observable acceptance criteria. Check the example's actual manifest and source rather than copying stale version statements from prose.

Implement only the requested example/change. Keep pending target requirements and compatibility limitations explicit. A source implementation, mock test, native build, live API test, and physical-device test are different evidence levels.

For new examples, run their own documented install/check commands. Add meaningful checks for the changed behavior, especially authorization rejection, webhook verification, or retry/durability logic. Do not add tests that merely assert document text or mirror implementation details.

For `api/upload-and-transcribe-node/`, run `npm ci`, `npm run check`, and `npm test` from that directory. It uses Node built-ins and its own lockfile; no root install is needed. Its path-filtered workflow uses no live credentials. Follow its README before live verification; the test end user's auto-transcription must be disabled because this example creates the job explicitly.

The webhook receiver uses Node built-in SQLite and commits before acknowledgment; do not replace its durable inbox with an in-memory Set. Python uses no third-party packages (`python -m unittest -v`). React Native uses Expo 57's iOS 16.4 floor and a scoped `xcode` ? `uuid@11.1.1` override. Web needs browser user activation and Bota Identity service support. Apple is a macOS app; Flutter includes an Android host only. Use each README and workflow for native checks. The current published provisioning API still returns raw `deviceToken` through the React Native provider; it is not the target opaque prepare/provision/confirm flow. Encrypted sync requires application-native material handling. Do not bypass these boundaries to mark the replacement complete.

Legacy workspace commands, from repository root:

```sh
npm ci
npm test
npm run typecheck
npm run build
```

Use Node 22.23.2 or newer. These commands are part of current CI, which also runs all-platform Expo exports and a separate Android native build. `npm ci` runs a required postinstall adapter. `npm run build` currently builds the backend. There is no root lint command. Prior migration CI evidence does not establish iOS native linking or physical-device acceptance. For documentation-only edits, inspect links, paths, commands, and status claims; dependency installation and hardware tests are unnecessary unless the documentation change depends on new runtime evidence.

## Documentation and review

The independent React Native example's iOS gate uses macOS 26, Xcode 26.6, and explicitly selected CocoaPods 1.16.2. Xcode 26.3 fails in Expo's native ownership annotations. The passing simulator build is evidence for this example only, not the legacy workspace or physical Bluetooth behavior.

Keep Android example application IDs distinct so samples can coexist on a test phone. Kotlin uses `dev.bota.examples.kotlinconnect`, React Native uses `dev.bota.examples.connect`, and Flutter uses `dev.bota.examples.bota_connect`. For Windows USB RN tests, verify Metro answers on IPv4 loopback before launching the debug APK; see its README. The review records exact-serial connection, mismatch rejection, status, and reconnect on Samsung SM-A166U1 / Bota Pin firmware 1.0.19. Historical beta.8 Kotlin radio-off/reconnect passed on this pair. RN cleared stale state but reconnect failed with GATT 133; Flutter missed one adapter-off event and later reconnect failed. The SDK handles confirmed GATT loss, but Android adapter shutdown can omit that callback. Beta.9 adds native adapter-off cleanup. Keep transport policy in the SDK; do not add private GATT or polling workarounds to the examples. Keep explicit disconnect UI cleanup in `finally`, retain failure messages, and distinguish tested manual recovery from automatic loss detection.

Keep the changed example's README and root catalog accurate. Update `ARCHITECTURE.md` when boundaries, layout, or migration status change; update this file when contributor rules change. Keep `CLAUDE.md` a short entry point instead of duplicating architecture.

In the Flutter connection sample, preserve newer connection notifications when
an older connect/status Future settles. Run `flutter test` as well as analysis
and the native build after changing this lifecycle. Widget regressions establish
UI ordering only; they do not establish a fix for native GATT reconnect failures.

The earlier SDK adapter-off fix was published across synchronized beta.9 artifacts.
At that checkpoint all five pins and hosted builds were verified. Beta.9 phone tests cleared
stale UI on all three radio losses per framework. RN passed all first reconnects;
Flutter passed two and recovered the third after GATT 8/133 with a fresh scan,
without an app restart or additional radio cycle. Preserve this reliability
limit in the [adoption review](docs/independent-examples-review.md#beta9-adoption).
Earlier candidate labs passed three radio-off/explicit-reconnect cycles per
framework, with one initial RN timeout recovered on retry. Keep those results
separate from public-package acceptance. Never copy isolated Maven overrides
into these public examples.

Beta.10 adds exact-generation cleanup when explicit disconnect times out or
is cancelled without a native callback. Its late event must not cancel queued
replacement work. All five connection examples previously used exact public beta.10
dependencies. Protected publication and public native/Flutter verification
completed after CocoaPods registration and CDN propagation recovered. Preserve
the six Flutter UI completion-ordering tests and the public package boundary;
example builds and physical checks remain separate from publication evidence.
See [historical beta.10 adoption](docs/independent-examples-review.md#beta10-adoption) for
local, hosted and phone evidence. Do not claim this fixes the distinct GATT
8/133 issue or proves physical missing-callback behavior from simulated native
regressions.

The October 8 beta.13 adoption covers all seven independent device examples,
using public artifacts from tag commit `958696b`. Keep the legacy beta.6 workspace
and dependency guards unchanged. The [current review](docs/independent-examples-review.md#beta13-adoption)
records local/hosted checks; beta.13 example physical acceptance remains unverified.
Do not attribute unpublished SDK recovery work or internal-app test results to
these examples. Recording-sync retains its existing bounded uncertainty behavior.

Search changed tokens (paths, package names, environment variables, endpoints, symbols) across this repository's docs. In a full Bota workspace, also search `internal-docs/`, `docs/`, and every repo's `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, and `README.md`; inspect the internal-docs downstream impact matrix. Review each affected hit. If those repos are unavailable, record the missing cross-repo check; do not make private workspace access a prerequisite for public contributors.

Before reporting completion, use `bota-skills:compound-engineering` 1.2.5+ when available (shared workspace source: `claude-code-plugins/plugins/bota-skills/skills/compound-engineering/SKILL.md`). Otherwise review directly against the user's scope, this architecture, and the selected public contracts. Record requirement -> evidence -> verification -> status in the existing review section or a concise completion checklist. Use matched, intentionally diverged, partial, not implemented, or unverified; explain deviations and outstanding checks.

Do not call an example verified until its claimed acceptance gates have evidence. Report exactly what ran and what remains unverified. New device examples must identify hardware/firmware/platform coverage; hosted CI success must not be inferred from local commands.

## Commit attribution

- Include the actual agent model's `Co-Authored-By` attribution on AI-authored commits.
