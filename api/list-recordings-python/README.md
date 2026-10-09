# List one owner's recording metadata with Python

Follow the public recording cursor pagination under one fixed end-user filter
and print selected cloud metadata after all observed rows pass validation. This
standard-library CLI retrieves no audio, transcript or summary and makes no
upload, processing, deletion, command, binding or device request.

**Status:** implemented with syntax checks and source review only. Pagination,
ownership rejection, deadline and live API behavior remain unverified. No
functional/unit tests, live requests or hardware operations were added or run,
following the owner's creation-without-testing instruction.

## Setup and run

Use **Python 3.12 or newer**. There are no pip dependencies, SDK package or sibling
runtime imports. Configure a server-held project secret/restricted API key with
`recordings:read` and a fixed authorized end user in that project. An end-user-scoped
key must match the configured owner. Browser/mobile apps must not receive this key.

`.env.example` is documentation only; Python does not load it automatically. Set
the process environment through your shell or server secret injection:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required trusted API origin ending in `/v1`, normally `https://api.bota.dev/v1`; HTTPS or HTTP on explicit loopback only. No URL credentials/query/fragment. |
| `BOTA_API_KEY` | Required server-held project key with `recordings:read`. |
| `BOTA_END_USER_ID` | Required fixed authorized `eu_...` owner, sent on every page and checked on every row. |
| `BOTA_LIMIT` | Requested rows per page, 1–100; default 20. |
| `BOTA_MAX_PAGES` | Maximum page reads, 1–50; default 5. |

```sh
export BOTA_API_BASE_URL=https://api.bota.dev/v1
export BOTA_END_USER_ID=eu_REPLACE_ME
export BOTA_LIMIT=20
export BOTA_MAX_PAGES=5
read -r -s -p 'Bota project API key: ' BOTA_API_KEY
echo
export BOTA_API_KEY
python main.py > recordings.json
```

```powershell
# PowerShell 7
$env:BOTA_API_BASE_URL = 'https://api.bota.dev/v1'
$env:BOTA_END_USER_ID = 'eu_REPLACE_ME'
$env:BOTA_LIMIT = '20'
$env:BOTA_MAX_PAGES = '5'
$env:BOTA_API_KEY = Read-Host 'Bota project API key' -MaskInput
python main.py > recordings.json
```

Replace resource placeholders before running. Remove the key from the shell
environment when finished and keep the session/output private. `recordings.json`,
`.env` and bytecode are ignored; other output filenames need their own ignore
rule or a location outside the checkout. No credential or serial is built in.

## Public requests and selected result

Every request is `GET /v1/recordings?end_user_id=eu_...&limit=N`, with the opaque
`cursor` from the preceding response added for later pages. The owner filter is
never dropped. The script does not decode, print or persist cursors and sends
no date, device or status filters.

Each page must contain a bounded `data` array and a boolean `has_more`. Every row
must have a recording ID, the exact configured owner, no deletion marker and
valid selected metadata. Only ID, status, nullable integer duration, nullable
recording timestamp and creation timestamp are projected. Names, general
metadata, signed audio URLs, device IDs, storage fields, transcript text and
arbitrary error payloads are excluded. JSON escaping prevents terminal control
characters from being emitted as raw text.

All rows and pages observed by the invocation are validated before stdout:

```json
{
  "recordings": [],
  "pages": 1,
  "complete": true,
  "stopped_reason": "end_of_list",
  "atomic_snapshot": false
}
```

`complete: true` means only that **this traversal observed `has_more: false`**.
It does not establish an atomic, exhaustive audit or stable owner inventory.
Changes during enumeration can add/remove/reassign rows and affect pagination;
separate API responses are not a frozen snapshot. A completed/uploaded recording
status alone also does not establish verified audio integrity or processing
quality. This example inspects cloud metadata only.

If `has_more` remains true at the page cap, output contains the validated partial
selection, `complete: false` and `stopped_reason: "page_limit"`. It exits **2**;
never treat that output as a finished traversal. Missing/repeated cursors, empty
nonterminal pages and duplicate IDs within/across pages fail instead of silently
skipping data. Failures emit no recording output. A repeated first page cannot
be counted as progress.

Project scope comes from the API key, while the configured owner narrows this
teaching CLI. A customer backend must authenticate callers and derive permitted
owner scope on the server; arbitrary client IDs are not authorization. The script
checks the owner returned on every row, but does not create an atomic authorization
snapshot across resource changes.

## Bounds and failures

All page requests share a **60-second elapsed budget**, with a **10-second budget
per page**. Connected requests have a remaining-deadline socket shutdown timer
covering sending, HTTP headers and body, including trickling bytes. Cleanup joins
the timer and closes the connection. OS DNS and initial TCP/TLS establishment
cannot be forcibly interrupted by this standard-library approach and may overrun
the budget. No further page or output starts after an expired budget is observed.

Responses require HTTP 200, uncompressed/identity `application/json` and at most
**2 MiB** per page. UTF-8 errors, duplicate JSON keys and non-finite JSON constants
are rejected. Duration rejects booleans, fractions and negative/unsafe integers.
Cursors are limited to 2048 characters; they remain opaque and URL-encoded. At
most 5000 selected rows can be retained under the maximum configured bounds.
These are local teaching limits, not platform quotas.

Connections go directly to the configured origin; environment proxy routing is
unused. Redirect responses are not followed and credentials stay on that origin.
There are no automatic request retries. HTTP/network/JSON/scope failures print
only controlled descriptions and HTTP status codes, with no body, key, URL or
cursor. Exit 0 means the observed traversal ended, exit 2 means page cap, and
exit 1 means failure. Starting another deliberate GET-only invocation requires
no cloud reconciliation or cleanup; this sample creates no cloud resource.

## Evidence and design review

```sh
python -m py_compile main.py
```

| Requirement / evidence | October 8, 2026 status |
| --- | --- |
| Independent setup | Standard-library imports, own environment/docs; no dependency installation required. |
| Syntax | Compiled with Python 3.12.14 locally. |
| Public filtered pagination | Recording list docs and tracked backend `1ac67c92` agree on owner filter, limit, cursor and `{data, has_more, next_cursor}`. |
| Scope/projection/non-progress boundaries | Present in source; runtime behavior unverified. |
| Page cap versus exhausted traversal | Explicit flags/exit codes; atomic inventory/audit not claimed. |
| Functional/live/device tests | Not added or run, by user instruction. |
| Hosted workflow | Syntax-only workflow configured; local compilation is not hosted evidence. |

Public contracts: [List Recordings](https://docs.bota.dev/api-reference/recordings/list)
and [Get Recording field descriptions](https://docs.bota.dev/api-reference/recordings/get).
Unlike the device-inventory contract discrepancy, the tracked recording service
passes limit/cursor into its end-user-filtered repository path. This source review
does not identify which backend revision is deployed or establish live pagination.
