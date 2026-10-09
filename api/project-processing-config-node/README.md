# Read project processing configuration (Node.js)

Observe the four automatic-processing enabled flags at the API key's project
level with one public GET. Unlike the device-scoped
[Python processing reader](../processing-config-python/README.md), this example
stops at organization/project inheritance and includes no end-user or device
override. It changes no configuration and creates no jobs.

Status, **2026-10-09**: implemented with source review and syntax checking only.
Runtime, functional and live API acceptance are unverified. The owner requested
creation without unit/functional tests, runtime CLI execution or API/device calls.

## Setup

Use Node.js **22.23.2 or newer**. This directory installs independently, uses
Node built-ins only and has no SDK, sibling runtime import or hardware requirement.
Keep the selected API destination and credentials in a trusted server environment.

```sh
cd api/project-processing-config-node
npm ci
cp .env.example .env
```

PowerShell: use `Copy-Item .env.example .env` instead of `cp`. Set the real values
locally before deliberately running `npm start`. Shell/secret-manager variables
also work; the start command loads `.env` only if present. Never commit the key,
real identifiers or `.env` file.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit operator-trusted HTTPS destination ending in `/v1`, normally `https://api.bota.dev/v1`. No controls, whitespace, backslashes, URL credentials, query or fragment. Never accept it from an app caller. |
| `BOTA_API_KEY` | Server-held project `sk_test_*`, `sk_live_*` or restricted `rk_*` key. Restricted keys require **`config:read`**. |
| `BOTA_PROJECT_ID` | Expected `proj_*` project assertion. The key selects the actual project; this variable does not switch projects. |

The reviewed direct response does **not** include `project_id`. You must select
and verify the key's project independently. The program requires the expected ID
and rejects a mismatching marker if a future response supplies one, but it cannot
verify that assertion when the marker is absent. It sends no project-ID header or
caller-controlled scope parameter. Output reports `expected_project_marker_present`
without printing identifiers. This flag alone is not deployed authorization proof.

An app-facing service must authenticate callers and authorize project access
before exposing selected metadata. Fixed operator configuration is not a general
caller authorization layer. The destination is trusted before sending the key;
HTTPS alone does not make an arbitrary host trustworthy.

## Read and output contract

`GET /v1/config/processing` requires `config:read` and returns the direct section
`{ value, source, definition }`, without an all-sections `data` wrapper. The key's
authenticated project is resolved from built-in defaults, then organization and
project overrides. This request never descends into end-user or device overrides.

`selected_processing` contains only these four objects, each with one required
boolean `enabled` field:

- `auto_transcription`
- `auto_summary`
- `auto_embedding`
- `auto_enhancement`

Missing, null, string or numeric enabled flags reject the entire result. The
server schema defaults all four to false, but this client never substitutes a
local default or treats an error as disabled automation. It does not merge values.
Providers, templates, defaults, definitions, arbitrary fields, credentials,
identifiers and recording/transcription content are omitted from output.

The required section `source` is exactly `default`, `organization` or `project`;
`definition.merge_strategy` must be `merge_deep`. `source` names the last level
with a participating section override. A project override of one field can leave
other fields inherited, so this metadata is **not per-field provenance**. It also
does not independently verify the server's merge calculation. An optional
`deleted_at` marker must be null.

The evidence label is `resolved_cloud_configuration` at `resolution_level:
project`. `atomic_snapshot`, `provider_approval_verified`,
`provider_credentials_verified`, `job_creation_verified`,
`job_completion_verified`, `effective_device_configuration_verified` and
`device_applied_state_verified` are all false. The resolver performs separate
database reads; one HTTP response is not an atomic database snapshot.

An enabled flag is automation intent. Processing still requires a usable,
separately approved provider route/credential and successful initiation/queueing.
The backend may resolve recording origin-lineage child overrides when processing
actual recordings, and summary settings may be resolved after transcription
completes. This project-only observation therefore cannot predict a particular
recording's jobs, prove their creation/completion, or establish firmware policy.
There are no PUT/DELETE calls, model requests, uploads, SDK/device operations or
automatic retries.

