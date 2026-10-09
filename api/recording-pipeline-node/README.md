# Observe one recording pipeline

Read one caller-configured recording, transcription and summary, check their exact
source links, project and recording owner, and print selected status metadata.
This server-side CLI makes four public GET requests for one observation. It
discovers no jobs, polls no resource, starts no processing, retrieves no audio and
performs no cloud, device or local-file mutation.

**Status:** implemented with frozen installation, syntax checks and source review
only on Node 22.23.2 / Windows, October 8, 2026. Functional, live API and failure
behavior remain unverified. No unit/functional tests, live calls or hardware
operations were added or run, following the owner's creation-only instruction.

## Setup and run

Use Node.js **22.23.2 or newer** and a project key with `recordings:read`,
`transcriptions:read` and `summaries:read`. All three resources must already exist;
their statuses can be pending, processing, completed or failed. Recording also
accepts the documented `streaming`, `uploaded` and `integrity_failure` statuses.
No SDK, third-party npm package, sibling runtime or physical device is needed.

From this directory:

```sh
npm ci
cp .env.example .env
# Fill every blank value with your own authorized project resources.
npm run check
npm start
```

On PowerShell use `Copy-Item .env.example .env`. Install and syntax commands need
no API credentials. `npm start` makes authenticated cloud reads.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required trusted API origin ending in `/v1`, normally `https://api.bota.dev/v1`; HTTPS except explicit loopback HTTP. No URL credentials/query/fragment. |
| `BOTA_API_KEY` | Required server-held secret/restricted project key with all three read scopes. |
| `BOTA_PROJECT_ID` | Required exact expected project. |
| `BOTA_END_USER_ID` | Required exact authorized owner (`eu_...`). |
| `BOTA_RECORDING_ID` | Required existing source recording (`rec_...`). |
| `BOTA_TRANSCRIPTION_ID` | Required existing transcription of that recording (`txn_...`). |
| `BOTA_SUMMARY_ID` | Required existing summary of that transcription (`sum_...`). |

Select the exact IDs using your own authorized application's records. Get
Recording does not list its transcription/summary jobs. The example does not
guess IDs, select a newest job or treat one configured job as the complete history.
Secret/restricted keys stay in this server process and never belong in mobile or
browser configuration. The API key scopes reads to its project; the configured
project is also checked when the resource contract exposes it.

These inputs describe an operator-authorized CLI scope. A multi-user application
must authenticate the caller and derive the permitted project, end user and
resource IDs from trusted server-side context. Client-supplied IDs alone are not
authorization. Configure only a trusted origin: that origin receives your key.

## Reads and output

The script uses these public routes, in order:

1. `GET /v1/recordings/{id}` checks exact recording ID, configured owner, any
   returned project, no deletion marker and the selected metadata fields.
2. `GET /v1/transcriptions/{id}` checks exact transcription ID, exact source
   recording, any returned project, status and timestamps.
3. `GET /v1/summaries/{id}` checks exact summary ID, mandatory exact project,
   exact source transcription, status and timestamps.
4. `GET /v1/recordings/{id}` repeats the recording checks before any output.
   The output's recording status/timestamps come from this final read.

The recording/transcription GET contracts do not promise `project_id`; if that
field is returned, even null, it must match. Summary's documented `project_id`
is required. Every selected field is validated before a single JSON document is
printed. Missing or null optional timestamps become null; invalid timestamp
formats and unknown status values fail without snapshot output. Required creation
and update timestamps must be present.

Output contains `observed_at`, `atomic_snapshot: false`, the configured project,
and three separate objects:

| Object | Selected fields |
| --- | --- |
| `recording` | `id`, `end_user_id`, `status`, `content_sha256_verified_at`, `server_hash_verification_timestamp_present`, `created_at`, `updated_at` |
| `transcription` | `id`, `recording_id`, `status`, `started_at`, `completed_at`, `created_at`, `updated_at` |
| `summary` | `id`, `project_id`, `transcription_id`, `status`, `started_at`, `completed_at`, `created_at`, `updated_at` |

No arbitrary response object is forwarded. Audio URLs, audio/hash bytes, actual
hash values, names, metadata, transcripts, summary output, custom prompts,
provider details and upstream error messages are excluded. Treat captured IDs
and status output as private project information.

## Interpret the three statuses separately

