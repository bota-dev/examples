# Recording sync: local authenticated backend

Learn how to keep project credentials on a server while an Android app transfers
an already-provisioned device recording with the public encrypted-upload-v2 SDK.
This component creates and retains the cloud identity, authorizes narrowly scoped
HTTP operations, and starts transcription only after cloud publication.

**Status (October 2, 2026):** implemented and locally tested with 18 passing
mocked public API tests on Node 22.23.2. Live API, Android native integration, and physical recording
transfer/deletion are separate checks; see the enclosing example's evidence.
This is a local, single-user test backend, not a deployed multi-user service.

## Prerequisites and setup

- Node **22.23.2+**, including built-in `node:sqlite`; no npm dependencies.
- One existing test project, end user, and bound device. The app must verify the
  same physical serial through the SDK. Provisioning, rebinding, reset, recording
  control, WiFi/4G fallback and session-owner replacement are excluded.
- A server-held secret or restricted Bota project key. Restricted keys need the
  public read/write scopes for devices, recordings and transcriptions plus
  `config:read`. It must access the configured project and end user.
- Effective device `processing.auto_transcription.enabled` must be **false**.
  Configure this before the run through the supported platform configuration UI
  or API. The backend verifies the public resolved device processing configuration
  at context lookup, recording/session creation, manifest submission and explicit
  transcription. Keep configuration unchanged during the run; these checks are
  observations, not a lock against concurrent administrators or other clients.
- Encrypted-v2 compatible firmware and the example's exact published SDK.
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
| `BOTA_DEVICE_ID` | One existing bound `dev_*`; no device registration or provisioning is performed. |
| `APP_ACCESS_TOKEN` | Separate random bearer token, at least 32 characters; configured in this server and this local phone app. |
| `PORT` | Loopback listener port; defaults to `8787`. |
| `JOURNAL_PATH` | Durable SQLite path; defaults to `./data/recording-sync.sqlite`. Keep its database/WAL together. |

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
Bodies are strict JSON (32 KiB maximum); unknown fields, query strings and
arbitrary paths are rejected. Cloud recording-list, transcription and native
context/session routes additionally require
`X-Bota-Binding-Generation: <expected integer>`. That value is compared with
current server-owned identity and retained resource scope; it never grants
authority. `GET /api/context` supplies the current generation without this header;
recording creation carries its required generation in the strict request body.

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
  same end user; refresh authorization first.
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
| Current generation before releasing session or cloud result state | Rebind-during-status and stale-caller/new-generation listing/transcription regressions — matched locally. |
| Exact manifest/receipt; cloud commitment separate from deletion | Published conflicting-manifest replay, receipt corruption, pending-state/no-PUT tests — matched locally; SDK/device cryptographic validation and physical deletion unverified here. |
| Explicit processing after publication | Disabled effective config, pending receipt rejection, known/existing job reuse and lost-job tests — matched locally, concurrent administrator/provider behavior outside this example. |
| Public contract only | `/v1` fixed routes; no dashboard/private endpoint, sibling dependency, custom GATT or signing code — source reviewed. |
| Hardware/integration | Not established by backend mocks; enclosing example records native/live/physical gates separately. |

Public contracts: [OpenAPI](https://docs.bota.dev/api-reference/openapi.json),
[create recording](https://docs.bota.dev/api-reference/recordings/create),
[automatic processing](https://docs.bota.dev/guides/auto-processing), and
[SDK integration guides](https://github.com/bota-dev/app-sdk/tree/v2.0.0-beta.10).
