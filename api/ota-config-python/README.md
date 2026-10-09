# Read OTA configuration (Python)

Read selected effective OTA automatic-selection settings for one already-bound
device owned by a fixed end user using Python's standard library and public
API GETs. The expected result is a small JSON projection of the enabled flag,
selector and section-level resolution metadata. This example changes no
configuration, enables no automatic updates and performs no physical-device
operations.

Status, **2026-10-08**: implemented with syntax checks and source review only.
Runtime, functional, live API and physical-device acceptance are unverified.
The owner requested creation without tests or runtime CLI/API/device calls;
no unit or functional tests were added or run.

## Prerequisites and configuration

- Python 3.12 or newer on Windows, macOS or Linux. There are no packages to
  install, Bota SDK dependencies or sibling-runtime imports.
- A trusted HTTPS Bota API environment and a server-held project secret or
  restricted API key. Restricted keys need **`devices:read` and `config:read`**.
- Exact operator-configured project, end-user and existing device identities.
  The device must currently be bound to that owner. Hardware access and a
  firmware version are unnecessary for this cloud read.

Work from this directory. `.env.example` documents the required process
variables; `main.py` does **not** load `.env` files. Supply values through a
secret manager or your shell environment. Never commit keys or real identifiers.

| Variable | Meaning and trust boundary |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS destination ending in `/v1`, normally `https://api.bota.dev/v1`. No credentials, query or fragment; never take this URL from an app caller. |
| `BOTA_API_KEY` | Project `sk_test_*`, `sk_live_*` or restricted `rk_*` key with both read scopes. Server/CLI only. |
| `BOTA_PROJECT_ID` | Exact expected `proj_*` project. The API key supplies project scope; this value cannot switch projects. |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` owner selected by the operator. |
| `BOTA_DEVICE_ID` | Exact existing `dev_*` device currently expected to be bound to that owner. |

After configuring the environment, run from the repository root on Windows:

```powershell
cd api/ota-config-python
py -3.12 main.py
```

On macOS/Linux:

```sh
cd api/ota-config-python
python3 main.py
```

A copied standalone directory can run directly with the same environment.
For an app-facing backend, derive project/end-user scope from authenticated
caller identity and authorize the device before returning a narrow projection.
Keep both API key and destination server-side; do not expose an arbitrary
privileged configuration proxy to mobile/browser callers.

## Read and output contract

The program makes exactly three requests, once each, before emitting output:

1. `GET /v1/devices/{id}` requires the exact configured device ID, end-user
   owner and `bound` status. If `deleted_at` exists it must be exactly `null`;
   if `project_id` exists it must exactly match the configured project.
2. `GET /v1/devices/{id}/config/ota` accepts the section directly as
   **`{ value, source, definition }`**, without the all-sections `data` wrapper.
   Any returned section `project_id` must match too.
3. Repeat the owned-device GET and all ownership/deletion/project checks.
   If `binding_generation` is available, it must be an actual integer in
   `0`–`9007199254740991` and match across both observations. A generation
   appearing or disappearing also rejects the read.

The public device schema may omit project, deletion and generation metadata.
The project-scoped key and API authorization remain the trust boundary.
Absent generation metadata cannot detect a rebind. Matching generations and
owners are separate observations, not continuous ownership or an atomic
snapshot; configuration and ownership can change between requests.

`selected_ota` contains only:

| Field | Accepted resolved value |
| --- | --- |
| `auto_update.enabled` | Actual boolean; missing, null, numeric and string substitutes are rejected |
| `source` | Exactly `legacy` or `service`; missing, null or unsupported values stop the run without choosing a fallback |

`selected_ota.source` comes from **`value.source`**, the OTA automatic-selection
selector. `legacy` selects local platform releases; `service` uses the registered
model ID for OTA service selection. It does not identify a particular release,
artifact, platform promotion or delivery assignment. Manual assignments are
independent of the automatic-selection setting.

The output's outer **`source`** comes from **`section.source`** and must be
`default`, `organization`, `project`, `end_user` or `device`. It names the last
participating section override. Deep-merged fields may retain earlier levels'
contributions, so `source_meaning` states that this is not per-field provenance.
`definition.merge_strategy` must be `merge_deep`. Arbitrary metadata, unknown
fields, URLs, definition text/defaults and full device/config responses are
ignored rather than printed. No default or fallback is inserted locally.

The evidence label is `resolved_cloud_configuration`; `atomic_snapshot`,
`device_applied_state_verified`, `ota_execution_verified`,
`release_authorization_verified` and `firmware_compatibility_verified` are
`false`. Resolution does not establish consumer enforcement, current release
selection, upstream publication, project promotion, grant authorization,
installed firmware, boot integrity or physical/model compatibility. An enabled
flag does not prove an update was assigned, downloaded or installed. A service
selector does not prove service availability; failure must not be treated as
permission to fall back to a legacy release.

There are no configuration writes, release assignments, promotion/Stop calls,
grants, artifact downloads, SDK transfers, commands or device writes.

## Failure and recovery

Each response must be uncompressed UTF-8 `application/json`, at most 1 MiB,
with no duplicate keys, nonstandard constants or numeric overflow to a
non-finite float. The reads share a 30-second elapsed-time budget with socket
timeouts and a connected-transport interruption for slow headers/bodies.
OS DNS resolution is outside Python's socket timeout control and can delay
termination beyond that budget. Redirects and automatic retries are rejected.
Responses are not saved; upstream error bodies, credentials and exception
details are never logged.

A failed HTTP, scope, owner, generation, shape or deadline check exits nonzero
before selected output is emitted. Check the trusted environment, access,
current owner or network, then deliberately rerun this GET-only workflow when
ready. The example creates no cloud resources or device recordings, so cleanup
is unnecessary.

## Checks and design review

Compile the source without executing the CLI or its functions:

```sh
python3 -m py_compile main.py
```

Windows equivalent: `py -3.12 -m py_compile main.py`. The path-filtered
[`ota-config-python.yml`](../../.github/workflows/ota-config-python.yml) uses
Ubuntu 24.04's Python, commit-pinned checkout with credential persistence
disabled, read-only repository permissions and syntax compilation only.
It contains no API credentials or runtime tests.

The compound-engineering 1.2.9 review compared the public contracts and
repository architecture with this implementation on **2026-10-08**:

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Standalone public read | `main.py`, standard-library imports, exactly three GETs including `/config/ota` | Matched by source review; execution unverified |
| Fixed server credential/project/owner | Trusted HTTPS environment; exact IDs, bound owner, strict optional deletion/project checks and stable optional generation | Matched by source review; authorization/failure behavior unverified |
| Direct section and selected public OTA fields | `select_ota`, required boolean and supported `value.source`, `merge_deep`, separate outer source metadata | Matched by public-schema/backend source review; deployed response unverified |
| No secret or arbitrary response output | Narrow selected fields, known source metadata, constant evidence labels and sanitized errors | Matched by source review; malformed-response behavior unverified |
| Read-only resolution with no fallback | GET-only path, unsupported selector rejection, no mutation/delivery code | Matched by source review; consumer enforcement and release/install/compatibility evidence remain outside this read |
| Bounded strict JSON/no retries | 1 MiB cap, duplicate/non-finite rejection, shared deadline, no redirects or retry loop | Matched by source review; network/runtime acceptance unverified; DNS limitation above |
| Syntax | `py_compile main.py` using the bundled Python on Windows | Passed locally; compilation does not execute the program |
| Formatting | `git diff --check` for this directory/workflow | Passed locally |
| Hosted CI; unit/functional/live/device acceptance | Creation-only instruction | Not run; advertised success and failure behavior remain unverified |

Review basis: [repository architecture](../../ARCHITECTURE.md),
[Hierarchical Configuration](https://docs.bota.dev/guides/hierarchical-config)
and public [OpenAPI](https://github.com/bota-dev/docs/blob/main/api-reference/openapi.json)
`/devices/{id}/config/{section}` and `DeviceSettings.ota`.
The documentation checkout was `c730fb5`; its local in-progress guide changes
were also inspected. Neither source establishes the deployed response.

Read-only backend review at `1ac67c92` covered
[`devices/index.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/devices/index.ts),
[`devices/controller.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/devices/controller.ts),
[`config/controller.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/controller.ts),
[`config.service.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/services/config.service.ts)
and [`definitions/ota.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/definitions/ota.ts).
The authoritative [OTA Architecture](https://github.com/bota-dev/internal-docs/blob/main/device/Device-App-Backend%20OTA%20Design.md)
separates publication, promotion, delivery and physical installation, and
prohibits treating service failure as permission for legacy fallback. These
private maintainer references are optional review evidence, not runtime or
reader prerequisites. No platform promotion gap, security qualification or
physical installation gate is closed by this example.