Recording status describes ingestion. Recording-level `processing` and
`completed` are legacy values; current transcription completion does not change
Recording status. Transcription and summary each report their own job status.
A failed summary can coexist with a completed transcription. A pending summary
can coexist with an uploaded recording. The script reports these observations
without inferring readiness, overall completion, missing jobs or a failure cause.

A non-null `content_sha256_verified_at` is server-reported evidence of a
successful asynchronous hash match. `server_hash_verification_timestamp_present`
reports only the presence of that timestamp. Null or omitted verification means
that evidence was not returned; it does not by itself mean failure. Hash
verification enqueue is best effort, and automatic processing is not gated on
this timestamp. `status: "uploaded"` alone is never verification or source-copy
deletion proof. This metadata observation supplies no device cleanup authority;
the chosen upload protocol's durable commitment/confirmation requirements still
apply. The script never deletes a source copy.

Separate GETs do not form an atomic snapshot, even after the final owner check.
Ownership and job state can change between or after reads; a change away from
and back to the same owner is not detectable here. `observed_at` is the local
time after the reads, rather than a shared server revision. Matching source links
establish the observed lineage, not continuously valid ownership or agreement
between every resource at one instant. Production applications must enforce
their own authorization and concurrency requirements.

## Bounds, failure and cleanup

One **30-second abort deadline** covers all requests and response reads, with a
final deadline check before output. Each response must be HTTP 200 and valid
UTF-8 JSON with content type `application/json`, bounded to **1 MiB**. This is a
teaching bound: a valid resource with a large transcript or summary may exceed it
even though those contents are not printed.

Requests use Node's core HTTP/HTTPS clients and connect directly to the configured
origin, without environment proxies or a global fetch dispatcher. HTTPS uses
normal certificate verification. HTTP is allowed only on explicit `localhost`,
`127.0.0.1` or `[::1]`. Redirects are rejected as non-200 responses; credentials
are never forwarded to another origin. There are no automatic retries, polling,
storage requests or processing writes.

Exit status is 0 after a validated observation, including when a job reports
`failed`. Exit status is 1 for configuration, ownership, identity, malformed
metadata, missing resources, HTTP, transport or deadline errors. Errors use
controlled descriptions and HTTP status codes; raw exceptions, API bodies,
URLs and credentials are omitted. An error/deadline is an inconclusive
observation rather than proof that a cloud job failed. Correct the scope/access
or observe again deliberately; the example never replaces or cancels a job.

No resources, files, journal or device state are created or changed. Delete the
private `.env` file or revoke its key when no longer needed; retain any captured
output according to project policy.

## Evidence and design review

The compound-engineering review uses repository Architecture §§2–4 and the public
Get Recording, Get Transcription, Get Summary and Recording Status contracts.
Only the following installation/syntax commands were executed:

```sh
npm ci
npm run check
```

| Requirement | Evidence | October 8, 2026 review status / remaining verification |
| --- | --- | --- |
| Independent public setup | Own manifest/lock, core Node HTTP only; frozen install and syntax passed locally on Node 22.23.2 | Matched locally; no runtime dependency on siblings |
| Exact configured lineage/project/owner | Four GETs and checks in `recordingSnapshot`, `transcriptionSnapshot`, `summarySnapshot` before stdout | Matched in source; rejection behavior and live enforcement unverified |
| Existing resources at any documented state | Independent status allowlists; no completion prerequisite, discovery, polling or write path | Matched in source; runtime cases unverified |
| Separate upload/integrity/processing observations | Three separate objects, explicit verification timestamp presence and `atomic_snapshot: false` | Matched in source; continuous ownership/atomicity not provided |
| Selected metadata only | Fixed output projection, validated IDs/status/timestamps, controlled errors | Matched in source; runtime privacy/failure behavior unverified |
| Bounded direct reads | Shared abort signal, 1 MiB response cap, core direct HTTP and non-200 rejection | Matched in source; deadline/network/oversize behavior unverified |
| Tests and live/hardware acceptance | Not added or run under the owner's creation-only instruction | Unverified; later authorized functional/live checks remain necessary |
| Hosted workflow | Separate path-filtered frozen-install/syntax workflow, pinned actions | Configured; local checks do not establish hosted success |

Public contracts: [Get Recording](https://docs.bota.dev/api-reference/recordings/get),
[Recording Status](https://docs.bota.dev/api-reference/recordings/create#recording-status),
[Get Transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get) and
[Get Summary](https://docs.bota.dev/api-reference/ai/summaries/get).
