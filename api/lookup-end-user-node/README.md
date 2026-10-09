# Look up an end user by external ID (Node.js)

Resolve one application identifier to its current active Bota end-user mapping
in a configured project. This standalone, dependency-free server CLI performs
`GET /v1/end-users?external_id=...`, followed by `GET /v1/end-users/{id}` for a
match. It never creates an end user, traverses a directory, issues a token or
retries a request. No SDK or sibling repository is required.

Use this in a trusted server process. Supply a project API key with
`end_users:read` and independently confirm that the key belongs to
`BOTA_PROJECT_ID`. Optional returned `project_id` must agree; its omission does
not independently establish the key's project. Do not expose this operator CLI
as an unauthenticated application endpoint: a host integration must derive the
external ID from its verified caller, rather than accepting another person's
identifier from a client.

## Setup

Requires Node.js 22.23.2 or newer.

```sh
cd api/lookup-end-user-node
npm ci
cp .env.example .env
npm run check
# Configure .env and a private external-ID file before running:
npm start
```

Configuration:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Trusted HTTPS base with exact `/v1` path; default `https://api.bota.dev/v1`. No credentials, query, fragment, trailing slash, backslash, controls or raw whitespace. |
| `BOTA_API_KEY` | Server-held `sk_test_*`, `sk_live_*` or restricted `rk_*` project key with `end_users:read`. |
| `BOTA_PROJECT_ID` | Independently verified expected `proj_*` project. |
| `EXTERNAL_ID_FILE` | Existing private regular UTF-8 file outside this checkout, containing the exact external ID. |

Keep `.env` and the identifier file private. On POSIX, the file and its immediate
parent must be owned by the current user, with no group/other permissions
(typically `0600` and `0700`). On Windows, configure an equivalent owner-only ACL
before running; this sample cannot verify Windows ACLs. Symlinks and hard-linked
files are rejected, and ancestors must be real directories. Keep the trusted
path and file stable during the operation; these checks cannot protect against
a hostile writer with the same user identity.

The file accepts 1–255 **UTF-16 code units**, matching the tracked creation
schema's `max(255)` string bound, with a 1,020-byte UTF-8 ceiling. It does not
trim or normalize: whitespace, line endings and a UTF-8 BOM become part of the
lookup value. Create the file without a trailing newline unless that newline is
part of your actual identifier. Empty input is rejected because current service
source treats an empty `external_id` as a directory request. NUL is rejected
because the tracked PostgreSQL text storage cannot hold it. Invalid UTF-8 fails
before any request. No private identifier is passed as a CLI argument.

## Result and limits

A match produces only:

```json
{
  "status": "found",
  "end_user_id": "eu_abc123",
  "atomic_snapshot": false,
  "persistent_identity_verified": false
}
```

A terminal empty lookup produces `status: "not_found"`, without an end-user ID,
and the same false evidence labels. Both are successful observations (exit 0);
invalid configuration, response, changed mapping or failed requests exit 1.
`not_found` is not permission to create an account and does not distinguish
absence, deletion or inaccessibility. A failed exact-ID recheck, including 404,
fails the operation; it never adopts a successor mapping or performs a new
lookup automatically.

The collection must have zero or one item, `has_more: false`, and an absent/null
continuation cursor. A selected item must have a valid `eu_*` ID and an exact
external-ID match. Optional `project_id` contradictions and every present
non-null `deleted_at` are rejected, on both collection and exact-ID reads. The
exact-ID recheck immediately precedes output. Separate requests are not an
atomic snapshot; deletion/recreation can change the external-ID mapping later.
Repeated invocations intentionally observe the current mapping and retain no
historical identity journal. Persist a trusted original `eu_*` ID in your own
application when identity must survive external-ID reuse.

No external ID, file path, hash, name, email, profile, arbitrary response or raw
exception is printed. The remote API necessarily receives the identifier in a
URL query; configure trusted API/proxy tracing and access logs to redact that
query. Credentials are sent only to the configured API. Redirects and automatic
retries are disabled. Each request and decoded response body have a 10-second
abort budget and a 1-MiB decoded byte cap; one 30-second deadline covers the
operation and is checked before output. Local synchronous filesystem calls are
not interruptible by that deadline. Oversized/invalid JSON or UTF-8 fails closed.

## Contract and design review — October 8, 2026

Authority: repository `ARCHITECTURE.md` independent-example and trust-boundary
rules, public [list](https://docs.bota.dev/api-reference/end-users/list) and
[get](https://docs.bota.dev/api-reference/end-users/get) contracts, and the
tracked backend source (`bota/api/src/routes/v1/end-users/{controller,validation,index}.ts`,
`services/end-user.service.ts`, `repositories/end-user.repository.ts`) inspected
as read-only reference. Private source is not an install/runtime dependency.

| Requirement | Implementation evidence | Status / remaining verification |
| --- | --- | --- |
| Independent public integration | Own package/lock, Node built-ins, two public GET endpoints | Matched by source inspection and frozen install; runtime acceptance unverified |
| Exact lookup; no directory/create fallback | Nonempty exact file value, encoded query, strict terminal zero/one response, no POST/pagination/retries | Matched by static review; live absence/reuse/race checks deferred |
| Private identifier handling | Private file ownership/type/size/fatal UTF-8 checks; selected ID output and sanitized errors | Matched by static review; filesystem/ACL and failure-path behavior unverified |
| Authenticated project and active mapping | Server-held key, optional project contradiction checks, strict deletion markers, final exact-ID reread | Partial: current key project is an operator prerequisite; requests are non-atomic |
| Bounded read-only operation | 10-second requests, 30-second overall abort, 1-MiB decoded responses, no redirect/retry | Matched by static review; runtime interruptions deferred |
| Scoped permission contract | Public docs require `end_users:read`; tracked GET/list router has no explicit `requireScopes` middleware | Unverified deployed scope enforcement; global project authentication/repository isolation exists in source, but does not prove per-route scope enforcement |
| Syntax-only delivery | `npm ci`, `npm run check`; parsed YAML/pin/path and package-lock identity review | Matched locally on Node 22.23.2; hosted install/syntax [passed at source `f8607c6`](https://github.com/bota-dev/examples/actions/runs/37892681342). No unit, functional, live API or device tests, and no example CLI execution |

Creation-only delivery follows the owner's instruction. It does not establish
deployed or end-to-end conformance. Remaining acceptance includes a disposable
mapping, no match, invalid/wrong-project/deleted responses, external-ID reuse,
ownership changes and bounded network/body failures in an explicitly authorized
runtime verification pass.
