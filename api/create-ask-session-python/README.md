# Create an empty Ask session with Python

Create one empty recording-scoped Ask session for a fixed server-configured end
user, retaining a durable SQLite intent before the single POST. The request
contains only `scope: {type: "recording", recording_id}`. It omits
`initial_message`, title, model and provider. The backend uses its default
`"New chat"` title. This example sends no messages, reads no conversation history,
prints no titles or content, and starts no transcription or model work.

Status on **2026-10-08**: implemented with source review and Python syntax
verification only. Unit, functional, live API and device tests were not run at
the owner's request. Runtime durability, concurrency and recovery acceptance
remain unverified.

## Prerequisites and configuration

Use Python **3.12 or newer** and its standard library. There is no package
installation, SDK dependency or root workspace setup. Use a server-held project
API key authorized for public Ask creation/get/list and for `recordings:read`
and `end_users:read`. The configured recording must exist in that exact project
and have the configured end user as its owner. Empty creation does not require
completed upload, transcription or an answer-ready recording in the tracked
backend; later message sending has separate requirements. No hardware is needed.

`.env.example` documents configuration; `main.py` does **not** load `.env` files.
Supply actual values through your server environment or secret manager:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS base, such as `https://api.bota.dev/v1`; no credentials, query or fragment. |
| `BOTA_API_KEY` | Server-held secret/restricted project key. Never expose it in an app, browser, logs or committed files. |
| `BOTA_PROJECT_ID` | Exact expected `proj_*` project for that trusted key. Returned project metadata, when present, must match. |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` identity. |
| `BOTA_RECORDING_ID` | Fixed owned `rec_*` identity. |
| `BOTA_JOURNAL_PATH` | Private SQLite file; default `.state/ask.sqlite`. Its parent must already exist and be private. |
| `BOTA_MAX_PAGES` | Membership page cap, default 5, range 1–20; 25 sessions per page. |

Obtain the base, key, project, end user and recording from trusted server
configuration. The project value cross-checks optional response metadata; it
does not select or prove the key's project association. Do not accept these
values, a journal path or a pagination cursor from an app request.

Before the first run, create a local journal parent with POSIX mode **0700** or
a Windows ACL restricted to the executing user. On macOS/Linux, `mkdir -m 700
.state` creates the default parent. On Windows, create `.state` and configure
its user-only ACL through your organization's normal filesystem controls.
Python's POSIX mode bits do not enforce Windows ACL privacy; the script does
not inspect or change Windows ACLs. Keep the parent and all its ancestors
trusted and protect the SQLite database and sidecars. Use a local filesystem
that supports SQLite locking and durable commits, rather than a network share.

PowerShell, after setting `BOTA_API_KEY` privately and preparing the parent:

```powershell
$env:BOTA_API_BASE_URL = 'https://api.bota.dev/v1'
$env:BOTA_PROJECT_ID = 'proj_YOUR_ACTUAL_ID'
$env:BOTA_END_USER_ID = 'eu_YOUR_ACTUAL_ID'
$env:BOTA_RECORDING_ID = 'rec_YOUR_ACTUAL_ID'
$env:BOTA_JOURNAL_PATH = '.state/ask.sqlite'
$env:BOTA_MAX_PAGES = '5'
python main.py
```

On macOS/Linux, export the same variables and use `python3 main.py`.

## One durable create and GET reconciliation

One journal represents one operation. The program exclusively creates a new
0600 database file, commits one `creating` row in a SQLite `BEGIN IMMEDIATE`
transaction with `synchronous=FULL`, and persists the parent directory entry
on POSIX before any network request. Only the invocation that created and
committed that fresh journal can send POST. Concurrent invocations never earn
another creation claim. An existing empty, malformed, incompatible or corrupted
journal stops; it is not repaired or treated as a fresh operation.

The intent retains a SHA-256 fingerprint of normalized API base, project,
end user and recording, plus phase and the exact returned session ID when
available. It stores no key, title, messages, audio or signed URLs. Existing
schema/version, singleton row, fingerprint, phase and ID are validated on each
run; changes or corruption stop for operator reconciliation. A rotated key may
be used only if it still belongs to the same trusted project and has the needed
permissions. File ownership/privacy checks reject unsafe POSIX files and
symlinks; Windows ACL enforcement remains the operator's prerequisite.

After committing intent, the fresh invocation checks `GET /end-users/{id}` and
`GET /recordings/{id}`, requiring exact IDs and the recording's exact
`end_user_id`. Both reject a non-null `deleted_at` and conflicting optional
project/owner metadata. It then sends exactly one `POST /ask/sessions`, expecting
**201** and a bare session object. A valid returned `as_*` ID is committed before
validating the other fields, so a subsequent mismatch still retains that known
ID for investigation. The session must be empty and have immutable serialized
scope `{type: "recording", recording_ids: [configured_recording]}`.

Known IDs are reconciled with GET only. The program reads the exact session,
observes that same ID in bounded list pages, rereads it, then rechecks the end
user and recording before printing. Every list page carries all three filters:
`end_user_id`, `scope_type=recording` and `recording_id`, including when following
an opaque `next_cursor`. Returned rows must retain that exact scope; optional
owner/project fields cannot contradict configuration. The public session
contract omits owner/project fields, so exact GET alone is insufficient for
owner membership. Listing remains required even when the backend returns an
explicit owner. No other listed ID is adopted as the created result.

Exit **0** prints only the saved `session_id`, configured `recording_id` and
`end_user_id`, observed `message_count: 0` and `atomic_snapshot: false`. It means
the checks passed during this run, not that the session will remain empty or
owned afterward. Titles, cached recording titles, messages, prompts, model and
provider fields, recording metadata, end-user profiles, cursor values and
arbitrary upstream errors are excluded.

Exit **1** prints a controlled error and no result IDs. Preserve the journal.
Known-ID failures, including membership not found within the page cap, permit
an explicit rerun after investigating access or concurrent changes; reruns send
only GETs. Listing order is mutable, so capped absence does not prove nonexistence.
Duplicate IDs, missing/repeated cursors, empty continuing pages, invalid scope,
deleted/changed resources or a nonempty session stop without writes.

If the session ID is unknown, **stop for operator reconciliation**. A timeout,
HTTP failure, malformed response, crash before POST or crash before saving the
response ID all leave retained intent that blocks any further POST. The script
cannot prove whether the server created a session and cannot automatically
adopt a search result. Keep the original journal and configuration for an
authorized operator to inspect against trusted server/audit evidence outside
this example. Do not delete/edit the journal, select a new path to retry the
uncertain operation, guess another session ID or reissue the create. This
conservative rule may block an operation that never reached the server.

The journal serializes this local operation only. It cannot prevent other
applications from creating sessions or writing messages, and it is not an
exactly-once API guarantee. Owner reads, session GETs and filtered membership are
separate current observations, not an atomic snapshot, immutable ownership
proof or historical audit. A recording-scoped session grants no device cleanup
authority and does not establish upload integrity or transcription readiness.
The example performs no automatic cloud deletion. Retain its private journal
for reconciliation; manage any cloud session separately through authorized
application controls.

## Bounded requests and checks

Responses are limited to **1 MiB**, with a **60-second overall budget** and at
most **10 seconds per request**. The timer interrupts connected transports,
including trickling response headers/bodies. Operating-system DNS resolution
can exceed the socket timeout before connection; time is checked again after
connecting and before output. Redirects, compressed responses, duplicate JSON
keys, non-finite numbers and invalid UTF-8 are rejected. There are no HTTP
retries, polling loops or message-generation calls.

The only executable verification in this creation batch is:

```powershell
python -m py_compile main.py
```

The path-filtered workflow uses Ubuntu 24.04, a SHA-pinned checkout action,
read-only repository permissions and that same syntax check. It has no API
credentials. Syntax success establishes parsing only.

| Evidence, 2026-10-08 | Result / remaining acceptance |
| --- | --- |
| Local Python `py_compile` | Passed using the bundled Windows runtime. |
| Public contracts / backend source | Reviewed create/get/list-session and owner reads against backend `1ac67c92`. |
| Unit / functional / live API / device tests | Not run, as requested. |
| Hosted syntax workflow | Syntax [passed at source `2752a79`](https://github.com/bota-dev/examples/actions/runs/37887199959); runtime acceptance unverified. |

Post-implementation review follows `bota-skills:compound-engineering` 1.2.9
against repository architecture and the public contracts:

| Requirement | Implementation evidence | Conformance / remaining verification |
| --- | --- | --- |
| Independent Python 3.12 example | Own source, environment template, ignore file, README; standard library only. | Matched by source; execution unverified. |
| Fixed trusted project/owner/recording | `configuration`, `check_identity`, `check_owners` before/after; optional contradiction rejection. | Matched by source; authorization runtime unverified. |
| Empty public creation without model work | `main` sends only recording scope, expects 201, checks serialized scope and zero messages. | Matched by source; live acceptance unverified. |
| Durable one-create intent / retained scope | `open_journal`, `retained_row`, `save_session`; FULL transactions, exclusive file, schema/fingerprint validation. | Matched by source; crash/concurrency/filesystem durability unverified. |
| GET-only uncertainty recovery | Existing intent cannot POST; known ID reused, unknown ID stops with operator guidance. | Matched by source; failure-path runtime unverified. |
| Public owner membership despite omitted fields | `check_membership` keeps owner/scope/recording filters on every bounded page and requires the saved ID. | Matched by source; mutable pagination and snapshot limits explicit. |
| Metadata privacy and bounded transport | Private parent/file checks, no content projection, strict JSON/byte/deadline gates. | Partial platform enforcement: Windows ACL is a documented operator prerequisite; runtime unverified. |

Tracked `serializeSession` returns `end_user_id` and omits `project_id`, whereas
public examples omit both. The script tolerates omission and rejects explicit
contradictions. Terminal `next_cursor` may be absent or null. The separate list
`total` is ignored. Backend `resolveRecordingForAsk` checks recording existence
and owner association for empty creation; the completed-transcription check is
in the later message-context path. No completion/readiness gate is invented here.

The public end-user GET contract names `end_users:read`; that permission is
required by this example's documented setup. The tracked route has no explicit
per-route `requireScopes` gate for that GET, unlike recording GET's
`recordings:read` gate. Source review does not establish deployed permission
enforcement. The internal design retains historical `/v1/sessions` sketches;
this example uses the current public `/v1/ask/sessions` route.

See [Create session](https://docs.bota.dev/api-reference/ask/create-session),
[Get session](https://docs.bota.dev/api-reference/ask/get-session),
[List sessions](https://docs.bota.dev/api-reference/ask/list-sessions),
[Get recording](https://docs.bota.dev/api-reference/recordings/get) and
[Get end user](https://docs.bota.dev/api-reference/end-users/get). For an
app-facing adaptation, authenticate the caller on your backend and derive its
authorized identities there; keep the Bota project key server-side.
