# Inspect summary metadata with Python

Learn to read one configured existing summary job and check its exact
transcription, recording and end-user source chain. The script makes five GETs
and prints selected summary status, timestamps and source IDs. It starts no
generation, polling, cancellation or device operation and creates no local file.

Status on **October 9, 2026 (Pacific)**: implemented with source review and Python
syntax verification only. The owner requested creation without executing the
example or unit, functional, live API or device tests. Runtime authorization,
response rejection and concurrency behavior remain unverified. Hosted syntax
results for the delivered source are recorded below.

## Prerequisites and configuration

Use Python **3.12 or newer** on Windows, macOS or Linux. This independent example
uses the standard library only; no package installation, SDK, sibling example
or root workspace setup is needed. Configure one existing `sum_*` job, its exact
`txn_*` transcription, the exact `rec_*` source recording and its authorized
`eu_*` owner in the project associated with your key. No hardware is required.

Keep the secret or restricted project API key on a trusted backend with the
documented `recordings:read`, `transcriptions:read` and `summaries:read` scopes.
The API origin and all IDs must come from trusted server configuration. The
expected project ID is an assertion; it does not choose the key's project or
grant resource access. Before adapting this for an application, authenticate
the caller on your backend and derive authorized project/end-user/resource
context there. Never accept these settings directly from an app request.

Run from this directory. `.env.example` documents settings; `main.py` reads the
process environment and **does not load `.env` files**.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS base, at most 2,048 characters, ending in `/v1`, such as `https://api.bota.dev/v1`. URL credentials, query/fragment delimiters (including empty ones), controls and backslashes are rejected. |
| `BOTA_API_KEY` | Server-held project key; never commit or log it or place it in a browser/mobile app. |
| `BOTA_PROJECT_ID` | Exact expected `proj_*` project; mandatory on the summary response and checked on recording/transcription responses when present. |
| `BOTA_END_USER_ID` | Exact authorized `eu_*` owner of the source recording. |
| `BOTA_RECORDING_ID` | Exact expected `rec_*` source recording. |
| `BOTA_TRANSCRIPTION_ID` | Exact existing `txn_*` source of the summary. |
| `BOTA_SUMMARY_ID` | Exact existing `sum_*` job to inspect. |

PowerShell, after setting `BOTA_API_KEY` privately:

```powershell
$env:BOTA_API_BASE_URL = 'https://api.bota.dev/v1'
$env:BOTA_PROJECT_ID = 'proj_YOUR_ACTUAL_ID'
$env:BOTA_END_USER_ID = 'eu_YOUR_ACTUAL_ID'
$env:BOTA_RECORDING_ID = 'rec_YOUR_ACTUAL_ID'
$env:BOTA_TRANSCRIPTION_ID = 'txn_YOUR_ACTUAL_ID'
$env:BOTA_SUMMARY_ID = 'sum_YOUR_ACTUAL_ID'
python main.py
```

On macOS/Linux, export the same variables and run `python3 main.py`. Replace the
illustrative IDs with your actual authorized values before running; do not
commit credentials or real resource IDs.

## Observation and failure behavior

The entire operation uses these five requests in this order:

1. `GET /recordings/{configured recording}` checks exact ID and end-user owner.
2. `GET /transcriptions/{configured transcription}` checks exact ID, exact source
   recording and a documented status.
3. `GET /summaries/{configured summary}` checks exact ID, **mandatory exact
   `project_id`**, exact source transcription, status and timestamp shapes.
4. The same transcription GET rechecks its source identity and available scope
   markers against the first observation.
5. The same recording GET rechecks ownership and available scope markers
   immediately before output.

All responses must be objects. Any returned `project_id` must exactly match the
configured project, including on source resources; null is rejected. A returned
`deleted_at` must be exactly null; absent is accepted, while empty strings,
false and all other non-null values are rejected. A recording with explicit
`status: deleted` is also rejected. The presence and value of
these optional source markers must remain stable across the surrounding reads.
The recording ID/end-user pair and transcription ID/recording pair must also
remain stable. The trusted key's project association must already be established
independently when source responses omit project metadata.

