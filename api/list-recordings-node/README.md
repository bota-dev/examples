# List recording metadata with Node.js

Learn to follow the public recordings API's cursor pagination and print a bounded metadata list from your selected project. This server-side CLI uses only Node built-ins. It performs GET requests only; it does not download audio, request signed URLs, transcribe, summarize or mutate resources.

**Status:** implemented; local contract/CLI tests pass with synthetic responses and a loopback fake API. A read-only live test verified cursor traversal, capped results and end-of-list completion in a dedicated test project. Hosted CI has not run. No device, firmware or App SDK is required.

## Setup

Use Node **22.23.2 or newer** and npm on Windows, macOS or Linux. Obtain a project-scoped secret or restricted API key with **`recordings:read`**. The key selects the project; there is no client-supplied project override. Keep the key in your terminal/server environment, never a browser or mobile application. An optional end-user filter must refer to that project.

From this example directory (no root or sibling install):

```sh
npm ci
cp .env.example .env
```

PowerShell users can use `Copy-Item .env.example .env`. Edit the ignored `.env`:

| Variable | Meaning |
|---|---|
| `BOTA_API_BASE_URL` | Required API base including `/v1`. The sample URL is production; select your intended environment explicitly. HTTPS required except loopback development. |
| `BOTA_API_KEY` | Required project server credential with `recordings:read`. |
| `BOTA_END_USER_ID` | Optional existing `eu_*` filter. Blank lists the selected project's recordings. |
| `BOTA_LIMIT` | Page size, 1–100; default 20. |
| `BOTA_MAX_PAGES` | Maximum page requests, 1–50; default 5. |

This focused example exposes only the optional end-user filter. Other endpoint filters are outside its scope.

## Run

```sh
npm start
```

For JSON without npm's command banner:

```sh
node --env-file-if-exists=.env index.mjs
```

An empty project is a valid result. A nonempty result has this form:

```json
{
  "recordings": [
    {
      "id": "rec_example",
      "status": "uploaded",
      "duration_seconds": 12,
      "recorded_at": null,
      "created_at": "2026-10-01T12:00:00.000Z"
    }
  ],
  "pages": 1,
  "complete": true,
  "stopped_reason": "end_of_list"
}
```

Only ID, recording status, duration, recording time and creation time are printed. Names, arbitrary metadata, user/device identifiers, transcripts, storage paths and URLs are excluded. Even projected metadata may be private; avoid committing output. A recording's status is not proof that transcription or summary completed.

The API returns `data`, `has_more` and an optional `next_cursor`. The CLI treats cursors as opaque and passes them unchanged on the next GET; it neither decodes nor prints them. There is no offset parameter. `complete: true` means this traversal reached `has_more: false`, not a consistent snapshot of a changing project.

| Exit status | Result |
|---|---|
| 0 | Reached the end of this listing. |
| 2 | Page budget reached while the API still reported more rows. Output explicitly has `complete: false` and `stopped_reason: "page_limit"`. |
| 1 | Configuration, authorization, HTTP, response or transport failure. No partial JSON is emitted. |

For a pagination smoke test against your own authorized environment, set `BOTA_LIMIT=1` and `BOTA_MAX_PAGES=3`; two or more accessible rows exercise multiple pages. This repository's checks never use a live key.

Each request has a 10-second timeout; the traversal has a 60-second deadline, a 2 MiB page-body limit and a maximum of 5,000 projected rows. There are no automatic retries. On 401/403, correct the key/scope. On 429, wait before running again. A malformed page or missing/repeated continuation cursor stops the traversal. After a failure or page cap, adjust the configuration if appropriate and rerun from the beginning; this example has no resume journal. Concurrent additions, deletions or changes can affect the listing, so it is not an export or snapshot guarantee. It creates no cloud resources and needs no cloud/device cleanup; remove the local `.env` when finished.

## Verification and design review

```sh
npm run check
npm test
```

The public contract is documented in [List Recordings](https://docs.bota.dev/api-reference/recordings/list), [pagination](https://docs.bota.dev/api-reference/pagination), [authentication](https://docs.bota.dev/authentication) and [OpenAPI](https://docs.bota.dev/api-reference/openapi). The contract source and API pagination implementation were inspected on 2026-10-02: `limit` is 1–100, `cursor` is opaque, terminal `next_cursor` may be absent (the prose example also shows null), and `recordings:read` is required. No private endpoint or runtime source dependency is used.

| Check | Dated evidence |
|---|---|
| Local install/syntax/tests | 2026-10-02, Windows, Node 22.23.2: `npm ci`, `npm run check`, all **12 tests passed**, both in place and in a standalone clean copy outside the repository. |
| Live capped traversal | 2026-10-03 00:20:37 UTC (October 2 local): protected test key, page size 1, maximum 3 pages. Optional end-user filter and project-wide runs each made 3 GETs, returned 3 unique IDs, and reported `complete: false` / `page_limit`. |
| Live end of list | 2026-10-03 00:21:23 UTC: same configured test end user, page size 100, maximum 1 page. One GET returned 16 unique metadata rows and `complete: true` / `end_of_list`. |
| Hosted workflow | Not run. |

The three live runs made seven GET requests total and no mutations. Raw records, IDs, names and credentials were not printed in the verification evidence or committed. This proves the exercised test-project listing paths, not snapshot consistency or every possible response/failure condition.

Compound review against the examples architecture §§2–6:

| Requirement | Evidence | Status / remaining check |
|---|---|---|
| Independent installation | Own manifest/lockfile; Node built-ins; no sibling imports; clean-copy frozen install/check | Matched locally on Node 22.23.2 / Windows |
| Public pagination and optional filter | Cursor/query tests, terminal empty list, loop detection and page cap; three live GET-only runs above | Matched in local tests and the stated live test project |
| Credential and data boundary | Server-only key, fixed endpoint, real redirect refusal, metadata projection and redacted errors | Matched in local tests |
| Bounded failures | Page/time/body bounds, no write/retry path, no partial success after later-page failure | Page/body/error behavior matched in tests; deadlines source-reviewed; live outage handling unverified |
| Runnable standalone CLI | Child-process test against a loopback fake API | Matched locally, including the clean copy |
| Path-scoped CI | `.github/workflows/list-recordings-node.yml`, no live credentials | Prepared; hosted run not run |

Documentation impact review searched the new example path, configuration names and pagination tokens across the examples and available public/internal documentation. The affected catalog/contributor/review and public pagination guidance are integrated by the coordinating task. Existing unrelated cursor-based APIs and target designs require no behavioral changes for this GET-only example.

Adapt this example inside your backend. If exposing results to application users, add caller authentication and server-derived project/end-user authorization before listing; accepting an arbitrary end-user ID from a browser is not authorization. Do not forward the project key or raw upstream response to clients.
