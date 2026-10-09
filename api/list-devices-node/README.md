# List a bounded owned-device inventory

Read one bounded selection of cloud devices belonging to a fixed end user and
print selected inventory metadata. This server-side Node.js CLI makes one GET
request. It performs no pagination, serial lookup, SDK connection, device command,
configuration update, registration, binding, upload, reset or hardware operation.

**Status:** implemented with installation/syntax checks and source review only.
Runtime scope enforcement, failure handling and live API behavior remain
unverified. No functional/unit tests or live/device calls were added or run,
following the owner's creation-without-testing instruction.

## Setup

Use Node.js **22.23.2 or newer**. This example uses built-ins, owns its manifest and
lockfile, and needs no SDK, third-party packages, hardware or sibling repository.
Configure an API project secret or restricted key with `devices:read`, and a fixed
authorized end user in that project. Device and upload tokens are excluded.

From this example directory:

```sh
npm ci
cp .env.example .env
```

PowerShell can use `Copy-Item .env.example .env`. Replace every placeholder:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_ORIGIN` | Trusted API origin, default `https://api.bota.dev`; HTTPS or HTTP on explicit `localhost`, `127.0.0.1`, or `[::1]`. No path, query or URL credentials. |
| `BOTA_API_KEY` | Project-held server secret or suitably permitted restricted key with `devices:read`. |
| `BOTA_END_USER_ID` | Fixed authorized bound owner, `eu_...`; required on the request and every returned row. |
| `BOTA_LIMIT` | Requested selection size, 1–100; defaults to 25. |

Keep the key in the server environment and `.env` private. Never put it in browser
or mobile configuration. For a multi-user backend, authenticate callers and derive
permitted owner scope on the server. Client-supplied IDs are not authorization;
the fixed configuration is a teaching CLI's operator-selected scope.

## Run and result

```sh
npm run check
npm start
```

The CLI calls `GET /v1/devices?end_user_id=eu_...&limit=N` once. Project scope comes
from the API key. It verifies the envelope (`data`, boolean `has_more`), the
requested row cap, each device's ID and exact owner, and `status: "bound"`. It
rejects deletion markers, duplicate IDs and malformed selected metadata before
any output. Unknown model names become `"unknown"`; firmware version is nullable.

Output contains only `id`, `model`, `firmware_version`, `status`, `end_user_id`,
`created_at` and `updated_at`, plus selection information:

```json
{
  "data": [],
  "requested_limit": 25,
  "has_more": false,
  "pagination_attempted": false,
  "inventory_complete": false
}
```

`has_more` is the API's observed flag. If true, the selection is incomplete and
this example stops after this response. Even if false or empty, the output is
not an independently complete inventory/audit: `inventory_complete` always
remains false. The request is not a frozen snapshot across ownership changes.
Use a separately qualified inventory/export process if completeness is required.

Names, serial numbers, settings, general metadata, grants, IPs, WiFi names,
recording state, battery, heartbeat and connection observations are omitted.
This is cloud inventory metadata, not proof of physical identity, applied firmware
or current hardware connectivity. Firmware version is the API's stored value.

The request/body read shares a 30-second AbortSignal timeout; the final pre-output
check enforces the same elapsed budget. The response is limited to 1 MiB of UTF-8
JSON. There are no redirects or automatic retries. Oversized/non-JSON responses,
HTTP errors, malformed rows or owner mismatches exit 1 without inventory output.
Only controlled error descriptions and HTTP status codes are printed; upstream
bodies, URLs and keys are excluded. A valid bounded selection exits 0, even when
`has_more` is true; callers must inspect that flag rather than infer completeness
from process success.

## Pagination compatibility gate

The public [List Devices](https://docs.bota.dev/api-reference/devices/list) page
currently advertises `offset` pagination. Tracked backend source reviewed at
commit `1ac67c92` accepts `cursor` instead, and its `end_user_id` branch retrieves
the owner's rows then bounds the response through `buildPaginatedResult`. That
branch does not consume either offset or cursor to advance the selection.
This source observation is not proof of the deployed version, but it prevents
claiming that either pagination mode is qualified here.

This example therefore sends only the common supported `end_user_id` and `limit`
parameters. It does not send an offset/cursor, follow an incidental `next_cursor`,
drop the owner filter, request a project-wide list, or repeat the selection to
try to enumerate more devices. A repeated first page cannot be treated as a new
page. Pagination remains a future gate requiring the public contract and the
deployed filtered-list behavior to agree, with duplicate/non-progress detection,
explicit page bounds and mutation/completeness limits. This creation batch
changes neither the backend implementation nor the public pagination schema.

## Cleanup and evidence

The CLI creates or changes no cloud resource or device state. Remove the private
`.env` file or revoke its key when no longer needed. Retain any redirected output
according to your metadata policy; `devices.json` is ignored by Git, while other
filenames need their own ignore rule or a location outside the checkout.

```sh
npm ci
npm run check
```

The standalone workflow performs those installation/syntax commands without API
credentials or requests.

| Requirement / evidence | October 8, 2026 status |
| --- | --- |
| Independent setup | Built-ins, own manifest/lock; frozen install passed on Node 22.23.2. |
| Syntax | `node --check index.mjs` passed locally. |
| Public selection contract | Owner filter, limit and `{data, has_more}` matched in docs/tracked source review. |
| Owner and selected-output boundaries | Present in source; runtime behavior unverified. |
| Pagination | Intentionally limited to one selection due to documented source/contract disagreement; full paging not implemented. |
| Automated/functional/live/device tests | Not added or run, by user instruction. |
| Hosted workflow | Syntax-only workflow configured; local checking is not hosted evidence. |

Public contract: [List Devices](https://docs.bota.dev/api-reference/devices/list).
Backend source was inspected only to qualify the common public request shape;
no private code or sibling runtime is imported.
