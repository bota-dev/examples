# Watch an existing summary (Node.js)

Observe one existing summary using bounded public API GETs, verify its exact
completed transcription, recording and fixed owner, then print selected status
metadata. This example never creates, retries or cancels processing, changes
configuration, follows a replacement job, downloads audio or calls a device.

**Status:** implemented with frozen-install, syntax and source evidence on
Node 22.23.2 / Windows, October 8, 2026. Polling, timeouts, ownership rejection,
failure handling and live API behavior remain unverified. No unit, functional,
CLI workflow, live API or device tests were run in this creation-only pass.

## Configure and run

Use **Node 22.23.2 or newer** in a server environment. Select an existing summary
and its existing **completed** source transcription, recording, project and
authorized end user. Use a project secret/restricted API key with the public
`recordings:read`, `transcriptions:read` and `summaries:read` permissions.
Keep this key out of browser/mobile code. No npm dependency, App SDK, sibling
repository, audio fixture or hardware is required.

From this directory:

```sh
npm ci
cp .env.example .env
# Fill all blank values with your own authorized existing resources.
npm run check
npm start
```

On PowerShell use `Copy-Item .env.example .env`. `npm start` loads the optional
`.env` with Node's built-in loader; injected process environment takes precedence.
Install and syntax commands make no API requests. Prefer server secret injection
for deployments; keep secrets out of shell history and retained logs.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required trusted, fixed HTTPS origin ending in `/v1`, normally `https://api.bota.dev/v1`; no URL credentials, query or fragment. |
| `BOTA_API_KEY` | Required server-held project secret/restricted key with all three documented read permissions. |
| `BOTA_PROJECT_ID` | Required expected `proj_...` project. |
| `BOTA_END_USER_ID` | Required fixed authorized `eu_...` owner. |
| `BOTA_RECORDING_ID` | Required expected source `rec_...` recording. |
| `BOTA_TRANSCRIPTION_ID` | Required existing completed `txn_...` transcription. |
| `BOTA_SUMMARY_ID` | Required existing `sum_...` summary to observe. |

Example output uses placeholders only:

```json
{
  "summary": {
    "id": "sum_example",
    "project_id": "proj_example",
    "transcription_id": "txn_example",
    "status": "completed"
  },
  "outcome": "completed",
  "stop_reason": "terminal_status",
  "successful_polls": 1
}
```

Only these four summary fields and fixed observation metadata are emitted.
No progress metadata is printed before final source/owner verification.
Summary output, custom prompts, full transcript text, segments, provider errors,
arbitrary API fields, recording names, signed URLs and credentials are excluded
from stdout and errors. GET responses can contain those fields; the process
receives them but selects no content for printing or export. This watcher does
not validate summary schema or model accuracy. Redirected `summary-status.json`
is ignored by Git; apply an appropriate retention policy to metadata and `.env`.

## Identity, observation and recovery

The initial `GET /v1/recordings/{id}` must match the configured recording and
end user, with `deleted_at` absent or null. `GET /v1/transcriptions/{id}` must match the
configured transcription and recording and have `completed` status. Only then
does the script poll `GET /v1/summaries/{id}` using the original configured ID.
Every summary read must carry the exact configured `id`, `project_id` and
`transcription_id`, and one public status: `pending`, `processing`, `completed`
or `failed`. Missing summary project/source identity or an unknown status fails.

Before any final metadata is emitted, the same transcription's completion and
recording link are rechecked, followed by the recording's current owner. An
unconfirmed or changed source/owner suppresses all job metadata. Recording and
transcription public GET contracts do not promise a `project_id` field: project
scope comes from the authenticated API key; any returned `project_id` must also
match. Summary `project_id` is mandatory. Separate GETs are not an atomic
authorization snapshot and cannot prove uninterrupted ownership or completion.
A multi-user service must derive allowed IDs and owner from authenticated caller
context rather than user-supplied configuration.

