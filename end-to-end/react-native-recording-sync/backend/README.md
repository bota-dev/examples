# Mobile recordings: local authenticated backend

Keep the Bota project key on a server while React Native and Flutter sample apps
browse recordings, read transcripts, generate general notes and Ask about one
recording. The separate Android encrypted-v2 routes retain the existing
device-sync workflow. Both use a fixed server-owned project/end user and a
separate application bearer token.

The cloud integration is in [library.mjs](library.mjs) and small local
[recordings](library/recordings.mjs), [processing](library/processing.mjs) and
[Ask](library/ask.mjs) modules. Native capture, binding and upload receipt logic
remains in [service.mjs](service.mjs). There are no runtime imports from another
example or private Bota package.

**October 12, 2026:** 63 local tests pass on Node 22.23.2: 41 cloud-library,
composition and real-loopback HTTP regressions plus the unchanged 22 native
service tests. HTTP tests use mocked public API responses. Live providers,
hosted CI, mobile integration and physical upload remain separate evidence.

**Historical native status (October 2, 2026):** implemented and locally tested with 22 passing
mocked public API tests on Node 22.23.2. Live API, Android native integration, and physical recording
transfer/deletion are separate checks; see the enclosing example's evidence.
This is a local, single-user test backend, not a deployed multi-user service.

## Prerequisites and setup

- Node **22.23.2+**, including built-in `node:sqlite`; no npm dependencies.
- One existing test project and end user with synthetic or consented cloud
  recordings. A physical device is optional for library use. Set
  `BOTA_DEVICE_ID` only to enable the existing Android sync path; that path
  additionally requires an already-bound, provisioned device and SDK-read
  identity verification. This server performs no provisioning, reset, recording
  control or WiFi/4G fallback.
- A server-held secret or restricted Bota project key. Restricted keys need the
  `recordings:read`, `transcriptions:read`, `transcriptions:write`,
  `summaries:read` and `summaries:write` for library use. Ask uses the authorized
  project key; do not invent an `ask:read` scope. Native sync also needs the
  documented device/recording write permissions and `config:read`.
- Keep automatic processing and other job writers unchanged during an explicit
  processing run. Library actions reuse existing source-linked jobs and do not
  replace them, but separate API reads/writes cannot lock external writers or
  configuration changes. The library does not set automatic-processing policy.
- For native sync, effective device `processing.auto_transcription.enabled` must be **false**.
  Configure this before the run through the supported platform configuration UI
  or API. The backend verifies the public resolved device processing configuration
  at context lookup, recording/session creation, manifest submission and explicit
  transcription. Keep configuration unchanged during the run; these checks are
  observations, not a lock against concurrent administrators or other clients.
- Native sync needs encrypted-v2 compatible firmware and the example's exact published SDK.
  This backend cannot establish physical upload ownership: the app/SDK must not
  start BLE transfer while direct-upload ownership is active or unknown.
- Synthetic or consented audio. Upload/transcription creates billable cloud data.

```sh
cd end-to-end/react-native-recording-sync/backend
npm ci
```

Copy `.env.example` to `.env` and replace every placeholder. Generate a distinct
application token, for example with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Do not use a Bota API key as that token.

| Variable | Owner and purpose |
| --- | --- |
| `BOTA_API_BASE_URL` | Server; intended public API base ending `/v1`. HTTPS is required except loopback tests. The template points at production. |
| `BOTA_API_KEY` | Server only; never entered in the phone app or sent to storage. |
| `BOTA_PROJECT_ID` | Fixed expected project. Every fetched device/recording must match. |
| `BOTA_END_USER_ID` | Fixed test user; never accepted from request bodies or headers. |
| `BOTA_DEVICE_ID` | Optional; blank enables cloud-library-only startup. A configured value must be a valid, existing bound `dev_*` for native sync. No device registration/provisioning. |
| `APP_ACCESS_TOKEN` | Separate random bearer token, at least 32 characters; configured in this server and this local phone app. |
| `PORT` | Loopback listener port; defaults to `8787`. |
| `JOURNAL_PATH` | Durable SQLite path; defaults to `./data/recording-sync.sqlite`. Keep its database/WAL together. |
| `LIBRARY_JOURNAL_PATH` | Separate durable library intent database; defaults to `JOURNAL_PATH` plus `.library.sqlite`. Must never be the native capture database. |

```sh
npm start
adb reverse tcp:8787 tcp:8787
```

