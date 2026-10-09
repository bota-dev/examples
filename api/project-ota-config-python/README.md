# Read project OTA configuration (Python)

Observe selected OTA automatic-update intent at the authenticated key's project
level using one public API GET and Python's standard library. Output contains
only the resolved enabled flag, OTA selector and section source. It does not
include end-user or device overrides and inserts no local defaults.

Status, **October 9, 2026 (Pacific)**: source-only implementation with Python
syntax and YAML/static review. CLI/functions, unit/functional tests, live API,
cloud/model/storage and physical-device actions were not executed. Runtime,
deployed authorization and physical acceptance remain unverified.

## Configure and run

Use Python 3.12 or newer on Windows, macOS or Linux. There are no packages to
install, Bota SDK dependencies or sibling runtime imports. Configure an explicit
trusted API origin and a server-held project secret key, or a restricted key
with **`config:read`**. A device or firmware version is unnecessary.

`.env.example` documents process variables; `main.py` does not load `.env` files.
Supply values from a secret manager or trusted shell environment. Never commit
keys or actual identifiers.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Operator-approved HTTPS destination ending in `/v1`, normally `https://api.bota.dev/v1`; no credentials, query, fragment, controls or backslashes. |
| `BOTA_API_KEY` | Server-held project `sk_test_*`, `sk_live_*` or restricted `rk_*` key with `config:read`. Never accept it from a mobile/browser caller. |
| `BOTA_PROJECT_ID` | Independently verified expected `proj_*` project for that key; an assertion, not a project selector. |

Establish the key-to-project mapping through trusted credential provisioning or
your authorized operator records before running. This GET normally returns no
project marker and cannot verify that mapping itself. Supplying
`BOTA_PROJECT_ID` cannot switch the authenticated project; no project query,
header or invented scope parameter is sent. An optional returned `project_id`
must match the configured assertion.

Run from this directory after configuring the environment:

```powershell
py -3.12 main.py
```

On macOS/Linux:

```sh
python3 main.py
```

The directory can be copied and run independently. If adapted into an
app-facing backend, authenticate the caller, derive the authorized project from
trusted server mappings, authorize project configuration access and keep the
API key and destination on the server. This CLI does not supply an application
authentication system or a generic privileged proxy.

## Public read and output contract

The only request is **`GET /v1/config/ota`**. It accepts the direct single-section
response **`{ value, source, definition }`**, without an all-sections `data`
wrapper. The server resolves built-in defaults, organization overrides and the
authenticated project overrides. This reader does not fetch child settings or
reconstruct inheritance locally.

| Selected field | Required value |
| --- | --- |
| `value.auto_update.enabled` | Actual boolean; missing, null, numeric or string substitutes fail. |
| `value.source` | Exactly `legacy` or `service`; unknown/missing values fail without choosing a fallback. |
| `section.source` | Exactly `default`, `organization` or `project`; child-level/unknown/missing values fail. |
| `definition.merge_strategy` | Exactly `merge_deep`. |

An optional section or definition `section` marker must identify `ota`; an
optional `deleted_at` must be exactly `null`. Invalid shapes and all required
field failures stop before any selected output is printed. Additional arbitrary
fields are ignored; full configuration, defaults, definition text, profiles,
device rows, identifiers, firmware URLs and upstream error data are not printed.

The output has only these keys:

```json
{
  "selected_ota": {
    "auto_update": { "enabled": true },
    "source": "service"
  },
  "source": "project"
}
```

This is illustrative output, not a live observation. `selected_ota.source`
comes from **`value.source`**, the configured automatic-update selector. The
schema distinguishes local platform releases (`legacy`) from OTA service
selection using the registered model (`service`). It does not identify a
release, artifact, platform promotion or assignment; manual assignments are
independent of this automatic-update setting. A configured service selector
does not prove service availability or authorize a legacy fallback.

The outer **`source`** is **section-level** metadata: the last section override
participating in resolution. With `merge_deep`, selected fields may retain
earlier levels' contributions, so it is not per-field provenance. This read
does not establish an atomic hierarchy snapshot or continuous authorization.

An enabled flag is configured intent. It does not prove publication, current
project/model release selection, promotion, eligibility or downgrade permission,
an OTA assignment, delivery, download, installation, fresh physical firmware
version, device applied state, signing authority or boot integrity. The current
public firmware guide separates Portal project/model promotion from device
delivery; a public project-key Promote/Stop API remains future work at the
reviewed source. This reader closes none of those acceptance gates.

There are no writes, release/grant/assignment calls, device reads, artifact
downloads, SDK transfers or physical-device operations.