Transcriptions and summaries accept `pending`, `processing`, `completed` or
`failed`. The reader does not require the transcription to remain completed or
compare job status across reads. Each summary timestamp field must be present:
`created_at` and `updated_at` are strings; `started_at` and `completed_at` are
explicitly null or strings. Non-null values must be at most 40 characters and
represent valid RFC3339-style calendar instants with `T`, seconds, optional
1–9 fractional digits and `Z` or a signed UTC offset. Unknown `-00:00` offsets,
leap seconds, missing zones and malformed dates are unsupported. Values are
retained as supplied; no local timestamp, fallback or undocumented status/time
ordering rule is substituted. Nullable fields alone establish no failure or
completion evidence.

One JSON object is printed only after all checks succeed. It contains the
summary's `id`, `project_id`, `status`, `created_at`, `updated_at`, `started_at`
and `completed_at`, a `source` object with the validated `transcription_id`,
`recording_id` and `end_user_id`, and `atomic_snapshot: false`. No provider,
template, custom prompt, summary output, transcript text/segments, recording
title, device identity, URL, arbitrary response fields or raw error payloads
are printed or saved. Upstream GETs can still return transcript/summary content
inside bounded responses; this example's projection does not avoid receiving it.

The summary fields describe its single GET response. Separate source checks
cannot establish an atomic snapshot, continuous or historical ownership,
unchanged transcript content, stable summary status after its GET, or absence
of a deletion after the last read. Matching source IDs do not verify generated
statements, upload integrity, exact completion acknowledgment, signed receipts
or device cleanup authority.

Each response and final output is capped at **1 MiB**. An existing job whose GET
payload exceeds that cap is rejected even though only metadata is selected;
a metadata-only endpoint would be needed to avoid receiving content. Strict
UTF-8/JSON parsing rejects duplicate object keys, invalid Unicode (including
unpaired escaped surrogates), nonstandard constants and numeric overflow to
nonfinite floats, even in unselected fields. Compressed responses and redirects
are rejected. There is no automatic retry or upstream/exception-body logging.

The total budget is **60 seconds**, with at most **10 seconds per request**.
After connection, a timer interrupts the transport at the request deadline,
including trickling response headers/body. Operating-system DNS resolution may
exceed a socket timeout before connection; this is not a universal hard deadline.
The script checks time after connection, during reads/parse and before output.
These are teaching limits, not API service limits.

Exit **0** means the selected metadata passed this invocation's checks; exit
**1** means configuration, scope, response, network or deadline rejection. A
failure suppresses the whole report and prints a safe message to stderr. Resolve
the cause and explicitly rerun if appropriate; a rerun observes new state and
creates no replacement job. IDs and timestamps may be sensitive operational
metadata, so keep any caller-created stdout capture private.

## Checks and design review

The only executable check for this creation batch is:

```powershell
python -m py_compile main.py
```

The path-filtered [GitHub Actions workflow](../../.github/workflows/inspect-summary-python.yml)
uses Ubuntu 24.04, a checkout action
pinned to a full SHA with `persist-credentials: false`, `contents: read`, a
five-minute job timeout and `python3 --version`/`py_compile` only. It needs no API
secrets or hardware. Compilation proves syntax; it does not execute the example.
Workflow YAML was parsed and reviewed manually because the workflow-generator
skill's referenced validator/reference resources are unavailable locally.

| Evidence, October 9, 2026 (Pacific) | Result / remaining acceptance |
| --- | --- |
| Local Python `py_compile` | Passed with the bundled Windows Python runtime. Syntax only. |
| Workflow YAML/source review | Parsed YAML; checked triggers, example paths, full checkout pin, permissions and syntax-only commands. Hosted syntax passed; see delivery evidence below. |
| Public/backend comparison | Reviewed public summary/transcription/recording GET prose, OpenAPI `Summary`/`Transcription`, backend routes/controller/service/repository/model source at `1ac67c92`. Compatibility remains unverified. |
| Example execution / unit / functional / live API / device tests | Not run as requested. No API, model, storage or device action was performed. |

