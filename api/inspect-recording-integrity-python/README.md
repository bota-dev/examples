# Inspect recording integrity metadata with Python

Read the backend's reported integrity metadata for one exact existing recording,
without downloading audio or changing upload state. Two exact recording GETs
must agree on identity, owner, source, device link, status and integrity evidence
before the reader emits selected metadata. Device-origin records also have
surrounding bound-device ownership and available-generation checks.

Status on **2026-10-09**: implemented with source review and Python syntax
verification only. Unit, functional, live API and device tests were not run at
the owner's request. Runtime compatibility and failure-path acceptance remain
unverified. No example CLI was executed in this creation pass.

## Prerequisites and configuration

Use Python **3.12 or newer** on Windows, macOS or Linux. Only the standard
library is used; no package installation, Bota SDK, private helper, root
workspace setup or hardware is required. Configure an existing recording owned
by one fixed authorized end user in the key's project. Keep your secret or
restricted project API key on the server, with **`recordings:read`** and, for
device-origin inspection, **`devices:read`**. Device/upload tokens are rejected.

This example supports two explicit modes:

| `BOTA_RECORDING_SOURCE` | Required API response | Device checks |
| --- | --- | --- |
| `api` | `source: api_upload`, `device_id: null` | None; `BOTA_DEVICE_ID` must be empty or unset. |
| `device` | `source: device`, exact configured `device_id` | Bound-device owner checks before/after recording reads; available generation must remain identical, including presence/absence. |

The actual backend source enum is `device`, `app_import`, `api_upload`.
`api` is this example's configuration shorthand for `api_upload`; it is never
sent as a query or interpreted as a backend source enum. `app_import` and
API-origin records with a non-null device link are intentionally unsupported;
the reader fails rather than guessing ownership or switching modes.

