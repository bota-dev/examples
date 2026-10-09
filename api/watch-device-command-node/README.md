# Watch an existing device command (Node.js)

Observe one ordinary command's backend lifecycle within a bounded interval,
checking its exact target and the device's current owner around every read.
The example emits selected metadata; it sends no command, acknowledgement,
cancellation, delivery request or physical-device operation.

**Status:** implemented with source review and syntax checks on October 8,
2026. Runtime, API authorization/failure handling and device execution are
unverified. This creation pass runs no tests or example CLI and makes no API
or hardware calls. Uses Node.js **22.23.2 or newer** and built-ins only, with
an independent manifest and lockfile; no SDK, private package or sibling
repository is required to install or run it.

## Configure and run

Use a server-held project key with **`devices:read`**. An authorized project
operator must independently establish that this existing command belongs to
the intended end user and binding generation, using their retained creation
audit context. Current ownership alone cannot establish that historical link.
Do not expose a project key in a mobile/browser application. A customer service
must derive its allowed project, end user, device and command from authenticated
caller identity rather than accepting these values as authorization from clients.

From this directory:

```sh
npm ci
cp .env.example .env
# Replace every placeholder in the private .env file with authorized values.
npm run check
npm start
```

PowerShell uses `Copy-Item .env.example .env` instead of `cp`. `npm start` loads
an optional `.env` file through Node; process environment values take precedence.
The template contains no credentials or cloud/device fixture. Protect `.env`
with the host's private permissions, or inject configuration through your
server's secret management. `npm run check` only parses the source and needs
no credentials or network access.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Trusted HTTPS API origin ending in `/v1`; defaults to `https://api.bota.dev/v1`; no credentials, query, fragment, whitespace, controls or backslashes |
| `BOTA_API_KEY` | Server-held secret or restricted project key with `devices:read`; device/upload tokens are rejected |
| `BOTA_PROJECT_ID` | Expected `proj_*` project, independently matched to the authenticated key by the operator |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` current owner |
| `BOTA_DEVICE_ID` | Exact `dev_*` cloud ID, not a physical serial number |
| `BOTA_COMMAND_ID` | One existing `cmd_*` whose historical authorization the operator established independently |

No resource is created. The script reads only `GET /v1/devices/{device}` and
`GET /v1/devices/{device}/commands/{command}`. It never fetches the pending
delivery endpoint, follows a replacement command, creates a retry, cancels,
acknowledges or clears a recording. It rejects `factory_reset`, whose lifecycle
can unbind the device and needs a separate reset-specific observer.

## Identity and evidence boundaries

Each observation performs device GET → exact command GET → device GET.
Both device reads must match the configured ID/end user, remain `bound` and
have no deletion marker (absent or exactly `null`). Optional project fields
must equal the configured project on both resource types. An available device
`binding_generation` must be a nonnegative safe integer and remain identical
across the operation. Its appearance or disappearance also stops observation.
An absent generation throughout is accepted but supplies no generation proof.

The command must have the exact configured ID **and returned `device_id`**.
The latter check is essential: the reviewed backend's get-command controller
passes the project and command ID to the service but ignores the device path
parameter. The ordinary type must be `start_recording`, `stop_recording` or
`trigger_upload`, and cannot change between observations. Unknown types,
statuses or contradicted identity fields fail closed.

The project key provides authenticated project scope. Device and command
responses do not promise a `project_id`, so `BOTA_PROJECT_ID` is an expected
operator context, not independent proof when the field is absent. Separate
owner reads are non-atomic, and current binding does not prove the historical
owner/generation that authorized a command. This reader does not implement or
claim the target versioned, generation-bound command protocol.

| Reported status | Interpretation |
| --- | --- |
| `pending` | Backend row remains queued; no receipt or physical action is proved |
| `delivered` | Backend selected the command for delivery; physical receipt is not independently proved |
| `executed` | Backend recorded success, possibly inferred from a later start/stop heartbeat; physical execution is not independently proved |
| `failed` | Backend recorded a failure, possibly from later start/stop state reconciliation |
| `expired` / `cancelled` | Backend reports a terminal lifecycle outcome |

For `trigger_upload`, `executed` reports acceptance of the trigger, not file
completion. Observe recording commitment/integrity separately; a legacy
`uploaded` state alone is not verification proof or cleanup authorization.
The script never reads or prints parameters, grants, results, error payloads,
raw bodies, device serials or secrets. Protect stdout as operational metadata.

## Bounds, outcome and recovery

There are at most **30** complete observations (three GETs each), separated by
two seconds, sharing a **90-second** monotonic deadline and abort timer. Every
request/header/body read additionally has at most **10 seconds**. Each decoded
response is at most **1 MiB** of fatal UTF-8 JSON. Only HTTP 200 JSON with no
compressed content is accepted; redirects and automatic retries are disabled.
No new request starts after the deadline. These are asynchronous I/O budgets,
not a guarantee against OS process suspension or blocked event-loop scheduling.

Output appears once, after a validated owner-command-owner observation, or at
the observation/deadline bound. A deadline during the next observation returns
only the last completed observation and its saved timestamp; it never emits an
unfinished observation. If none completed, `data` and `observed_at` are `null`
and `observations` is zero. Metadata includes:

```json
{
  "data": {
    "id": "cmd_example",
    "device_id": "dev_example",
    "type": "trigger_upload",
    "status": "executed"
  },
  "observations": 1,
  "observed_at": "2026-10-08T00:00:00.000Z",
  "stopped_by": "terminal_status",
  "evidence": "backend_command_report",
  "historical_owner_verified": false,
  "atomic_snapshot": false,
  "physical_execution_verified": false,
  "upload_completion_verified": false
}
```

The IDs/timestamp above illustrate output, not runnable fixtures.
Exit **0** means an `executed` backend report was observed. Exit **2** means a
`failed`, `expired` or `cancelled` report, or a deadline/observation cap without
observed success. Exit **1** means configuration, transport, HTTP, ownership,
binding, identity or shape validation failed; stdout is withheld on those
failures. Stderr is sanitized and contains no raw exceptions or response body.
Observation caps/deadlines are not cancellation and do not change the command.
After any outcome, reconcile the same ID using your authorized audit context;
do not create a replacement to force a successful result. There is no cloud
cleanup. `command-observation.json` is ignored for optional local redirection;
retain/remove it according to your metadata policy.

## Contract review and verification

Public contracts: [get device](https://docs.bota.dev/api-reference/devices/get),
[get an existing command](https://docs.bota.dev/api-reference/devices/get-command),
[command creation and lifecycle](https://docs.bota.dev/api-reference/devices/create-command),
[command history](https://docs.bota.dev/api-reference/devices/list-commands), and
[OpenAPI](https://docs.bota.dev/api-reference/openapi).
The public router registers exact-command GET with `devices:read`, but the
reviewed documentation baseline `76b0a4f` included only DELETE at that path and
had no dedicated GET page. This batch adds the narrow GET source reference and
OpenAPI operation for the existing route. Source documentation on docs `main`
does not establish publication on `docs.bota.dev`, deployed route availability
or runtime compatibility; those checks remain unverified.

Read-only backend source at `1ac67c92c6d72858e29dc264037cb82b6c449825` clarifies
`api/src/routes/v1/devices/{index,controller}.ts`, `command.service.ts`,
`command.repository.ts` and `device.service.ts`. Neither device GET nor exact
command GET mutates commands in this baseline. Expiration and state-based
start/stop reconciliation run during heartbeat processing; this watcher cannot
force a pending row to expire merely by GET polling. `/commands/pending`
marks delivery and is deliberately never visited. No private source is imported
at installation or runtime.

| Requirement | October 8, 2026 evidence / status |
| --- | --- |
| Independent built-in installation | `npm ci` passed on Node 22.23.2 / Windows; own manifest/lock, no dependencies |
| Syntax | `npm run check` passed; source parsing only |
| Exact target and current-owner fencing | Source review: command `device_id` comparison and owner/generation checks around every read; runtime unverified |
| Selected report with honest lifecycle limits | Source review: fixed projection and physical/historical/atomic/upload evidence flags false |
| Bounded failure without command mutation | Source review: deadline/cap/body bounds, GET only, sanitized errors; failure-path runtime unverified |
| Hosted workflow | Configured for frozen installation and syntax only; result recorded in the repository review after integration |
| Public exact GET contract | Existing public route; this batch documents GET in the source reference/OpenAPI after baseline omission; publication/deployed compatibility unverified |
| Functional, live API and physical-device checks | Not run under the owner's creation-only instruction |
