# Read one recording's Ask history with Node.js

Read an existing recording-scoped Ask session for one fixed, server-configured
end user, then print selected message text and citations as JSON. This example
uses GET only: it creates no session, message, processing job or model request,
and does not upload/download audio, select branches, poll generation, modify
recordings, or operate a device.

**Status:** implemented; installation, syntax and source checks only. Functional,
unit and live checks were not added or run, following the owner's creation-only
instruction. Runtime authorization and pagination acceptance remain unverified.

## Prerequisites and configuration

- Node.js **22.23.2 or newer**. Built-ins only; no SDK, third-party dependencies,
  hardware or sibling repositories are required.
- A trusted API environment and server-held secret or suitably permitted
  restricted **project key for the expected project**, with `recordings:read`
  and access to that project's Ask reads. The public Ask pages do not specify a
  separate restricted-key Ask scope; confirm deployed key permissions.
- One existing recording owned by the configured end user and the exact existing
  Ask session, whose scope is `recording` with only that recording. No ready
  transcription/provider setup is needed by this reader.
- A private terminal and directory. History text and identifiers are sensitive.

From this directory:

```sh
npm ci
cp .env.example .env
```

On PowerShell use `Copy-Item .env.example .env`. Replace every placeholder:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_ORIGIN` | Trusted HTTPS origin, default `https://api.bota.dev`; explicit loopback HTTP is permitted locally. No path, query, fragment, URL credentials or redirects. |
| `BOTA_API_KEY` | Secret/restricted project key, visible only to this server-side process. Device/upload/end-user token formats are excluded. |
| `BOTA_PROJECT_ID` | Expected project. The key must be selected for this project; any returned optional `project_id` must match. |
| `BOTA_END_USER_ID` | Fixed authorized recording and session owner, `eu_...`. |
| `BOTA_RECORDING_ID` | The one existing recording, `rec_...`. |
| `BOTA_ASK_SESSION_ID` | Exact existing recording-scoped session, `as_...`. |

Keep `.env` and captured output private. A customer backend must authenticate its
caller and derive the project/end-user/recording/session authorization from trusted
server-side mappings. Client-supplied IDs do not establish access. This fixed-scope
CLI is a teaching example, not a multi-user backend.

## Run and result

```sh
npm run check
npm start
```

The reader:

1. Reads `GET /v1/recordings/{id}` and verifies the exact ID and end-user owner.
2. Searches `GET /v1/ask/sessions` with the fixed `end_user_id`, `recording_id`,
   `scope_type=recording` and `limit=50` on **every** cursor request. It must find
   the exact configured session within ten pages. Every observed session must
   retain the single-recording scope; lookup cap or not-found stops the read.
3. Reads `GET /v1/ask/sessions/{id}` and checks the exact ID and immutable scope:
   `{ "type": "recording", "recording_ids": ["rec_..."] }`.
4. Reads `GET /v1/ask/sessions/{id}/messages?limit=50`, following opaque cursors
   unchanged for at most ten pages. It validates every selected message and part.
5. Repeats recording ownership, owner-filtered session membership and exact session
   scope checks before printing any history.

Compact JSON output contains `session_id`, `recording_id`, `order: "api_response_order"`,
`atomic_snapshot: false`, `traversal` and `messages`. Each message contains only `id`, `role`, `content` and
selected `parts`: `{ type: "text", text }` or
`{ type: "citation", recording_id, start_ms }`. Only `user`/`assistant` roles and
these part types are accepted. Citations must be assistant parts for the exact
configured recording, with nonnegative safe-integer `start_ms`. Unknown part
types, invalid fields, cross-recording citations and duplicate message IDs fail.

`traversal.status` is `observed_end` when a response says `has_more: false`, or
`page_cap` with `has_more: true` for a capped selection. An observed end exits 0;
a validated capped selection prints its partial output and exits 2; failure exits
1 without history output. It also reports pages and
returned message count. Empty history is permitted. Neither label proves an atomic
snapshot or an audit-complete conversation. Concurrent edits, new turns and branch
changes can occur between reads; the sample neither infers an active branch nor
uses `message_count` to claim completeness or finished generation. Historical
assistant text can be incomplete or inaccurate.

Public List Messages documentation says oldest-first; tracked backend source at
`1ac67c92` uses newest-first and pages backward, and the service forwards that
order. This sample preserves observed response order without sorting or assuming
which end a capped selection represents. Deployed ordering remains unverified.

## Authorization and bounded failures

