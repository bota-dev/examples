# Read connection configuration (Python)

Learn to read selected resolved cloud connection settings for one already-bound,
owned device using Python's standard library and public API GETs. The expected
result is a small JSON projection of connection gates, heartbeat gates, upload
preference and idle timeouts. The example changes no configuration and performs
no physical-device operations.

Status, **2026-10-08**: implemented with syntax compilation and source review
only. Runtime, functional, live API and physical-device acceptance are
unverified. The owner requested creation without unit, functional, live or
device tests; none were added or run.

## Prerequisites and configuration

- Python 3.12 or newer on Windows, macOS or Linux. There are no dependencies to
  install, Bota SDK packages, manifests or sibling-runtime imports.
- A trusted HTTPS Bota API environment and its server-side project
  secret/restricted API key. Restricted keys need **`devices:read` and
  `config:read`**.
- Operator-configured expected project, end user and existing device identities.
  The device must currently be bound to that end user. Hardware access and a
  firmware version are unnecessary for this cloud read.

Work from this directory. `.env.example` lists the required process variables;
the program does **not** load `.env` files. Set values in the process environment
through your secret manager or local shell before running. Never commit keys.

| Variable | Meaning and trust boundary |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS destination ending in `/v1`, normally `https://api.bota.dev/v1`; no credentials, query or fragment. Never accept this URL from an app caller. |
| `BOTA_API_KEY` | Project `sk_test_*`, `sk_live_*` or restricted `rk_*` key with the two read scopes. Server/CLI only. |
| `BOTA_PROJECT_ID` | Fixed expected `proj_*` identity; the key supplies API project scope. |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` owner, selected by the operator. |
| `BOTA_DEVICE_ID` | Exact existing `dev_*` device selected by the operator. No physical identity is bundled. |

After supplying the environment, run on Windows:

```powershell
cd api/connection-config-python
py -3.12 main.py
```

On macOS/Linux:

```sh
cd api/connection-config-python
python3 main.py
```

The paths above start at the repository root; a copied standalone directory can
run directly with its configured environment. The key must belong to the
configured project; optional returned `project_id` fields are additional
checks, not a mechanism to select or switch projects. This is an operator CLI;
a customer application must keep the key and destination server-side, derive
scope from authenticated caller mappings and authorize each requested device.

## Read and output contract

The program makes these requests once each, in order:

1. `GET /v1/devices/{id}`: require the exact device ID, exact configured end-user
   owner and `bound` status. Reject a non-null `deleted_at` marker and any
   returned project mismatch. Public device schemas may omit those two fields;
   the project-scoped API key and GET authorization remain the scope boundary.
2. **One** `GET /v1/devices/{id}/config/connection`: accept the section directly
   as `{ value, source, definition }`. The all-sections endpoint's `data` wrapper
   is not used.
3. Repeat the owned-device GET checks before printing anything.

The output is explicitly named `selected_connection` and includes only:

| Resolved field | Accepted value / meaning |
| --- | --- |
| `enabled_connections.wifi`, `.cellular` | Actual booleans describing configured connection gates. |
| `heartbeat_enabled_connections.wifi`, `.cellular` | Actual booleans describing heartbeat-specific gates, still subject to the corresponding global connection gate. |
| `upload_network_preference` | One to three documented strings: `wifi`, `ble`, `cellular`, in their returned order. |
| `power_management.wifi_idle_timeout_seconds`, `.cellular_idle_timeout_seconds` | Canonical integers: `-1`, `0`, or `10` through `2540`, inclusive. |

All these fields must be present in the resolved value; this example invents no
defaults. Unknown fields, arbitrary metadata, credential values, URLs and
definition/default contents are not printed. Invalid known fields stop the run
before selected output is emitted. Boolean and fractional timeout values are
rejected rather than coerced.

Idle timeout `-1` means keep the radio on indefinitely; `0` means power down
immediately after current work completes; a canonical positive value means wait
that many idle seconds before power-down. The documented write schema accepts
legacy `1` through `9` and normalizes them to `10`; this reader requires the
canonical resolved range. Released firmware represents positive timeouts in
10-second units, rounding down, so positive multiples of 10 are needed for exact
representation. This program reports the server value without predicting or
checking physical timing.

`definition.merge_strategy` must be `merge_deep`. Objects merge recursively;
nested arrays currently merge **by index**. A shorter preference override can
retain inherited tail entries and introduce repeated connection types. The
reader preserves the actual resolved array, including repeats; it neither
deduplicates nor treats it as an array-replacement policy.

`source` names the last hierarchy level with a participating **section**
override, or `default`. Deep-merged settings can retain contributions from
earlier levels; `source` is not per-field provenance. The output annotates this
as `last_section_override_level; not per-field provenance`.

Output labels the evidence `resolved_cloud_configuration` and sets
`atomic_snapshot`, `device_applied_state_verified`,
`physical_connection_availability_verified` and
`connection_policy_enforcement_verified` to `false`. Separate before/after
ownership reads cannot establish uninterrupted ownership or an atomic snapshot.
Configuration can change between reads. These settings do not establish
physical radio availability, enabled hardware bands/services, firmware applied
state, heartbeat delivery, upload activity, reachability or policy enforcement.
There is no SDK, GATT, radio toggle, heartbeat send, upload or device write.

## Failure and recovery

Responses must be uncompressed UTF-8 JSON, with no duplicate object keys,
nonstandard `NaN`/infinity constants or overflowing nonfinite numeric values,
and at most 1 MiB each. The three reads share a 30-second elapsed-time budget,
with socket timeouts and a connected-transport deadline interruption for slow
headers/bodies. OS DNS resolution is outside Python's socket timeout control and
can delay termination beyond that budget. No redirects or automatic retries
are followed. No responses are written to disk; error bodies, exception details
and authorization headers are not logged.

A failed scope, owner, shape, timeout or HTTP check exits nonzero before the
selected JSON is emitted. Check the trusted environment, current owner, API
scopes or network and deliberately rerun the GET-only workflow when ready.
No cloud resource or device recording is created, so cleanup is unnecessary.
Do not expose an arbitrary URL or privileged configuration proxy to an app.

## Checks and design review

The available local check compiles source without executing the CLI or its
functions:

```sh
python3 -m py_compile main.py
```

Windows equivalent: `py -3.12 -m py_compile main.py`. The path-filtered
[`connection-config-python.yml`](../../.github/workflows/connection-config-python.yml)
uses Ubuntu 24.04's Python, commit-pinned checkout with credential persistence
disabled, read-only repository permissions and syntax compilation only. It
contains no API credentials or runtime tests.

The compound-engineering 1.2.9 review compared public contracts and repository
architecture with this implementation on **2026-10-08**:

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Independent public GET workflow | `main.py`, standard-library imports, fixed connection path between owned-device reads | Matched by source review; execution unverified |
| Fixed server credential/owner boundary | Explicit HTTPS/process environment, exact ID/owner/bound checks, optional project/deletion assertions on both reads | Matched by source review; authorization/failure behavior unverified |
| Direct section and selected public fields | `select_connection`, boolean/enum/canonical integer checks, narrow projection | Matched by public-guide/backend source review; deployed response unverified |
| Correct merge/source interpretation | Returned preference order/repeats preserved; section-level source annotation; no defaults supplied | Matched by source review; runtime merged values unverified |
| No physical state or enforcement claim | Constant evidence labels; no SDK/device operations | Matched by source review; physical acceptance outside this cloud workflow |
| Bounded strict reads and safe errors | 1 MiB caps, shared deadline, strict JSON hooks, GET-only/no retry, static errors/HTTP status | Matched by source review; runtime/network behavior unverified; DNS limit above |
| Syntax | `py_compile main.py`, bundled Python 3.12 on Windows | Passed locally; compilation does not execute the program |
| Formatting | Whitespace review of this directory and workflow | Passed locally |
| Hosted CI | Syntax [passed at source `2752a79`](https://github.com/bota-dev/examples/actions/runs/37887199930) | Compilation only |
| Unit/functional/live/device checks | Creation-only instruction | Not run; success/failure runtime acceptance remains open |

Review basis: [repository architecture](../../ARCHITECTURE.md),
[Hierarchical Configuration](https://docs.bota.dev/guides/hierarchical-config),
[device settings](https://docs.bota.dev/api-reference/devices/update), and public
[OpenAPI](https://github.com/bota-dev/docs/blob/main/api-reference/openapi.json)
`/devices/{id}/config/{section}` and `DeviceSettings.connection`.
The reviewed documentation checkout was `c730fb50`.

Read-only backend source inspection at `1ac67c92` covered
[`devices/index.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/devices/index.ts),
[`config/controller.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/controller.ts),
[`config.service.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/services/config.service.ts)
and [`definitions/connection.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/definitions/connection.ts).
These private maintainer links are optional review evidence, not runtime or
reader prerequisites. Neither source checkout proves deployed compatibility.

The public single-section OpenAPI response is a generic object; the direct
envelope is established by the public guide and reviewed controller. The public
device-update preference schema rejects duplicates, while the reviewed generic
section schema permits them and deep merging can retain repeated entries. This
GET reader preserves resolved data within the documented enums/length rather
than applying that separate write contract. It performs no local merge and
cannot identify which level supplied each retained field or array entry.
