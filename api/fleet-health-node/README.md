# Read project fleet health counts (Node.js)

Make one public `GET /v1/devices/stats` request with a server-held project key,
validate the three aggregate counts and print only those counts plus explicit
observation and evidence labels. This is a project-operator workflow: configure
an identity authorized to read the whole project, including every end user's
devices. It is unsuitable as an end-user endpoint without separate application
authorization.

**Status:** implemented with frozen-install, syntax and source evidence on
Node 22.23.2 / Windows, October 8, 2026. Runtime validation, timeout/size/error
handling and live API behavior remain unverified. No unit, functional, CLI
workflow, live API or device tests were run under the owner's creation-only
instruction.

## Configure and run

Use **Node 22.23.2 or newer** in a trusted server environment. Select the expected
`proj_...` project and its secret/restricted API key with `devices:read` scope.
Confirm that the key belongs to that project before running. The API does not
promise a project identifier in this response, so the expected project setting
does not independently prove the key's project. Keep the key out of browser,
mobile and publicly callable proxy code. No npm dependencies, App SDK, sibling
repository or hardware are required.

From this directory:

```sh
npm ci
cp .env.example .env
# Fill the blank values with your own authorized project and server-held key.
npm run check
npm start
```

On PowerShell use `Copy-Item .env.example .env`. `npm start` uses Node's optional
built-in environment-file loader; injected process variables take precedence.
Install and syntax commands make no API requests. Prefer server secret injection
for deployments and keep credentials out of shell history and logs.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required fixed, trusted HTTPS API origin ending in `/v1`, normally `https://api.bota.dev/v1`; no credentials, query or fragment. Choose it in server configuration, never from an untrusted caller. |
| `BOTA_API_KEY` | Required server-held project secret/restricted key with `devices:read`. |
| `BOTA_PROJECT_ID` | Required expected `proj_...` project; verify the key's assignment independently. |

Example output uses placeholders only:

```json
{
  "expected_project_id": "proj_example",
  "observed_at": "2026-10-08T12:00:00.000Z",
  "evidence": "backend_reported_counts",
  "project_scope_evidence": "authenticated_project_key",
  "physical_reachability_evidence": "not_verified",
  "atomic_fleet_audit_evidence": "not_established",
  "counts": {
    "online_count": 15,
    "low_battery_count": 3,
    "storage_full_count": 1
  }
}
```

`observed_at` is the local time after response validation, not the time every
device reported. The three counts must each be finite nonnegative safe integers;
missing fields, nulls, numeric strings, fractions and oversized integers fail.
If a `project_id` field is returned, it must equal the configured project;
otherwise output identifies the authenticated key as the project-scope evidence.
Missing `project_id` is accepted because it is absent from the selected public
contract and tracked backend response. A matching field supplements the key's
scope; it is no substitute for operator authorization.

The endpoint response contains individual device rows. This process receives
those rows within its bounded response but discards them without printing or
exporting device IDs, serial numbers, names, device metadata, firmware fields,
content or URLs. It prints no arbitrary response fields, credentials, raw HTTP
error bodies or raw exceptions. Redirected `fleet-health.json` is ignored by
Git; apply a suitable retention policy to project metadata and `.env`.

## Meaning and limits

The public [Fleet Status contract](https://docs.bota.dev/api-reference/devices/fleet-status)
defines `online_count`, `low_battery_count` and `storage_full_count`. Read-only
backend source at `1ac67c92c6d72858e29dc264037cb82b6c449825` confirms that:

- Counts are limited to the authenticated `project_id` and exclude soft-deleted
  device rows.
- `online_count` uses stored `last_heartbeat_at` newer than the database's current
  time minus 15 minutes. It is heartbeat-derived, not fresh physical connection,
  reachability or successful-command evidence.
- `low_battery_count` uses stored nonnull `battery_percent < 15`.
- `storage_full_count` uses positive `storage_total_mb` and a stored
  `storage_used_mb / storage_total_mb` ratio greater than 0.9.

Battery and storage values may be stale, and missing values are not proof of
healthy devices. Categories can overlap; adding the counts does not give the
fleet size. The endpoint supplies no aggregate sample timestamp or total-device
count. Do not infer exhaustive physical fleet health, currently reachable
devices, an atomic fleet audit or an end-user-scoped result from this output.

The source controller passes the authenticated project to the service and
repository, and the route explicitly requires `devices:read`. The repository
executes aggregate and individual-row queries concurrently without an explicit
shared snapshot. The reviewed public page at docs `c730fb5` used introductory
“real-time” wording beyond this source's evidence. This batch narrows that
introduction to stored observations. Its row example still uses `last_sync_at`,
while this source emits `last_seen_at` and `last_synced_at`. This example uses only
the three common aggregate fields; it does not establish deployed row shapes or
repair that remaining documentation/server discrepancy.

There is exactly one GET attempt, no polling and no automatic retry. Redirects
are rejected so the configured bearer remains on the selected API origin.
The response must be HTTP 200, uncompressed `application/json`, valid UTF-8 JSON
and at most **1 MiB**, including discarded device rows. Large fleets may exceed
this teaching-example bound; the example fails instead of truncating the result
or falling back to an unsupported aggregate-only endpoint.

A **10-second request timeout** covers connection, headers and streamed body.
Timers require the Node event loop to run; synchronous JSON parsing and OS work
can delay cancellation, so this is not a strict whole-process wall-clock bound.
Exit `0` means selected counts were read and validated, not that the fleet is
healthy. Exit `1` means configuration, transport, timeout, HTTP, size, JSON,
project contradiction or count validation failed; no counts are emitted. Failures
provide no conclusive health result. A deliberate later run makes a new GET
observation. No cloud writes, device calls, processing, device cleanup or local
output file creation are performed by the script.

## Evidence and design review

The compound-engineering review uses the independent-example, trust-boundary
and acceptance requirements in the repository's `ARCHITECTURE.md`, the public
Fleet Status contract and the owner's creation-without-testing instruction.

| Requirement | October 8, 2026 evidence / remaining verification |
| --- | --- |
| Independent setup | Built-ins only; own manifest/lockfile; `npm ci` and syntax check passed on Node 22.23.2 / Windows. Matched for install/syntax. |
| Public project-wide GET | Public contract and backend controller/service/repository inspected at the recorded commit. Matched by source inspection; deployed enforcement unverified. |
| Scope and counts | Expected project configured, optional contradiction rejected, three safe integer counts selected. Matched by inspection; runtime rejection unverified. |
| Bounded metadata-only observation | One GET, 10-second timer, 1 MiB cap, no redirects/retry; device rows excluded from output. Matched by inspection; runtime behavior unverified. |
| Accurate evidence labels | Output and this README identify backend-reported counts, key-derived project scope and physical/atomic evidence gaps. Matched by inspection. |
| Hosted workflow | Install/syntax [passed at source `2752a79`](https://github.com/bota-dev/examples/actions/runs/37887199899); runtime acceptance remains unverified. |
| Functional/live/device acceptance | Not run under the owner's creation-only instruction; no runtime or physical conformance claim. |

Maintainer source references are `api/src/routes/v1/devices/index.ts`,
`controller.ts`, `api/src/services/device.service.ts` and
`api/src/repositories/device.repository.ts` in the recorded backend checkout.
Those internal sources are review context only; readers run this directory
independently using the public API contract.
