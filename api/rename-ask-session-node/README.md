# Rename one recording-scoped Ask session with Node.js

Rename one exact existing Ask session for a fixed project, end user and recording.
The server-side CLI reads a private title file, observes owner membership and
recording scope, commits local intent, then sends at most one title-only PATCH.
It prints only identifiers and outcome observations. It sends no messages and
makes no model requests, session creation, audio access or device operations.

**Status:** implemented with frozen-install, syntax and source review evidence
only. Unit, functional, live API and device tests were not added or run under the
owner's creation-without-testing instruction. Runtime acceptance is unverified.

## Setup

Use Node.js **22.23.2 or newer** and npm on a trusted server or local CLI host.
This independent example uses built-in fetch and SQLite, without SDK packages,
external dependencies or sibling repositories. Node 22 can emit its SQLite
experimental warning.

Use a server-held secret or suitably permitted restricted project key for the
expected project, with `end_users:read`, `recordings:read` and access to Ask
session reads and updates. Public Ask pages do not specify a separate restricted
Ask scope; confirm the deployed key permissions. Choose one existing session
whose immutable scope is exactly `recording` with `[BOTA_RECORDING_ID]`, owned by
the configured end user. Coordinate other title/session writers and deletion
before running, including any automatic title generation from a first message.

From this directory:

```sh
npm ci
cp .env.example .env
```

On PowerShell use `Copy-Item .env.example .env`. Replace every placeholder:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_ORIGIN` | Trusted HTTPS origin, default `https://api.bota.dev`; no path, query, fragment or URL credentials. Redirects are rejected. |
| `BOTA_API_KEY` | Server-held secret/restricted project key. Device, upload and end-user token formats are excluded. |
| `BOTA_PROJECT_ID` | Exact expected `proj_*` ID. The selected key determines the project; optional returned project fields must match. |
| `BOTA_END_USER_ID` | Exact configured active owner, `eu_*`. |
| `BOTA_RECORDING_ID` | Exact owned recording, `rec_*`. |
| `BOTA_ASK_SESSION_ID` | Exact existing single-recording session, `as_*`. |
| `TITLE_FILE` | Trusted private regular UTF-8 file containing the intended title. Default example location `.private/title.txt`. |
| `JOURNAL_FILE` | Durable private SQLite file for this one operation. Default example location `.private/rename.sqlite`. Its private parent must already exist. |

Create `.private/` yourself with private permissions and create `title.txt` using
your trusted editor, without replacing an existing title file. On POSIX, the
parent and title file must be owned by the process user with no group or other
permissions (for example directory `0700`, file `0600`). On Windows restrict the
parent and files with ACLs before execution: Node's POSIX mode checks/chmod do
not establish private Windows access. Keep directories stable and trusted; the
example rejects symlinks in the parent ancestry and symlink/non-regular or
multiply linked files. These checks do not secure an attacker-writable ancestor
or replace OS access controls.

`TITLE_FILE` is bounded to 4096 bytes, decoded as UTF-8 with fatal errors and
trimmed once. The canonical result must have 1–200 JavaScript UTF-16 code units,
matching the reviewed backend's `z.string().trim().min(1).max(200)`. Outer
whitespace/newlines are removed; interior content is retained. Supplementary
characters count as two code units. The input is read into one immutable string
and is never written by the CLI. A subsequent edit that changes the canonical
title fails the journal fingerprint check. Retain the original input.

Protect `.env`, the title, journal, terminal and identifiers. Configure the key
and expected project together through trusted server configuration; an omitted
response `project_id` is not independent project proof. Do not expose this CLI
as an endpoint accepting caller-chosen IDs, paths or title material.

## Run and output

```sh
npm run check
npm start
```

Before the write and again before metadata output, the CLI performs:

1. `GET /v1/end-users/{id}` for the exact owner and
   `GET /v1/recordings/{id}` for the exact recording and owner.
2. Bounded `GET /v1/ask/sessions` requests with the same `end_user_id`,
   `recording_id` and `scope_type=recording` filters on every cursor request.
3. `GET /v1/ask/sessions/{id}` for the exact session and scope.

After the final session read, it rechecks the end user and recording immediately
before output. These checks narrow the ownership observation window without
making the requests an atomic snapshot. Contradictory optional scope fields on
membership page envelopes are also rejected.

Every optional project/owner field must agree; a present `deleted_at` must be
exactly `null`, and a recording reported as deleted is rejected. Public
contracts omit some of these fields, so absence alone is allowed. Single-session
GET does not document an owner field: filtered list membership is required even
when a deployed response also includes owner metadata. The list is capped at
10 pages of 50 items and validates each page's returned scope/IDs, pagination
progress and duplicates. Failure or absence at the cap stops before writing or
printing success; finding membership does not claim complete list traversal.

A fresh local claim commits `uncertain` before the only
`PATCH /v1/ask/sessions/{id}`, whose entire body is `{ "title": "..." }`.
Only HTTP `200` JSON with the exact session ID, exact recording scope and exact
canonical title is accepted as an acknowledgment. That fact is durably retained
before the final owner/membership/session observations.

Example output, with no actual title or digest:

```json
{
  "session_id": "as_example",
  "recording_id": "rec_example",
  "patch_acknowledged": true,
  "observed_title_match": true,
  "observation": "acknowledged_outcome",
  "atomic_snapshot": false
}
```

