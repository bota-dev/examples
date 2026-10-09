# Read a recording's transcription directory with Node.js

Traverse bounded public transcription pages for one configured recording and print selected job metadata. This independent server-side CLI uses Node built-ins and GET only. It starts no job, calls no model, cancels nothing and performs no device operation. For transcript content, use a separately authorized export workflow.

**Status (2026-10-08): implemented with source review and install/syntax checks only.** Unit, functional, runtime, live API and failure-path acceptance remain unverified under the owner's creation-without-testing instruction. No CLI run or API/device call was performed during this creation batch.

## Setup

Use Node **22.23.2 or newer** and npm on Windows, macOS or Linux. Configure a trusted project-scoped secret or restricted API key with the documented **`recordings:read`** and **`transcriptions:read`** scopes. Select an existing recording currently owned by the configured end user. The key selects the API project; expected IDs are consistency checks from trusted server administration, not authorization supplied by a caller.

Install from this directory without installing the repository root or siblings:

```sh
npm ci
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env`. Edit the ignored `.env`:

| Variable | Meaning |
|---|---|
| `BOTA_API_BASE_URL` | Required trusted HTTPS origin with `/v1`, normally `https://api.bota.dev/v1`. No credentials, query, fragment or other path; no HTTP fallback. The key is sent to this origin, so derive it only from trusted server settings. |
| `BOTA_API_KEY` | Server-held project key with the two read scopes. Device/upload tokens and placeholders are rejected. Never expose it in browser/mobile code, committed configuration or logs. |
| `BOTA_PROJECT_ID` | Required expected `proj_*`; any returned `project_id` must match. The public schemas omit this field, so its absence cannot independently corroborate the key's project. |
| `BOTA_END_USER_ID` | Required exact authorized `eu_*`. Both recording reads must return this owner. |
| `BOTA_RECORDING_ID` | Required exact authorized `rec_*`. Every list request and every returned job must refer to it. |
| `BOTA_LIMIT` | Page size 1–20; default 20. |
| `BOTA_MAX_PAGES` | Page cap 1–10; default 5. |

## Run and output

```sh
npm start
```

For JSON without npm's banner:

```sh
node --env-file-if-exists=.env index.mjs
```

Illustrative output, not runtime evidence:

```json
{
  "recording_id": "rec_example",
  "transcriptions": [
    {
      "id": "txn_example",
      "recording_id": "rec_example",
      "status": "completed",
      "language": "en",
      "started_at": "2026-10-08T12:00:01.000Z",
      "completed_at": "2026-10-08T12:00:05.000Z",
      "created_at": "2026-10-08T12:00:00.000Z",
      "updated_at": "2026-10-08T12:00:05.000Z",
      "provider": "deepgram"
    }
  ],
  "pages": 1,
  "complete": true,
  "stopped_reason": "observed_end",
  "snapshot": false
}
```

An empty directory is valid. Job statuses must be `pending`, `processing`, `completed` or `failed`. The CLI emits IDs, status, a validated language label and validated timestamps; nullable language/start/completion fields stay null. Language permits bounded simple subtags such as `en` or `en-US`; unfamiliar formats stop rather than print arbitrary strings. Provider is an open string in the public schema: the output includes null or recognized labels `whisper`, `deepgram`, `assemblyai` and `elevenlabs`; other bounded string values are omitted. This is a metadata projection, not a claim that the public schema has a provider enum.

Full text, segments, word counts, confidence, error messages, names, audio/storage URLs, arbitrary upstream fields, credentials and cursors are excluded. Upstream responses may contain transcript content even though output does not. The CLI buffers bounded responses in memory; do not log raw bodies or commit captured output. Treat JSON as data and keep any saved metadata private.

The request sequence is an ownership `GET /v1/recordings/{fixed_id}`, then up to the configured cap of `GET /v1/transcriptions?recording_id={fixed_id}&limit=...`, followed by a fresh ownership read. The previous opaque `next_cursor` is passed as `cursor` on each subsequent page; the recording filter is retained on **every** page. No cursor is decoded, logged, persisted or synthesized, and no offset, end-user list filter or invented private endpoint is used.

Every job must have a valid `txn_*` ID, the exact recording ID, known status, valid selected metadata, and the expected project when returned. In both recording reads, `end_user_id` must match and optional `project_id` must match. If a `deleted_at` marker appears on a recording or job, it must be exactly null; missing markers are accepted because the public examples omit them. Missing markers do not independently prove physical deletion state. All metadata remains buffered until the final owner check succeeds; errors emit no partial directory JSON.

An optional page-level `project_id` must also match the configured project.

| Exit status | Meaning |
|---|---|
| 0 | Observed `has_more: false`; `complete: true`, `stopped_reason: "observed_end"`. |
| 2 | API still reports more rows at the page cap; `complete: false`, `stopped_reason: "page_limit"`. |
| 1 | Configuration, response, ownership, transport or deadline failure; no directory JSON is emitted. |