Configure the phone app with `http://127.0.0.1:8787` and `APP_ACCESS_TOKEN`.
The server binds **only 127.0.0.1** and rejects browser Origin requests; it has no
CORS or general proxy route. Keep the host and USB device trusted. A production
service needs user authentication, per-user authorization, HTTPS, managed secret
storage and operational controls beyond this example.

## HTTP contract

Every request requires `Authorization: Bearer <APP_ACCESS_TOKEN>`.
Bodies are strict JSON (32 KiB maximum); unknown fields and arbitrary paths are
rejected. Only `GET /api/library/recordings` accepts one URL-encoded opaque
`cursor` query. Library routes authorize current project/end-user ownership and
do not require a device or binding header. GET requests accept no body;
processing POSTs accept an empty JSON object and Ask accepts one `question`.

The original capture-list, transcription and native context/session routes require
`X-Bota-Binding-Generation: <expected integer>`. That value is compared with
current server-owned identity and retained resource scope; it never grants
authority. `GET /api/context` supplies the current generation without this header;
recording creation carries its required generation in the strict request body.
With no configured device, these original routes return
`409 device_not_configured` before any native upstream call.

### Cloud library

| Local endpoint | Response/action and public API recipe |
| --- | --- |
| `GET /api/library/recordings?cursor=...` | `{data,has_more,next_cursor}`; fixed-owner `GET /v1/recordings`, then exact owned recording reads. One page of at most 20. |
| `GET /api/library/recordings/:id` | `{id,name,status,created_at,duration_seconds,upload_verified}` from owned `GET /v1/recordings/:id`. No storage URL/path. |
| `GET /api/library/recordings/:id/transcriptions` | `{data:[{id,recording_id,status,created_at,full_text?}]}`; `GET /v1/transcriptions?recording_id=...`, exact job and recording checks. Text only after completion. |
| `POST /api/library/recordings/:id/transcriptions` | `{operation,transcription?}`; reuse a known job or persist intent before one `POST /v1/transcriptions`. New jobs require server upload-integrity evidence. |
| `GET /api/library/transcriptions/:id/summaries` | `{data:[{id,transcription_id,recording_id,template_id,status,created_at,output?}]}`; source-filtered summaries and exact source-chain reads. Only `tmpl_general_notes`; output only after completion. |
| `POST /api/library/transcriptions/:id/summaries` | `{operation,summary?}`; reuse general notes or persist intent before one `POST /v1/summaries` for the completed transcription. |
| `POST /api/library/recordings/:id/ask` | `{question}` → `{operation,answer?,citations?}`. Public recording-scoped session creation, one message, then owner-filtered membership/exact-history GETs. Each distinct canonical question is a separate single-question session. |
| `GET /api/library/operations` | `{data:[operation]}`; newest 50 retained action metadata rows. No questions, answers, transcript or raw journal details. |
| `GET /api/library/operations/:id` | GET-only reconciliation: known transcription/summary/Ask content after current ownership checks; unknown resource stays uncertain. Never resends a write. |

An operation is `{id,kind,state,resource_id,updated_at}`. Its identifier is a
local UUID. `resource_id` can be null when a create response was lost. Complete
general-note output is `{overview,key_points,action_items,decisions,participants}`;
all entries are bounded strings. Ask citations are `{recording_id,start_ms}` and
must reference the selected recording. Render all returned content as text.

Ordinary upstream requests have a 25-second deadline and 2 MiB response limit;
Ask calls allow 180 seconds. No redirects or automatic retries. A client may time
out earlier while the server is still processing; retain the action and refresh
through GET. A failed action may include its narrow `operation` alongside
`{error:{code,message}}`; authorization/missing-resource errors omit it. Raw
upstream content, credentials and journal details never appear in error bodies.

The library is a cloud-content interface. It issues no upload session, device
receipt, source confirmation or deletion authority. Cloud access stays available
without a current Bluetooth connection. The frontends' credential-free demo is
local synthetic data; this live backend has no synthetic upload/receipt mode.

### Existing Android encrypted-v2 routes