## Failure and recovery

One 10-second abort budget covers fetch, headers and the entire body. Responses
must be uncompressed UTF-8 `application/json`, at most 1 MiB. UTF-8 decoding is
fatal, JSON syntax must be valid and non-finite numeric values are rejected.
Node's native `JSON.parse` uses the last value for duplicate keys; this is not a
duplicate-key validation example. The byte cap bounds parsing work; synchronous
parsing and OS scheduling can delay abort observation beyond the nominal budget.

Redirects are rejected. No response body, request headers, API exception details
or keys are logged or saved. HTTP, transport, deadline, project-marker, section
or flag validation failures exit nonzero before selected metadata is emitted.
Correct access, configuration or connectivity, then deliberately rerun this
GET-only reader. Failure never authorizes a configuration write, weaker provider
policy or a job creation request. No resource cleanup is needed.

## Checks and design review

Install and check source syntax without executing the CLI:

```sh
npm ci
npm run check
```

The independent
[`project-processing-config-node.yml`](../../.github/workflows/project-processing-config-node.yml)
uses commit-pinned actions, disabled checkout credential persistence, read-only
repository permissions and a five-minute job budget. It runs installation and
`node --check` only, without live credentials or runtime tests.

Compound-engineering 1.2.9 review, **2026-10-09**:

| Requirement | Implementation evidence | Status / remaining verification |
| --- | --- | --- |
| Independent public read | Built-ins, own package/lock, one exact GET | Matched by source review; runtime unverified |
| Project authority | Key-derived route; trusted server configuration; optional marker mismatch rejection | Matched by source review; absent marker cannot verify expected project; deployed authorization unverified |
| Project-only hierarchy | Restricted source levels, required direct section and `merge_deep` | Matched against public contract and resolver; runtime merge result unverified |
| Narrow processing output | Four actual booleans only, no providers/templates/defaults or local fallback | Matched by source review; live shape unverified |
| Intent/evidence boundary | Explicit false flags; no child resolution, writes or job calls | Matched against design/provider services; job/provider/device acceptance outside scope |
| Bounded sanitized failures | 1 MiB, 10-second signal, fatal UTF-8, finite JSON, no redirect/retry | Matched by source review; failure behavior unverified; duplicate-key/parsing limits above |
| Local install and syntax | Node 22.23.2 `npm ci`, `npm run check` on Windows | Passed; CLI/functions were not executed |
| Formatting/workflow | New-file whitespace inspection and YAML/manual security review | Passed locally; bundled validator skill/resources unavailable, manual fallback used |
| Hosted CI | Separate path-filtered workflow | Not yet observed |
| Unit/functional/live/device acceptance | Owner's creation-only instruction | Not run; advertised runtime behavior unverified |

Public contract basis: [Hierarchical Configuration](https://docs.bota.dev/guides/hierarchical-config),
[Auto-Processing](https://docs.bota.dev/guides/auto-processing) and the documented
`GET /config/processing` OpenAPI operation. Repository acceptance requirements
are in [ARCHITECTURE.md](../../ARCHITECTURE.md). Documentation source is not
deployment evidence.

Optional maintainer source review at backend `1ac67c92` covered
[`config/index.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/index.ts),
[`config/controller.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/controller.ts),
[`processing.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/definitions/processing.ts),
[`hierarchy.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/hierarchy.ts),
[`config.service.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/services/config.service.ts),
[`auto-processing.service.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/services/auto-processing.service.ts),
and the transcription/summary service route-pin checks. The private
[Hierarchical Configuration design](https://github.com/bota-dev/internal-docs/blob/main/Hierarchical%20Configuration%20Management%20Design.md)
separates enabled intent, approved provider egress and immutable recording-origin
lineage. These references are not install/runtime prerequisites. This reader
closes no platform provider, processing or device enforcement gate.
