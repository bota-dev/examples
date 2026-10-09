# Read project connection configuration (Node.js)

Read selected resolved connection gates, heartbeat gates, upload preference and
radio idle timeouts at the authenticated key's project level. The example makes
one public GET and prints a small JSON observation with evidence limits. It
applies no end-user/device override or local default and performs no
configuration write, upload, heartbeat send, SDK call or physical-device operation.

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
| `BOTA_API_BASE_URL` | Explicit independently trusted HTTPS origin ending in `/v1`; no URL credentials, query, fragment, controls or backslashes |
| `BOTA_API_KEY` | Server-held project secret or restricted key; restricted keys require **`config:read`**; device/upload tokens are rejected |
| `BOTA_PROJECT_ID` | Expected `proj_*` identity independently confirmed against the key's project; checks optional response metadata only |

**The API key selects the project.** Independently confirm that exact
key-to-project mapping in your trusted operator context before running. The
normal section response contains no `project_id`; this reader cannot discover
or independently prove the key's project. `BOTA_PROJECT_ID` neither selects
another project nor adds a workspace header. For a customer service,
authenticate its caller and derive the authorized project/key on the server.
Keep the privileged credential and API destination server-side; never accept
them from a browser/mobile caller or expose a generic configuration proxy.

## Request and selected output

The only request is **`GET /v1/config/connection`**, using the project's bearer
key. Accept the section directly as `{ value, source, definition }`, without an
all-sections `data` wrapper. `definition.merge_strategy` must be `merge_deep`
and `source` must be `default`, `organization` or `project`. An end-user/device
source is unsupported at this level. An available `project_id` must match the
configured expectation, an available `deleted_at` must be null, and optional
section identity markers must identify `connection`.

The JSON output's `selected_connection` contains only these required fields:

| Resolved field | Accepted value |
| --- | --- |
| `enabled_connections.wifi`, `.cellular` | Actual booleans for the configured direct-connection gates |
| `heartbeat_enabled_connections.wifi`, `.cellular` | Actual booleans for heartbeat-specific gates, still subject to their corresponding global connection gates |
| `upload_network_preference` | One to three entries from `wifi`, `ble`, `cellular`, preserving the returned order and repeats |
| `power_management.wifi_idle_timeout_seconds`, `.cellular_idle_timeout_seconds` | Safe canonical integers: `-1`, `0`, or `10` through `2540`, inclusive |

Missing selected fields, unsupported enum/source/merge values, non-boolean
gates, fractional/boolean timeouts and out-of-range timeouts fail before output.
No values are coerced and no default is supplied. Unselected fields and
definition contents are omitted. Output adds section `source`, project
resolution/evidence metadata, whether an optional project marker was present,
and false verification flags. No keys, full configuration, provider/profile
data, identifiers, serials, URLs or arbitrary API fields are printed. Protect
redirected `project-connection-config.json` as operational metadata and retain
or remove it under your own policy.

Idle timeout `-1` describes keeping the radio on indefinitely; `0` describes
power-down after current work completes; a positive value describes an idle
delay before power-down. The server write schema accepts legacy `1` through `9`
and normalizes them to `10` during validation. This GET reader requires the
canonical resolved range and does not normalize a stale/noncanonical response.
Released firmware represents positive values in 10-second units, rounding
down; positive multiples of 10 are needed for exact representation. This
program reports the returned seconds without rounding or asserting physical
timing.

Objects merge recursively in the reviewed resolver; nested arrays merge **by
index**. A shorter preference override can retain inherited tail entries and
produce duplicates. This reader preserves that actual resolved array without
deduplicating, sorting or recomputing inheritance. The separate device-update
write schema's uniqueness rule does not describe every resolved GET value.

Section `source` names the last level with a participating section override,
or `default`. Earlier levels can still contribute individual fields and array
entries. Output annotates it as
`last_section_override_level; not per-field provenance`.

Project resolution stops before end-user/device overrides. The selected
response supplies no applied settings revision, binding/assignment generation
or firmware acknowledgement. It does not establish an atomic hierarchy
snapshot, effective device policy, heartbeat delivery, radio availability,
upload activity, reachability, hardware bands/services or policy enforcement.
The target capability-bounded, versioned effective policy and applied
acknowledgement remain separate design work; this legacy section reader
implements neither. Output labels its evidence `resolved_cloud_configuration`
and sets `atomic_snapshot`, `effective_device_configuration_verified`,
`device_applied_state_verified`, `applied_generation_verified`,
`physical_connection_availability_verified`, `heartbeat_delivery_verified`
and `connection_policy_enforcement_verified` to `false`.

