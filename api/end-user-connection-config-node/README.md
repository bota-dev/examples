# Read end-user connection configuration (Node.js)

Read selected resolved connection gates, heartbeat gates, upload preference and
radio idle timeouts for one authorized existing end user. Three public GETs
observe the connection section between exact end-user identity checks. The
result is a small JSON projection of current cloud configuration and its
section source. The example performs no configuration write, upload, heartbeat
send, SDK call or physical-device operation.

**Status, October 9, 2026 (Pacific):** implemented with source review and syntax
checks only. Runtime, authorization rejection, deployed API compatibility and
physical/enforcement acceptance remain unverified. No example CLI, function,
unit/functional test, live API or device execution occurred in this creation pass.

## Setup and configuration

Use **Node.js 22.23.2 or newer** on Windows, macOS or Linux. This directory owns
its manifest and lockfile and uses Node built-ins only. No SDK, root workspace
install, hardware, firmware version or sibling repository is required.

Run from this directory:

```sh
npm ci
cp .env.example .env
# Replace placeholders privately or inject trusted server environment values.
npm run check
npm start
```

On PowerShell use `Copy-Item .env.example .env`. `npm start` loads `.env` if
present; process environment values take precedence. Keep `.env` private or use
your server secret manager. `npm run check` parses source without credentials,
network access or example execution.

| Variable | Meaning and trust boundary |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit independently trusted HTTPS destination ending in `/v1`; no URL credentials, query, fragment, controls or backslashes |
| `BOTA_API_KEY` | Server-held project secret or restricted key; restricted keys need documented **`end_users:read`** and **`config:read`** scopes; device/upload tokens are rejected |
| `BOTA_PROJECT_ID` | Exact expected `proj_*` identity independently confirmed against the key's project; an assertion, not a project selector |
| `BOTA_END_USER_ID` | Exact operator-authorized existing `eu_*` identity; no external-ID lookup or device selection |

**The API key selects the project.** Independently confirm its exact project
mapping and authority to inspect this end user before running. Optional
response metadata is checked when available; a client-supplied ID is not
authorization. For a customer service, authenticate its caller and derive the
authorized project/key/end-user mapping on the server. Keep the privileged
credential and API destination server-side; do not accept them from a
browser/mobile caller or expose an arbitrary privileged configuration proxy.

## Request and selected output

Each successful invocation makes exactly three requests in this order:

1. **`GET /v1/end-users/{id}`**: require the exact configured `id`; reject any
   returned `project_id` mismatch and any non-null `deleted_at` marker.
2. **`GET /v1/end-users/{id}/config/connection`**: require the direct
   `{ value, source, definition }` section, `merge_deep` strategy and all selected
   fields below. An available project or end-user marker must match, an
   available deletion marker must be null, and optional section identity
   markers must identify `connection`.
3. Repeat the exact end-user checks before printing any settings.

If either end-user response includes `project_assignment_generation`, it must
be a nonnegative safe integer. Its presence and value must match across both
observations; changed, appearing/disappearing, null or malformed values fail.
If both omit it, the read is permitted with
`assignment_generation_observed: false`. This project-assignment metadata is
distinct from device binding generation. The public end-user GET documentation
currently omits it; tracked backend source returns it. No generation is
invented, inferred or emitted.

The JSON output's `selected_connection` contains only these required fields:

| Resolved field | Accepted value |
| --- | --- |
| `enabled_connections.wifi`, `.cellular` | Actual booleans for configured direct-connection gates |
| `heartbeat_enabled_connections.wifi`, `.cellular` | Actual booleans for heartbeat-specific gates, still subject to their corresponding global connection gates |
| `upload_network_preference` | One to three entries from `wifi`, `ble`, `cellular`, preserving returned order and repeats |
| `power_management.wifi_idle_timeout_seconds`, `.cellular_idle_timeout_seconds` | Safe canonical integers: `-1`, `0`, or `10` through `2540`, inclusive |

