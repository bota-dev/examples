# Read a bounded end-user directory with Node.js

Learn to traverse your selected project's end-user directory through the public cursor API and print only `id`, `external_id` and `created_at`. This independent server-side CLI uses Node built-ins and GET requests only. It does not create end users, look up one external ID, expose an HTTP proxy, change assignments, process recordings or delete anything.

**Status (2026-10-08): implemented with source review and install/syntax checks only.** Runtime, unit, functional, live API and failure-path acceptance are unverified; the owner requested creation without those tests. No App SDK, hardware or firmware is needed.

## Setup

Use Node **22.23.2 or newer** and npm on Windows, macOS or Linux. Obtain a project-scoped secret or restricted API key with **`end_users:read`**. Configure the corresponding expected `proj_*` ID from trusted project administration. The API key selects the project; this example sends no project selector or client-controlled URL.

From this directory, without installing the repository root or a sibling:

```sh
npm ci
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env`. Edit the ignored `.env` with your authorized environment:

| Variable | Meaning |
|---|---|
| `BOTA_API_ORIGIN` | Trusted API origin, default `https://api.bota.dev`. Use HTTPS with no path, credentials, query or fragment. Explicit HTTP is accepted only on loopback. A key is sent to this origin, so configure it only from trusted server settings. |
| `BOTA_API_KEY` | Server-held project key with `end_users:read`. Placeholder values are rejected. Never put it in a browser/mobile app, log or committed file. |
| `BOTA_PROJECT_ID` | Required expected `proj_*` ID. Returned `project_id` must match when present. It is a consistency check, not an independent proof of key ownership; public response examples omit it, and an empty list cannot corroborate it. |
| `BOTA_LIMIT` | Page size, 1–100; default 20. |
| `BOTA_MAX_PAGES` | Maximum page requests, 1–50; default 5. |

Use an existing authorized project. The directory may include private application identifiers; choose an environment whose output you are permitted to view.

## Run and output

```sh
npm start
```

For JSON without npm's command banner:

```sh
node --env-file-if-exists=.env index.mjs
```

Illustrative output (not live evidence):

```json
{
  "end_users": [
    {
      "id": "eu_example",
      "external_id": "application-user-example",
      "created_at": "2026-10-08T12:00:00.000Z"
    }
  ],
  "pages": 1,
  "traversal_ended": true,
  "stopped_reason": "observed_end"
}
```

An empty list is valid, and `external_id` can be null. External IDs are private, untrusted application data. JSON serialization escapes control characters; still treat the result as data, never as HTML, a shell command or authorization evidence. Do not commit captured output or share it through public CI logs. Names, emails, arbitrary metadata, raw API errors, credentials and cursors are never printed.

Every request uses exactly `GET /v1/end-users?limit=...` with the previous opaque `next_cursor` added as `cursor` on subsequent pages. Cursors are neither decoded nor printed. There is no offset or external-ID filter. For exact external-ID lookup and durable creation reconciliation, see the separate [onboarding example](../create-end-user-node/README.md).

| Exit status | Meaning |
|---|---|
| 0 | The observed traversal reached `has_more: false`; `traversal_ended: true` and `stopped_reason: "observed_end"`. |
| 2 | Page cap reached while the API reported more rows; `traversal_ended: false` and `stopped_reason: "page_limit"`. |
| 1 | Invalid configuration, HTTP/transport failure or invalid response. No partial directory JSON is emitted. |

Reaching the observed end is not an atomic snapshot, exhaustive audit, export guarantee or proof that no rows changed between requests. Concurrent creation, deletion or reassignment can alter the traversal. Optional response project/active-state checks apply to each observed row, without a final re-read or cross-request snapshot claim.

