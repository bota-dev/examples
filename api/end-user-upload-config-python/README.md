# Read end-user upload intent (Python)

Read four selected resolved upload settings for one configured end user through
three public GETs. Output is a narrow observation of cloud configuration and
section source. This example changes no configuration, uploads no audio and
performs no device or SDK operation.

**Status, October 9, 2026 Pacific:** implemented with source review and Python
syntax compilation only. Runtime, authorization rejection, API compatibility
and firmware enforcement remain unverified. No example CLI or function, unit or
functional test, live API, cloud, storage, model or device execution occurred in
this creation pass.

## Setup and run

Use **Python 3.12 or newer** on Windows, macOS or Linux. The directory uses the
standard library only; no package install, Bota SDK or sibling import is needed.
Use an existing end user, its matching project's server-held secret or restricted
key, and independent operator authorization to inspect that end user. Restricted
keys need the documented **`end_users:read`** and **`config:read`** scopes.

Set process environment values through a secret manager or local shell.
`.env.example` documents them; the program does **not** load `.env` files.

| Variable | Meaning and trust boundary |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit independently trusted HTTPS destination ending in `/v1`, normally `https://api.bota.dev/v1`; no URL credentials, query/fragment delimiters (including empty ones), controls, whitespace or backslashes |
| `BOTA_API_KEY` | Server/CLI-only `sk_test_*`, `sk_live_*` or `rk_*` project key with both documented scopes; device/upload tokens are rejected |
| `BOTA_PROJECT_ID` | Exact expected `proj_*` identity independently mapped to the key; it asserts optional returned project metadata and does not change project scope |
| `BOTA_END_USER_ID` | Exact authorized existing `eu_*` identity fixed by the operator; caller-supplied identity is not authorization |

The API key selects the project. Normal public responses may omit project
markers, so these reads cannot independently prove the key-to-project mapping.
Keep the key and destination on a trusted backend. An application adaptation
must authenticate its caller, derive this mapping from trusted server context
and authorize the exact end user before returning a narrow projection.

After setting environment values, run from this directory:

```powershell
py -3.12 main.py
```

On macOS/Linux use `python3 main.py`. A copied directory is independently usable.
Protect redirected `end-user-upload-config.json` as operational metadata and
retain/remove it under your policy. No cloud or device cleanup is needed.

## Requests and output

Each successful invocation makes exactly three requests:

1. `GET /v1/end-users/{id}`: require the configured exact ID, reject any returned
   `project_id` mismatch and non-null `deleted_at` marker.
2. `GET /v1/end-users/{id}/config/upload`: require the direct
   `{ value, source, definition }` entry, without an all-sections wrapper.
3. Repeat the exact end-user checks before emitting any settings.

Available `project_assignment_generation` must be a nonnegative safe integer,
with identical presence and value across the two entity reads. Null, malformed,
changed or newly appearing/disappearing generation fails. If both responses
omit it, output marks `assignment_generation_observed: false`; no generation is
invented. It is project-assignment metadata, distinct from device binding
generation. Tracked backend source returns it; the public end-user response
documentation currently omits it.

The section requires `definition.merge_strategy: "merge_deep"` and a `source`
of `default`, `organization`, `project` or `end_user`. A `device` or unknown
source is rejected. Available section `project_id` must match, `deleted_at`
must be null, and optional `section` identity markers must identify `upload`.

| `selected_upload` field | Accepted value |
| --- | --- |
| `streaming_enabled` | Actual boolean |
| `streaming_chunk_kb` | Integer `64`–`1024` |
| `streaming_flush_interval_seconds` | Integer `0`–`255`; documented zero disables timed partial-chunk flushing |
| `daily_data_limit_mb` | Integer `0`–`10000`; numeric zero remains unchanged |

Missing fields, coerced boolean/integer strings and out-of-range values fail;
no local default or inheritance computation is applied. Other response fields
are ignored and never emitted. Output contains only the four settings, section
source, resolution/evidence labels, generation-observed flag and false
verification flags. It omits IDs, profiles, defaults, schedules, arbitrary
metadata, credentials, URLs, descriptions, providers and device serials.

Section `source` means the last participating section override level, not
per-field provenance. The reviewed resolver applies numeric **`min`** to
`daily_data_limit_mb`. The schema documents zero as unlimited, but numeric
minimum makes zero win over positive ancestor/child values. This unresolved
sentinel behavior is reported unchanged; the reader neither repairs it locally
nor establishes an enforced unlimited policy or positive data cap.

