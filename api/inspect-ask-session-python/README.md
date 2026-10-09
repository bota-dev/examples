# Inspect an existing Ask session with Python

Read selected metadata for one exact existing **recording-scoped** Ask session.
The example observes its membership in a fixed end user's recording-filtered
session collection before and after the exact session GET, and checks current
recording ownership before the first traversal and before output. It retrieves
no messages or recording content, calls no model and performs no writes.

Status on **2026-10-09**: implemented with source review and Python syntax
verification only. Unit, functional, live API and device tests were not run at
the owner's request. Runtime compatibility and failure-path acceptance remain
unverified.

## Prerequisites and configuration

Use Python **3.12 or newer** on Windows, macOS or Linux. Only the Python standard
library is used; no installation, Bota SDK, root workspace setup or hardware is
required. Configure an existing project, authorized end user, recording currently
owned by that user, and exact Ask session with `scope.type: recording` and that
single recording ID. This reader does not create missing resources or choose a
different session.

Keep the project secret/restricted API key on your server. It must authorize
recording reads (`recordings:read`) and Ask session reads in that project. The
public Ask contract names API-key access, rather than an `ask:read` permission.
The tracked Ask route has no explicit per-route read-scope middleware; do not
assume a read restriction on another resource prevents Ask access. Confirm the
deployed key's intended access and apply your application's own authorization.

