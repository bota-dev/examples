# List summaries with Python

Learn to select existing summary jobs for one fixed completed transcription of
an owned recording through bounded public cursor pagination. The script prints
only summary IDs, known statuses and traversal metadata. It starts no processing,
calls no model, cancels no jobs and performs no cloud or device writes.

Status on **2026-10-08**: implemented with source review and Python syntax
verification only. Unit, functional, live API and device tests were not run at
the owner's request. Runtime authorization, pagination and failure behavior
remain unverified.

## Prerequisites and configuration

Use Python **3.12 or newer** on Windows, macOS or Linux. This independent example
uses the standard library only: no installation, SDK, sibling helper or root
workspace setup is needed. Have an existing completed transcription, its exact
recording and the recording's expected end user in the configured project.
Completion is an intentional prerequisite of this teaching example; the list
API itself does not document a completed-source restriction. Summary jobs can
have any of the four documented statuses.

Use a server-held secret or restricted project API key with `recordings:read`,
`transcriptions:read` and `summaries:read`. No hardware is required. The API
origin, key, project, end user, recording and transcription must come from
trusted server configuration. They must not come from an app request. An ID and
expected project field do not grant access or choose the key's project.

Run from this directory. `.env.example` documents settings; `main.py` reads
the process environment and **does not load `.env` files**.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS base ending in `/v1`, for example `https://api.bota.dev/v1`. No URL credentials, query or fragment. HTTP is rejected. |
| `BOTA_API_KEY` | Server-held project key; never commit it, log it or put it in a browser/mobile app. |
| `BOTA_PROJECT_ID` | Exact project associated with the key. Every summary row must return this project; recording/transcription project fields are checked when present. |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` owner of the source recording. |
| `BOTA_RECORDING_ID` | Exact expected owned `rec_*` source recording. |
| `BOTA_TRANSCRIPTION_ID` | Exact existing completed `txn_*` source; preserved on **every** list page. |
| `BOTA_MAX_PAGES` | Page cap, default 10, range 1–10. Page size is fixed at 20; total selection cannot exceed 200 summaries. |

PowerShell, after setting `BOTA_API_KEY` privately:

```powershell
$env:BOTA_API_BASE_URL = 'https://api.bota.dev/v1'
$env:BOTA_PROJECT_ID = 'YOUR_ACTUAL_PROJECT_ID'
$env:BOTA_END_USER_ID = 'eu_YOUR_ACTUAL_ID'
$env:BOTA_RECORDING_ID = 'rec_YOUR_ACTUAL_ID'
$env:BOTA_TRANSCRIPTION_ID = 'txn_YOUR_ACTUAL_ID'
$env:BOTA_MAX_PAGES = '10'
python main.py
```

On macOS/Linux, export the same environment variables and run `python3 main.py`.
For a customer application, authenticate the caller on your backend and derive
authorized project/end-user/resource context there. Keep the project key on that
backend and expose an intentional metadata projection.

## Selection and failure behavior

Before listing, the script reads `GET /recordings/{id}` and then
`GET /transcriptions/{id}`. It checks the exact transcription ID, completed status,
recording link, exact recording ID and recording end-user owner. Optional
`project_id` fields must match the expected project. On these reads, page
envelopes and summary rows, a returned `deleted_at` must be absent or exactly
null; false, empty strings and other non-null values are rejected.

The script then traverses
`GET /summaries?transcription_id=FIXED&limit=20`, forwarding the response's opaque
cursor on each subsequent request and retaining the same fixed transcription
filter. Every returned summary needs a valid `sum_*` ID, **mandatory exact
`project_id`**, exact `transcription_id` and status `pending`, `processing`,
`completed` or `failed`. After traversal it rechecks the transcription and then
recording, placing the final owner observation immediately before publication.
Failure on any page or the final checks
suppresses the entire selection.

Output has a `summaries` array containing only `{id, status}`, plus `pages`,
`observed_exhaustion`, `capped`, `stopped_reason` and `atomic_snapshot: false`.
Providers, templates, timestamps, custom prompts, outputs, error payloads,
transcript segments/text, recording titles, signed URLs, arbitrary response
fields, cursors and credentials are excluded. Minimal ID/status output avoids
exposing arbitrary provider or custom-template text. Upstream transcript and
summary payloads can still be received in bounded responses; they are not
printed or saved by this script.

| Exit | Meaning |
| --- | --- |
| **0** | A validated page reported `has_more: false`; `observed_exhaustion: true`, `capped: false`, `stopped_reason: observed_end_of_list`. |
| **2** | A continuing list reached the configured page cap or 200-item cap. The validated selection is printed with `observed_exhaustion: false`, `capped: true`, `stopped_reason: page_limit` or `item_limit`. |
| **1** | Configuration, scope, response, network or deadline rejection. A safe error is printed to stderr and no summary selection is emitted. |

`has_more` must be an exact JSON boolean. Continuing pages need at least one
new summary and a nonempty cursor no longer than 2,048 characters without
control/space characters. Repeated summary IDs (including within one page),
repeated cursors, empty continuing pages, oversized pages and missing cursors
are rejected. Terminal cursors may be absent or null, matching public prose
and tracked backend behavior; a non-null terminal cursor is rejected. Cursors
are never decoded, edited, printed or accepted from a caller.

Each API response and final JSON output is limited to 1 MiB, including responses
containing long transcripts or summary outputs. Larger existing resources stop
this example safely; a metadata-only backend endpoint would be needed to avoid
receiving that content. Strict UTF-8 JSON parsing rejects duplicate object keys,
nonstandard constants and numeric overflow to nonfinite floats, even in unused
payload fields. Redirects and compressed responses are rejected. There is no
automatic retry or error-body logging.

The overall budget is 60 seconds, with at most 10 seconds per request. A timer
interrupts connected transports at their deadline, including trickling headers
and body bytes; operating-system DNS resolution may exceed a socket timeout
before connection. Deadlines are checked after connection, during reads and
before output. These are example limits, not API service limits.

Summary creation/deletion or source/ownership changes can occur between reads
and pages. Before/after checks and progress guards cannot detect every omitted
row or concurrent change. `observed_exhaustion: true` means this traversal reached
its reported end; it does not prove an exhaustive atomic snapshot, stable
ownership or an audit history. A completed source and summary status do not
verify generated statements, upload integrity or authorize device cleanup.

After a failure, investigate the safe error and explicitly rerun the whole
selection once configuration/access is resolved. A rerun makes new observations;
it starts no replacement job. No remote cleanup is needed. If you redirect
stdout to a local file, store the IDs/statuses privately and remove the file when
finished; `.gitignore` excludes the suggested `summaries.json` filename only.

## Checks and design review

The only executable verification for this creation batch is:

```powershell
python -m py_compile main.py
```

CI uses the same compilation check on Ubuntu 24.04, a checkout action pinned to
40 hexadecimal characters, read-only repository permissions and this example's
path filters. It has no API credentials and runs no unit, functional, live or
device checks. Compilation proves Python syntax only.

| Evidence, 2026-10-08 | Result / remaining acceptance |
| --- | --- |
| Local Python `py_compile` | Passed using the bundled Windows Python runtime. |
| Public/source comparison | Reviewed OpenAPI `GET /summaries` and `Summary`, public summary/transcription/recording GET documentation, and backend controller/service/repository/pagination at `1ac67c92`. Runtime compatibility remains unverified. |
| Unit / functional / live API / device tests | Not run, as requested; no sample CLI or API/device calls were made. |
| Hosted syntax workflow | Added; execution remains unverified in this creation batch. |

Post-implementation review follows `bota-skills:compound-engineering` 1.2.9 with
the repository architecture, authorized scope and selected public contracts as
the authoritative basis:

| Requirement | Implementation evidence | Status / remaining verification |
| --- | --- | --- |
| Independent Python 3.12 example | Own source, environment template, ignore file, README and workflow; standard-library imports only. | Matched by source; compilation passed; standalone execution unverified. |
| Fixed project/source/owner | `configuration`, `check_recording`, `check_transcription`, `check_identity`, `metadata`; exact source and owner checked before and after listing. | Matched by source; live authorization and concurrent ownership behavior unverified. |
| Public cursor pagination | `list_summaries` retains fixed `transcription_id` on every page; exact boolean, row/cursor progress guards and caps. | Matched by source; runtime/failure cases unverified. |
| Metadata without content | `metadata` returns ID/status only; safe failures do not include API bodies. | Matched by source; runtime output checks unverified. |
| Bounded strict read-only HTTP | GET-only `read_json`, byte/time caps, strict JSON hooks, no redirect/retry paths. | Matched by source; network/deadline/parse rejection behavior unverified. |
| Capped versus observed end | Explicit result flags, exit codes and non-atomic caveats. | Matched by source/documentation; concurrent pagination behavior unverified. |
| Minimal completed-source workflow | Configured completed transcription required; no provider/template selection, job creation, cancellation or device operations. | Intentional scope restriction; broader list inputs are outside this example. |

The tracked backend passes authenticated project scope and `transcription_id`
through controller/service/repository, orders by `(created_at, id)` descending,
fetches `limit + 1` rows and omits `next_cursor` at the observed end. The client
depends only on opaque public cursor behavior; it does not implement that
encoding. Some malformed backend cursors can be treated as an initial page;
client duplicate/progress rejection limits that failure without claiming every
possible inconsistency is detected.

At the reviewed backend revision, summary and transcription list/get routers
lack explicit `requireScopes` guards; recording GET has its documented guard.
Project authentication and repository filtering are present. This example still
requires all three documented read permissions; deployed permission enforcement
is unverified. The reader does not repair this platform discrepancy.

OpenAPI's `Summary` schema omits `project_id`, while public get-summary examples
and response fields document it and the tracked repository returns it. This
example deliberately requires it on each summary row. A deployment that returns
only the OpenAPI fields is rejected; the contract discrepancy and live
compatibility remain unresolved. Recording/transcription public GET prose can
omit project metadata, so those fields are checked when present; the trusted
key's project association must already be known.

See [Get summary](https://docs.bota.dev/api-reference/ai/summaries/get),
[Get transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get),
[Get recording](https://docs.bota.dev/api-reference/recordings/get), the
[public OpenAPI list/schema](https://github.com/bota-dev/docs/blob/main/api-reference/openapi.json)
and [API authentication](https://docs.bota.dev/authentication).
