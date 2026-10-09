# Credential-free API health probe (Python)

Learn to make one bounded, credential-free `GET /health` and report the server's
database health result using Python's standard library. A supported response
produces selected status fields and observation times. It supplies no evidence
about authenticated resource APIs, storage operations, queues, AI providers,
physical devices, whole-system availability, sustained uptime or SLA compliance.

Status, **2026-10-09 Pacific**: implemented with source review and syntax checks
only. Unit, functional, runtime, live API and physical-device acceptance are
unverified. The owner requested creation without those tests or API execution;
none were added or run.

## Prerequisites and configuration

- Python 3.12 or newer on Windows, macOS or Linux. No dependency installation,
  Bota SDK package, manifest, sibling helper or physical hardware is required.
- An operator-approved, trusted HTTPS API origin. Use the destination approved
  for your environment; the public API status page identifies
  `https://api.bota.dev/health`. Do not accept an arbitrary origin from a caller.
- No API key, cookie, authorization header, project, end-user, device or recording
  identifier is configured or used. This endpoint sits outside `/v1`.

Work from this directory. [.env.example](.env.example) contains only a placeholder
process-environment template; the program does **not** load `.env` files. Set the
one variable directly in the process environment before running.

| Variable | Meaning and trust boundary |
| --- | --- |
| `BOTA_API_ORIGIN` | Explicit trusted HTTPS origin root, such as `https://api.bota.dev`, optionally with a port and one trailing `/`. Use an ASCII DNS host or unscoped bracketed IPv6 address. At most 2,048 ASCII characters; no URL credentials, non-root path, controls, whitespace, backslash, query or fragment delimiters, including empty `?` or `#`. No default destination is supplied. |

The program reads only `BOTA_API_ORIGIN` from the environment. It never reads,
loads or forwards API keys or cookies, uses no cookie jar and makes no resource
requests. TLS certificate verification uses Python's default HTTPS transport.

After approving the origin, run on Windows from the repository root:

```powershell
cd api/api-health-python
$env:BOTA_API_ORIGIN = 'https://api.bota.dev'
py -3.12 main.py
```

On macOS/Linux:

```sh
cd api/api-health-python
BOTA_API_ORIGIN=https://api.bota.dev python3 main.py
```

A copied standalone directory can run directly with the same process variable.
The sample URL is a public contract reference, not evidence of a live check.

## Request and output contract

After local validation, the program makes exactly one `GET /health` to the
configured origin. It sends `Accept: application/json` and
`Accept-Encoding: identity`, with no authentication. It does not send a request
to `/v1/health`, follow redirects, retry, poll, schedule or create automation.

