# Read project upload-security policy (Node.js)

Observe one selected encrypted-upload policy at the authenticated key's project
level with a single public GET. This example reports cloud configuration
metadata and performs no policy write, capability negotiation, upload, SDK call
or device operation.

**Status, October 9, 2026 Pacific:** implemented with source review and syntax
checks only. Runtime, functional, live API, deployed authorization and
physical-device acceptance remain unverified. No example CLI/function,
unit/functional test or live API/cloud/storage/device action was executed in
this creation pass.

## Setup

Use **Node.js 22.23.2 or newer** on Windows, macOS or Linux. This directory owns
its manifest and lockfile, uses built-ins only, and needs no SDK, private package,
root workspace installation or sibling runtime import.

Run from this directory:

```sh
npm ci
cp .env.example .env
# Replace placeholders privately, or inject server environment values.
npm run check
npm start
```

On PowerShell use `Copy-Item .env.example .env`. `npm start` loads `.env` if
present; process environment takes precedence. Keep real credentials and IDs
private and out of Git. `npm run check` parses source without network or secrets.

| Variable | Meaning and trust boundary |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit independently trusted HTTPS destination ending in `/v1`, normally `https://api.bota.dev/v1`; no credentials, query, fragment, whitespace, controls or backslashes; literal `?`/`#` rejected even when empty |
| `BOTA_API_KEY` | Server-held project secret `sk_test_*` / `sk_live_*`, or restricted `rk_*` key with **`config:read`**; device/upload tokens rejected |
| `BOTA_PROJECT_ID` | Independently confirmed expected `proj_*` project; asserts optional response metadata and does not select another project |

**The key selects the project.** Independently confirm the exact key-to-project
mapping in a trusted operator context before running. The normal section
response has no `project_id`; this reader cannot discover or independently prove
the key's project. It adds no project selector/header. An app-facing service must
authenticate the caller, derive its authorized project/key on the server and
authorize the observation before returning metadata. Keep the key and trusted
API destination server-side; do not take either from a browser/mobile caller.

## Request and selected output

The only request is **`GET /v1/config/upload_security`**. The response must be
the direct **`{ value, source, definition }`** section, without an all-sections
wrapper. `definition.merge_strategy` must be `merge_deep`; section `source` must
be `default`, `organization` or `project`. End-user/device sources are rejected
at this project resolution level. An available `project_id` must match the
configured expectation, `deleted_at` must be null, and optional `section`
markers on the entry/definition must identify `upload_security`. Missing scope
markers are not invented; the authenticated project remains the API boundary.

`selected_upload_security` contains only `encrypted_upload_policy`, exactly
`legacy_allowed`, `v2_preferred` or `v2_required`. Missing, null and unknown
policies fail. The reviewed server has a `legacy_allowed` default, but this
client never fills a missing value or uses a default to recover an error.

The reviewed schema allows overrides at **organization, project and device**
levels; **end-user overrides are not allowed**. Its section strategy is
`merge_deep`, with a separate per-field **`ordered_max`** resolver in the order
`legacy_allowed < v2_preferred < v2_required`. A lower scope cannot relax a
stricter ancestor through ordinary override resolution. This reader returns the
server's selected policy unchanged, stops before device overrides and makes no
local merge, downgrade, profile-selection or fallback decision.

Section `source` is the last participating section override level. It can differ
from the level that supplied the retained strictest policy, so it is not
per-field provenance or proof that the client verified the merge calculation.
The response exposes the section merge strategy, not the field ordering.

Output contains the selected policy, limited source/resolution/evidence metadata
and whether an optional project marker was present. `effective_device_policy_verified`,
`device_enforcement_verified`, `recording_encryption_verified`,
`device_capability_verified`, `upload_authorization_verified`,
`cloud_commitment_verified`, `integrity_verified` and
`device_cleanup_authorized` are all **false**. No keys, IDs, full configuration,
profiles, providers, serials, URLs or arbitrary API fields are printed. Protect
redirected `project-upload-security.json` as operational metadata and remove or
retain it under your own policy.

