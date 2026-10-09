# Watch an existing encrypted upload (Node.js)

Observe one known encrypted-v2 upload session and report its backend lifecycle,
checking the exact recording and bound device's current owner around every
session read. This example creates no session, renews no staging URL, submits
no manifest, follows no successor and performs no cancellation or device cleanup.

**Status:** implemented with source review and syntax checks on October 9,
2026. Runtime, live API authorization/failure handling, receipt verification
and physical-device behavior remain unverified. This creation pass executes no
example CLI, functional tests, API calls or device operations. Requires Node.js
**22.23.2 or newer**, built-ins only, and its own manifest/lockfile; no SDK,
private package or sibling repository is needed at installation or runtime.

## Configure and run

Use a server-held project secret key, or a restricted key with
**`recordings:write`, `recordings:read` and `devices:read`**. The reviewed
encrypted-session actor authorizer requires `recordings:write` even for this
GET. The latter two scopes permit the surrounding recording/device reads.
This unusual authorization requirement does not turn observation into a write;
the script issues GET only. Prefer a dedicated restricted operator credential
and never put it in a mobile/browser app.

An authorized project operator must independently establish the saved
recording/session/revision's intended end user and historical binding generation.
Current ownership checks cannot establish that historical authorization. In a
customer service, derive the allowed IDs from verified caller identity and a
trusted audit record; IDs supplied by a client are not authorization.

From this directory:

```sh
npm ci
cp .env.example .env
# Replace every placeholder in the private .env file with authorized values.
npm run check
npm start
```