The [public API status documentation](https://docs.bota.dev/api-reference/api-status)
documents the root endpoint and broadly describes `200 OK` as operational.
This example additionally validates a **source-specific** response profile from
[`api/src/server.ts` at `1ac67c92`](https://github.com/bota-dev/bota/blob/1ac67c92c6d72858e29dc264037cb82b6c449825/api/src/server.ts#L126):

| HTTP status | Required response | Exit code |
| --- | --- | --- |
| `200` | Exactly `status: "healthy"`, `database: "connected"`, and `billing: "enabled"` or `"disabled"` | `0` |
| `503` | Exactly `status: "unhealthy"`, `database: "disconnected"`, and the same known billing choices | `2` |
| Any other status, unsupported shape or transport failure | No supported report is emitted | `1` |

The source's
[`healthCheck()`](https://github.com/bota-dev/bota/blob/1ac67c92c6d72858e29dc264037cb82b6c449825/api/src/config/database.ts#L59)
attempts `SELECT 1`. The pairing of HTTP status and database/status fields is
checked; missing, extra or unsupported fields fail. The billing value is
validated for compatibility and omitted from output. This profile is not a
claim that a deployed server matches that source or a new public schema promise.

The selected JSON output contains `selected_report.status`,
`selected_report.database`, `http_status`, local `observed_at_utc` and
`elapsed_seconds`, plus an evidence label and explicit `false` verification
flags for whole-system availability, storage, authenticated APIs, queues,
providers, devices and sustained uptime. Observation time is recorded locally
after the response; it is not a server timestamp. No origin, arbitrary response
content, headers, billing details or resource identifiers are printed.

A single supported healthy report means only that this server reported its
database check successful at that observation. It cannot establish complete API
availability, historical or future health, processing success, storage access,
device connectivity or an availability percentage.

## Bounds, failures and recovery

The single request has a 10-second request budget within a 30-second total
elapsed budget. Socket timeouts and a connected-transport timer interrupt slow
headers or body streams; parsing and final output are checked against the total
budget. OS DNS resolution is outside Python's socket-timeout control and can
delay termination beyond these budgets. This is not a universal hard deadline.

Responses must declare `application/json`, use identity encoding, contain at
most 64 KiB, and be strict UTF-8 JSON without duplicate keys, nonstandard
constants or nonfinite numbers, including overflowing exponents. Unsupported
HTTP statuses are rejected without logging their body. Errors use fixed safe
messages and expose no raw exceptions, response bodies or destination.

Exit `2` preserves a known unhealthy server report for a caller to inspect;
exit `1` means the probe could not establish the supported report. Check the
trusted origin, environment and network, then deliberately rerun when ready.
No cloud resources, files or device recordings are created, so cleanup is
unnecessary. Keep a customer-facing adaptation's destination operator-controlled
and preserve these evidence limits; introducing a scheduler or wider health
checks is a separate task.

## Checks and design review

Compile source without executing the CLI or any probe function:

```sh
python3 -m py_compile main.py
```

Windows equivalent: `py -3.12 -m py_compile main.py`. The independent
[`api-health-python.yml`](../../.github/workflows/api-health-python.yml) uses
Ubuntu 24.04, a full-SHA checkout with credential persistence disabled,
`contents: read`, main/PR path filters, a manual trigger and a five-minute
syntax-only job. It prints the runner Python version and compiles source; it
has no API credentials or network probe. Python comes from the runner image
rather than an independently pinned setup action. The workflow-generator
reference/validator resources were unavailable; parsed YAML and manual review
are the fallback, not hosted CI evidence.

The compound-engineering 1.2.9 review compared the repository architecture,
public health documentation and the exact backend source on **2026-10-09
Pacific**:

| Requirement | Source evidence | Status / remaining verification |
| --- | --- | --- |
| Independent credential-free root GET | `read_origin()` reads only the origin; `read_health()` has one HTTPS `GET /health` with no auth/cookie facility | Matched by source review; runtime request acceptance unverified |
| Explicit trusted root origin | HTTPS/root/length/ASCII/host validation rejects URL credentials and delimiter, control or backslash input | Matched by source review; malformed-input execution not run |
| Source-specific health mapping | Exact three-field shape, known billing choices and `200`/`503` status correspondence in `read_health()` | Matched against `server.ts`; deployed profile and both runtime outcomes unverified |
| Bounded strict JSON and no retries | 10-second connected request interruption, 30-second total checks, 64 KiB read cap, strict UTF-8/duplicate/finite parsing, no redirect or retry path | Matched by source review; DNS caveat retained; timeout/failure execution unverified |
| Narrow evidence | Selected database/status projection and local times; broader verification flags false; no billing/URL/error payload output | Matched by source review; output execution unverified |
| Syntax and CI structure | Python compilation and Node 22.23.2 YAML parsing; workflow uses verified repository checkout SHA | Local checks and exact-source hosted syntax passed; see delivery evidence below |

| Check / compatibility | Evidence on 2026-10-09 Pacific |
| --- | --- |
| Python 3.12 standard-library compilation | `py_compile` passed with bundled Python 3.12.14 on Windows |
| Workflow YAML / source review | YAML parsed with the existing `yaml` package under Node 22.23.2; source reviewed against the pinned backend and public root path |
| Runtime, unit and functional tests | Not run under the creation-only instruction |
| Live API, physical device or sustained uptime | Not run; no acceptance or SLA claim |

Changed-token documentation review covers `api-health-python`,
`BOTA_API_ORIGIN` and `/health`. The existing public API-status page and parent
catalog/architecture entries are the affected overview surfaces; integration
updates are owned by the parent task. This example adds no backend, protocol,
SDK or production design change.

## Hosted syntax evidence

Implementation `6a50f36586212f5c388843a068a90c3f96c23b96` was pushed directly to examples
`main`. GitHub APIs confirmed the [run](https://github.com/bota-dev/examples/actions/runs/38003676933) and
[job](https://github.com/bota-dev/examples/actions/runs/38003676933/job/114067435642) completed successfully at that exact source.
This establishes Python syntax compilation only; no example, functional,
live API, filesystem, consumer or device acceptance was executed. The later
evidence update changes documentation only.