The traversal has a 60-second overall deadline, a 10-second per-request timeout, a 2 MiB decoded body limit per page and at most 5,000 projected rows. These are teaching-example bounds, not API service limits. It requires exact HTTP 200, JSON content type and valid UTF-8/JSON; redirects and automatic retries are disabled. Missing, repeated or nonprogressing cursors, duplicate end-user IDs, overlarge pages and malformed metadata stop the run. A terminal cursor may be absent or null; a non-null terminal cursor is rejected. Optional `total` is type-checked but ignored, because it cannot prove snapshot completeness.

After a failure or page cap, review the configuration and rerun from the beginning; there is no saved cursor or resume journal. On 401/403, check project credentials and scope. On 429, wait before rerunning. Other HTTP failures require environment/API investigation; raw response bodies are discarded. No cloud resource or device recording is created, so no cloud/device cleanup is needed. Remove your local `.env` when finished.

## Public contract and review

The contracts are [List End Users](https://docs.bota.dev/api-reference/end-users/list), [Get End User](https://docs.bota.dev/api-reference/end-users/get), [pagination](https://docs.bota.dev/api-reference/pagination), [authentication](https://docs.bota.dev/authentication) and [OpenAPI](https://docs.bota.dev/api-reference/openapi). The Get contract is a response-shape reference; this example performs no per-row Get requests.

Source inspection on 2026-10-08 used the public documentation sources and backend commit `1ac67c92`: the v1 controller passes `limit`/`cursor` and authenticated project identity to the service; the repository applies project and active-row filters and descending creation-time/ID ordering; the pagination builder returns `data`, `has_more` and continuation `next_cursor`. No private endpoint, backend import or sibling dependency is used by the runnable example.

The reviewed baseline prose table described `external_id` as a string, while OpenAPI and backend models allow null; the accompanying public documentation update corrects this to string/null, which this example accepts. A prose list example has `metadata: null`, while OpenAPI describes an object; optional metadata accepts object/null and is discarded. The backend additionally returns `project_id` and `deleted_at`, which the public examples omit; when present, they must match the configured project and active state (`deleted_at: null`). There is no documented end-user status enum. Creation time is required and validated; optional update time and name/email types are validated without output. This source-shape review does not establish deployed response behavior.

The compound-engineering review uses the examples architecture §§2–6 and these public contracts:

| Requirement | Evidence (2026-10-08) | Status / remaining verification |
|---|---|---|
| Independent public API example | Own manifest/lockfile/configuration; only Node globals/built-ins; no sibling imports | Matched in source; `npm ci` passed locally on Windows / Node 22.23.2 |
| Exact GET-only cursor traversal | Fixed `/v1/end-users`, only `limit`/opaque `cursor`, no write/cleanup path | Matched in source; runtime requests and live pagination unverified |
| Project and active-row consistency | Trusted server settings; optional project/deletion checks on each row | Matched in source; authorization rejection and mismatched-response behavior unverified |
| Bounded traversal and honest completion | Page/row/body/time bounds; duplicate and cursor-progress checks; distinct observed-end/cap output | Matched in source; timeout, malformed-page and capped runtime behavior unverified |
| Selected output and private data boundary | Field projection, all pages validated before output, sanitized failures | Matched in source; runtime output/error behavior unverified |
| Syntax-only independent workflow | Path-filtered workflow, pinned actions, read-only permissions, `npm ci` and `npm run check` only | Matched in source; hosted execution unverified |
| Validation limit | `npm ci` and `npm run check` passed locally; no CLI invocation/API requests | Syntax verified; unit/functional/live/device tests not run by owner instruction |

Local syntax verification:

```sh
npm run check
```

This only parses JavaScript and does not execute the workflow. Successful installation/syntax checks cannot establish runtime, deployed API or failure-path conformance. No test script is provided for this creation batch.

To adapt the directory into your backend, authenticate application callers and derive their allowed project/directory scope on the server before returning any selected rows. A whole-project directory must not become an unscoped public listing. Keep the origin and key in trusted server configuration, preserve response limits and validate the public contract; never forward a generic caller-selected path or raw upstream response.