Missing selected fields, unsupported enum/source/merge values, non-boolean
gates, fractional/boolean timeouts and out-of-range timeouts fail before output.
No values are coerced, normalized or supplied from local defaults. Unselected
fields and definition contents are omitted. Unknown extra fields are ignored,
not approved as safe output. Output adds section `source`, end-user
resolution/evidence metadata, assignment-generation availability and false
verification flags. No keys, profile data, full configuration, identifiers,
serials, URLs or arbitrary API fields are printed. Protect redirected
`end-user-connection-config.json` as operational metadata and retain or remove
it under your own policy.

Idle timeout `-1` describes keeping the radio on indefinitely; `0` describes
power-down after current work completes; a positive value describes an idle
delay before power-down. The server write schema accepts legacy `1` through `9`
and normalizes them to `10` during validation. This GET reader requires the
canonical resolved range and rejects a stale/noncanonical response. Released
firmware represents positive values in 10-second units, rounding down; positive
multiples of 10 are needed for exact representation. This program preserves the
returned seconds without rounding or asserting physical timing.

Objects merge recursively in the reviewed resolver; nested arrays merge **by
index**. A shorter preference override can retain inherited tail entries and
produce duplicates. This reader preserves that actual resolved array without
deduplicating, sorting or recomputing inheritance. The separate device-update
write schema's uniqueness rule does not describe every resolved GET value.

`source` must be `default`, `organization`, `project` or `end_user`. It names the
last level with a participating **section** override, or `default`. Earlier
levels can still contribute fields and array entries; it is annotated as
`last_section_override_level; not per-field provenance`. A `device` source is
rejected because end-user resolution stops before device overrides.

The before/after reads are not an atomic snapshot or proof of uninterrupted
ownership. The config response exposes no assignment generation or revision to
correlate with those reads. Available generation stability detects only changes
visible in these two observations; it does not prove connection-override
generation enforcement. The tracked resolver fences the child's current
project and deletion state; its special generation filtering applies to
`processing` overrides, not to this connection section.

The response supplies no applied settings revision, device acknowledgement or
effective device policy. It does not establish heartbeat delivery, radio
availability, upload activity, reachability, hardware bands/services or policy
enforcement. The target capability-bounded, versioned effective policy and
applied acknowledgement remain separate design work. Output labels its evidence
`resolved_cloud_end_user_configuration` and sets `includes_device_overrides`,
`atomic_snapshot`, `effective_device_configuration_verified`,
`device_applied_state_verified`, `applied_generation_verified`,
`physical_connection_availability_verified`, `heartbeat_delivery_verified` and
`connection_policy_enforcement_verified` to `false`.

## Bounds, failures and checks

The three requests share a **30-second** monotonic budget. Each request,
headers and body read additionally has at most **10 seconds**, with a **1 MiB**
response cap. Only HTTP 200 and uncompressed JSON decoded as fatal UTF-8 are
accepted; JSON numbers must be finite. Node's JSON parser retains the last
occurrence of duplicate object keys. These asynchronous limits cannot guarantee
scheduling during OS suspension or a blocked event loop. There are no redirects
or automatic retries.

Exit **0** emits the validated observation. Exit **1** prints sanitized stderr
and emits no settings for configuration, HTTP, transport, deadline, schema,
generation or identity failure. Raw upstream bodies, exception messages and
credentials are never logged. Resolve access or compatibility explicitly before
deliberately requesting another GET observation. Failure does not select
fallback values or authorize writes. No cloud or device cleanup is necessary.

The local checks are `npm ci` and `npm run check` (`node --check index.mjs`).
The path-filtered
[`end-user-connection-config-node.yml`](../../.github/workflows/end-user-connection-config-node.yml)
uses Node 22.23.2, commit-pinned actions, checkout credential persistence
disabled, `contents: read`, main push/PR filters and manual dispatch. Its
five-minute job performs only frozen installation and source syntax checking,
without API secrets, runtime tests or device access.

## Contracts and design review

