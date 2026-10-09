# Create or reuse an end user (Node.js)

Map one configured application identity to a Bota end user: look it up by exact
`external_id`, create a minimal record only when absent, and verify the `eu_*`
ID through a fresh GET before printing it. This server-side CLI does not create
application accounts, invent names/emails, issue tokens, bind devices, upload
recordings, or delete resources.

**Status:** implemented with frozen-install, syntax and source review evidence
only. Functional, automated and live API acceptance are unverified; no such tests
were added or run under the owner's creation-only instruction. No App SDK package
or hardware is required.

## Prerequisites and setup

- Node.js **22.23.2 or newer**, npm, and a server/CLI environment on Windows,
  macOS or Linux. The example uses built-in fetch and SQLite, with no external
  dependencies. Node 22 may emit its SQLite experimental warning.
- A key for the intended Bota project with `end_users:read` and `end_users:write`
  scopes. Prefer a test environment and an application identity you control.
- The exact trusted project ID and stable identifier from your own application.
  Bota end users do not log into Bota; your application owns authentication.
- A private, durable working directory for `.state/end-user.sqlite`. Keep it on
  local storage and retain it across interruptions. On Windows restrict the
  directory with ACLs; POSIX modes alone do not enforce Windows access control.

From this directory:

```sh
npm ci
cp .env.example .env
```

On PowerShell use `Copy-Item .env.example .env`. Replace every placeholder:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_ORIGIN` | Trusted API origin, default `https://api.bota.dev`; HTTPS or explicit loopback HTTP on `localhost`, `127.0.0.1` or `[::1]`. No path, query, fragment, URL credentials or redirects. |
| `BOTA_API_KEY` | Secret/restricted project API key held only by the server process. Device, upload and end-user tokens are excluded. |
| `BOTA_PROJECT_ID` | Expected `proj_*` ID, pinned in the journal. The key selects the authorized project; optional response `project_id` fields must match this value. |
| `BOTA_EXTERNAL_ID` | Exact stable application identity, 1–255 characters. No surrounding whitespace or control characters. It is not trimmed or replaced with a default identity. |

The key determines the project on the API. `BOTA_PROJECT_ID` is an expectation,
not an independent proof when a response omits `project_id`; choose the key and
expected project together through trusted configuration. Key rotation within
the same project need not change the journal. Changing the origin, expected
project or external identity is rejected by the existing journal.

Keep `.env`, `.state/` and emitted mappings private. A customer backend must
derive the identity from its authenticated caller and persist the verified
mapping within that application's authorization boundary. Do not expose this
CLI as a generic endpoint accepting untrusted identity or project selectors.

## Run and expected result

```sh
npm run check
npm start
```

Each invocation performs one `GET /v1/end-users?external_id=...` with URL-encoded
exact identity. It requires the documented collection shape: zero or one item,
`has_more: false`, a valid `eu_*` ID, the exact external ID, and matching optional
project/active-state fields. Extra items, pagination or mismatched identities
stop before creation.

If the first lookup is empty and no creation intent exists, SQLite atomically
commits `uncertain` **before** the one `POST /v1/end-users`. Its entire body is
`{ "external_id": "your-application-id" }`; there is no generated email, name,
metadata, device binding or undocumented idempotency header. Only HTTP `201`
with a matching identity is accepted, then its ID is durably retained. A found
existing identity is reusable without POST, and its ID is also retained.

Before output, `GET /v1/end-users/{id}` must confirm that exact ID and external
identity again, with optional project/active-state checks. Output contains only:

```json
{
  "end_user_id": "eu_example",
  "external_id": "your-application-id",
  "resolution": "created"
}
```

`resolution` is `created`, `existing` or `reconciled`. It describes the local
path, not an atomic snapshot or proof of which caller created a recovered row.
Output is JSON-escaped. The example prints no names/emails, arbitrary API
metadata, raw response/error bodies, keys or authorization headers. All requests
share a two-minute deadline, reject redirects and require bounded UTF-8 JSON
responses of at most 1 MiB. These are teaching-example limits, not API limits.
There are no automatic HTTP retries.

## Uncertain outcomes, concurrency and deletion

The SQLite journal stores only the origin, expected project, SHA-256 of the
external ID, phase and known end-user ID. It stores no API key, raw request/body,
name, email or other profile data. The identity hash can reveal predictable
identifiers; protect it as application data. Its file is created exclusively
without replacing an existing journal; SQLite `synchronous=FULL` makes committed
intent and known-result changes durable subject to the local filesystem/storage.

- After intent is committed, **every later invocation uses GETs only**. This
  includes HTTP `400`, `409`, timeout, malformed JSON, unexpected status, network
  failure, interrupted response and a crash before the ID is saved. A request
  can succeed remotely despite a local error. Preserve the journal and rerun
  to observe the current mapping; never automatically repeat POST.
