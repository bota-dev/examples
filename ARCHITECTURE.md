# Bota Examples Architecture

Status: fourteen independent examples are implemented, including the bounded already-provisioned Android recording-sync path, Node summary/list/download/search workflows and an Android metadata catalog. Node/Python upload and transcription are live-verified. The webhook receiver and five read-only connection samples have the checks recorded in the [implementation review](docs/independent-examples-review.md). All five App SDK connection examples pin public beta.10 following its completed protected release. Flutter adoption checks are recorded separately below. Beta.10 adds exact-session explicit-disconnect timeout cleanup. RN beta.10 passed three radio-loss/first-reconnect cycles and graceful disconnect/reconnect on Samsung SM-A166U1 / Bota Pin firmware 1.0.19; all four beta.10 example workflows passed at source 54237e1, including RN Android and iOS Simulator builds. The earlier Flutter GATT 8/133 reconnect issue is not established as fixed, and wider physical coverage remains partial. Full recording-sync replacement and legacy retirement remain blocked on their existing integration/hardware gates. Target requirements below remain unchanged.

## 1. Purpose and scope

The [beta.10 adoption review](docs/independent-examples-review.md#beta10-adoption)
tracks all five exact public package upgrades, including Flutter after completed publication.
Flutter's six widget tests and hosted APK build passed at source `c8c7a89`.
Its public-package phone run passed three loss/eventual-reconnect cycles with
verified identity/status, but the first cycle required a third scan several
minutes later. This bounded observation does not establish prompt rediscovery
or diagnose the delay's cause.
Each example selects an available public version independently, as required by
section 4. Native SDK cleanup owns connection loss; examples add no GATT or
retry workaround. The earlier beta.8/beta.9 failures, hosted builds and isolated
candidate checks remain historical evidence, including the unresolved Flutter
first-attempt reconnect limitation.

Keep customer-facing API and App SDK examples in one discoverable repository. Each example teaches one bounded workflow with enough context to run it and understand its trust boundaries. Complete app/backend workflows are allowed when that relationship is the subject of the example.

Examples consume public Bota `/v1/*` APIs and published Bota App SDK packages. The App SDK is the device-facing library family. A future API SDK is a separate server-client family; until a suitable public API SDK exists, use ordinary HTTP clients and the public API schema rather than inventing or importing a private SDK.

Bota One is the internal reference application: it demonstrates a real customer application built on the SDK and backend API. It is a source of integration lessons, not a dependency or template to copy wholesale. Its private helpers, native modules, infrastructure, deployment accounts, branding, and application state do not become example prerequisites.

Non-goals: a second SDK, a reusable example framework, a production SaaS starter, feature parity with Bota One, firmware implementations, and platform administration through `/dashboard/*`.

## 2. Repository organization

Implemented layout, including the scoped Android recording-sync example:

```text
examples/
  README.md                         # Catalog, current status, entry points
  ARCHITECTURE.md                    # Design and migration/acceptance gates
  AGENTS.md                         # Canonical contributor/agent rules
  CLAUDE.md                         # Claude entry point; refers to AGENTS.md
  api/
    upload-and-transcribe-node/
    upload-and-transcribe-python/
    webhook-receiver-node/
    summarize-transcription-node/
    list-recordings-node/
    download-recording-node/
    search-transcripts-node/
  app-sdk/
    react-native-device-connect/
    web-device-connect/
    apple-device-connect/
    android-device-connect/
    android-recording-catalog/
    flutter-device-connect/
  end-to-end/
    react-native-recording-sync/    # Already-provisioned Android, encrypted v2 only
      app/
      backend/
      README.md
  .github/workflows/                # Checks selected by changed example
  apps/                            # Existing legacy pair during migration
    backend/
    react-native/
```

Python now teaches server-side upload; Apple (macOS), Android, Flutter (Android), Web, and React Native teach read-only connection/status using exact published SDK packages; the adoption review records the current versions. Different languages do not require different repositories. Split a project out only when it becomes an independently maintained application with its own access, deployment, or release lifecycle; retain a catalog link here.

### Independence and dependencies

- The unit of installation is an example directory. A reader can copy that directory and follow its README without sibling repositories or other examples.
- Each new example owns its dependency manifest and appropriate lockfile. An end-to-end example may own a local workspace joining its app and backend with one lockfile.
- Do not add new examples to the legacy root `apps/*` npm workspace. Keep the existing root workspace and lockfile until its consumers migrate.
- Avoid root runtime packages, shared authentication servers, cross-example source imports, Git submodules, unpublished artifacts, and local `file:` dependencies on Bota repositories.
- Small teaching helpers may be repeated to keep examples self-contained. Substantial reusable protocol logic belongs in the SDK or platform, not an examples utility library.
- Root automation can orchestrate checks; it must not become a runtime prerequisite.

## 3. Integration and ownership

The ninth example, `end-to-end/react-native-recording-sync`, implements a bounded
already-provisioned-device path. Its app and backend install independently within
the example. A public Kotlin material-registration adapter supplies authenticated
HTTP callbacks; the SDK owns transfer, native bytes and signed-receipt confirmation.
The backend fixes project/end-user/device scope, verifies binding generation and
retains a SQLite journal. Uncertain creates/PUTs and expired or changed sessions
stop for reconciliation. The example does not implement pairing, a second transport
engine, full automatic restart recovery, or legacy retirement. Current verification
is in the [scoped review](docs/independent-examples-review.md#pre-provisioned-recording-sync).

```text
API-only script (developer's server environment)
  -> Bota public API -> upload storage / processing / results

Physical device <-> App using published App SDK
                      | authenticated application requests
                      v
                Customer-owned backend -> Bota public API
                      |
                      +-> scoped upload authorization -> App -> storage

Bota webhook delivery -> customer receiver -> application processing
```

| Component | Owns |
| --- | --- |
| App SDK | Supported device transport, protocol, and device workflows exposed by its public release |
| Example app | Permissions, selection, UI, SDK lifecycle, and documented host callbacks/persistence |
| Customer backend | App-user authentication, project/end-user mapping, resource authorization, Bota API credentials and orchestration |
| Bota platform | Authoritative device/recording resources, cloud audio, transcription, summaries, and platform processing |
| API-only script | Explicit developer-selected inputs and credentials in a server/CLI environment |

The customer backend may persist identity mappings and necessary recovery state. Do not mirror the platform's entire recording/transcription database merely to support an example.

Connection notifications take precedence over older UI operations. A delayed
connect or status result must not restore a disconnected selection or display
status from a retired connection. Test event/result ordering separately from
physical Bluetooth reliability; UI guards do not change SDK transport policy.

### Authentication and authorization

Use public `/v1/*` contracts. App-facing backends must validate caller identity, derive project/end-user context from trusted server-side configuration or mappings, and check ownership for every resource operation. A request's workspace header, end-user ID, or device ID is not authorization. Constrain proxy routes and accepted fields; never expose a generic forwarder using a privileged API key.

For an initial local end-to-end sample, a documented single-user mode is acceptable: the backend uses a fixed test identity and requires a separate developer-configured app access token, with no built-in default. This is a local test credential, not a Bota API key or a production identity system. Bind locally by default and document deliberate LAN access for physical phones. Hosted or multi-user variants must replace this mode with verified user authentication and per-user authorization. Do not imply that adding CORS provides authentication.

Keep `sk_*` and `rk_*` credentials server-side. Redact authorization headers, device tokens, signed upload URLs, provisioning envelopes, and audio contents from logs. Clients may receive only the scoped grants, opaque material, and upload authorization required by the public workflow. Use HTTPS for hosted endpoints.

### Device lifecycle and recording durability

Apply these contracts only when an example includes the corresponding feature; a connect/status sample need not implement binding, reset, or upload.

- Verify the selected physical device through SDK identity reads, including its exact serial number; advertised names are discovery hints.
- Binding follows prepare -> physical-device provisioning -> confirm of the exact attempt. Abort unsuccessful attempts without deleting the stable device row. The target relays a device-bound opaque provisioning payload; raw-token provisioning is a tracked compatibility gap. Preserve binding-generation checks when reconciling late results.
- Use backend-issued action authorization and the public SDK for protected recording control. Do not implement GATT opcodes or cryptography in examples.
- Describe the selected upload profile and capability requirements. Preserve stable recording/session identity during recovery, handle unknown outcomes, and report transfer, cloud completion, transcription, and summary as distinct states.
- Delete a device recording only after the selected protocol's required durable confirmation. A successful byte transfer or a transcription request alone is not deletion authority.
- If supporting direct WiFi/4G upload plus BLE fallback, establish fresh evidence that device upload ownership is inactive before starting BLE. Disconnect/timeout does not establish inactivity.
- Keep unbind and factory reset distinct. Reset examples, if later added, must preserve the durable exact-command completion flow and generation fencing; they are outside the initial catalog.

If the installed public SDK/API/firmware combination cannot support a target requirement, mark the feature blocked or explicitly limited. Do not silently reproduce Bota One's workaround or downgrade a required security profile.

### Asynchronous API workflows

The Node summary example starts from an existing completed transcription. It
persists scoped creation intent before POST and the returned summary ID before
polling. An ambiguous creation stops for explicit reconciliation; a repeated
template-based POST can replace an existing result. A local journal does not
serialize other applications or the platform's automatic processing. Keep those
limits explicit instead of presenting local deduplication as exactly-once work.

The Android recording catalog uses only public SDK identity/status/catalog calls.
It renders `PendingRecording.Legacy` and `EncryptedV2` separately; legacy does not
mean plaintext. Connection revisions fence late reads. Metadata listing does not
authorize audio transfer or establish cloud commitment, and this example adds no
binding, upload, recording control or cleanup operations.

API upload examples must follow the public upload/finalization contract before requesting processing. Use bounded polling with terminal-error handling or documented webhooks to retrieve asynchronous results. Retry only when the operation's documented idempotency/recovery behavior makes it safe; do not create duplicate recordings or processing jobs blindly.

The API recording-list example follows opaque cursors using a server-held project
key and an optional end-user filter. It projects selected metadata, limits the
number of pages and reports incomplete traversal explicitly. Listing is not a
snapshot, a resource authorization check for a multi-user app, or permission to
download or delete audio. This example performs no writes.

The recording-download example retrieves original stored bytes, without format
conversion, enhancement or decryption. It checks configured scope before URL
issuance, isolates API credentials from storage, limits transfer size and time,
and publishes a local file without overwriting an existing destination. A signed
URL is not proof that an object exists or that its bytes match a trusted fixture.

The transcript-search example fixes end-user scope and optionally narrows to a
recording allowlist. It validates citations and checks each returned recording's
owner before printing any excerpts. Search uses the provider's embedding path
and may incur usage; it does not create an Ask session or generated answer.
Empty results do not establish indexing readiness. Separate ownership reads do
not provide an atomic snapshot or replace customer application authorization.

The webhook example must use the public verification format, preserve the input bytes that verification requires, and handle duplicate events. It must document delivery/retry semantics and acknowledge only after the example's stated acceptance/durability step. Do not invent signature headers or claim exactly-once delivery.

## 4. Example contract

Every new example README must include:

1. One-sentence learning objective, expected outcome, and explicit exclusions.
2. Status: planned, implemented but unverified, verified for a stated combination, or legacy/deprecated. Distinguish mocked, live API, native-build, and physical-device evidence.
3. Prerequisites: language/toolchain, OS, SDK exact version and release channel, API environment, project/end user, hardware/firmware/capabilities when relevant.
4. Dependency installation and configuration from the example directory, with placeholder-only `.env.example` or platform equivalent. Explain each value and which component may see it.
5. Exact run commands, expected visible result, failure/recovery behavior, and cleanup of any cloud resources or device recordings it creates.
6. Local verification commands and a dated compatibility/evidence table; say `not run` for missing checks.
7. Links to public contracts, known limitations, and instructions for adapting to a customer application.

Keep one primary path through the example. Pin direct Bota SDK dependencies to an exact publicly installable version, including beta suffixes; preserve native lock/resolution files where supported. Select versions at implementation time after public installation verification, rather than inheriting whichever source version Bota One currently uses. Respect host callback obligations and platform support limits.

There is no synchronized release version for the examples collection. Update each example's dependency pin and evidence together. Catalog rows identify support and status; tags are optional snapshots, not compatibility guarantees for every example.

## 5. Current baseline and migration

Initial inspection used examples commit `7d817bb5b6c35902b7096c80b10085083eadd9d2`; the baseline below was reconciled with main `36684e0`, including the App SDK migration `64a9fd0`, before committing. The initial design changed documentation only. The existing workspace is legacy in layout and lifecycle scope, not in SDK package selection.

| Current evidence | Consequence / migration gate |
| --- | --- |
| Root `package.json` declares `apps/*`, one lockfile, security tests, typechecks and workspace builds | Retain current commands until replacement paths and CI are implemented |
| App pins `@bota.dev/react-native-app-sdk@2.0.0-beta.6`; old standalone SDK packages and BLE PLX were removed | Preserve the published SDK migration and select/verify appropriate versions for new examples |
| Expo 57 native matrix aligned; prior migration CI passed all-platform exports and Android native build | Historical Hermes export failure superseded; iOS native linking and physical-device acceptance remain open |
| `apps/backend/src/index.ts` has open CORS, no caller auth, a fixed `BOTA_END_USER_ID`, and unscoped resource access | Legacy local-only sample; implement the new backend boundary before publishing a replacement |
| Register/token routes call immediate `/bind` and return `device_token`; app provisions it directly | Does not implement the target prepare/provision/confirm lifecycle or opaque payload boundary |
| Existing upload-complete handler separately attempts transcription and may return a nested error | Replacement must distinguish cloud completion from processing failure and document safe retry |
| Root CI runs `npm ci`, regression tests, typechecks, backend build, all-platform exports, and a separate Android native build | Prior results are in [migration evidence](docs/app-sdk-migration.md); no live API or physical-device acceptance claim |

Migration sequence:

1. Implement `api/upload-and-transcribe-node` independently; verify with a disposable audio fixture and explicit project configuration.
2. Add the webhook receiver and focused React Native connect/status sample. Verify their own contracts independently.
3. Implement the end-to-end example with a contained app/backend workspace. Reimplement the workflow using current public packages/contracts; use the existing sample and Bota One for reference.
4. Verify replacement native builds, binding recovery, upload completion/retry, and physical-device behavior for each advertised platform. Document any unsupported profile instead of claiming broad parity.
5. Update catalog and external documentation links. Retire `apps/` and root workspace scripts only after replacement setup works from a clean checkout, existing dependency security coverage has been retained or superseded, and old links have migration guidance.

The initial design change made no source moves, package upgrades, new workflows, device operations, or deployments. The first-example implementation is recorded below. Subsequent expansion and unresolved end-to-end requirements are tracked in [the current review](docs/independent-examples-review.md). Legacy source is unchanged by this expansion.

### First independent example: upload and transcribe

[`api/upload-and-transcribe-node/`](api/upload-and-transcribe-node/README.md) implements create recording -> scoped storage PUT -> SHA-256 completion (exact `425` retry until `200`) -> explicit transcription -> bounded result polling. It uses Node built-ins, owns its lockfile, and has a separate path-filtered CI workflow. It never deletes the local source or automatically retries creation requests. Effective auto-transcription must be disabled for the test end user to avoid a duplicate automatic job.

The example intentionally has no restart journal or automatic recovery after ambiguous requests; its README explains reconciliation using recorded IDs and the generated recording name. It accepts local files up to 25 MiB, a teaching-example memory bound rather than an API service limit. It does not implement device workflows.

| Requirement | Evidence | Review status |
| --- | --- | --- |
| Independent setup | Own manifest/lockfile, no dependencies; frozen install and CLI copied to temporary directory | Matched locally on Node 22.23.2 / Windows |
| Public API contracts | Public OpenAPI source and upload/transcription pages; explicit `api_upload` / `import` recording | Matched for the exercised live path; optional-size completion replay discrepancy documented in example README |
| Credential boundary | Tests assert API bearer is absent from storage PUT and secrets are absent from progress/errors | Matched in local tests |
| Integrity before processing | Exact bytes/hash tests; repeated `425`; HTTP/hash failure prevents transcription | Matched in local tests |
| Bounded failures and source preservation | Deadline, terminal-status, non-retry creation, and source-byte checks | Matched in local tests; live failure recovery unverified |
| Verification and documentation | 15 tests pass, syntax check passes; example README, root catalog, agent entries updated; [CI 36524299811](https://github.com/bota-dev/examples/actions/runs/36524299811) passed for source `fb06b1e` | Matched locally and in the standalone example's hosted CI; existing mobile CI is separate |
| Live acceptance | 2026-09-29 UTC: reserved test key, dedicated end user with auto-processing disabled, 333,326-byte synthetic WAV; matching server SHA-256 and one completed Deepgram job | Matched for live upload, hash-only completion, and transcription retrieval; other providers/formats and live outage recovery unverified |

The compound-engineering review uses the repository architecture and public contracts as its basis. Cross-repo searches for the new path, configuration variables, upload completion, SHA-256, and auto-transcription identified existing contract/reference docs. The live check found that optional numeric completion size conflicts with a stored string size on replay; the example now omits that optional field while retaining server hash verification and size on the upload-URL request. This is within the public schema, not a platform fix. Updates are contained to this repository's example and contributor documentation. No broader production or hardware conformance is inferred from these checks.

## 6. Validation and CI design

New CI jobs should install and check only the affected independent examples; shared CI changes must select all impacted jobs. Use platform-appropriate runners for native builds. Keep the current legacy job until the legacy workspace is retired.

Default PR checks require no live credentials or physical devices. Use meaningful unit/contract checks for request construction, authorization rejection, webhook verification, duplicate handling, or recovery as applicable. Mark mocks as mocks. Live API smoke tests are explicitly configured against disposable resources; hardware tests record device/firmware, OS, SDK version, scenario, date, and outcome. Never run destructive hardware actions or live deployments as incidental PR checks.

Acceptance gates for a new example:

| Gate | Required evidence |
| --- | --- |
| Independent setup | Clean install/run from its own directory, using no private Bota dependencies |
| Public compatibility | Exact published package installs; used methods/endpoints exist in the selected contract |
| Trust boundary | No client API keys; backend auth/ownership and malformed-input rejection exercised where applicable |
| Workflow | Advertised success and relevant retry/failure paths demonstrated |
| Platform claims | Native build and physical-device evidence for each claimed device workflow; missing checks explicitly labeled |
| Documentation | Catalog, example instructions, version/status evidence, and design deviations agree |

## 7. Reference basis and design review

Maintainer reference map (private sibling paths are optional context, never reader prerequisites):

| Source | Lesson / authority |
| --- | --- |
| Public Bota documentation and selected published SDK reference | Runnable example's external interface and compatibility contract |
| `bota-one/amplify/functions/shared/workspace-context.ts` | Derive caller scope from verified identity, not a client workspace selector |
| `bota-one/amplify/functions/shared/encrypted-upload-v2-proxy.ts` | Validate inputs and authorize owned devices/recordings before privileged calls |
| `bota-one/app/lib/sync/deviceUploadHandoff.ts` | BLE fallback requires known inactive device upload ownership |
| `bota-one/app/lib/sync/nativeEncryptedUploadV2Provider.ts` | Recovery and host-side responsibilities may exceed the SDK alone; private native modules are not public SDK features |
| `internal-docs/App SDK Architecture.md` | App SDK/API SDK separation and SDK-local development examples |
| `internal-docs/device/Device-Provisioning.md` | Normative binding, identity, generation, and reset lifecycle |
| `internal-docs/device/Upload-Management.md` | Upload profile, durability, recovery, and confirmation requirements |

Bota One source was inspected at local HEAD `5e2c276`; it is reference evidence, not proof of public release or deployed/hardware conformance. Internal target designs may precede public availability. Preserve that distinction when implementing examples.

Documentation review, 2026-09-28:

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Design one examples repo before implementation | Sections 1-2 and README catalog | Matched for design; example implementation not started |
| Use Bota One as reference without private dependencies | Sections 3 and 7, contributor rules | Matched for design; clean public installs remain implementation gates |
| Provide architecture and both agent entry points plus README | Four root documents with one canonical agent rule set | Matched for documentation |
| Preserve concurrently merged App SDK migration | Baseline reconciled with `36684e0`; README and agent notes retain beta.6, Node floor, and migration evidence | Matched for documentation; no new runtime checks |
| Preserve current source and distinguish legacy gaps | Section 5 and README existing-sample instructions | Matched by source/manifest inspection; native/API/device checks not run |
| Honor current device lifecycle and durability requirements | Section 3, migration and acceptance gates | Matched as target requirements; legacy implementation remains partial |
| Keep affected documentation coherent | Token search across public/internal docs and repo instruction/overview files | Existing paths/packages preserved; external runnable-example claims must be revisited during migration |

The shared `bota-skills:compound-engineering` 1.2.5 workflow was used for this review. All four documents passed local-link and fenced-code checks; documented npm commands were checked against the current manifests. The tracked diff passed `git diff --check`. Dependency installs, builds, live API calls, hosted CI, and physical-device tests were not run for this documentation-only change. No runtime or production conformance is claimed.
## October 7 signing-tool dependency checkpoint

The legacy workspace, RN connection sample and recording-sync app each apply
their own pinned node-forge parser guard during install. This retains independent
example installation and existing public SDK/runtime interfaces; see
[source qualification](docs/node-forge-parser-mitigation.md). Scanner closure,
native binary delivery and hardware acceptance remain separate.

## October 7 scoped braces source guard

The legacy root and both independent React Native apps retain their existing
query-string/Forge hooks and add standalone mandatory guarded `braces` 3.0.3
installation. Locks/public SDKs/device and HTTP code remain unchanged. Root
`npm test` and each independent app test chain require 16 installer/parser/actual
micromatch controls. Source qualification, scanner identity, hosted native builds
and physical installation remain separate. See [review](docs/braces-depth-mitigation.md).
