# Read upload configuration (Node.js)

Read selected effective cloud upload settings for one already-bound device owned
by a fixed end user. This standalone example uses Node.js built-ins and public
GET endpoints. It prints a narrow JSON projection without changing configuration,
uploading recordings, issuing device commands or accessing physical hardware.

Status, **2026-10-08**: implemented with independent installation, syntax checks
and source review. Runtime, functional, live API and physical-device acceptance
are unverified. The owner requested creation without tests or runtime CLI/live
calls; no unit/functional tests were added or run.

## Setup

Use **Node.js 22.23.2 or newer** on Windows, macOS or Linux. There are no runtime
dependencies, Bota SDK packages or sibling-repository imports. Copy this
directory or work here from the repository root:

```sh
cd api/upload-config-node
npm ci
```

Copy `.env.example` to a local `.env`, or supply variables through the process
environment. `npm start` loads `.env` if present. Keep keys in a secret manager
for hosted operation; `.env` is ignored by Git.

| Variable | Meaning and trust boundary |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS destination ending in `/v1`, normally `https://api.bota.dev/v1`. No URL credentials, query or fragment; never derive it from an app caller. |
| `BOTA_API_KEY` | Server-held project `sk_test_*`, `sk_live_*` or `rk_*` key. Restricted keys require **`devices:read` and `config:read`**. |
| `BOTA_PROJECT_ID` | Fixed expected `proj_*` project. API key authorization supplies project scope; this value cannot switch projects. |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` owner configured by the operator. |
| `BOTA_DEVICE_ID` | Exact existing `dev_*` device expected to be currently bound to that owner. |

No real identifiers or keys are bundled. After configuring these values:

```sh
npm start
```

This is a server/CLI workflow. For an app-facing service, derive project and
end-user scope from verified caller identity and authorize each selected device
before returning the narrow projection. Keep both API key and destination on
the server; do not build an arbitrary privileged configuration proxy.

## Requests and output

The program makes exactly three requests, once each, before emitting output:

1. `GET /v1/devices/{id}` requires the exact device ID, configured end-user owner
   and `bound` status. If `deleted_at` exists it must be exactly `null`; if
   `project_id` exists it must exactly match the expected project.
2. `GET /v1/devices/{id}/config/upload` reads the section directly as
   **`{ value, source, definition }`**. It does not use the all-sections `data`
   wrapper. An optional returned project identity is checked too.
3. Repeat the owned-device GET and all ownership/deletion/project checks before
   printing. Available `binding_generation` values must be nonnegative safe
   integers and equal across the two device responses. A generation appearing
   or disappearing also rejects the observation.

Public device responses may omit project, deletion and generation metadata;
the project-scoped key and GET authorization remain the API trust boundary.
Absent generation metadata is accepted, but cannot establish that no rebind
occurred. Even matching generations and owners are separate observations:
ownership or configuration can change between requests. This is **not an atomic
snapshot**, continuous ownership proof or historical policy audit.

`selected_upload` contains only these documented values:

| Field | Accepted metadata |
| --- | --- |
| `streaming_enabled` | Actual boolean |
| `streaming_chunk_kb` | Safe integer, `64`–`1024` |
| `streaming_flush_interval_seconds` | Safe integer, `0`–`255`; `0` disables time-based partial-chunk flushing in the documented setting |
| `daily_data_limit_mb` | Safe integer, `0`–`10000`; resolver caveat below |
| `allow_roaming` | Actual boolean |
| `pause_on_low_battery` | Actual boolean |
| `off_peak_hours` | `null`, or selected `enabled`, `start`, `end`, `timezone` metadata |

All selected fields must be present and valid. Non-finite numbers, fractions,
out-of-range integers, missing values and string substitutes for booleans fail
closed. A schedule object requires an actual boolean `enabled`, valid `HH:MM`
start/end times, and a 1–64 character timezone identifier containing only ASCII
letters, digits, `_`, `+`, `-` and `/`-separated nonempty components. No controls
or whitespace are accepted. This intentionally narrower output policy can
reject strings the API stores; it does not validate an IANA zone or calculate
an upload schedule. Unknown fields in the section and schedule are ignored.

`source` must be `default`, `organization`, `project`, `end_user` or `device`.
It identifies the last participating **section** override level. Deep merging
and field-specific merging can retain other levels' contributions, so the
output's `source_meaning` explicitly says it is not per-field provenance.
`definition.merge_strategy` must be `merge_deep`; definition text/defaults and
arbitrary API response content are not printed.

Output labels its evidence `resolved_cloud_configuration` and sets
`atomic_snapshot`, `device_applied_state_verified` and
`upload_execution_verified` to `false`. It supplies no integrity evidence,
completion receipt, upload success proof or permission to delete device data.

## Compatibility limits

The current public guide documents these released compatibility-firmware gaps:

- `streaming_chunk_kb` is stored and resolved, but firmware uses a **512 KB
  full-chunk target** regardless of that value. Timer/final flushes can be smaller.
- `daily_data_limit_mb`, `allow_roaming`, `pause_on_low_battery` and
  `off_peak_hours` are stored targets that released compatibility firmware does
  **not enforce**. This example cannot establish applied streaming settings
  either; it observes only the API's resolved values.
- `daily_data_limit_mb` uses the numeric minimum across the built-in **500 MB**
  default and applicable overrides. The schema describes `0` as unlimited,
  while the resolver still treats it as the numeric minimum. The example prints
  the returned number unchanged and never interprets it as an enforced quota or
  recomputes inheritance. Avoid the `0` sentinel when a positive descendant
  value must win.

The upload section does not describe the separate `upload_security` policy,
prove transport availability, or establish a recording's upload lifecycle.
No firmware enforcement, integrity or cleanup acceptance is claimed.

## Failure and recovery

All three reads share a 30-second elapsed-time budget. Each request has an abort
signal capped at 10 seconds, covering its headers and streamed body. Responses
must be uncompressed UTF-8 JSON, with a **1 MiB** body cap. A suspended process or
OS/network teardown can delay wall-clock termination; this is bounded request
logic, not a hard real-time guarantee.

Redirects and automatic retries are rejected. Error bodies, authorization
headers, URL details and arbitrary exception messages are never logged. The
program writes no response files and emits selected JSON only after all checks.
HTTP, shape, ownership, generation or deadline failure exits nonzero. Check the
trusted configuration, API scopes, current ownership or network and deliberately
rerun the same GET-only observation when ready. No cleanup is needed.

## Checks and design review

Installation and syntax checking do not execute the CLI or call the API:

```sh
npm ci
npm run check
```

The path-filtered
[`upload-config-node.yml`](../../.github/workflows/upload-config-node.yml)
uses Node 22.23.2, commit-pinned checkout/setup actions, disabled checkout
credential persistence and read-only repository permissions. It installs only
this example and checks syntax; no API credentials, runtime or device tests are
configured.

The compound-engineering **1.2.9** review on **2026-10-08** compared the
[repository architecture](../../ARCHITECTURE.md), public
[Hierarchical Configuration guide](https://docs.bota.dev/guides/hierarchical-config),
[device settings reference](https://docs.bota.dev/api-reference/devices/update)
and [OpenAPI](https://github.com/bota-dev/docs/blob/main/api-reference/openapi.json)
with the implementation. Reviewed documentation checkout: `c730fb50`; backend
`1ac67c92` was inspected read-only for the public controller, resolver, route
scopes and upload definition. Private sources are review evidence, not reader
dependencies.

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Independent public GET workflow | Own manifest/lockfile, built-in `fetch`; exact upload path between two owner reads | Matched by source review; runtime unverified |
| Server credential/fixed scope | Explicit HTTPS configuration; exact project/owner/device checks, strict absent-or-null deletion, observed generation equality | Matched by source review; authorization/rebind rejection unverified |
| Public response/types | Direct section envelope; known booleans, safe integer ranges and schedule projection | Matched by public/backend source review; deployed response unverified |
| Safe timezone output | Bounded ASCII identifier; API permits broader nonempty strings | Intentionally narrower example output policy; runtime rejection unverified |
| Source/compatibility interpretation | Section-level provenance label; fixed firmware chunk and unenforced policy/min-zero limits above | Matched by source/document review; no firmware or lifecycle acceptance |
| Bounded failures/no mutation | GET only, no retries/redirects, shared deadline, 1 MiB cap, selected output and static errors | Matched by source review; runtime/network failure paths unverified |
| Install and syntax | `npm ci`, `npm run check` on Node 22.23.2 / Windows | Passed locally; no CLI functions executed |
| Formatting | Scoped `git diff --check` | Passed locally |
| Hosted CI | Install/syntax [passed at source `2752a79`](https://github.com/bota-dev/examples/actions/runs/37887199914) | Installation/compilation only |
| Unit/functional/live/device acceptance | Creation-only instruction | Not run; advertised runtime success/failure remains unverified |

Token searches for upload fields, route/envelope semantics and the new example
path covered internal/public docs and repository instruction/overview files.
The cited guides already preserve these compatibility limits; this example
adds no platform behavior. Broader device/upload targets remain separate gates.