Get Session's documented serialization omits `end_user_id`. Recording ownership
and recording scope alone are insufficient to prove **session** ownership. The
independent owner-filtered List Sessions membership checks rely on that public
filter's server enforcement and the project key's project boundary. If an API
response supplies `end_user_id`, it must also match. The CLI deliberately requires
a project key because an end-user-scoped key can override the list filter with its
own owner; its token format is not accepted here.

The public Get Recording and Ask schemas also do not promise `project_id`. The
expected project is supplied by trusted key configuration; when optional project
metadata appears it is checked for mismatch. Its absence cannot independently
prove the configured project. The output makes no `project_verified` claim.
Separate before/after reads are observations, not a transaction or a substitute
for server authorization at each operation.

All reads share a two-minute deadline. Each JSON body is bounded to 1 MiB; the
entire operation to 8 MiB; final compact stdout JSON including its newline to
4 MiB (checked before printing); each message
and text part to one million characters; parts to 1000 per message. At most 500
history messages are selected. Each of the two owner lookups also has a separate
ten-page cap. These are sample bounds, not platform service limits. Repeated
cursors, duplicate IDs, `has_more` with an empty page or missing cursor, malformed
JSON and nonprogress all stop. Cursors are opaque, length-bounded and encoded with
`URLSearchParams`; they are never decoded, printed or fabricated.

There are no redirects or automatic retries. Errors contain controlled local
descriptions or HTTP status codes. No raw error/provider body, arbitrary metadata,
tokens, model/provider details, audio URLs, session title or API key is printed.
History appears on stdout only after all scope checks; stderr never contains
history. JSON escaping protects terminal control characters, but captured stdout
still contains authorized sensitive message text. Secure it according to your
application's data policy. No cloud resources or local history files are created,
so there is no resource cleanup; remove private configuration/captured output when
no longer needed. A later manual rerun makes new GET observations only.

Run in a trusted Node environment using the default `fetch` dispatcher and trusted
DNS, certificates and proxy configuration. This sample does not defend against
process-level changes to Node's global dispatcher, malicious runtime preload
hooks, or local interception. The fixed API origin and rejected redirects do not
override those host trust responsibilities.

## Checks and evidence

```sh
npm ci
npm run check
```

The independent path-filtered workflow runs only those two commands, without API
credentials, functional tests or live calls.

| Evidence | October 8, 2026 |
| --- | --- |
| Independent frozen installation | `npm ci` passed locally on Windows / Node 22.23.2; no dependencies |
| Syntax check | `npm run check` passed locally on Windows / Node 22.23.2 |
| Public contract / tracked source review | Session filters, serialization, pagination and message parts inspected |
| Functional/unit/live checks | Not added or run, by request |
| Device checks | Not applicable; none run |
| Hosted workflow | Not run locally; inspect the exact committed workflow run |

Compound-engineering review against repository architecture, public contracts and
the requested read-only scope:

| Requirement | Evidence / verification / status |
| --- | --- |
| Independent setup | Own manifest/lock and built-ins; frozen installation and syntax matched locally. Runtime workflow unverified. |
| Existing exact recording and session | Before/after recording owner, filtered session membership and exact scope checks in source; runtime enforcement unverified. |
| Project isolation | Project key plus mismatch rejection for optional project metadata; absence of project metadata prevents independent project proof. Partial evidence by design. |
| GET only, no generation or mutation | Explicit GET client and public read routes only; matched by source review. No live call made. |
| Bounded pagination | Fixed filters, opaque cursors, ID/cursor nonprogress checks and capped selection label present; behavior unverified. |
| Selected output and citations | Allowlisted roles/parts, exact recording citations and safe positions checked before output; adversarial behavior unverified. |
| Ordering/branch/completeness limits | API response order retained; documented public/source mismatch and observational limit; intentionally avoids stronger claims. |
| Behavioral acceptance | Unverified; deferred under the owner's instruction to create without functional/unit/live/device tests. |

Changed-token searches covered the examples documentation, public Ask/recording
docs and internal Ask design; the internal-docs downstream matrix was inspected.
Existing endpoint/field contracts are retained. Root catalog/review integration is
handled with this creation batch; no backend or public-schema change is claimed.

Public contracts: [Get Recording](https://docs.bota.dev/api-reference/recordings/get),
[List Sessions](https://docs.bota.dev/api-reference/ask/list-sessions),
[Get Session](https://docs.bota.dev/api-reference/ask/get-session),
and [List Messages](https://docs.bota.dev/api-reference/ask/list-messages).
The example requires no private source or sibling runtime helpers.