PowerShell uses `Copy-Item .env.example .env`. `npm start` loads an optional
`.env` through Node; injected environment values take precedence. Protect that
file with private host permissions or use your service's secret management.
`npm run check` parses source only and needs no credentials or network access.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Trusted HTTPS API origin ending in `/v1`, default `https://api.bota.dev/v1`; no user information, query, fragment, whitespace, controls or backslashes |
| `BOTA_API_KEY` | Server-held project secret/restricted key with the scopes above; device/upload tokens rejected |
| `BOTA_PROJECT_ID` | Expected `proj_*` project independently matched to the authenticated key by the operator |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` current owner |
| `BOTA_DEVICE_ID` | Exact `dev_*` cloud identity, not an advertised name or physical serial number |
| `BOTA_RECORDING_ID` | One existing `rec_*` device recording belonging to the fixed owner/device |
| `BOTA_UPLOAD_SESSION_ID` | Exact saved lowercase UUID of one existing encrypted-v2 session |
| `BOTA_UPLOAD_OWNER_REVISION` | Known saved decimal revision, `1`–`4294967295`; never discovered by accepting whatever the server returns |

No hardware or firmware is needed to run this backend observer. The existing
session must already have been created by an independently authorized workflow.
This example does not demonstrate any firmware, SDK or transport compatibility.

## Owner and identity checks

Every observation follows recording GET → device GET → exact session GET →
device GET → recording GET. Recording reads must match the configured recording,
device and end user, with `source: "device"`. Device reads must match the fixed
device/end user and remain `bound`. Available `project_id` fields must match
the configured project; available `deleted_at` must be exactly `null`.
An available device `binding_generation` must be a nonnegative safe integer and
remain identical across the entire operation, including its presence/absence.
An absent generation throughout supplies no generation proof.

Session reads must match the exact saved UUID, `encrypted_upload_v2` profile
and positive owner revision. Unknown/missing state, channel or policy fails
closed. Channel and policy snapshots must not change between observations.
Available session project/recording/device/end-user/deletion fields must also
agree. The public status normally omits those scope fields: backend authorization
and its project/session/recording lookup provide that association, rather than
the session UUID alone. The script makes no private API calls.

These are separate reads, not an atomic snapshot. Available current generation
does not prove the session's historical generation: the public status omits it.
Neither backend actor authorization nor the surrounding reads replace the
operator's independent authority for this saved session.

## Output, bounds and recovery

The only emitted session fields are profile, UUID, revision, state, channel,
policy and available canonical UTC millisecond `expires_at`/`published_at`
timestamps. Dates are metadata; the script never infers expiration or success
from a timestamp. Required missing fields fail; there is no legacy fallback.
The policy is the session's saved policy snapshot, not a fresh device policy
resolution or evidence that firmware applied it.

| Backend state | Observer behavior |
| --- | --- |
| `created`, `staging`, `staged`, `ready`, `processing` | Continue observing the same session; never restage, recover or repeat a manifest |
| `published` | Exit 0 with a backend publication report only |
| `failed`, `cancelled`, `expired` | Exit 2 with the reported terminal state; no automatic replacement |

There are at most **30** complete observations, five GETs each, separated by
two seconds. All share one **90-second** monotonic deadline and abort timer;
each request/header/body read has at most **10 seconds**. Each response is at
most **1 MiB**, fatal UTF-8, JSON with finite numbers. Only HTTP 200 JSON with
identity/no content encoding is accepted; no redirects or automatic retries.
Parsing uses Node's JSON semantics, including last-value handling for duplicate
object keys. These asynchronous budgets do not guarantee scheduling during OS
process suspension or an event-loop stall.

Output appears once after a complete owner-surrounded terminal observation or
at the observation/deadline bound. A deadline while a later observation is
incomplete emits only the last fully checked observation and its saved
`observed_at`; with none completed, `data`/`observed_at` are `null` and
`observations` is zero. The report names `stopped_by` and
`evidence: "backend_encrypted_upload_session_report"`, with these flags false:

- `historical_owner_verified` and `atomic_snapshot`.
- `independent_integrity_verified` and `signed_receipt_verified`.
- `device_cleanup_authorized` and `device_cleanup_verified`.

The API response includes sensitive signed authorization and, when published,
a receipt. They are read into memory but never printed, persisted, parsed for
cryptographic authority or relayed. Plaintext/ciphertext hashes and lengths,
raw error/terminal-reason payloads, content, audio URLs, API keys and device
serials are also excluded. Protect stdout as operational metadata. A backend
`published` report is not independent integrity verification. Physical cleanup
still requires the exact-session signed receipt verified by the device/SDK;
this watcher cannot supply that authority.

Exit **2** also means the cap/deadline ended without observed publication.
Exit **1** means configuration, HTTP, transport, shape, ownership, binding or
identity validation failed; those failures withhold stdout and print sanitized
stderr only. A timeout/cap does not cancel or expire the session. Reconcile the
same saved identity through your authorized integration; do not erase evidence,
switch sessions or issue a replacement to force success. No cloud/local source
or device recording is modified. Optional redirected `upload-observation.json`
is ignored; retain/remove that metadata under your own policy.

## Contracts and verification

Public references: [encrypted-v2 session status and lifecycle](https://docs.bota.dev/api-reference/uploads/encrypted-v2#get-session-status),
[get recording](https://docs.bota.dev/api-reference/recordings/get),
[get device](https://docs.bota.dev/api-reference/devices/get), and
[API authentication](https://docs.bota.dev/authentication).

Read-only source review at backend
`1ac67c92c6d72858e29dc264037cb82b6c449825` used
`api/src/routes/v1/recordings/{index,encrypted-upload-v2-controller}.ts`,
`api/src/middleware/encrypted-upload-v2-actor.ts`,
`api/src/services/encrypted-upload-v2-lifecycle.service.ts` and
`api/src/models/encrypted-upload.ts`. Exact status GET authorizes existing
project/recording/session scope and reads the retained session/artifact; it
does not mark delivery, expire rows, submit work or mutate state. Published
status requires retained receipt/publication fields in this source, but this
observer does not independently validate them. Source review is not evidence
that a deployed API runs this revision. Readers do not need that private source.

| Requirement | October 9, 2026 evidence / status |
| --- | --- |
| Independent built-in installation | Own manifest/lock, no dependencies; `npm ci` passed on Node 22.23.2 / Windows |
| Syntax | `npm run check` passed; source parsing only |
| Exact saved identity and owner fencing | Source review: recording/device gates around each exact session read, expected revision and stable available generation; runtime unverified |
| Honest publication and cleanup boundaries | Source review: selected projection, no receipt/authorization output and false integrity/receipt/cleanup evidence flags; cryptographic/device acceptance unverified |
| Bounded read-only failure behavior | Source review: deadline/cap, finite JSON/body bounds, no redirects/retries or writes; failure-path runtime unverified |
| Restricted-key GET scope | Source actor authorizer requires `recordings:write`; recording/device gates require their read scopes; live authorization unverified |
| Hosted workflow | [Frozen-install/syntax run](https://github.com/bota-dev/examples/actions/runs/37995712315) passed at `95c24d9bb596653913f8b5a28a884a662bc63e15`; source parsing only |
| Functional, live API and physical-device checks | Not run under the owner's creation-only instruction |
