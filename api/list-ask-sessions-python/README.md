# List Ask sessions with Python

Learn to select existing Ask sessions for one configured end user through bounded cursor pagination, printing only session IDs, scope recording IDs, message counts and timestamps. This example reads metadata; it does not retrieve messages, citations, recording content or transcripts, call a model, create/update/delete sessions, select branches or operate devices.

Status on **2026-10-08**: implemented with source review and Python syntax verification only. Unit, functional, live API and device tests were not run at the owner's request. Runtime compatibility and failure-path acceptance remain unverified.

## Prerequisites and configuration

Use Python **3.12 or newer** on Windows, macOS or Linux. Only the Python standard library is used; there is no package installation, SDK dependency, release pin or root workspace setup. Have a server-held project API key authorized to list Ask sessions and read the configured end user (`end_users:read`). Use an existing end user in that exact project. No hardware is required.

Run from this directory. `.env.example` documents configuration; `main.py` does **not** load `.env` files. Supply values through your server environment or secret manager:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted API base, for example `https://api.bota.dev/v1`. HTTPS is required except for loopback HTTP. No URL credentials, query or fragment. |
| `BOTA_API_KEY` | Secret or restricted project key, kept on the server. Never place it in a browser/mobile app, logs or committed files. |
| `BOTA_PROJECT_ID` | Exact project ID associated with that trusted key; used to reject mismatching `project_id` fields when returned. |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` identity; sent on **every** list page. |
| `BOTA_LIMIT` | Sessions per page, default 20, range 1–100. |
| `BOTA_MAX_PAGES` | Page cap, default 5, range 1–20. |

PowerShell, after setting `BOTA_API_KEY` privately:

```powershell
$env:BOTA_API_BASE_URL = 'https://api.bota.dev/v1'
$env:BOTA_PROJECT_ID = 'YOUR_ACTUAL_PROJECT_ID'
$env:BOTA_END_USER_ID = 'eu_YOUR_ACTUAL_ID'
$env:BOTA_LIMIT = '20'
$env:BOTA_MAX_PAGES = '5'
python main.py
```

On macOS/Linux, export the same environment variables and run `python3 main.py`.
Obtain the API origin, key, project and end user from trusted server configuration;
the project field is a cross-check, not a mechanism for selecting a key's project.
Public responses may omit project metadata, so the key's project association must
already be known. Do not accept these values or a cursor from an app request.

## Result and bounded failures

The script checks the end user with `GET /end-users/{id}`, traverses `GET /ask/sessions?end_user_id=...&limit=...` with opaque `next_cursor` values, then checks the end user again before printing. End-user profile data is discarded. The documented session response can omit both owner and project fields: filtered membership establishes the observed session owner, and optional `end_user_id`/`project_id` fields are checked when present on rows or page envelopes. A returned `deleted_at` must be absent or null. A project key's unfiltered session GET alone would not establish that fixed end-user membership; this example makes no such GET.

Output contains a `sessions` array, `pages`, `complete`, `stopped_reason` and `atomic_snapshot: false`. Each session has only `id`, `scope: {type, recording_ids}`, `message_count`, `last_message_at`, `created_at` and `updated_at`. Titles, cached recording titles, models/providers, prompts, messages, citations, arbitrary response fields, cursors and credentials are excluded. Message counts describe the current active branch in the tracked implementation; they are not counts of every sibling message.

| Scope | Accepted response shape / interpretation |
| --- | --- |
| `recording` | Exactly one `rec_*` in `recording_ids`. |
| `library` | Empty `recording_ids`; this does not mean an empty user library. |
| `selected` | 1–500 distinct `rec_*` IDs. |
| `folder` | Publicly named but reserved by the current backend; rejected because no supported exact folder shape is established. |

The API scope also contains `recording_title`; it is discarded rather than printed.
Scope IDs describe session context. They are **not** proof that those recordings
still exist, currently belong to this end user, have complete processing, or
authorize content access. A content reader needs its own fresh recording
ownership and citation-scope checks before showing text.

The example caps selection at 500 sessions, 2 MiB per API response and 2 MiB of final JSON, with a 60-second overall budget and at most 10 seconds per request. Connected HTTP transports are interrupted at the request deadline, including trickling headers/bodies; operating-system DNS resolution can exceed the socket timeout before connection. Requests are checked again after connection and before output. These are example limits, not API service limits.

Exit **0** means the traversed list reported `has_more: false`. Exit **2** prints a validated but **incomplete** selection with `stopped_reason: page_limit` or `session_limit`. Exit **1** prints a fixed safe error and no session output for identity/schema/HTTP/byte/time failures, duplicate session IDs, empty continuing pages or repeated/missing cursors. The cursor is never decoded, edited or reused on an automatic retry. Redirects and compressed responses are rejected. Duplicate JSON keys and nonstandard JSON constants are rejected.

Newest-activity order can move sessions across pages while other requests add messages or switch branches. Duplicate/progress checks stop some inconsistent traversals, but cannot detect every omission or concurrent change. `complete: true` means this traversal reached its reported end, **not** that it produced an exhaustive atomic snapshot. End-user checks before/after and filtered membership are current observations, not immutable ownership/history proof; sessions may change or disappear after selection. No total count is used as completion evidence.

After a failure, resolve configuration/access or investigate the safe error and explicitly rerun the whole selection. A rerun takes a new observation. No cloud resources or device data are created, so no remote cleanup is needed. If you redirect output to a file, treat the IDs and activity timestamps as private metadata and remove that local file when finished.

## Checks and design review

The only executable verification for this creation batch is:

```powershell
python -m py_compile main.py
```

CI uses the same syntax check on Ubuntu 24.04, a pinned checkout action, read-only repository permissions and this example's path filters. It has no API credentials and runs no unit, functional, live or device checks. Syntax success proves parsing only.

| Evidence, 2026-10-08 | Result / remaining acceptance |
| --- | --- |
| Local Python `py_compile` | Passed; bundled Windows Python runtime. |
| Public contract and tracked source comparison | Reviewed list/get-session and get-end-user contracts against backend `1ac67c92`; runtime behavior unverified. |
| Unit / functional / live API / device tests | Not run, as requested. |
| Hosted syntax workflow | Added; not run in this creation batch. |

Post-implementation review uses the repository architecture and public contracts as the authoritative basis, following `bota-skills:compound-engineering` 1.2.9:

| Requirement | Implementation evidence | Conformance / remaining verification |
| --- | --- | --- |
| Independent Python example | Own `main.py`, environment template, ignore file and README; standard-library imports only. | Matched by source; independent live execution unverified. |
| Fixed server project/end-user context | `configuration`, `check_end_user`, `check_identity`; every page preserves `end_user_id`. | Matched by source; authorization behavior unverified. |
| Public metadata and scope contract | `metadata` projects only allowed fields; exact recording/library/selected cardinalities; folder stops. | Partial public scope support; folder compatibility limit explicit. |
| Bounded opaque pagination | `list_sessions`, page/item/byte limits, repeated ID/cursor rejection, capped output marked incomplete. | Matched by source; failure paths unverified. |
| Read-only session selection | HTTP method always GET; no content or generation paths. | Matched by source; no live requests made. |
| Honest ownership/snapshot limits | Before/after owner reads and this README's movement/current-observation caveats. | Matched by source/documentation; atomicity intentionally not claimed. |

Public documentation omits optional ownership metadata and shows `next_cursor: null` at the end; the tracked serializer adds `end_user_id`, omits `project_id` and may omit the terminal cursor entirely. Both absence and null terminal cursors are accepted. The tracked backend also returns a separate `total`, ignored here because its query is not an atomic snapshot of all pages. `last_message_at` is required: the tracked database supplies a non-null default even for a session with zero messages.

The public list supports optional `scope_type`, `recording_id` and title search `q`; this example deliberately uses only fixed owner, page size and cursor to teach session selection. In tracked source, `recording_id` matches membership in the scope's recording-ID array, including selected scopes; it should not be interpreted as a recording-scope or recording-ownership check. Title search is not used or printed.

Use [List sessions](https://docs.bota.dev/api-reference/ask/list-sessions), [Get session response fields](https://docs.bota.dev/api-reference/ask/get-session), [Get end user](https://docs.bota.dev/api-reference/end-users/get) and [API authentication](https://docs.bota.dev/authentication) for the public contract. To adapt for a customer application, authenticate the app caller on your backend, derive the authorized project/end user on the server, and provide an intentional metadata projection. Never expose the project API key or trust caller-supplied identity as authorization.