A resolved `v2_required` value at project level is configuration intent. The
target device protection requires capability checks and the signed desired/applied
revision close-loop; this endpoint does not provide that evidence. No returned
policy proves that a recording is encrypted, grants upload/fallback permission,
establishes cloud commitment or authorizes deletion. Follow the full session
authorization and exact signed-receipt flow for actual encrypted uploads.

## Bounds and failures

The operation has a **30-second** monotonic budget. Its one request, including
headers/body, has at most **10 seconds**, and JSON is capped at **1 MiB**. Only
HTTP 200, uncompressed JSON and fatal UTF-8 decoding are accepted. Numbers must
be finite; Node's JSON parser retains the last value of duplicate keys.
Redirects and automatic retries are disabled. These asynchronous limits cannot
guarantee scheduling during OS suspension or a blocked event loop.

Exit **0** emits the validated observation. Exit **1** emits sanitized stderr
and no policy for configuration, HTTP, transport, timeout, schema or identity
failure. Raw exception/body/credential/URL data is never logged. Resolve access
or server compatibility explicitly before another observation; a failed read
must not trigger a policy write, local default or upload fallback.

## Public contract and design review

Public references: [hierarchical configuration](https://docs.bota.dev/guides/hierarchical-config),
[authentication](https://docs.bota.dev/authentication),
[public OpenAPI](https://docs.bota.dev/api-reference/openapi.json), and
[Encrypted Upload v2](https://docs.bota.dev/api-reference/uploads/encrypted-v2).

Source review at backend **`1ac67c92c6d72858e29dc264037cb82b6c449825`** covered
`api/src/routes/v1/config/{index,controller}.ts`,
`api/src/middleware/auth.ts`,
`api/src/config-schema/definitions/upload-security.ts` and
`api/src/services/config.service.ts`. The route uses `requireScopes('config:read')`
and the authenticated project. Restricted keys must have that scope; secret
keys have full access, while device/upload tokens are denied. There is no
missing restricted-key scope gate in this inspected route. The controller
returns the section entry directly with description/merge-strategy metadata;
project/section markers are not normally included. Source inspection does not
prove that a deployed server runs this revision or that firmware enforces it.

The compound-engineering comparison uses the repository architecture, public
contracts, Hierarchical Configuration Management Design and Encrypted Upload v2
desired/applied design. Cross-repository token searches identified the existing
hierarchical-config and encrypted-v2 guides, device get/update contracts and API
overview as related documentation. This new reader adds no config definition or
production capability; root catalog/reference integration is tracked separately.

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Independent setup | Own built-in-only manifest/lock; `npm ci` on Node 22.23.2 / Windows | Matched locally for installation |
| Syntax and workflow | `npm run check`; parsed YAML; full-SHA actions and syntax-only 5-minute job | Matched locally for parsing; hosted syntax passed; see delivery evidence below |
| Project and read scope | Source router/controller/auth: one exact project-selected GET and enforced restricted-key `config:read` | Matched by source; deployed key authorization/rejection unverified |
| Direct section and selected policy | Source validates shape, merge strategy, allowed sources/enums and optional identity/deletion markers | Matched by source; malformed/live response behavior unverified |
| Strictest server resolution | Schema levels and resolver field `ordered_max`; no local defaults, merging or downgrade choice | Matched by source; deployed resolution unverified |
| Honest evidence limits | Narrow projection and explicit false encryption/capability/commitment/cleanup flags | Matched by source; desired/applied device protection unverified |
| Bounded safe read | Source request/body/deadline caps, no redirects/retries/writes and sanitized errors | Matched by source; runtime transport/timeout rejection unverified |
| Functional/live/device acceptance | Owner requested creation only; none executed | Unverified; requires separately authorized runtime acceptance |

## Hosted syntax evidence

Implementation `6a50f36586212f5c388843a068a90c3f96c23b96` was pushed directly to examples
`main`. GitHub APIs confirmed the [run](https://github.com/bota-dev/examples/actions/runs/38003676851) and
[job](https://github.com/bota-dev/examples/actions/runs/38003676851/job/114067435269) completed successfully at that exact source.
This establishes frozen installation and JavaScript syntax only; no example, functional,
live API, filesystem, consumer or device acceptance was executed. The later
evidence update changes documentation only.
