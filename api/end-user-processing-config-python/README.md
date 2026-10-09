# Read end-user processing flags (Python)

Learn to read four resolved cloud processing enabled flags for one configured
end user through three public API GETs. The expected result is a small JSON
projection of current end-user configuration and its section source. This
example changes no configuration and creates no jobs, resources or recordings.

Status, **2026-10-09**: implemented with source review and syntax compilation.
Runtime, functional and live API acceptance remain unverified. The owner
requested creation without unit, functional, live or device tests; none were
added or run. There are no physical-device operations.

## Setup and run

- Python 3.12 or newer on Windows, macOS or Linux. No dependency installation,
  Bota SDK package or sibling repository is required.
- A trusted HTTPS Bota API environment, an existing end user and the matching
  project's server-side secret or restricted key. Restricted keys need the
  documented **`end_users:read`** and **`config:read`** scopes.
- Independent operator authorization to inspect this end user's configuration.
  A client-supplied ID is not authorization. Hardware and firmware are irrelevant
  to this cloud read.

Work from this directory. Set the process environment through your secret
manager or local shell. `.env.example` documents variables; the program does
**not** load `.env` files. Never commit keys.

| Variable | Meaning and trust boundary |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS destination ending in `/v1`, normally `https://api.bota.dev/v1`. No URL credentials, query, fragment, whitespace or backslash. Never take this destination from an application caller. |
| `BOTA_API_KEY` | Server/CLI-only `sk_test_*`, `sk_live_*` or `rk_*` project key with both documented read scopes. |
| `BOTA_PROJECT_ID` | Exact expected `proj_*` identity. The key supplies project scope; this variable does not switch projects. |
| `BOTA_END_USER_ID` | Exact authorized existing `eu_*` identity fixed by the operator. No external-ID lookup or device selection is performed. |

After setting the environment, run from the repository root on Windows:

```powershell
cd api/end-user-processing-config-python
py -3.12 main.py
```

On macOS/Linux:

```sh
cd api/end-user-processing-config-python
python3 main.py
```

A copied standalone directory can run directly with its configured environment.

## Request and output contract

Each successful invocation makes exactly three requests in this order:

1. `GET /v1/end-users/{id}`: require the configured exact ID, reject any returned
   `project_id` mismatch and any non-null `deleted_at` marker.
2. `GET /v1/end-users/{id}/config/processing`: require the direct
   `{ value, source, definition }` envelope, `merge_deep` strategy and actual
   boolean `enabled` values for all four features.
3. Repeat the exact end-user checks before printing anything.

If either end-user observation includes `project_assignment_generation`, it
must be a nonnegative safe integer. Its presence and value must match across
both observations; a missing, changed, newly appearing, `null` or malformed
generation fails the comparison or validation as applicable. If both omit the
field, the read is permitted with `assignment_generation_observed: false`;
lineage fencing then relies on the server and cannot be checked by this client.
This is project assignment metadata, distinct from device binding generation.
The public end-user response documentation currently omits it; tracked backend
source returns it. No generation is invented or inferred.

`selected_processing` contains only:

```json
{
  "auto_transcription": { "enabled": false },
  "auto_summary": { "enabled": false },
  "auto_embedding": { "enabled": false },
  "auto_enhancement": { "enabled": false }
}
```

The illustration shows all flags disabled; real output uses the returned
booleans. Missing or malformed flags fail without selecting a local default.
Provider names, templates, prompts, profile data, emails, metadata, external
IDs, arbitrary config fields, definition descriptions and defaults are omitted.
Unknown fields are ignored, not approved as public or safe output.

`source` must be `default`, `organization`, `project` or `end_user`. It identifies
the last participating **section** override, not every contributing field after
deep merge. A `device` source is rejected: end-user resolution stops at the end
user and cannot include overrides from any of their devices. The existing
[device processing reader](../processing-config-python/README.md) teaches that
different resolution scope.

Output includes the configured `end_user_id`, flags, source, evidence label
`resolved_cloud_end_user_configuration`, `assignment_generation_observed` and
explicit false claims for `includes_device_overrides`, `atomic_snapshot`,
`historical_processing_authority_verified`, `provider_authorization_verified`,
`future_job_configuration_verified`, `processing_execution_verified` and
`device_enforcement_verified`.