End-user resolution stops before device overrides. Before/after identity and
available generation observations are non-atomic and cannot prove uninterrupted
assignment: the section response has no assignment generation or revision to
correlate with them. No effective device configuration, applied firmware,
successful upload, flush timing or data-limit enforcement is verified. The
public guide states that released compatibility firmware uses a fixed 512 KB
full-chunk target and does not enforce `daily_data_limit_mb`. Output preserves
these limits with false `includes_device_overrides`, `atomic_snapshot`,
`effective_device_configuration_verified`, `device_applied_state_verified`,
`upload_execution_verified`, `upload_timing_verified` and
`data_limit_enforcement_verified` flags. Future design intent is separate from
deployed or physical acceptance.

## Bounds and failure

The operation shares a **30-second** monotonic budget, at most **10 seconds**
per request/header/body and **1 MiB** per JSON response. Only HTTP 200,
uncompressed strict UTF-8 JSON with unique object keys and finite numbers is
accepted. Socket timeouts and a connected-transport timer interrupt slow
headers/bodies. OS DNS resolution is outside Python's socket timeout control
and can delay termination beyond these budgets; there is no universal hard
deadline claim. Redirects, automatic retries and local fallback are absent.

Exit 0 emits the validated JSON. Exit 1 emits sanitized static stderr or HTTP
status before any settings for identity, generation, deletion, schema, access,
transport or budget failure. Raw response bodies and exception details are
never printed. Resolve access or compatibility deliberately before rerunning;
an error grants no configuration-write or device-cleanup authority.

## Checks and design review

Compile without executing the CLI or its functions:

```sh
python3 -m py_compile main.py
```

Windows equivalent: `py -3.12 -m py_compile main.py`. The path-filtered
[`end-user-upload-config-python.yml`](../../.github/workflows/end-user-upload-config-python.yml)
uses Ubuntu 24.04's Python, a full-SHA checkout with credential persistence
disabled, read-only repository permissions and a five-minute syntax-only job.
CI uses no API key, dependency installation or device access.

The compound-engineering 1.2.9 review on **October 9, 2026 Pacific** compared
source with the repository architecture, public hierarchy/identity contracts and
current upload schema/resolver:

| Requirement | Source evidence | Status / remaining verification |
| --- | --- | --- |
| Independent public GET workflow | `main.py`, standard library only, exact end-user/upload paths | Matched by source review; execution unverified |
| Exact authorized scope | Entity ID, optional project/deletion checks twice; available assignment-generation presence/value fence | Matched by source review; continuous assignment and live authorization unverified |
| Actual upload contract | `select_upload`, required four fields and exact ranges, allowed end-user source, direct entry, `merge_deep` | Matched by source/public review; deployed response unverified |
| Resolution/enforcement distinction | Unmodified numeric-min zero, section-only source, false applied/timing/cap flags | Matched by source/docs; firmware behavior unverified |
| Narrow bounded safe failure | 1 MiB, 10/30-second budgets, strict JSON, sanitized errors, no retries/writes/defaults | Matched by source review; runtime rejection and DNS termination unverified |
| Syntax | Python 3.12 `py_compile main.py` on Windows | Passed locally; no example code executed |
| Workflow | SHA pin, paths, permissions, timeout and syntax-only steps | Parsed YAML/manual static review passed; hosted run pending |
| Unit/functional/live/device acceptance | Creation-only instruction | Not run; no runtime or physical acceptance claim |

Public references: [Hierarchical Configuration](https://docs.bota.dev/guides/hierarchical-config),
[Get End User](https://docs.bota.dev/api-reference/end-users/get),
[Authentication](https://docs.bota.dev/authentication), and
[repository architecture](../../ARCHITECTURE.md). Reviewed documentation checkout:
`7114baf52c6783fdd41224d00ca029c9e3ca101c`.

Optional private maintainer evidence at backend
`1ac67c92c6d72858e29dc264037cb82b6c449825` covers
`api/src/routes/v1/end-users/{index,controller}.ts`,
`api/src/routes/v1/config/controller.ts`,
`api/src/repositories/{end-user,entity-config}.repository.ts`,
`api/src/config-schema/definitions/upload.ts` and
`api/src/services/config.service.ts`. These are not installation prerequisites
or proof of the deployed revision. The tracked end-user GET is project-scoped
but lacks explicit `end_users:read` middleware, despite that public scope
requirement. The config route explicitly guards `config:read` and resolves
against the authenticated expected project and current nondeleted end user in
one repository query. Its generation-stamped override filtering is specific to
processing; this upload section exposes no generation to correlate with the
entity reads. Keep both documented scopes operationally; this script cannot inspect
a key's scopes or correct the server's enforcement gap.