## Failure and bounds

The single request/header/body has a nominal 10-second budget inside a
30-second total elapsed budget. Socket timeouts and a connected-transport timer
interrupt slow header/body streams. OS DNS resolution is outside Python's
socket timeout control; parsing and OS scheduling can also delay observation.
These are not universal hard deadlines.

The response must be uncompressed UTF-8 `application/json`, at most 1 MiB.
Duplicate keys, nonstandard JSON constants and float overflow to non-finite
values are rejected. HTTPS uses the standard library's certificate verification.
Redirects are rejected and there are no automatic retries. No response is saved,
and no upstream body, exception detail, credential or URL is logged. HTTP,
transport, scope-marker, schema or deadline failure exits nonzero. Correct the
trusted configuration/access/network and deliberately rerun this GET-only
reader when ready; it creates no resource requiring cleanup.

## Checks and design review

Compile without executing the CLI or any example function:

```sh
python3 -m py_compile main.py
```

Windows: `py -3.12 -m py_compile main.py`. The independent
[`project-ota-config-python.yml`](../../.github/workflows/project-ota-config-python.yml)
uses Ubuntu 24.04, a full-SHA checkout with credential persistence disabled,
`contents: read`, main/PR path filters, manual dispatch and a five-minute syntax
job. CI contains no API secrets or hardware and invokes only version output and
compilation.

Compound-engineering 1.2.9 source review, **October 9, 2026 (Pacific)**:

| Requirement | Source evidence | Conformance / remaining verification |
| --- | --- | --- |
| Independent public project read | Standard-library imports; one literal GET to `/config/ota` | Matched in source; runtime unverified. |
| Key-derived scope and restricted authorization | Configuration validation; optional project/deletion checks; backend route uses `req.auth.projectId` and `requireScopes('config:read')` | Matched in source. No missing config-read scope middleware was found; expected key/project mapping is an operator prerequisite and deployed authorization remains unverified. |
| Direct section at project hierarchy only | `select_ota`; direct response; allowed `default/organization/project`; required `merge_deep` | Matched against public guide/schema and resolver; live response and merge result unverified. |
| Narrow intent without defaults | Required actual boolean and `legacy/service`; selected settings/source only | Matched in source; malformed-response behavior unverified. |
| Publication/promotion/delivery/install boundaries | GET-only source; no device, release or grant path; documented evidence limits | Matched against current OTA architecture. No device applied revision or physical acceptance claim. |
| Bounded sanitized failures | 1 MiB; strict UTF-8/duplicate/finite parsing; timer/timeouts; no redirect/retry; fixed safe errors | Matched in source; runtime/network failure behavior unverified and DNS limitation retained. |
| Python syntax | Bundled Python 3.12 `py_compile main.py` on Windows | Passed locally; no example code executed. |
| Workflow and formatting | Parsed YAML and manual permission/trigger/SHA/syntax-only review; new-file whitespace check | Passed locally. Generator validator resources are absent; YAML/manual fallback used. |
| Hosted CI | Separate workflow is provided | Unverified; local syntax is not hosted evidence. |
| Unit/functional/live/device acceptance | Owner's creation-only instruction | Not run; advertised success/failure behavior remains unverified. |

Public basis: [repository architecture](../../ARCHITECTURE.md),
[Hierarchical Configuration](https://docs.bota.dev/guides/hierarchical-config),
[Firmware Updates](https://docs.bota.dev/guides/firmware-updates) and
[OpenAPI](https://github.com/bota-dev/docs/blob/main/api-reference/openapi.json)
`GET /config/{section}` and `DeviceSettings.ota`. Reviewed documentation
checkout: `7114baf52c6783fdd41224d00ca029c9e3ca101c`, including its local guide
changes. Documentation source does not establish deployed behavior.

Optional maintainer review at backend `1ac67c92c6d72858e29dc264037cb82b6c449825`
covered
[`config/index.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/index.ts),
[`config/controller.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/controller.ts),
[`auth.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/middleware/auth.ts),
[`definitions/ota.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/definitions/ota.ts),
[`hierarchy.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/hierarchy.ts),
[`config.service.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/services/config.service.ts)
and
[`firmware-release.service.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/services/firmware-release.service.ts).
The current private
[OTA Architecture](https://github.com/bota-dev/internal-docs/blob/main/device/Device-App-Backend%20OTA%20Design.md)
separates release publication, project promotion, delivery and installation.
The hierarchy design's desired/applied revision target is separate from this
project intent read. These references are review evidence, not installation or
runtime prerequisites.