| Local endpoint | Contract |
| --- | --- |
| `GET /api/context` | `{deviceId,serialNumber,bindingGeneration,endUserId,projectId}` after current ownership and processing checks. |
| `POST /api/recordings` | Body: `device_id`, `binding_generation`, `recording_uuid`, `recording_generation`, numeric `ciphertext_length`, lowercase `ciphertext_sha256`; optional `started_at_ms`/`duration_ms` are accepted metadata only. Returns `{id,recording_id}`. Generation starts at 1. The backend injects end-user ID, `source:device`, `upload_method:ble`, and `encryption_version:2`. |
| `GET /api/recordings` | `{recordings:[{id,status}]}` from at most 100 newest current-generation journal entries, after current resource checks. Status is `not_started`, `session_create_uncertain` or the exact v2 state. Enables cloud-result access after app restart/device cleanup. |
| `POST /api/recordings/:id/encrypted-upload-v2/sessions` | Exact public create-session fields; only `channel:ble` and `storage_format:bota_enc_v2`. Capture metadata must equal the journal. Returns public session fields. Replaying a known request reads that same session; staging URL is renewed only in `created`/`staging`. |
| `GET /api/recordings/:id/encrypted-upload-v2/sessions/:session` | Exact session status; current scope, identity, revision and content hash/size must match. Published authorization/receipt lengths and SHA-256 are checked before release. The SDK/device still owns signature and protocol validation. |
| `POST .../:session/staging-url` | `{owner_revision}`; only `created`/`staging` may obtain a target. The native adapter separately journals PUT uncertainty; a URL alone is not permission to repeat an uncertain upload. |
| `POST .../:session/manifest` | `{owner_revision,manifest_base64,manifest_sha256}`; exact 580-byte document and digest, then public API validation, including replay after publication. |
| `DELETE .../:session` | `{owner_revision}`; cancellation of the known session through its public API. No device file deletion. |
| `POST .../:session/recover` | Always stops with `recovery_requires_reconciliation`; this bounded example does not replace expired or nonce-changed owners. |
| `POST /api/devices/:id/encrypted-upload-v2/contexts` | Public `{nonce_base64}`; remembers nonce hash/context ID before returning. |
| `POST .../contexts/:context/proof` / `GET .../contexts/:context` | Public proof/status, limited to remembered contexts at the current binding generation. |
| `POST /api/recordings/:id/transcription` | Empty body; verifies same-session published receipt and disabled automatic transcription, then returns/reuses `{id,recordingId,status,text?}`. An existing single job is reused; multiple jobs stop for inspection. |
| `GET /api/transcriptions/:id` | Same normalized response, only for this journal's known transcription and current recording/device scope. Completed text comes from public `full_text`. |

Success is HTTP 200 (or 204 for an empty cancellation response); public manifest
pending state remains nonterminal even though this local wrapper returns 200.
Errors are `{error:{code,message}}`; upstream raw messages, bodies, tokens,
signed URLs and transcript contents are not logged. A 502 on a write means the
remote outcome may be unknown. The native adapter must inspect the code/state,
not treat transport success as cloud commitment or deletion permission.

## Durability and failure behavior

SQLite uses WAL and `synchronous=FULL`. Before cloud creation, it records fixed
environment/project/user/device scope and immutable capture UUID/generation,
binding generation, ciphertext length/digest. Cloud recording/session IDs and
owner revision are committed before returning them to the app. No audio,
authorization, receipt, storage URL, API key or app token is stored in the journal.
Retain the journal: deleting it discards unknown-outcome evidence and is **not**
a recovery procedure. Never switch its fixed scope to another account/project.

The native capture journal pins the configured device, including the absence of
a device. Adding a device to cloud-only configuration or changing it refuses the
original capture journal. Preserve that database and choose the appropriate
separate device journal deliberately; do not erase retained upload evidence.

The separate library journal uses SQLite `synchronous=FULL` and DELETE journal
mode. It pins a hash of API base URL, project, end user and API key. Rotating the
key or changing identity refuses the original database; reconcile outstanding
actions before deliberately choosing a different library journal. It stores
only action kind/source IDs, immutable known resource IDs, state, timestamp and
question hash. Questions, result content and secrets are not stored. Private
file modes are checked on POSIX; Windows requires a trusted private directory
with appropriate user-managed ACLs. This is not a hostile-filesystem/ACL audit.

Native and library transcription entry points share one process's recording
lock and inspect each other's retained intent. A native unknown create blocks
library creation; a library unknown create blocks native replacement. Known
identities can be reused only through matching GET observations. These guards
cover this server process, not multiple instances or other API clients. The
common app should use the library processing actions after device sync.

- Recording creation uses the documented public device UUID/generation replay
  contract. A lost response can repeat that exact request; no identity-free
  retry is allowed. Changed content for the same capture is rejected.