`complete` means observed cursor exhaustion only. Separate list/ownership GETs are **non-atomic**: jobs or ownership can change between reads, and a transfer away and back can evade those observations. No result is an exhaustive audit, immutable snapshot, transcript-content authorization for another user, processing success guarantee or device-cleanup permission. `snapshot: false` makes that boundary explicit.

The bounds are 60 seconds overall, 10 seconds per request, at most 10 list pages/200 selected jobs, and 1 MiB of uncompressed UTF-8 JSON per response. Listing uses the first 50 seconds and reserves the final 10 seconds for ownership recheck; budget failure produces no output. At most 12 GETs permit at most 12 MiB of response bytes across a full run. Actual JSON objects occupy additional bounded memory. These are example limits, not API service limits: large content-bearing responses can fail before metadata projection.

Exact HTTP 200, JSON content type, uncompressed bodies and valid UTF-8/JSON are required. Redirects and automatic retries are disabled. `has_more` must be an actual boolean. A continuing page must contain rows and a nonempty bounded cursor; repeated cursors, repeated job IDs, malformed metadata and overlarge pages stop traversal. A terminal cursor must be absent or null. Optional `total` must be a nonnegative safe integer but cannot establish completeness and is excluded from output.

After a failure or cap, review scope/configuration and rerun from the beginning; there is no resume journal. On 401/403, check credentials and scopes; on 429, wait before rerunning. Other failures require environment/API investigation. GET failure grants no authority to create or replace transcription jobs. No cloud or device cleanup is needed; remove local credentials when finished.

## Public contract and design review

The contract basis is [OpenAPI](https://docs.bota.dev/api-reference/openapi), [Get Recording](https://docs.bota.dev/api-reference/recordings/get), [Get Transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get), [pagination](https://docs.bota.dev/api-reference/pagination) and [authentication](https://docs.bota.dev/authentication). The OpenAPI `GET /transcriptions` operation documents `recording_id`, `limit`, `cursor` and `data`/`has_more`/`next_cursor`; the get page supplies the job metadata shape. No standalone prose transcription-list page was present in the reviewed documentation source.

Source inspection on 2026-10-08 used the public documentation source and read-only backend commit `1ac67c92`. The v1 controller passes authenticated project, `recording_id`, limit and cursor to the service. `findMany` scopes by project and recording, orders descending by creation time and ID, and requests one extra row. The pagination builder returns boolean `has_more`, bounded `data` and `next_cursor` only when more rows exist. The runnable example imports no backend code or private helper.

**Source gap:** the inspected transcription router does not invoke `requireScopes` on its list/get routes; global authentication selects a project but does not enforce the documented `transcriptions:read` permission there. The recording get route does invoke `requireScopes('recordings:read')`. Configure both documented scopes and preserve application ownership checks; this example cannot repair server enforcement or establish deployed authorization behavior. Optional backend `project_id` and recording `deleted_at` fields are checked when present but are omitted from public examples. Backend cursor decoding details are source evidence only and never a client cursor format.

The compound-engineering review compares examples architecture §§2–6 and the public contracts with this implementation:

| Requirement | Evidence (2026-10-08) | Status / remaining verification |
|---|---|---|
| Independent public API example | Own manifest, lock, configuration and built-in HTTP/JSON logic; no imports or dependencies | Matched in source; local `npm ci` passed on Windows / Node 22.23.2 |
| Exact recording filter and GET-only traversal | Fixed recording on every list page; only opaque cursors; no write/model/device code | Matched in source; runtime request construction and live paging unverified |
| Ownership and resource consistency | Exact owner/recording pre/post reads; per-job source and optional project/deletion checks | Matched in source; mismatch/deletion/failure behavior unverified; reads non-atomic |
| Documented read scopes | Config/docs require both scopes; backend source reviewed | Partial platform enforcement in reviewed source; deployed scope behavior unverified |
| Bounded progression and honest completion | Page/item/time/body caps; duplicate/cursor checks; explicit capped vs observed-end output | Matched in source; malformed-page, cap and timeout runtime acceptance unverified |
| Metadata-only output | Selected validated projection after final ownership check; safe fixed error text | Matched in source; runtime data/error output unverified |
| Independent syntax workflow | Path-scoped pinned actions, `contents: read`, install and parse only | Matched in source; hosted execution unverified |
| Verification boundary | Local `npm ci` and `npm run check` passed; no CLI invocation, test suite or API/device call | Syntax verified; functional/live acceptance not run by owner instruction |

Local syntax verification:

```sh
npm run check
```

This parses JavaScript only. Installation and syntax checks do not establish live API compatibility, runtime authorization or failure-path conformance. No test script is provided for this creation batch.

To expose this workflow through an application backend, authenticate the caller and derive their allowed project/end-user/recording on the server. Preserve the fixed filter and output projection; do not accept caller-selected upstream paths, keys or origins, or turn project-level access into an unscoped directory proxy.
