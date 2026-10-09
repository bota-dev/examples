# Read end-user OTA settings (Python)

Read two selected resolved cloud OTA settings for one configured end user
through three public API GETs. The output contains the returned automatic-update
enabled flag, OTA selector and section source metadata. This example changes
no configuration and creates no resources, jobs or assignments.

Status, **October 9, 2026 (Pacific)**: implemented with source review and syntax
compilation only. Runtime, functional and live API acceptance remain unverified.
The owner requested creation without unit, functional, live or device tests;
none were added or run. No example CLI or functions were executed.

## Setup and run

- Python 3.12 or newer on Windows, macOS or Linux. Standard library only;
  no dependency installation, Bota SDK or sibling repository is required.
- A trusted HTTPS Bota API environment and an existing end user in the project
  selected by your server-side key. Restricted keys need the documented
  **`end_users:read`** and **`config:read`** scopes.
- Independent operator authorization to inspect this exact end user's settings.
  Caller-supplied IDs are not authorization. No physical device is required.

Work from this directory. Set process environment variables through a secret
manager or local shell; `.env.example` documents them. The program does **not**
load `.env` files. Never commit keys or put them in mobile/browser configuration.

| Variable | Meaning and trust boundary |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS destination ending in `/v1`, normally `https://api.bota.dev/v1`. No URL credentials, query/fragment delimiters, whitespace, control character or backslash. Never accept it from an application caller. |
| `BOTA_API_KEY` | Server/CLI-only `sk_test_*`, `sk_live_*` or `rk_*` project key with both documented read scopes. |
| `BOTA_PROJECT_ID` | Exact expected `proj_*` identity. The key supplies project scope; this assertion does not switch projects. |
| `BOTA_END_USER_ID` | Exact existing authorized `eu_*` identity fixed by the operator. |

After configuring the environment, start from the repository root on Windows:

```powershell
cd api/end-user-ota-config-python
py -3.12 main.py
```

On macOS/Linux:

```sh
cd api/end-user-ota-config-python
python3 main.py
```

A copied standalone directory can run directly with its configured environment.

## Public request and output contract

A successful invocation makes exactly three requests in order:

1. `GET /v1/end-users/{id}` requires the exact configured identity. Any returned
   `project_id` must match and any returned `deleted_at` must be null.
2. `GET /v1/end-users/{id}/config/ota` requires the direct
   `{ value, source, definition }` response, `definition.merge_strategy` equal to
   `merge_deep`, an actual boolean `value.auto_update.enabled` and
   `value.source` equal to `legacy` or `service`. Optional returned project and
   deletion markers receive the same checks. Optional `section` and
   `definition.section` must equal `ota`; any returned `end_user_id` must match
   the exact configured end user.
3. Repeat the exact end-user GET and checks before printing selected output.

If either end-user observation supplies `project_assignment_generation`, it must
be a nonnegative safe integer and its presence and value must match in both
observations. A changed, newly present, disappeared, null or malformed generation
fails. If both omit the field, `assignment_generation_observed` is false; the
client cannot check that lineage fence. The public end-user response example
omits this marker; tracked backend source returns it. It is project-assignment
metadata, distinct from device binding generation. No generation is inferred.

Output `selected_ota` contains only the actual returned values:

```text
selected_ota.auto_update.enabled  boolean
selected_ota.source               legacy | service
```

The output's outer `source` must be `default`, `organization`, `project` or
`end_user`. It describes the latest section override level used by server
resolution, not the provenance of each field. It is distinct from
`selected_ota.source`, the configured OTA selector. Missing or malformed selected
fields and unknown enum values fail without local defaults or fallback.
Unselected fields are omitted; they are not approved as public or safe output.

Only current resolution through the end-user level is observed. Device overrides
are excluded. End-user/project IDs, profile data, emails, external IDs, arbitrary
metadata, definition descriptions/defaults, firmware identities and URLs are
omitted. Separate GETs
are non-atomic and do not prove uninterrupted ownership or immutable configuration
between observations; `atomic_snapshot` is always false.

The selected values express configuration intent. They establish no release
promotion, compatibility or eligibility, assignment, delivery, firmware
installation or applied device state. Those evidence flags are always false.
The OTA design's qualified selection, authorization, device transport and
installed-version observation gates are outside this read. Target design and
source contracts are not evidence of deployed behavior.

## Failure and application integration