`.env.example` documents settings; `main.py` does **not** load `.env` files. Set
them in the process environment or your server secret manager:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS API origin with `/v1`, for example `https://api.bota.dev/v1`; no credentials, query, fragment, controls or backslashes. |
| `BOTA_API_KEY` | Server-held secret or restricted project key; never log it, commit it or ship it in a mobile/browser app. |
| `BOTA_PROJECT_ID` | Exact project associated with that key, used to cross-check optional returned `project_id`. |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` identity, retained on every collection request. |
| `BOTA_RECORDING_ID` | Exact owned `rec_*`, retained as collection filter and sole expected session scope ID. |
| `BOTA_SESSION_ID` | Exact existing `as_*` to inspect. |
| `BOTA_LIMIT` | Sessions per page, default 20, range 1–100. |
| `BOTA_MAX_PAGES` | Page cap for each membership traversal, default 5, range 1–10. |

PowerShell, after setting `BOTA_API_KEY` privately:

```powershell
$env:BOTA_API_BASE_URL = 'https://api.bota.dev/v1'
$env:BOTA_PROJECT_ID = 'YOUR_ACTUAL_PROJECT_ID'
$env:BOTA_END_USER_ID = 'eu_YOUR_ACTUAL_ID'
$env:BOTA_RECORDING_ID = 'rec_YOUR_ACTUAL_ID'
$env:BOTA_SESSION_ID = 'as_YOUR_ACTUAL_ID'
python main.py
```

On macOS/Linux, export the same variables and run `python3 main.py` from this
directory. Obtain the origin, key and IDs from trusted server configuration.
The project field cross-checks metadata; it does not select the key's project.
Do not accept these values or a cursor directly from an app caller. Authenticate
that caller and derive authorized project/end-user/resource IDs on your server.

## Observation sequence and result

1. `GET /recordings/{configuredRecording}` requires the exact ID and returned
   `end_user_id` to match the configured owner.
2. Traverse `GET /ask/sessions` with **all three fixed filters** on every page:
   `end_user_id`, `scope_type=recording`, `recording_id`. Validate each returned
   session's recording scope and single recording ID, and find the exact session.
3. `GET /ask/sessions/{configuredSession}` requires that same ID and scope, then
   selects only its message count and valid timestamps.
4. Repeat the filtered membership observation from its first page, then re-read
   the recording's exact ownership before emitting the selected metadata.

Optional returned `project_id` and `end_user_id` must match the fixed context on
session rows and list envelopes. An optional `deleted_at` must be absent or
null. These additional checks do not replace filtered membership: the public
session response omits owner/project metadata, and a project-key session GET
alone does not establish the caller's configured end-user membership. The
tracked serializer adds `end_user_id` but this example does not depend on that
undocumented field being returned.

Output contains `session` with only `id`, `scope: {type, recording_ids}`,
`message_count`, `last_message_at`, `created_at` and `updated_at`; it also reports
`membership_observation_pages: {before, after}`, `atomic_snapshot: false` and
`historical_authorization_proof: false`. Titles, cached recording titles,
model/provider names, active-leaf IDs, prompts, conversation text, profiles,
audio URLs, raw payloads, cursors and credentials are discarded. Metadata can
still be private; protect redirected files such as `session.json` and delete
them when finished.

Message count is the exact GET's observation of the active branch in the
tracked backend, not a count of all sibling messages. Timestamps must be valid
timezone-bearing ISO timestamps; the tracked database supplies a non-null
`last_message_at` default even for empty sessions. Counts and timestamps may
change between membership observations; the reader compares identity/scope,
not mutable counts or activity times. It never fetches messages to verify them.

All ownership and membership reads are separate current observations. They do
not create an atomic snapshot, prove historical authorization, prevent a later
ownership change, prove recording processing completion, or grant access to
conversation/recording content. Session scope is immutable in the tracked API;
the reader still validates it on each response. `recording_id` alone can also
match selected scopes in tracked source, so `scope_type=recording` and exact
response cardinality are both required here.

## Limits and failures

Each membership traversal has its configured page cap and a 500-session cap.
Opaque cursors are URL-encoded as returned, never decoded, modified or accepted
from a caller. The entire returned page is validated before accepting a match,
including duplicate IDs and its terminal/continuing cursor shape. Continuing
pages must be nonempty with a new nonempty cursor; terminal pages accept an
absent or null cursor. The reader stops after finding the target, so membership
success is not an exhaustive session-directory result.

Exit **0** prints only validated selected metadata after both membership
observations and the final recording ownership check. Exit **1** prints a fixed
safe error and no session output for a missing target, cap reached without a
target, identity/scope/schema mismatch, duplicate session IDs or repeated/missing
cursors, HTTP failure, invalid UTF-8/JSON, or byte/time failure. Activity-based
pagination is mutable: omission is possible despite duplicate/progress checks;
failure to observe a session is not proof it does not exist or belong to the
user. Resolve access/configuration or investigate the error, then explicitly
rerun for a new observation. No automatic retry, mutation or remote cleanup is
performed.

Responses are limited to **1 MiB per request** and final JSON to 1 MiB. Requests
share a **60-second overall budget**, with at most **10 seconds per request**.
A timer interrupts the connected transport at its deadline, including slowly
arriving headers/bodies. Operating-system DNS resolution can exceed the socket
timeout before connection; the deadline is rechecked after connection and
before output. Redirects and compressed responses are rejected. Duplicate JSON
keys, non-finite numeric values, invalid UTF-8 and unpaired Unicode surrogates
are rejected. These are example limits, not service limits.

## Checks and design review

The creation batch's only executable example verification is:

```powershell
python -m py_compile main.py
```

The path-filtered workflow runs the same syntax check on Ubuntu 24.04, using a
fully pinned checkout action, read-only repository permissions and disabled
persisted credentials. It needs no API key or hardware and runs no behavioral
tests. Syntax success establishes parsing only.

| Evidence, 2026-10-09 | Result / remaining acceptance |
| --- | --- |
| Local Python `py_compile` | Passed with bundled Python 3.12; no example execution. |
| Public contract and tracked source comparison | Reviewed get/list-session and recording GET contracts against backend `1ac67c92`; deployed behavior unverified. |
| Static workflow review | Pinned action, read-only permissions, standalone working directory, main/path PR triggers and syntax-only commands reviewed. |
| Unit / functional / live API / device tests | Not run, as requested. |
| Hosted syntax workflow | Added; hosted result not yet recorded. |

Post-implementation review follows `bota-skills:compound-engineering` 1.2.9,
using the repository architecture and public contracts as the authoritative
basis:

| Requirement | Implementation evidence | Conformance / remaining verification |
| --- | --- | --- |
| Independent standard-library reader | Own source, environment template, ignore file, README and workflow. | Matched by source; standalone runtime execution unverified. |
| Exact fixed server project/owner/recording/session | `configuration`, `check_identity`, `check_recording`, `check_session`. | Matched by source; runtime authorization rejection unverified. |
| Owner-filtered membership before/after exact GET | `observe_membership` retains all three filters on each opaque cursor page; validates scope/cardinality and exact target. | Matched by source; pagination movement and failure paths unverified. |
| Bounded read-only metadata projection | `read_json` uses GET only; `metadata` emits selected fields; limits and safe failures are explicit. | Matched by source; no live requests or behavioral tests performed. |
| Current observation versus historical/atomic proof | Output false flags and ownership/membership caveats above. | Matched by source/documentation; historical/atomic proof intentionally not claimed. |
| Honest evidence and permission boundary | Syntax-only evidence, public optional markers and Ask read-middleware gap documented. | Partial security boundary: application authorization is still required. |

Public contracts: [Get session](https://docs.bota.dev/api-reference/ask/get-session),
[List sessions](https://docs.bota.dev/api-reference/ask/list-sessions),
[Get recording](https://docs.bota.dev/api-reference/recordings/get) and
[Authentication](https://docs.bota.dev/authentication).

Tracked source inspection covered the Ask route/controller, `serializeSession`,
`aiAskService.getSession`/`listSessions`, and the repository's project/end-user,
scope and recording filters. The terminal cursor may be absent in source while
the public example shows null; both are accepted. `total` is ignored because
it is not an atomic membership guarantee. No private helper or sibling
repository is needed to install or run this public example.
