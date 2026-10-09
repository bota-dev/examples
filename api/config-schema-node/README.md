# Discover configuration schema metadata

Learn to read the public configuration registry with one `GET /v1/config/schema`
and print only each section's identifier, description, allowed override levels and
section merge strategy. This example reads no resolved settings, changes no
configuration and makes no device or processing requests.

Status on **2026-10-08**: implemented with source review and local installation /
syntax checks only. Runtime behavior, malformed-response handling, live API
acceptance and hosted CI are unverified. The owner requested creation without
unit, functional, live API or device testing; the CLI was not executed.

## Prerequisites and configuration

- Node.js **22.23.2** and npm; Windows, macOS or Linux. Local checks used Windows.
- An authorized server/operator environment with a project secret or restricted
  API key granting `config:read`. Keep the key and `.env` server-side, outside
  browser/mobile code and logs.
- The expected project ID from trusted administrative configuration. No end
  user, device, firmware or App SDK package is required; all code uses Node
  built-ins and installs independently of the repository's root workspace.

Run from this directory:

```powershell
npm ci
Copy-Item .env.example .env
```

On macOS/Linux, use `cp .env.example .env` for the copy. Replace placeholders in
the ignored `.env` file:

| Variable | Meaning / trust boundary |
| --- | --- |
| `BOTA_API_ORIGIN` | Trusted operator-selected API origin; defaults to `https://api.bota.dev`. HTTPS is required except explicit loopback HTTP for a local development service. No URL path, query, fragment or embedded credentials. Never derive it from caller input. |
| `BOTA_API_KEY` | Server-held `sk_test_*`, `sk_live_*` or `rk_*` project key with `config:read`. Use a reserved test project when qualifying the sample. |
| `BOTA_PROJECT_ID` | Expected `proj_*` identity. If the response or a section carries `project_id`, a mismatch is rejected. The current contract omits it: configuring this value does **not** prove the key belongs to that project. Verify the key's project independently through trusted administration. |

The endpoint is authenticated schema discovery, not an entity-specific owner
query. No project selector is sent. The sample is an operator CLI; adapting it
into a customer backend also requires caller authentication and authorization,
with origin, key and project context selected by that server.

## Run and output

```powershell
npm start
```

This command performs the API request. On success, stdout is a JSON object with a
`data` array containing only `section`, `description`, `levels` and
`merge_strategy`. For example, a selected row could be:

```json
{
  "section": "upload",
  "description": "Upload behavior, data limits, and scheduling settings",
  "levels": ["organization", "project", "end_user", "device"],
  "merge_strategy": "merge_deep"
}
```

Descriptions are untrusted API text emitted through JSON escaping, including
control characters. Treat them as data in downstream rendering. The sample
omits `defaults`, resolved values, arbitrary settings and response properties.
It never prints credentials or raw API/transport errors.

One 30-second deadline covers the request and body. Responses must be HTTP 200
UTF-8 JSON, at most 256 KiB and 64 sections. Section identifiers must be bounded
lowercase identifiers; descriptions are at most 2,048 characters; levels must
be unique members of `organization`, `project`, `end_user`, `device`; strategies
must be `override`, `merge_deep`, `append`, `min`, `max` or `ordered_max`.
Duplicate section identifiers and invalid metadata reject the entire response
before output. Redirects are rejected and no retry is automatic. Limits are
teaching-example bounds, not API service limits. Failure exits nonzero with a
fixed safe reason or HTTP status; after correcting configuration or investigating
the API, a new run is another read.

The API exposes no pagination or total count for this endpoint. Source inspection
shows a full list of the serving process's registered sections. The example
receives and validates that one response in full, never silently truncates it,
and writes an explicit limitation to stderr. This does not establish a stable
or deployment-wide complete registry across releases or backend instances.
No cloud resources or device recordings are created, so no API/device cleanup
is needed. Remove the local `.env` when retiring the sample.

## Contract and limits

The [public OpenAPI contract](https://github.com/bota-dev/docs/blob/main/api-reference/openapi.json)
defines `/config/schema` as `{ "data": [ConfigSectionDefinition] }`, where
each definition contains `section`, `description`, `defaults`, `levels` and
`merge_strategy`. The base URL supplies `/v1`. It also defines
`/config/schema/{section}` as a bare definition; this sample uses only the list
endpoint and has no arbitrary section selector.

The [hierarchical configuration guide](https://docs.bota.dev/guides/hierarchical-config)
explains inheritance and enforcement limits. Its `recording` section is absent
from the registry inspected at backend source `1ac67c92`: that registry registers
`connection`, `upload`, `processing`, `ota` and `upload_security`. The guide's
endpoint table also omits schema discovery, although OpenAPI and the tracked
routes contain it. These are source/documentation discrepancies, not live
observations. Discovery accepts valid returned section identifiers dynamically;
it neither fabricates `recording` nor assumes the same five sections are deployed.

The returned section strategy does not expose per-field merge overrides or the
Zod validation schema. For example, a section reporting `merge_deep` need not
apply that strategy to every field. Allowed override levels are registry
metadata, not this key's write permissions. Discovery proves neither that
firmware applies values nor that cloud processing workers support/enforce them;
it supplies no applied-state acknowledgement or provider approval.

## Verification and design review

```powershell
npm ci
npm run check
```

The dedicated path-filtered workflow runs these two commands with Node 22.23.2,
pinned checkout/setup actions and read-only repository permissions. It uses no
live credentials and does not execute the CLI.

| Requirement / basis | Evidence on 2026-10-08 | Status / remaining check |
| --- | --- | --- |
| Independent public read-only example, repository architecture §§3–6 | Own manifest/lock, zero dependencies; single fixed GET; no SDK/device/write operations | Matched by source review; CLI runtime not run |
| OpenAPI definition shape and `config:read` gate | Public OpenAPI and backend `1ac67c92` route/controller/registry/types compared | Matched by source inspection; live shape/scope enforcement unverified |
| Server credential/project boundary | Fixed trusted environment, redirects rejected, optional response project check, no secret output | Matched by source review; configured expected ID is not key-project verification; failure paths unverified |
| Bounded metadata output | Deadline/bytes/rows and all selected fields checked before JSON projection; duplicate IDs rejected | Matched by source review; functional malformed/slow/oversized response cases not run |
| Honest completeness and capability limits | No invented pagination; guide/registry differences and device/worker limits recorded above | Matched in documentation; deployed registry unverified |
| Frozen install and syntax | `npm ci` and `npm run check` on Node 22.23.2 / Windows | Passed; syntax establishes parsing only |
| Functional, live API and device acceptance | No unit/functional/live/device tests or CLI run under owner instruction | Unverified; remaining API success/failure qualification is separate |
| Hosted syntax workflow | Dedicated `config-schema-node.yml` | Implemented; hosted run not yet observed |

Review followed `bota-skills:compound-engineering` 1.2.9 using the repository
architecture, public contracts and this example's read-only acceptance criteria.
No runtime, deployed backend or hardware conformance is claimed.