`patch_acknowledged` reports a retained validated PATCH response, including on
later GET-only runs. `observed_title_match` compares the final GET to the private
input without exposing it. An uncertain run prints `patch_acknowledged: false`
and `observation: "uncertain_outcome"` even if the title matches. Exit `0` means
acknowledged and currently matching; exit `2` means uncertainty or a current
title mismatch. Exit `1` means configuration, local state, authorization,
pagination or API validation failure. Controlled errors exclude raw response
bodies, native errors, titles, hashes, storage URLs and credentials.

All requests share one two-minute deadline, with a 1 MiB per-response and 16 MiB
total UTF-8 JSON limit. No automatic retry or redirect occurs. These page, byte
and time limits are teaching-example bounds rather than service limits.

## Durable uncertainty and other writers

The journal stores only fixed origin/project/owner/recording/session identifiers,
the SHA-256 of the canonical title, and `uncertain` or `acknowledged` phase.
It stores no key or raw title. Predictable titles can be guessed from hashes;
treat the journal as sensitive. Exclusive file creation preserves an existing
file and applies `0600` before SQLite opens it. SQLite uses DELETE journaling,
`synchronous=FULL` and a transactional local claim. Durability depends on the
local filesystem/storage; keep the file on private durable local storage,
including its SQLite sidecars, across interruptions.

The example does not explicitly fsync the journal's parent directory. In
particular, retention of a newly created directory entry across power loss
depends on SQLite and filesystem guarantees; FULL synchronous commits alone
are not independent proof of that durability.

Every existing intent in either phase permits **GETs only**, including after
HTTP errors, timeouts, malformed responses, mismatched titles, interruption or a
crash before acknowledgment retention. A crash after intent but before sending
PATCH conservatively consumes the local attempt. An initialized valid journal
without an intent row has not authorized a PATCH and can claim its first attempt.
Malformed/corrupt existing journals are never reinitialized or repaired; exact
schema and retained rows are validated, and the journal has a 1 MiB file bound.

An uncertain run cannot establish whether its PATCH reached the server. A
matching GET title could have been set by another writer or already existed;
the CLI never promotes that observation into PATCH acknowledgment. A mismatch
can reflect an unapplied request or a later overwrite. Preserve both journal
and title and reconcile through authorized application records. Do not discard,
move, edit or replace an unresolved journal, change scope, or start another
journal to force a retry. There is no journal reset, replay or title-adoption
command.

SQLite serializes only callers sharing this journal. Other files, hosts and
applications remain outside its claim. The reviewed backend performs an
unconditional title update after project/session access resolution, with no
public compare-and-swap or idempotency mechanism. This CLI does not invent an
atomic old-title check or distributed exactly-once guarantee. Owner, recording,
list and session reads are separate non-atomic observations; they can change
between requests or immediately after output. Coordinate other writers and
deletion through your application's authorization and operation lifecycle.

## Checks and October 8, 2026 design review

The path-filtered workflow uses pinned checkout/setup-node actions and Node
22.23.2; it runs only `npm ci` and `npm run check`. `check` uses `node --check`;
it does not execute this CLI or contact the API. No tests were added or run.

| Requirement | Evidence | Review status / remaining verification |
| --- | --- | --- |
| One independent public title workflow | Own manifest/lock, Node built-ins, only owner/recording/session GETs and one title-only PATCH | Source matched; frozen install and syntax passed locally |
| Fixed scope and owner membership | Exact configured IDs, optional contradiction checks, bounded fixed-owner list, exact immutable recording scope before write/output | Source matched; deployed authorization/pagination acceptance unverified |
| Private canonical title | Private regular file checks, fatal UTF-8, trim and 1–200 UTF-16 units, immutable input, no title/digest output | Source matched; adversarial input/OS ACL behavior unverified |
| Durable intent and acknowledgment | FULL SQLite transaction before PATCH; exact response before retained acknowledgment; scope/title fingerprint | Source matched; crash, storage and concurrent-runtime behavior unverified |
| GET-only recovery in every retained phase | No repeat PATCH; matching observation remains distinct from causal acknowledgment | Source matched; uncertain-outcome runtime scenarios unverified |
| Bounded disclosure and non-atomic observations | Selected identifier/boolean output, bounded JSON/deadline, no redirects/retries/raw errors | Source matched; runtime failure acceptance unverified |
| Behavioral acceptance | Owner requested creation without tests/runtime calls | Intentionally deferred; no functional/live conformance claim; hardware not applicable |

The `bota-skills:compound-engineering` review compared implementation with
`ARCHITECTURE.md` §4 and the public Ask update/get/list and recording/end-user
GET contracts. Source inspection used tracked backend
`1ac67c92c6d72858e29dc264037cb82b6c449825`,
`api/src/routes/v1/ask/sessions/{validation,controller}.ts` and
`api/src/services/ai-ask.service.ts` (`updateSession`, `serializeSession`). The
public documentation source is the supplied docs migration checkout; these
sources are evidence, not installation/runtime dependencies. Hosted execution
of the exact committed workflow remains unverified. Token searches cover the
new path, configuration, title, scope and update contract; no API or platform
behavior is changed.

Public contracts: [Update Session](https://docs.bota.dev/api-reference/ask/update-session),
[Get Session](https://docs.bota.dev/api-reference/ask/get-session),
[List Sessions](https://docs.bota.dev/api-reference/ask/list-sessions),
[Get Recording](https://docs.bota.dev/api-reference/recordings/get) and
[Get End User](https://docs.bota.dev/api-reference/end-users/get).
