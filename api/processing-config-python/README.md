# Read processing configuration (Python)

Learn to read selected resolved cloud processing settings for one already-bound,
owned device using Python's standard library and public API GETs. The expected
result is a small JSON projection of enabled flags and documented options.
The example changes no configuration, creates no processing jobs and performs
no physical-device operations.

Status, **2026-10-08**: implemented with syntax checks and source review only.
Runtime, functional, live API and physical-device acceptance are unverified.
The owner requested creation without unit, functional, live or device tests;
none were added or run.

## Prerequisites and configuration

- Python 3.12 or newer on Windows, macOS or Linux. There are no dependencies to
  install, Bota SDK packages, manifests or sibling-runtime imports.
- A trusted Bota API environment and its server-side project secret/restricted
  API key. Restricted keys need **`devices:read` and `config:read`**.
- Operator-configured expected project, end user and existing device identities.
  The device must currently be bound to that end user. Hardware access and a
  firmware version are unnecessary for this cloud read.

Work from this directory. `.env.example` lists the required process variables;
the program does **not** load `.env` files. Set values in the process environment
through your secret manager or local shell before running. Never commit keys.

| Variable | Meaning and trust boundary |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted API destination ending in `/v1`, normally `https://api.bota.dev/v1`; no credentials, query or fragment. HTTPS required except loopback HTTP. Never accept this URL from an app caller. |
| `BOTA_API_KEY` | Project `sk_test_*`, `sk_live_*` or restricted `rk_*` key with the two read scopes. Server/CLI only. |
| `BOTA_PROJECT_ID` | Fixed expected `proj_*` identity; the key supplies API project scope. |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` owner, selected by the operator. |
| `BOTA_DEVICE_ID` | Exact existing `dev_*` device selected by the operator. No physical ID is bundled. |

For example, after supplying the environment, run on Windows:

```powershell
cd api/processing-config-python
py -3.12 main.py
```

On macOS/Linux:

```sh
cd api/processing-config-python
python3 main.py
```

The paths above start at the repository root; a copied standalone directory can
run directly with its configured environment. The key must belong to the
configured project; optional returned `project_id` fields are additional
checks, not a mechanism to select or switch projects.

## Read and output contract

The program makes these requests once each, in order:

1. `GET /v1/devices/{id}`: require the exact configured device ID, exact end-user
   owner and `bound` status. Reject any non-null `deleted_at` marker and any
   returned project mismatch. Public device schemas may omit those two fields;
   the project-scoped API key and GET authorization remain the scope boundary.
2. **One** `GET /v1/devices/{id}/config/processing`: accept the section directly
   as `{ value, source, definition }`, rather than the all-sections `data` wrapper.
3. Repeat the owned-device GET checks before printing anything.

All four resolved features must include actual boolean enabled flags:
`auto_transcription`, `auto_summary`, `auto_embedding` and `auto_enhancement`.
The output is explicitly named `selected_processing`. It may also include:

- ASR provider: `whisper`, `deepgram`, `assemblyai` or `elevenlabs`.
- Summary provider: `gemini`, `openai` or `claude`.
- Enhancement provider: `cleanvoice`.
- Summary template: the documented built-ins `general_notes`, `sales_call`,
  `clinical_soap` or `legal_memo`.

ASR/summary providers can be omitted or `null`; neither identifies an explicit
provider selection. Custom template strings are validated for type and length
but omitted from output. Undocumented language settings, arbitrary metadata,
prompts, provider keys, unknown fields, URLs and definition/default contents
are never printed. This is a selected projection rather than the complete
resolved configuration. Unsupported provider values or malformed required
fields stop the run without printing the section.

`source` names the last hierarchy level with a participating **section**
override, or `default`; deep-merged settings can retain contributions from
earlier levels. It is not per-field provenance. `definition.merge_strategy`
must be `merge_deep`; arbitrary definition text is ignored.

Output labels the evidence as `resolved_cloud_configuration` and sets
`atomic_snapshot`, `device_applied_state_verified` and
`processing_execution_verified` to `false`. Before/after ownership observations
cannot establish uninterrupted ownership or an atomic snapshot. Config may
change between reads. Automatic processing resolves a recording's origin
lineage when triggered, and summary settings can be resolved later again; this
current-device read does not establish what any existing recording used.
Enabled settings do not prove provider authorization/credential availability,
job creation, successful queueing or execution. Auto-enhancement is a cloud job,
separate from device `recording.mode`.

## Failure and recovery

Responses must be uncompressed UTF-8 JSON with no duplicate object keys or
nonstandard JSON constants, and at most 1 MiB each. The three reads share a
30-second elapsed-time budget with socket timeouts and a connected-transport
deadline interruption for slow headers/bodies. OS DNS resolution is outside
Python's socket timeout control and can delay termination beyond that budget.
No redirects or automatic retries are followed. No responses are written to
disk, and error bodies/exception details/authorization headers are not logged.

A failed scope, owner, shape, timeout or HTTP check exits nonzero before the
selected JSON is emitted. Check the trusted environment, current device owner,
API scopes or network and deliberately rerun the GET-only workflow when ready.
No cloud resources or device recordings are created, so cleanup is unnecessary.

For a customer application, keep this key and destination server-side, replace
operator selection with authenticated caller-to-project/end-user mappings, and
authorize each requested device before returning an equally narrow projection.
Do not expose an arbitrary URL or privileged config proxy to a mobile/browser
client.

## Checks and design review

The available local check compiles source without executing the CLI or its
functions:

```sh
python3 -m py_compile main.py
```

Windows equivalent: `py -3.12 -m py_compile main.py`. The path-filtered
[`processing-config-python.yml`](../../.github/workflows/processing-config-python.yml)
uses Ubuntu 24.04's Python, a commit-pinned checkout with credential persistence
disabled, read-only repository permissions and syntax compilation only. It
contains no API credentials or runtime tests.

The compound-engineering 1.2.9 review compared the public contracts and
repository architecture with this implementation on **2026-10-08**:

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Standalone public GET workflow | `main.py`, no external imports/install; fixed processing path between owned-device reads | Matched by source review; execution unverified |
| Server credential and fixed-owner boundary | Explicit environment validation, exact ID/owner/bound status, optional deletion/project assertions on both reads | Matched by source review; authorization/failure behavior unverified |
| Direct section envelope and merge semantics | `select_processing`, narrow booleans/providers/templates, section-level source annotation | Matched by public-guide/backend source review; deployed response unverified |
| No arbitrary/secret response output | Only selected known fields and constant evidence labels emitted; errors use static messages and HTTP status | Matched by source review; malformed-response behavior unverified |
| Bounded reads/no retries/no mutation | 1 MiB response cap, one shared deadline, GET-only requests, no redirect handling/retry loop | Matched by source review; runtime/network behavior unverified; DNS limit above |
| Syntax | `py_compile main.py`, Python 3.12.14 on Windows | Passed locally; compilation does not execute the program |
| Formatting | `git diff --check` for this directory/workflow | Passed locally |
| Hosted CI; unit/functional/live/device checks | Creation-only instruction | Not run; success/failure runtime acceptance remains open |

Review basis: [repository architecture](../../ARCHITECTURE.md),
[Hierarchical Configuration](https://docs.bota.dev/guides/hierarchical-config),
[Auto-Processing](https://docs.bota.dev/guides/auto-processing),
and public [OpenAPI](https://github.com/bota-dev/docs/blob/main/api-reference/openapi.json)
`/devices/{id}/config/{section}` and `ProcessingConfig` schemas.
The reviewed documentation checkout was `67509d10`.

Read-only backend source inspection at `1ac67c92` covered
[`devices/index.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/devices/index.ts),
[`config/controller.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/controller.ts),
[`config.service.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/services/config.service.ts)
and [`definitions/processing.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/definitions/processing.ts).
These private maintainer references are optional review evidence, not runtime
or reader prerequisites. Neither checkout establishes deployed compatibility.
The public `ProcessingConfig` string-only ASR/summary provider declarations
omit null values accepted by the reviewed backend; this example tolerates null
as no explicit selection. No processing language field appears in the reviewed
public/backend processing schema, so the projection omits it. Unknown merged
fields are ignored rather than treated as safe public output.