Public contracts: [Hierarchical Configuration](https://docs.bota.dev/guides/hierarchical-config),
[Get End User](https://docs.bota.dev/api-reference/end-users/get),
[authentication](https://docs.bota.dev/authentication),
[device settings](https://docs.bota.dev/api-reference/devices/update) and
[OpenAPI](https://github.com/bota-dev/docs/blob/main/api-reference/openapi.json)
`/end-users/{id}/config/{section}` and `DeviceSettings.connection`. The OpenAPI
single-section response is generic; the direct envelope is established by the
guide and reviewed controller. Reviewed public documentation checkout:
`7114baf52c6783fdd41224d00ca029c9e3ca101c`.

Read-only backend review at
`1ac67c92c6d72858e29dc264037cb82b6c449825` covered
[`end-users/index.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/end-users/index.ts),
[`end-users/controller.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/end-users/controller.ts),
[`end-user.repository.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/repositories/end-user.repository.ts),
[`config/controller.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/controller.ts),
[`definitions/connection.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/definitions/connection.ts),
[`config.service.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/services/config.service.ts)
and [`entity-config.repository.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/repositories/entity-config.repository.ts).
These private maintainer links are source evidence, not runtime prerequisites or
proof that the deployed API runs the reviewed revision.

The tracked end-user GET is project-scoped but lacks an explicit
`end_users:read` middleware guard, although its public contract requires that
scope. The section route explicitly requires `config:read` and resolves against
the authenticated expected project. The example still requires both documented
scopes operationally; it cannot inspect key scopes or repair server enforcement.
That scope discrepancy is a separate platform follow-up, not an example
permission guarantee or caller-authorization mechanism.

The compound-engineering 1.2.9 review used the
[repository architecture](../../ARCHITECTURE.md), public contracts and the
current Connection Management design's API-model, power-management and target
applied-acknowledgement sections. Requirement-to-source evidence on
**October 9, 2026 (Pacific)**:

| Requirement | Implementation/source evidence | Status / remaining verification |
| --- | --- | --- |
| Independent installation | Own manifest/lock and built-in-only `index.mjs`; `npm ci` on Node 22.23.2 / Windows | Matched locally; standalone execution unverified |
| Exact end-user/project observations | `checkEndUser` twice, optional project/deletion checks and available assignment-generation presence/value comparison | Matched by source review; continuous ownership and live rejection unverified |
| End-user section and selected fields | Fixed connection path, `selectConnection`, source/merge, required booleans, preference and canonical timeout checks | Matched by public/source review; deployed shape unverified |
| Server values and provenance retained | Array copied unchanged with repeats; no local inheritance, normalization or defaults; section-level source annotation | Matched by source review; runtime inheritance unverified |
| Connection policy and generation limits | No device/SDK path; explicit false flags; response revision/acknowledgement absent | Partial relative to broader target design; applied policy and connection-generation enforcement unverified |
| Bounded safe reads | Three GETs, 10/30-second budgets, 1 MiB each, finite UTF-8 JSON, no redirects/retries, sanitized errors | Matched by source review; runtime failure behavior unverified |
| Source syntax | `npm run check` on Node 22.23.2 / Windows | Passed locally; no example code executed |
| Workflow | YAML parsing and manual source inspection; SHA pins match existing reviewed workflows | Matched statically; hosted syntax passed; see delivery evidence below |
| Independent peer source review | Parent agent source review; explicit empty query/fragment delimiters are rejected | No source blockers after correction; runtime acceptance unverified |
| Functional/live/device acceptance | Creation-only instruction | Unverified; no unit/functional/live/device checks added or run |

For other scopes, see the independent [project reader](../project-connection-config-node/README.md)
and [device reader](../connection-config-python/README.md). End-user observations
do not include any owned device's overrides or applied state.

## Hosted syntax evidence

Implementation `6a50f36586212f5c388843a068a90c3f96c23b96` was pushed directly to examples
`main`. GitHub APIs confirmed the [run](https://github.com/bota-dev/examples/actions/runs/38003677041) and
[job](https://github.com/bota-dev/examples/actions/runs/38003677041/job/114067436052) completed successfully at that exact source.
This establishes frozen installation and JavaScript syntax only; no example, functional,
live API, filesystem, consumer or device acceptance was executed. The later
evidence update changes documentation only.
