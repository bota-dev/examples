# Read project upload intent (Node.js)

Read four selected effective upload settings at the authenticated key's project
level. The example makes one public GET and reports cloud resolution metadata;
it performs no upload, configuration write, device command, SDK call or hardware
operation and applies no end-user/device override or local default.

**Status:** implemented with source review and syntax checks on October 9,
2026. Runtime, authorization rejection, API compatibility and enforcement remain
unverified. No example CLI, function, unit/functional test, live API or device
execution occurred in this creation pass.

## Setup

Use **Node.js 22.23.2 or newer** on Windows, macOS or Linux. This directory owns
its manifest/lockfile and uses built-ins only; no SDK, root workspace install,
private package or sibling repository is needed.

```sh
npm ci
cp .env.example .env
# Replace placeholders in your private .env or inject server environment values.
npm run check
npm start
```

Run these commands from this directory. On PowerShell use
`Copy-Item .env.example .env`. `npm start` loads `.env` if present; process
environment values take precedence. Keep the file private or use your server's
secret manager. `npm run check` parses source without credentials or network.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit independently trusted HTTPS origin ending in `/v1`; no URL credentials, query, fragment, controls or backslashes |
| `BOTA_API_KEY` | Server-held project secret or restricted key with **`config:read`**; device/upload tokens rejected |
| `BOTA_PROJECT_ID` | Expected `proj_*` independently verified against this API key's project; checks optional response metadata only |

**The key selects the project.** Before running, independently confirm its exact
project in your trusted operator context. The normal response does not contain
`project_id`; this reader cannot discover or independently prove which project
the key belongs to. `BOTA_PROJECT_ID` does not select another project, add a
workspace header or change the route. For customer services, authenticate the
caller and derive its authorized project/key on the server. Never embed this
privileged credential in browser/mobile code or accept its origin from a caller.

## Request and selected values

The single request is **`GET /v1/config/upload`**, authenticated by the project
key. The direct response must be `{ value, source, definition }`, without an
all-sections wrapper. `definition.merge_strategy` must be `merge_deep` and
`source` must be `default`, `organization` or `project`. End-user/device sources
are rejected at this resolution level. An available `project_id` must equal
the configured expectation, available `deleted_at` must be null, and optional
section identity markers must identify `upload`. Missing normal scope markers
are not invented; backend authorization remains the project boundary.

| Selected setting | Accepted value |
| --- | --- |
| `streaming_enabled` | Actual boolean |
| `streaming_chunk_kb` | Safe integer `64`–`1024` |
| `streaming_flush_interval_seconds` | Safe integer `0`–`255`; documented zero disables timed partial-chunk flushing |
| `daily_data_limit_mb` | Safe integer `0`–`10000`; numeric zero is retained unchanged |

Missing values, strings substituting for booleans/integers, non-finite numbers
and out-of-range values fail closed. No default is applied. Only
`selected_upload`, section `source`, resolution/evidence metadata and false
verification flags are printed. No keys, full configuration, schedules,
profiles, provider details, device identifiers, serials or arbitrary API fields
are emitted. Protect redirected `project-upload-config.json` as operational
metadata and retain/remove it under your own policy. No cloud cleanup is needed.

Section `source` identifies the last section override level, not each field's
provenance. `daily_data_limit_mb` uses a numeric **`min` field override** in the
reviewed resolver. Although zero is documented as unlimited, ordinary numeric
minimum makes zero win over positive ancestor/child values. This reader reports
the returned number only; it neither corrects resolution locally nor infers an
enforced unlimited policy or data cap. There is no usage accounting here.

Project resolution stops before end-user/device overrides. It is not effective
device configuration, an applied firmware acknowledgement, an upload execution
result or proof of a flush interval/data-limit enforcement. In particular,
released compatibility firmware can use fixed chunk behavior and omit policy
enforcement described in the public guide. Output makes those evidence limits
explicit with false `effective_device_configuration_verified`,
`device_applied_state_verified`, `upload_execution_verified`,
`upload_timing_verified` and `data_limit_enforcement_verified` flags.

## Bounds and failures

The operation has a **30-second** monotonic budget; its one request/header/body
read additionally has at most **10 seconds**, with a **1 MiB** response cap.
Only HTTP 200, uncompressed JSON and fatal UTF-8 decoding are accepted. JSON
numbers must be finite; Node's parser retains the last value of duplicate keys.
Redirects and automatic retries are disabled. These asynchronous limits cannot
guarantee scheduling during OS suspension or a blocked event loop.

Exit **0** emits the validated narrow observation. Exit **1** emits sanitized
stderr and no settings for configuration, HTTP, transport, timeout, schema or
identity failure. Raw exceptions/bodies are never printed. Explicitly resolve
access or server compatibility before requesting another observation; errors
must not trigger local fallback values or a configuration write.

## Contracts and design review

Public references: [hierarchical configuration](https://docs.bota.dev/guides/hierarchical-config),
[authentication](https://docs.bota.dev/authentication), and
[device-level upload reader](../upload-config-node/README.md) for a separate
device-owned resolution workflow.

Source review at backend `1ac67c92c6d72858e29dc264037cb82b6c449825`
covered `api/src/routes/v1/config/{index,controller}.ts`,
`api/src/config-schema/definitions/upload.ts` and `api/src/services/config.service.ts`.
The router requires `config:read` and derives the project from authenticated
context. The controller returns the section entry directly; its definition
normally contains description/merge strategy, not a section/project identity.
Source inspection does not prove the deployed server runs that revision.

| Requirement | October 9, 2026 evidence / status |
| --- | --- |
| Independent installation | Own manifest/lock, built-ins only; `npm ci` passed on Node 22.23.2 / Windows |
| Syntax | `npm run check` passed; source parsing only |
| Correct project route and scope | Source router/controller: `/config/upload`, `config:read`, authenticated project; live key authorization unverified |
| Narrow actual-schema projection | Source: exact boolean/integer bounds, valid source/merge strategy, optional markers checked, no local defaults |
| Honest intent versus enforcement | Source/docs: raw numeric min result and false device/timing/enforcement flags; applied behavior unverified |
| Bounded safe GET | Source: response/deadline bounds, no redirects/retries/writes and sanitized failures; runtime rejection unverified |
| Hosted workflow | [Frozen-install/syntax run](https://github.com/bota-dev/examples/actions/runs/38001047171) passed at `268150ec24422067747075676a251fd519025834`; source parsing only |
| Functional/live API/device acceptance | Not run under the owner's creation-only instruction |