- Session/context/transcription creation records an intent **before** the HTTP
  write. A lost response or process crash before the returned ID is persisted
  parks the operation. No fresh session or job is created automatically. The
  public secret-key session reconciliation endpoint is unavailable; this is an
  explicit recovery limitation, not a claimed complete restart recovery flow.
- Known sessions survive restart and are read by exact ID/revision. Pending,
  failed, expired or cancelled states never trigger a new PUT or owner. A known
  published session remains available for the SDK's receipt/cleanup retry; the
  backend never claims that cloud publication proves physical source deletion.
- Binding/ownership changes stop old work. Restoring a radio link does not
  override the generation check. Older-generation journal rows are retained but
  excluded from the cloud-results list. An app using an older generation cannot
  list or process a newer generation's recordings, even after a rebind to the
  same end user; refresh authorization first. The backend rechecks current
  binding after reading a recording, after processing-config lookup before
  recording/session creation, and after existing-job lookup before transcription
  creation. These checks reject changes observed during those reads before
  returning identity or sending the next write. They narrow the application
  race window; separate public API reads and writes are not an atomic binding
  fence. A rebind after the last read may still overlap a write, whose response
  is checked again. Keep binding unchanged during a test run.
- Transcription is an explicit later action. A durable known job is reused;
  a lost job-create response remains parked for inspection. No exactly-once
  claim applies to other applications or concurrently changed auto-processing.
- For parked operations, inspect the same project/device/recording/session in
  the platform and retain the database/native journal. No automatic repair or
  journal-reset endpoint is provided.

Stop the server with Ctrl+C; remove the USB forwarding with
`adb reverse --remove tcp:8787`. The example deletes no cloud resources. Review
and remove only the synthetic test recordings/transcriptions you intentionally
created, using your normal project administration tools after testing.

## Verification and design review

```sh
npm ci
npm run check
npm test
```

| Requirement | Evidence/status |
| --- | --- |
| Fixed authenticated scope; no project key in phone | HTTP anonymous/wrong-token/Origin rejection; strict body and scope tests — matched locally. |
| Stable identity before write; no duplicate create after uncertainty | SQLite restart, lost recording/session/transcription response and concurrent-call tests — matched for documented paths; lost session/context/job create is intentionally parked. |
| Current generation before releasing session or cloud result state | Rebind-during-status/recording-read and stale-caller/new-generation listing/transcription regressions — matched locally. |
| Recheck current ownership before recording/session/transcription writes | Rebind during config or existing-job lookup sends no POST and creates no new intent — matched in regression tests; atomic API-enforced generation fencing remains outside this example. |
| Exact manifest/receipt; cloud commitment separate from deletion | Published conflicting-manifest replay, receipt corruption, pending-state/no-PUT tests — matched locally; SDK/device cryptographic validation and physical deletion unverified here. |
| Explicit processing after publication | Disabled effective config, pending receipt rejection, known/existing job reuse and lost-job tests — matched locally, concurrent administrator/provider behavior outside this example. |
| Public contract only | `/v1` fixed routes; no dashboard/private endpoint, sibling dependency, custom GATT or signing code — source reviewed. |
| Device-independent common library | No-device config/direct-route/real HTTP tests serve owned cloud content and reject native paths before upstream access — matched locally. |
| Owner/source checks before returning content | List exact reads, project/end-user rejection, changed-source transcript/summary checks and Ask membership/citation tests — matched locally; separate reads are non-atomic. |
| Durable library writes and narrow error recovery | Transcription/summary/Ask restart and uncertainty tests retain intent; known-ID real HTTP errors include only narrow operation metadata; 403/404 omit it — matched locally. |
| Original journals and identities remain protected | Optional/invalid device, later-device scope refusal, key/base/project/owner rotation and native-database rejection tests — matched locally; Windows ACL qualification unverified. |
| Native/library processing paths cannot replace each other's uncertain write | Shared-lock concurrency and both-direction uncertainty tests issue at most one POST; missing known native ID refuses replacement — matched for one process; multiple instances/external writers unverified. |
| Hardware/integration | Not established by backend mocks; enclosing example records native/live/physical gates separately. |

Public contracts: [OpenAPI](https://docs.bota.dev/api-reference/openapi.json),
[create recording](https://docs.bota.dev/api-reference/recordings/create),
[automatic processing](https://docs.bota.dev/guides/auto-processing), and
[SDK integration guides](https://github.com/bota-dev/app-sdk/tree/v2.0.0-beta.13).