- An uncertain attempt with a unique exact active lookup can retain that ID and
  verify it by GET. It establishes the current active mapping, not whether this
  attempt, another application, or a later re-creation produced the row. An
  empty lookup after intent stops for manual reconciliation; it does not grant
  permission to create another record. Missing, deleted or inaccessible rows
  all yield the same empty collection in the public contract.
- Once an ID is known, the journal pins it. A different ID for the same external
  identity is rejected. An empty collection or failed/mismatched GET of the known
  ID also stops. The sample does not silently rebind to a replacement end user.
- SQLite's atomic pre-POST claim limits competing invocations sharing this one
  file. Another journal, working directory, host or application is outside that
  serialization. The tracked backend uses project-scoped active uniqueness and
  translates insert conflicts into HTTP `409`; a competing create may therefore
  win between lookup and POST. The sample stops and reconciles by GET on rerun.
  Deployment of the reviewed backend/migration is not established by source.
- The active uniqueness rule permits reuse after soft deletion. That new row has
  a different `eu_*` ID and does not restore the deleted account or its history.
  An unknown attempt cannot distinguish this history by external-ID lookup.
  Lookup, create and confirmation are separate, non-atomic operations; remote
  writers and deletion can change the mapping immediately after a successful
  read. This example provides no distributed exactly-once guarantee.
- A crash after journal initialization but **before** intent leaves `ready`:
  no POST was authorized by that state. A rerun can look up again and claim the
  first intent. A crash **after** intent but before sending the request consumes
  that local attempt conservatively and will never resume the missing POST.

Do not delete or move an unresolved journal, change configuration, or use a new
working directory to force another create. Resolve uncertain state through
authorized project records and your application's identity lifecycle. This
example intentionally provides no journal reset or manual ID adoption command.

## Cleanup and adapting the example

The sample may create one cloud end user and performs no automatic cleanup.
Retain a reused identity for other workflows. Deleting an end user can affect
associated device ownership and access; use your authorized account lifecycle
after confirming the exact identity rather than treating deletion as a retry
mechanism. Archive resolved state securely only after the lifecycle is settled.
Preserve unresolved intent even if the CLI printed an error.

In a multi-user application, put identity mappings and durable operations in
your application's database, derive project/external ID from verified callers,
and coordinate competing writers and deletion. A fixed local SQLite journal
demonstrates one onboarding operation; it is not a complete account service.

## Checks and dated design review

```sh
npm ci
npm run check
```

The standalone path-filtered workflow runs only these two commands, without API
credentials. `check` uses `node --check`; it does not execute the CLI or any
functional test.

| Evidence | October 8, 2026 |
| --- | --- |
| Node 22.23.2 frozen install and syntax | Run locally |
| Contract and tracked backend review | Create/list/get contracts, service, repository and active-uniqueness migration inspected |
| Unit, functional, live and device tests | Not added or run, by request; hardware is not applicable |
| Hosted workflow | Unverified until the exact committed run completes |

Compound-engineering review against the repository architecture and the public
end-user contracts:

| Requirement | Implementation evidence | Review status / remaining verification |
| --- | --- | --- |
| Independent server-side public workflow | Own manifest/lock, Node built-ins and `/v1/end-users` only | Source matched; frozen install and syntax passed locally |
| Exact stable application identity | Fixed configuration, URL-encoded exact lookup, at most one active item, minimal external-ID-only body | Source matched; deployed lookup/create acceptance unverified |
| Project credential boundary | Server key; expected project pinned; optional returned `project_id` checked | Source matched; omitted project fields rely on trusted key selection |
| Durable intent and retained result | SQLite atomic claim before POST, FULL synchronization, scope hash and known ID | Source matched; crash, storage and concurrency behavior unverified |
| GET-only uncertain reconciliation | Existing intent forbids POST; known ID cannot be replaced | Source matched; failure/recovery runtime scenarios unverified |
| Identity confirmation and bounded disclosure | Exact GET-by-ID checks, bounded JSON/deadline, controlled errors and selected output | Source matched; adversarial/runtime behavior unverified |
| Behavioral acceptance | Owner explicitly requested creation without testing | Intentionally deferred; no live, automated or exactly-once conformance claim |

Source basis: public documentation checkout
`93b6b3ddbc80875b6fef0d7f17d24eddb5a7f77a`,
`api-reference/end-users/{create,list,get}.mdx`; tracked backend
`1ac67c92c6d72858e29dc264037cb82b6c449825`,
`api/src/routes/v1/end-users/{validation,controller}.ts`,
`api/src/services/end-user.service.ts`,
`api/src/repositories/end-user.repository.ts` and
`api/src/db/migrations/064_end_user_external_id_active_unique.sql`.
These sources are review evidence and are not installation/runtime dependencies.
The documentation token search found existing external-ID/project contracts;
this sample changes no public API or platform lifecycle design.

Public contracts: [Create End User](https://docs.bota.dev/api-reference/end-users/create),
[List / external-ID lookup](https://docs.bota.dev/api-reference/end-users/list),
[Get End User](https://docs.bota.dev/api-reference/end-users/get) and
[Delete End User](https://docs.bota.dev/api-reference/end-users/delete).