## Bounds, failures and checks

The operation has a **30-second** monotonic budget. Its single request, headers
and body read additionally have at most **10 seconds**, with a **1 MiB** response
cap. Only HTTP 200 and uncompressed JSON decoded as fatal UTF-8 are accepted;
JSON numbers must be finite. Node's JSON parser retains the last occurrence of
duplicate object keys. These asynchronous limits cannot guarantee scheduling
during OS suspension or a blocked event loop. There are no redirects or
automatic retries.

Exit **0** emits the validated observation. Exit **1** prints sanitized stderr
and emits no settings for configuration, HTTP, transport, deadline, schema or
identity failure. Raw upstream bodies, exception messages and credentials are
never logged. Resolve access or compatibility explicitly before deliberately
requesting another GET observation. Failures must not trigger local fallback
values or a configuration write. No resources are created, so cloud/device
cleanup is unnecessary.

The local checks are `npm ci` and `npm run check` (`node --check index.mjs`).
The path-filtered
[`project-connection-config-node.yml`](../../.github/workflows/project-connection-config-node.yml)
uses Node 22.23.2, commit-pinned actions, checkout credential persistence
disabled, `contents: read`, main push/PR filters and manual dispatch. Its
five-minute job performs only frozen installation and source syntax checking,
without API secrets, runtime tests or device access.

## Contracts and design review

Public contracts: [Hierarchical Configuration](https://docs.bota.dev/guides/hierarchical-config),
[authentication](https://docs.bota.dev/authentication),
[device settings](https://docs.bota.dev/api-reference/devices/update) and
[OpenAPI](https://github.com/bota-dev/docs/blob/main/api-reference/openapi.json)
`/config/{section}` and `DeviceSettings.connection`. The OpenAPI single-section
response is generic; the direct envelope is established by the guide and the
reviewed controller. The public documentation checkout was
`7114baf52c6783fdd41224d00ca029c9e3ca101c`.

Read-only backend source review at
`1ac67c92c6d72858e29dc264037cb82b6c449825` covered
[`config/index.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/index.ts),
[`config/controller.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/controller.ts),
[`definitions/connection.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/definitions/connection.ts),
[`hierarchy.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/hierarchy.ts),
[`config.service.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/services/config.service.ts)
and [`auth.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/middleware/auth.ts).
The config route explicitly requires `config:read`, derives the project from
authenticated context, and rejects non-secret/non-restricted token types.
Secret keys have full access; restricted keys must hold that scope. The response
normally has description/merge metadata, with no project/section identity or
generation marker. This source boundary does not authenticate a customer
application's caller, prove the operator's configured key mapping, or prove the
deployed server runs the reviewed revision. Private maintainer links are review
evidence only; the example does not depend on private source at runtime.

The compound-engineering 1.2.9 review used the
[repository architecture](../../ARCHITECTURE.md), public contracts and the
current Connection Management design's API-model, power-management and target
applied-acknowledgement sections. Requirement-to-source evidence on
**October 9, 2026 (Pacific)**:

| Requirement | Implementation/source evidence | Status / remaining verification |
| --- | --- | --- |
| Independent installation | Own manifest/lock, built-in-only `index.mjs`; `npm ci` on Node 22.23.2 / Windows | Matched locally; clean run unverified |
| Correct project route and credential boundary | `configuration`, fixed `/config/connection`; router's `config:read` and auth-derived project | Matched by source review; live authorization rejection and key mapping unverified |
| Direct section and actual required fields | `selectConnection`, exact source/merge, optional marker, gate/enum/canonical range checks | Matched by source review; deployed shapes unverified |
| Server order and provenance preserved | Array copied unchanged, repeats allowed, section-level source annotation, no local merge/defaults | Matched by source review; runtime inheritance unverified |
| Applied policy and generation limits | Constant false flags and no firmware/SDK path; target acknowledgement remains separate | Partial relative to broader target design; no applied-state evidence claimed |
| Bounded safe read | One GET, 10/30-second budgets, 1 MiB, finite UTF-8 JSON, no redirects/retries, sanitized errors | Matched by source review; network/failure behavior unverified |
| Source syntax | `npm run check` on Node 22.23.2 / Windows | Passed locally; no example code executed |
| Workflow | YAML parsing and manual source inspection; SHA pins match existing reviewed workflows | Matched statically; hosted CI not run in this creation pass |
| Functional/live/device acceptance | Creation-only instruction | Unverified; no unit/functional/live/device checks added or run |

For device-owned resolution with separate ownership reads, see the independent
[Python connection reader](../connection-config-python/README.md). This project
reader never selects an end user or device.