Responses must be uncompressed strict UTF-8 JSON, at most 1 MiB each. Duplicate
object keys, nonstandard constants and non-finite numbers are rejected.
Requests share a 30-second elapsed-time budget with a 10-second budget per
request, socket timeouts and connected-transport interruption for slow
headers/bodies. OS DNS resolution is outside Python socket timeout control and
can delay termination beyond those budgets; this is not a universal hard
deadline. Redirects, automatic retries and fallback are unsupported.

HTTP, identity, deletion, generation, shape or budget failure exits nonzero
before printing selected JSON. Errors contain static messages or HTTP status,
without upstream bodies, exception details, keys, URLs or profile content.
Check trusted configuration, access and network before deliberately rerunning
this GET-only read. No cleanup is authorized by its result.

For a customer application, derive the project/end-user mapping from verified
caller identity on your backend and authorize the exact resource there. Keep
the key and API destination server-side; return only an equally narrow
projection. This CLI does not provide caller authentication or inspect key
scopes and must not become an arbitrary privileged configuration proxy.

## Checks and design review

Compile source without executing the CLI or functions:

```sh
python3 -m py_compile main.py
```

Windows equivalent: `py -3.12 -m py_compile main.py`. The path-filtered
[`end-user-ota-config-python.yml`](../../.github/workflows/end-user-ota-config-python.yml)
uses Ubuntu 24.04 Python, full-SHA checkout with credential persistence disabled,
read-only repository permission and a five-minute syntax-only job. CI needs no
API secrets, package installation or physical device.

The compound-engineering 1.2.9 review compared the implementation with the
[repository architecture](../../ARCHITECTURE.md), public contracts and current
OTA design on **October 9, 2026 (Pacific)**:

| Requirement | Source evidence | Status / remaining verification |
| --- | --- | --- |
| Independent GET-only workflow | `main.py`, standard-library imports, fixed OTA path and three GETs | Matched by source review; runtime execution unverified |
| Fixed end-user/project boundary | `check_end_user` before/after, exact identity, optional project/deletion checks, available generation comparison | Matched by source review; continuous ownership and live access unverified |
| Direct end-user OTA envelope | `select_ota`, required boolean/selector, optional section/owner markers, non-device sources and `merge_deep` | Matched by public/source review; deployed response unverified |
| Distinct section metadata and OTA intent | Narrow projection, separate selected/outer sources and false execution evidence flags | Matched by source review; release and physical acceptance outside scope |
| Bounded safe failure | Strict JSON, 1 MiB cap, shared/per-request budgets, static errors, no retries | Matched by source review; runtime failure handling and DNS termination unverified |
| Python syntax | Python 3.12 `py_compile main.py` | Passed locally; no example workflow code executed |
| CI workflow | Pinned checkout, path filters, contents read, syntax-only five-minute job | Parsed YAML/manual source review; hosted check unverified in this creation pass |
| Functional/live/device acceptance | Owner's creation-only instruction | Unverified; no unit, functional, API or device tests run |

Public basis: [Hierarchical Configuration](https://docs.bota.dev/guides/hierarchical-config),
[Get End User](https://docs.bota.dev/api-reference/end-users/get) and the public
OpenAPI OTA value schema. Documentation source was reviewed at
`7114baf52c6783fdd41224d00ca029c9e3ca101c`.

Optional private maintainer evidence at backend
`1ac67c92c6d72858e29dc264037cb82b6c449825` includes
[`end-users/index.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/end-users/index.ts),
[`end-user.repository.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/repositories/end-user.repository.ts),
[`config/controller.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/controller.ts),
[`config.service.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/services/config.service.ts),
[`entity-config.repository.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/repositories/entity-config.repository.ts)
and [`definitions/ota.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/definitions/ota.ts).
The internal Hierarchical Configuration Management and Device-App-Backend OTA
Designs provide normative lineage/OTA boundaries. Private sources are optional
review evidence, never runtime prerequisites or deployed-compatibility proof.

The tracked end-user GET is project-scoped but lacks an explicit
`end_users:read` middleware guard; the public contract requires that scope.
Config GET explicitly requires `config:read` and resolves against the
authenticated expected project and active end-user row. The resolver's stamped
override-lineage filtering is specific to `processing`; current generation
observations do not establish the historical origin of OTA overrides. This
example requires both documented scopes operationally and cannot fix or verify
server scope enforcement. The discrepancy remains a platform follow-up.