Post-implementation review uses `bota-skills:compound-engineering` 1.2.9, the
repository architecture and the selected public GET contracts:

| Requirement | Implementation evidence | Status / remaining verification |
| --- | --- | --- |
| Independent Python reader | Own `main.py`, environment template, ignore file, README and workflow; standard-library imports only. | Matched by source and syntax; standalone runtime unverified. |
| Exact configured summary/source/owner/project | `configuration`, `check_scope`, `check_recording`, `check_transcription`, `summary_metadata`; five fixed-ID GETs and final owner check. | Matched by source; live authorization and concurrent changes unverified. |
| Selected public summary status/timestamps | `summary_metadata` selects known status and required nullable/non-null timestamp fields; `timestamp` validates bounded calendar/offset strings. | Matched by source; deployed response compatibility unverified. |
| Stable source identity without atomic claims | Before/after source tuples preserve exact links and marker presence/value; output explicitly sets `atomic_snapshot: false`. | Matched for observed relationships; content/historical/continuous ownership not verified. |
| Metadata without generated content | Explicit projection only; fixed safe errors and generic unexpected-exception handler. | Matched by source; runtime output/rejection behavior unverified. |
| Bounded GET-only transport | `read_json` uses one GET per fixed request, strict parsing, byte caps and connected deadline timer, with no retries/redirects. | Matched by source; network/parse/deadline failure behavior unverified; DNS caveat retained. |
| No processing or device writes | No generation, polling, cancellation, file output or device API paths. | Matched by source; no live actions were run. |
| Documented restricted-key scopes | All three read scopes remain prerequisites. | Partial platform conformance: the inspected transcription/summary routers lack `requireScopes`; deployed enforcement unverified. |

At the reviewed backend revision, `/v1` authentication selects the project;
controllers pass that project to services and repository `findById` queries
filter by `project_id` and exact ID. Recording GET has a `recordings:read` guard.
Transcription and summary GET routers lack explicit `requireScopes` guards for
their documented read permissions. This example cannot repair that platform
gap and does not rely on it to relax operator permissions.

Public get-summary prose documents `project_id`, and the inspected repository
returns it; OpenAPI's `Summary` schema omits it. The reader deliberately requires
it. A deployment exposing only those OpenAPI fields is rejected; the contract
discrepancy remains unresolved. Recording/transcription public GET prose can
omit project/deletion markers, so only available markers are checked and fenced.
These are source observations, not proof of deployed behavior or target-wide
architecture conformance.

See [Get summary](https://docs.bota.dev/api-reference/ai/summaries/get),
[Get transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get),
[Get recording](https://docs.bota.dev/api-reference/recordings/get),
[OpenAPI](https://github.com/bota-dev/docs/blob/main/api-reference/openapi.json)
and [API authentication](https://docs.bota.dev/authentication). Backend source
evidence includes the [summary router](https://github.com/bota-dev/bota/blob/1ac67c92c6d72858e29dc264037cb82b6c449825/api/src/routes/v1/summaries/index.ts),
[transcription router](https://github.com/bota-dev/bota/blob/1ac67c92c6d72858e29dc264037cb82b6c449825/api/src/routes/v1/transcriptions/index.ts),
[recording router](https://github.com/bota-dev/bota/blob/1ac67c92c6d72858e29dc264037cb82b6c449825/api/src/routes/v1/recordings/index.ts)
and [project-scoped repository lookup](https://github.com/bota-dev/bota/blob/1ac67c92c6d72858e29dc264037cb82b6c449825/api/src/repositories/base.repository.ts).

## Hosted syntax evidence

Implementation `6a50f36586212f5c388843a068a90c3f96c23b96` was pushed directly to examples
`main`. GitHub APIs confirmed the [run](https://github.com/bota-dev/examples/actions/runs/38003677115) and
[job](https://github.com/bota-dev/examples/actions/runs/38003677115/job/114067436261) completed successfully at that exact source.
This establishes Python syntax compilation only; no example, functional,
live API, filesystem, consumer or device acceptance was executed. The later
evidence update changes documentation only.