`.env.example` documents settings; `main.py` does **not** load `.env` files. Set
them through the process environment or a server secret manager:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS API origin ending in `/v1`, for example `https://api.bota.dev/v1`; no URL credentials, query, fragment, controls or backslashes. |
| `BOTA_API_KEY` | Server-held project secret/restricted key. Never commit, log or ship it in a mobile/browser application. |
| `BOTA_PROJECT_ID` | Exact expected `proj_*` associated with the key; returned optional `project_id` must agree. |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` current owner, required on both recording reads. |
| `BOTA_RECORDING_ID` | Exact existing `rec_*` to inspect. |
| `BOTA_RECORDING_SOURCE` | Required `api` or `device`, using the mapping above. |
| `BOTA_DEVICE_ID` | Exact authorized `dev_*` for `device`; empty/unset for `api`. |

PowerShell, after setting `BOTA_API_KEY` privately:

```powershell
$env:BOTA_API_BASE_URL = 'https://api.bota.dev/v1'
$env:BOTA_PROJECT_ID = 'proj_YOUR_ACTUAL_ID'
$env:BOTA_END_USER_ID = 'eu_YOUR_ACTUAL_ID'
$env:BOTA_RECORDING_ID = 'rec_YOUR_ACTUAL_ID'
$env:BOTA_RECORDING_SOURCE = 'api'
$env:BOTA_DEVICE_ID = ''
python main.py
```

For a device-origin recording, use `BOTA_RECORDING_SOURCE=device` and set the
exact authorized `BOTA_DEVICE_ID`. On macOS/Linux, export the same settings and
run `python3 main.py` from this directory. The key's project association and
intended resource authorization must be known independently. The project setting
cross-checks metadata; it does not select the authenticated project. In a customer
service, authenticate the app caller and derive authorized IDs on your server;
caller-supplied IDs are not authorization.

## Reads, output and interpretation

API mode performs `GET /recordings/{id}` twice. Device mode performs device GET
→ recording GET → recording GET → device GET. Both recording responses require
the fixed ID, exact end user, configured source and expected device link.
Optional `project_id` must match, and optional `deleted_at` must be absent or
null. Device responses additionally require the exact device, end user and
`status: bound`. An available `binding_generation` must be a nonnegative safe
integer and unchanged between device reads; absent generation provides no
generation proof. These separate observations remain non-atomic and do not prove
the recording's historical device binding or authorization.

Recording status must be one of the tracked enum values: `pending`, `streaming`,
`uploaded`, `processing`, `completed`, `failed`, `integrity_failure`. Both
documented integrity fields must be present. `content_sha256` accepts null or
exactly 64 lowercase hexadecimal characters. `content_sha256_verified_at`
accepts null or a valid timezone-bearing ISO timestamp; a non-null timestamp
must retain an associated digest. No missing-field fallback is made. The exact
digest is retained only in memory for before/after comparison and never emitted.

Any difference in selected identity, ownership, source/device relationship,
status, digest or verification timestamp withholds output, even if it reflects
a legitimate asynchronous update. Generation value or presence changes also
withhold output. Investigate or explicitly rerun for a fresh observation; the
example does not poll, retry or repair evidence.

Output contains only `id`, `end_user_id`, `device_id`, `source`, `status`,
`hash_present` and `reported_hash_verification_at`, plus
`evidence: backend_recording_metadata_report` and these false evidence flags:

- `atomic_snapshot` and `historical_owner_verified`.
- `independent_bytes_verified` and `media_validation_verified`.
- `completion_acknowledgment_observed` and `signed_receipt_verified`.
- `device_cleanup_authorized` and `device_cleanup_verified`.

The flags describe what this reader establishes; they do not negate work the
backend may have performed. Names, arbitrary metadata, URLs, hash material,
audio/content, file lengths, provider data, raw responses and credentials are
excluded. The normal recording GET can return a signed audio URL; the reader
discards it and never follows it. Protect stdout as private operational metadata
and remove any redirected `integrity-observation.json` when finished.

| Reported evidence | Meaning and limit |
| --- | --- |
| `hash_present: true` | A syntactically valid digest is reported; presence alone does not establish a successful match, usable media or independently verified bytes. |
| Non-null `reported_hash_verification_at` | The backend reports successful hash verification associated with this digest; the reader neither downloads the object nor validates that worker's result independently. |
| Null verification timestamp | This GET supplies no successful verification timestamp; null does not itself mean failure. |
| `uploaded`, `processing` or `completed` | Cloud resource state, not a retained exact completion response or signed encrypted-v2 receipt and not permission to delete a device source. |
| `integrity_failure` | The backend reports that state; the reader performs no re-upload, digest substitution or cleanup. |

Cloud commitment and device cleanup are separate durable phases. A successful
PUT, declared hash, processing result or Recording status cannot replace the
exact required completion acknowledgment. Encrypted-v2 requires its own
session/receipt protocol; this reader does not retrieve or verify its signed
receipt and cannot authorize physical cleanup. Retain the original source until
the authorized uploader has durably accepted the required exact evidence.

## Bounds and failure handling

Each GET is limited to **1 MiB**, at most **10 seconds**, and a shared
**45-second overall budget**. A timer interrupts the connected transport at its
deadline, including slowly arriving headers/bodies. Operating-system DNS
resolution can exceed the socket timeout before connection; the deadline is
rechecked after connection and before output. Final selected JSON is also capped
at 1 MiB. These are example limits, not API service limits.

Only HTTP 200 JSON with identity/no content encoding is accepted. Redirects,
automatic retries and compressed responses are rejected. Duplicate JSON keys,
non-finite numeric values, invalid UTF-8 and unpaired Unicode surrogates are
rejected. Unexpected shapes or identities fail before output.

Exit **0** means the selected report passed these checks; it can legitimately
report `pending`, a null timestamp or `integrity_failure`. It does not mean the
recording is complete or safe to discard. Exit **1** prints a fixed safe error
and no report for configuration, access, shape, identity, changing evidence,
byte/time or transport failure. No API polling, content download, completion
POST, device operation or remote cleanup occurs. Resolve access/configuration
or investigate the error before explicitly rerunning.

## Source boundaries and verification

Public contracts: [Get recording](https://docs.bota.dev/api-reference/recordings/get),
[Complete upload](https://docs.bota.dev/api-reference/uploads/complete),
[Get device](https://docs.bota.dev/api-reference/devices/get) and
[Authentication](https://docs.bota.dev/authentication).

Source review used backend `1ac67c92c6d72858e29dc264037cb82b6c449825`: recording
model/source/status enums, recording route/controller, completion service,
integrity worker/repository and encrypted-v2 publication metadata. That baseline
hash worker skips records without a declared hash. The current public docs label
the plaintext-device OGG/hashless correction pending; authoritative Upload
Management §1.1 records October 9 source delivery separately from deployment
and physical evidence. This reviewed baseline predates that correction.
Neither source delivery nor this metadata report proves what a deployed server
does. Earlier verification timestamps are not evidence that newer media
validation ran; historical exceptions and other transport/storage profiles
remain distinct. The reader emits no media-validation proof.

The creation pass's only executable example verification is:

```powershell
python -m py_compile main.py
```

CI runs the same syntax check on Ubuntu 24.04 with a pinned checkout action,
read-only repository permissions and disabled persisted credentials. It uses
this example's main/path PR filters and needs no API key or hardware. Syntax
success establishes parsing only.

| Evidence, 2026-10-09 | Result / remaining acceptance |
| --- | --- |
| Local Python `py_compile` | Passed with bundled Python 3.12; no example execution. |
| Public contract / tracked source / authoritative design comparison | Reviewed source/status/integrity fields and separate commitment/cleanup phases; deployed behavior unverified. |
| Static workflow review | Full action SHA, read-only permissions, standalone working directory, triggers and syntax-only commands checked. |
| Unit / functional / live API / device tests | Not run, as requested. |
| Hosted syntax workflow | Added; hosted result not yet recorded. |

Post-implementation review follows `bota-skills:compound-engineering` 1.2.9:

| Requirement | Implementation evidence | Conformance / remaining verification |
| --- | --- | --- |
| Independent read-only example | Own source/config/README/workflow, standard-library imports, GET-only transport. | Matched by source; standalone runtime unverified. |
| Exact server-derived owner/source relationships | `configuration`, `select_recording`, surrounding `check_device`, before/after comparison. | Matched by source; authorization and changing-evidence failure paths unverified. |
| Nullable integrity metadata without disclosure | `select_recording`, `timestamp` and explicit output projection; digest stays private. | Matched by source; live field compatibility unverified. |
| Bounded failures and no hidden retries | `read_json`, strict JSON, request/body limits and final monotonic deadline. | Matched by source; runtime failure paths unverified. |
| Commitment separate from physical cleanup | False proof flags and interpretation table; no completion, receipt or device operation. | Matched by source/documentation; no independent bytes, media, receipt or physical acceptance claimed. |
| Current baseline versus pending/deployed correction | Source boundary above explicitly distinguishes baseline, source delivery and runtime evidence. | Partial: current deployed integrity behavior remains unverified. |

The private source/design references are maintainer review evidence, not
installation/runtime prerequisites for users of this public example.