There are at most **20 summary GET attempts**, with **2 seconds** between
successful nonterminal reads. Request duration adds to that interval. Initial
and final source verification use four additional GETs. HTTP/transport or
verification errors stop immediately without automatic retry. The only repeated
requests are nonterminal status observations of the same configured summary.
It does not list resources, discover new IDs or follow a replacement after 404.

A **60-second elapsed budget** starts after configuration, with the final
**20 seconds reserved** for transcription and owner rechecks. Every request uses
an abort timer of at most **10 seconds** and no more than the remaining phase
budget, covering connection, headers and streamed body. Polling stops earlier
at its cap or observation cutoff. Timers require the Node event loop to run;
JSON parsing and OS/runtime work may delay cancellation. This is not a strict
whole-process wall-clock guarantee or a platform processing-time quota.

Every API response must be HTTP 200, uncompressed `application/json`, valid
UTF-8 and at most **1 MiB**. This conservative response limit applies even when
the response contains transcript/summary content that the watcher will discard.
Oversized data fails without truncation. Redirects are rejected, including
redirects to another HTTPS origin, so the configured bearer stays on the selected
API origin. No automatic request or processing retry occurs.

| Exit | Meaning |
| --- | --- |
| `0` | Observed `completed` summary after successful final source/owner rechecks. |
| `1` | Configuration, HTTP, transport, identity or malformed-response failure; sanitized stderr, no job metadata, no conclusive result. |
| `2` | Inconclusive observation: `failed` summary, local elapsed/request timeout or poll cap. Metadata is printed only if final source/owner rechecks succeed. |

A failed summary remains visible as `summary.status: failed` with
`outcome: inconclusive`; completion has not been established. For a polling
timeout/cap, output retains the last validated status or `summary: null` when
none was observed, with `stop_reason: elapsed_budget` or `poll_cap`. Timeout
before source/owner verification completes emits only sanitized stderr.

Failure or timeout does **not** authorize regeneration, replacement, cancellation
or a new POST. Inspect the existing resource through authorized GETs. To continue
observation, run again with the **same IDs**; do not swap in a newly discovered
job to conceal uncertainty. This example makes no cloud changes and has no cloud
or device cleanup. Retain or delete local environment/metadata deliberately.

## Evidence and design review

The review compares `ARCHITECTURE.md`'s independent-example/trust/acceptance rules,
the three public GET contracts and the owner's creation-without-testing request.

| Requirement | October 8, 2026 evidence / remaining verification |
| --- | --- |
| Independent setup | Built-ins only; own manifest and lockfile; `npm ci` and `npm run check` passed on Node 22.23.2 / Windows. Matched for install/syntax. |
| Public identity/status contract | Exact configured chain and known statuses enforced in source; public docs and backend source reviewed. Matched by inspection; runtime rejection unverified. |
| GET-only bounded observation | Fixed-ID polling, timers, response cap and final source/owner checks present. Matched by inspection; timing and failure behavior unverified. |
| Metadata-only output and sanitized errors | Explicit four-field projection; no content or raw exception printing. Matched by inspection; runtime output unverified. |
| Hosted workflow | Path-filtered install/syntax only, Node 22.23.2, SHA-pinned actions, read permissions. Configured; hosted execution not run. |
| Functional/live/device acceptance | Not run under the owner's creation-only instruction; no runtime conformance claim. |

Read-only backend source was inspected at
`1ac67c92c6d72858e29dc264037cb82b6c449825`: GET controllers return repository
resources using the authenticated project; base/recording repositories filter
by `project_id`, with deleted recordings excluded; summary/transcription models
use the four documented statuses. The recording GET route explicitly checks
`recordings:read`. Summary/transcription routers lack corresponding explicit
`requireScopes` guards in this source checkout. Keep all three **documented**
permissions on the configured key; source inspection does not prove deployed
scope enforcement, and this example does not repair that server discrepancy.

Public contracts: [Get Summary](https://docs.bota.dev/api-reference/ai/summaries/get),
[Get Transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get) and
[Get Recording](https://docs.bota.dev/api-reference/recordings/get). No private
dashboard endpoint or internal application helper is needed to run the example.
