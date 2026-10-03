# Search transcript excerpts (Node.js)

Search one configured end user's indexed transcripts through the public
`POST /v1/recordings/search` API. Print timestamped excerpts as JSON for citation
or playback navigation. This example does not create an AI Ask session, generate
an answer, upload audio, or operate a physical device.

Requires Node **22.23.2 or newer**. Uses Node built-ins, with no runtime dependency
on another example, SDK source checkout, or Bota's internal application.

## Prepare

Use a server-side API key with **`recordings:read`** in the intended project and
a fixed authorized end-user ID. An end-user-scoped key must match that configured
end user. The example always sends `end_user_id`, even when the API could derive
it from a scoped key. Do not put the key in a browser or mobile application.

Input recordings must already have completed transcriptions and searchable
chunks. The platform schedules embedding after transcription when the effective
`processing.auto_embedding.enabled` policy permits it; a completed transcript
alone does not guarantee a populated index. The example does not change that
policy, enqueue indexing or wait for it. Empty results do **not** prove
that indexing completed, that no recordings exist, or that the query has no
relevant answer.

**Query egress and cost:** search sends the query to the Bota API and its embedding
provider under the project's provider policy. This can incur provider cost even
when results are empty, the client times out, or a later ownership check fails.
Use synthetic or consented content and verify the project's provider configuration
before a live run. Excerpts are transcript content and can be sensitive; stdout
and any redirected output need the same protection as those transcripts.

## Install and run

From this directory:

```sh
npm ci
cp .env.example .env
# Fill the blank values in .env using your own authorized project resources.
npm run check
npm test
npm start
```

On PowerShell, use `Copy-Item .env.example .env`. `.env` and the suggested
`results.json` output file are ignored by Git. There are no built-in credentials
or resource IDs. `npm ci`, checks and tests need no live Bota credential; `npm
start` performs the provider-backed search.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit API origin ending in `/v1`, normally `https://api.bota.dev/v1`; HTTPS required except loopback HTTP for local tests |
| `BOTA_API_KEY` | Server-held project key with `recordings:read` |
| `BOTA_END_USER_ID` | Required fixed authorized end user |
| `BOTA_QUERY` | Query of 1–1000 characters after trimming |
| `BOTA_LIMIT` | Maximum returned chunks, 1–50; default 8 |
| `BOTA_RECORDING_IDS` | Optional comma-separated allowlist of 1–500 distinct authorized recording IDs; blank searches that end user's indexed transcripts |

## Request and output boundaries

One search POST contains only `query`, `end_user_id`, `limit`, and the optional
`recording_ids`. There are no automatic retries, date filters, answer-generation
requests, or additional search pages. A result is a top-ranked selection, not a
complete transcript export. To narrow a live test, configure the allowlist to
known synthetic recordings.

Search rows do not include owner identity. Before printing any excerpts, the
example calls `GET /v1/recordings/{id}` once for each distinct returned recording
(at most 50 extra reads), using the same project key and API origin. Each ID and
`end_user_id` must match; allowlist escapes are rejected before these reads.
This relies on Bota's project-scoped API authorization and returned ownership
metadata. It is not a replacement for authenticated per-user authorization in a
multi-user application, or a transaction across changing recordings and indexes.

Output is `{ "results": [...] }` with exactly these documented fields:

- `chunk_id`, `recording_id`, `transcription_id`
- `chunk_text`, `speaker` (string or null)
- `start_ms`, `end_ms` (nonnegative ordered integer audio offsets)
- `recorded_at` (ISO timestamp or null), `score` (finite relevance number)

Use the offsets with an authorized player; the script does not construct or
print an audio URL. It drops arbitrary upstream fields, storage metadata and
URLs, and does not print the query, credentials, raw HTTP error bodies or exception
details. All rows and ownership checks must pass before any JSON is emitted.
Empty results produce `{ "results": [] }`. Exit status is 0 for a validated
response (including empty results), or 1 on failure.

One **30-second deadline** covers the search, all ownership reads and response
bodies. Every response is limited to **1 MiB**. The example also rejects excerpt
text over 32,768 characters and speaker labels over 128 characters; these are
local output limits, not advertised API limits. Oversized content fails rather
than being silently truncated. Redirects are rejected. After a timeout, a search
may already have reached its provider; the example does not repeat it automatically.

## Verification and design review

`npm ci`, `npm run check` and `npm test` pass locally on Node 22.23.2. The 12 test
cases use synthetic responses and loopback servers, including real-fetch redirect
rejection and a stalled response body. They make no Bota or provider calls.
The path-filtered GitHub workflow runs the same checks without credentials.

A bounded live check on 2026-10-03 at 01:21 UTC verified the known synthetic
fixture's project/end-user scope and completed transcription first, then made one
search POST with a one-recording allowlist and limit 3. The API returned HTTP 200
with `results: []`; there were no ownership GETs, excerpts, retries or indexing
changes. This verifies the empty-result path only. Nonempty retrieval, timestamped
live excerpts, real ownership GETs and indexing completion remain unverified.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Public retrieval contract and timestamped fields | Public search/get documentation, current API validation/service fields; request and projection tests | Matched in source and offline tests |
| Fixed identity and recording scope | Required end user, allowlist validation and unique ownership GETs before output; mismatch and partial-result tests | Matched in offline tests; one scoped empty live response, ownership GETs unverified live |
| Bounded execution and safe failures | Shared deadline, response/text limits, no retry, rejected redirects, sanitized HTTP/network failures | Matched in offline tests |
| Customer-independent example | Own manifest/lockfile, Node built-ins, no private helpers or shared runtime | Matched by source review |
| Search quality, indexing and provider behavior | One scoped synthetic live search returned HTTP 200 and no results | Empty-result path matched; nonempty retrieval and indexing unverified |

Public contracts: [Search Recordings](https://docs.bota.dev/api-reference/recordings/search)
and [Get Recording](https://docs.bota.dev/api-reference/recordings/get).