Before/after entity reads are not an atomic snapshot or proof of uninterrupted
ownership. The config response exposes no assignment generation or revision
to correlate with those reads. This current resolution does not establish
which settings an existing recording used or what future jobs will resolve.
Backend processing uses origin-project/generation lineage and separately
authorizes provider routes; enabled flags are admission intent, not provider
approval, queueing or execution evidence. Auto-enhancement is a post-upload
cloud operation, independent of device capture mode.

## Failure and adaptation

Responses must be uncompressed UTF-8 JSON, at most 1 MiB each, with no duplicate
object keys, nonstandard constants or non-finite numbers. The requests share a
30-second budget with a 10-second budget per request, socket timeouts and
connected-transport deadline interruption for slow headers/bodies. OS DNS
resolution is outside Python's socket timeout control and can delay termination
beyond those budgets. No redirect, automatic retry or fallback occurs.

HTTP, identity, generation, deletion, shape or budget failure exits nonzero
before printing the selected JSON. Errors show only static messages or HTTP
status; no upstream body, exception details, credential or profile is logged.
Check trusted configuration, access and network, then deliberately rerun this
GET-only workflow. No cloud or device cleanup is necessary.

For a customer application, keep the destination and key server-side and derive
the project and end-user mapping from authenticated caller identity. Authorize
the exact end user before returning an equally narrow projection. Do not expose
this as an arbitrary privileged configuration proxy or treat flags as permission
to invoke a model.

## Checks and design review

Compile source without executing the CLI or its functions:

```sh
python3 -m py_compile main.py
```

Windows equivalent: `py -3.12 -m py_compile main.py`. The path-filtered
[`end-user-processing-config-python.yml`](../../.github/workflows/end-user-processing-config-python.yml)
uses Ubuntu 24.04's Python, a commit-pinned checkout with credential persistence
disabled, read-only repository permissions and syntax compilation only.
No API credentials, installation or runtime tests are needed.

The compound-engineering 1.2.9 review compared the implementation with the
repository architecture, public contracts and current processing-lineage design
on **2026-10-09**:

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Independent public read workflow | `main.py`, standard library imports, fixed processing path and three GETs | Matched by source review; execution unverified |
| Fixed project/end-user boundary | Exact entity ID, optional project/deletion checks twice; available assignment-generation presence/value comparison | Matched by source review; continuous ownership, response lineage and live access unverified |
| End-user hierarchy and direct envelope | `select_processing`; four required booleans, non-device sources, `merge_deep` | Matched by public/source review; deployed response unverified |
| Processing/provider separation | Output limits current server resolution, no provider fields or jobs | Matched by source review; provider/future-job/historical authority unverified |
| Minimal output and bounded failure | Projection excludes profile/defaults; strict JSON, 1 MiB cap, time budgets, GET only | Matched by source review; runtime rejection and DNS termination unverified |
| Syntax | `py_compile main.py`, Python 3.12.14 on Windows | Passed locally; this check executes no workflow code |
| Workflow source | Pinned checkout, exact path filters, five-minute job, read-only permission, syntax only | Matched by YAML parsing/manual review; hosted CI not run at authoring |
| Independent peer source review | Another agent inspected source, README, workflow and assignment-lineage evidence | No blockers found; no example execution or runtime acceptance |
| Unit/functional/live/device checks | Creation-only instruction | Not run; runtime success/failure acceptance remains open |

Public basis: [Hierarchical Configuration](https://docs.bota.dev/guides/hierarchical-config),
[Get End User](https://docs.bota.dev/api-reference/end-users/get),
[Auto-Processing](https://docs.bota.dev/guides/auto-processing), and
[repository architecture](../../ARCHITECTURE.md). Reviewed documentation checkout:
`3cc7fe23d88783290aff09c679851bd266b784e4`.

Optional private maintainer evidence at backend `1ac67c92` includes
[`end-users/index.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/end-users/index.ts),
[`end-user.repository.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/repositories/end-user.repository.ts),
[`config/controller.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/controller.ts),
[`entity-config.repository.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/repositories/entity-config.repository.ts)
and [`definitions/processing.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/definitions/processing.ts).
The normative processing amendment is in the internal Hierarchical Configuration
Management Design. None of these private sources are runtime prerequisites or
proof of deployed compatibility.

The tracked end-user GET is project-scoped but lacks an explicit
`end_users:read` middleware guard, whereas the public contract requires that
scope. The config route explicitly requires `config:read` and resolves against
the authenticated expected project with current assignment-lineage fencing.
The example still requires both documented scopes operationally; it cannot
inspect a key's scopes or fix server enforcement. That backend scope discrepancy
is a separate platform follow-up, not an example permission guarantee.
