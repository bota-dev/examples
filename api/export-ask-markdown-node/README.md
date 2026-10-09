# Export one recording's Ask history as Markdown

Read an existing Ask session for a fixed authorized recording and end user, then
publish selected message content, text parts and plain citation positions to a
private Markdown file without overwriting anything. This is GET only: no sessions,
messages, models, jobs, audio downloads, branches or device operations are created
or changed. The session title, provider, token usage and arbitrary metadata are
excluded.

**Status:** implemented with source review, independent installation and syntax
checks only. Functional, unit, live API and device checks were not added or run,
following the owner's creation-only instruction. Runtime acceptance is unverified.

## Prerequisites

- Node.js **22.23.2 or newer**, on a trusted server or workstation. Built-ins only;
  no SDK, third-party dependencies or sibling repositories are required.
- A trusted HTTPS API environment and a server-held secret or suitably permitted
  restricted **project key** for the expected project, with `recordings:read` and
  access to Ask reads. Public Ask pages do not specify a separate restricted-key
  Ask scope; confirm deployed key permissions. End-user, device and upload token
  formats are excluded.
- One existing recording owned by the fixed end user and one existing Ask session
  with the exact immutable scope `{ "type": "recording", "recording_ids": ["rec_..."] }`.
  Transcript readiness or a model configuration is unnecessary for these reads.
- An existing private output directory on a filesystem supporting exclusive file
  creation, file synchronization and hard links. On POSIX its owner must be this
  process user and its mode must permit no group/other access (for example `0700`).
  Every ancestor must be trusted and protected from untrusted replacement; symbolic
  links in the ancestry are rejected. On Windows, configure a private NTFS ACL
  restricted to the intended account before running: the example cannot inspect
  ACLs, and Node's `0600` mode does not establish Windows privacy. Avoid shared or
  untrusted network filesystems and directory writers.

## Configure and run

From this directory:

```sh
npm ci
cp .env.example .env
mkdir -m 700 private
```

On PowerShell use `Copy-Item .env.example .env` and create `private` with a suitably
restricted ACL using your administrator's approved procedure. Replace every
placeholder; the example does not create the output directory.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Trusted HTTPS origin with `/v1` path, such as `https://api.bota.dev/v1`; no credentials, query, fragment, whitespace, backslashes or redirects. |
| `BOTA_API_KEY` | Server-held project key. Keep it out of browser/mobile configuration, files shared with others and logs. |
| `BOTA_PROJECT_ID` | Exact expected `proj_...` project, selected independently when issuing the key. |
| `BOTA_END_USER_ID` | Fixed authorized recording and session owner, `eu_...`. |
| `BOTA_RECORDING_ID` | One existing authorized `rec_...` recording. |
| `BOTA_ASK_SESSION_ID` | Exact existing recording-scoped `as_...` session. |
| `OUTPUT_PATH` | New `.md` destination inside the existing private directory. The file must not exist. Relative paths resolve from the current directory. |

```sh
npm run check
npm start
```

Success exits 0 and prints only `Exported selected Ask history as private Markdown.`
It never prints the path, history, title, cursor or key. Failure exits 1 with a
controlled explanation or HTTP status; raw response bodies and native errors are
suppressed. The destination contains sensitive authorized history as plaintext.
Keep `.env`, partial files, exports and their backups under your data policy.

This fixed-scope CLI is a teaching example. A customer backend must authenticate
callers and derive project, owner, recording and session authorization from trusted
server-side mappings. Client-supplied identifiers are not authorization.

## Read and publication flow

1. Verify the existing output parent and absence of a destination before networking.
2. Read `GET /v1/recordings/{id}` and verify exact identity and end-user ownership,
   rejecting a deleted status, non-null deletion marker or contradictory optional
   project metadata.
3. Traverse `GET /v1/ask/sessions` with fixed `end_user_id`, `recording_id`,
   `scope_type=recording` and `limit=50` on **every** page. Require the exact session
   to appear within ten pages. Validate every observed session's single-recording
   scope and any supplied project/owner/deletion metadata. Finding membership does
   not require traversing the remaining unrelated sessions.
4. Read `GET /v1/ask/sessions/{id}` and verify its exact ID and immutable `[rec]` scope.
5. Traverse `GET /v1/ask/sessions/{id}/messages?limit=50` using opaque cursors for
   at most ten pages. Validate all selected messages and parts. A `has_more: true`
   response at the cap **fails without publishing**; incomplete history is never
   silently exported. An empty observed history is permitted.
6. Recheck fixed-owner session membership and exact session scope, then write the
   rendered bytes to an exclusively created `0600` partial in the same directory,
   synchronize and close it. Recheck the parent identity/permissions and make a
   final fresh recording-owner observation immediately before publication.
7. Hard-link the partial to the destination. The link refuses an existing file,
   directory or symlink, including one created after preflight. Remove only this
   invocation's successfully created partial.

The export preserves API response order; it never sorts or reverses messages.
Public List Messages documentation says oldest-first. Backend source at
`1ac67c92c6d72858e29dc264037cb82b6c449825` orders newest-first and pages toward older
rows; the service forwards that order. Deployed order remains unverified.

The file has a fixed `Ask history` heading, labels `Order: API response order`,
`Traversal: observed end required` and `Atomic snapshot: false`, then sections
headed `User` or `Assistant`. Each section includes both `Content` and the ordered
`Parts`; content/text parts may overlap or duplicate by API design. Citations are
plain text `Citation: rec_... at ... ms.` with no link or playback instruction.

Only `user`/`assistant` roles and `text`/assistant-only `citation` parts are accepted.
Every citation must reference the configured recording with nonnegative
safe-integer `start_ms`. Any supplied message `session_id`, project/owner/deletion
metadata or part recording reference must match. Duplicate message/session IDs,
unknown parts, invalid Unicode or cross-recording citations fail the entire export.
Messages retain response order; the title and model/provider fields are never used.

All untrusted content and text parts have ASCII whitespace/control characters,
bidi controls and Unicode line/paragraph separators flattened to spaces. Every
ASCII punctuation character is encoded as a numeric entity, including `<`, `>`,
`&`, brackets, backticks, Markdown delimiters, URL colons and email `@`. Untrusted
input therefore cannot introduce raw HTML, Markdown links or source autolinks in
ordinary Markdown parsing. Citation identifiers are escaped the same way. This is
a display export, not byte-for-byte text preservation. Use a trusted Markdown
viewer without plugins that reparse decoded text or add post-render linkification;
the example cannot control custom renderers or their external link behavior.

## Limits and recovery

Each decoded JSON response is bounded to 1 MiB and all responses combined to
16 MiB. All API reads and the publication gate share a two-minute abort deadline;
local filesystem synchronization and linking are not interruptible and have no
wall-clock guarantee. No request is automatically retried or redirected. History
is limited to 500 messages, each with at most 1000 parts and at most 250,000 UTF-16
code units per content/text field; the final UTF-8 Markdown is limited to 4 MiB.
Each membership pass separately permits ten pages. These are example bounds,
not platform service limits. Responses must contain valid UTF-8 JSON; selected
schemas are validated, while duplicate object keys follow Node JSON parsing's
last-value semantics and are not independently detected.

`has_more: false` is an observed end, not an atomic snapshot, audit completeness or
proof that generation has finished. Concurrent additions, edits, deletions and
branch changes may occur between pages or final checks. Historical assistant text
can be incomplete or incorrect. The reader does not choose an active branch or
infer completeness from `message_count`. The final owner observation cannot make
the filesystem publication transactional with the API.

Public Get Recording/Get Session schemas do not guarantee `project_id` or session
`end_user_id`. Optional contradictions are rejected, but absent project metadata
cannot independently verify the expected project: use a key issued for the
intended project. Session ownership depends on server enforcement of the fixed
owner list filter and the project-key boundary; recording ownership and session
scope alone are insufficient. An end-user token can override the list owner filter
and is deliberately not accepted.

File synchronization protects written bytes before publication; this sample does
not synchronize directory entries or claim power-loss durability. A crash may
leave its private partial; after a reported failure a completed destination may
also exist if link succeeded before cleanup failed. Inspect the private directory
before retrying. Existing destinations are never repaired or replaced. A later
manual invocation performs fresh GET observations only; choose a new destination
only after reviewing local artifacts. No cloud resources are created or deleted.
Remove private local artifacts/configuration when no longer needed.

Trust the runtime, DNS, TLS certificates and proxy settings. Use Node's default
fetch dispatcher, without untrusted preload hooks or modified dispatchers. Origin
and redirect restrictions do not defend against a compromised host. Ancestry and
parent observations do not prevent races with an authorized local writer; the
private directory and its trusted ancestry must exclude such interference.

## Checks and design review

```sh
npm ci
npm run check
```

The path-filtered workflow performs only installation and syntax compilation,
without credentials or example execution.

| Evidence | October 8, 2026 |
| --- | --- |
| Independent installation | `npm ci` passed on Windows / Node 22.23.2; built-ins only |
| Syntax | `npm run check` passed on Windows / Node 22.23.2 |
| Workflow source | YAML parsing, pinned action references, `contents: read`, disabled persisted credentials, main branch and working-directory checks passed |
| Public/source contracts | Public recording/Ask pages and backend controller, service and repositories reviewed at `1ac67c92` |
| Functional/unit/live/device checks | Not added or run, by request; behavioral acceptance unverified |
| Hosted workflow | Install/syntax [passed at source `f8607c6`](https://github.com/bota-dev/examples/actions/runs/37892681335); runtime acceptance remains unverified |

Compound-engineering review against repository architecture and the requested
read-only, private, bounded export:

| Requirement | Implementation evidence / status |
| --- | --- |
| Independent setup | Own package, lock and built-ins; install and syntax matched locally. No sibling runtime imports. |
| GET-only existing resources | Explicit GET client; public recording, session and message reads only. Matched by source review; deployed acceptance unverified. |
| Exact owner/project/session/citation scope | Before/after membership and exact scope, final recording owner, optional contradiction checks and exact citation ID in source. Project/owner filter enforcement unverified. |
| Complete bounded selection | Cursors/duplicate IDs checked; cap fails without publication; only observed end exports. Runtime pagination unverified; snapshot guarantee intentionally excluded. |
| Untrusted Markdown safety | All selected untrusted strings validated, flattened and punctuation escaped; no title or active citation link. Adversarial renderer/runtime behavior unverified. |
| Private no-overwrite publication | Existing private parent, ancestry checks, exclusive `0600` partial, file fsync, hard link and own-partial cleanup. POSIX/Windows/filesystem behavior unverified; Windows ACL and trusted ancestors are operator prerequisites. |
| Current ordering | API response order preserved; public/source discrepancy documented. Deployed order unverified. |
| Behavioral acceptance | Deferred under the owner's instruction to create without unit/functional/live/device testing. |

Changed-token discovery covers public Ask/recording pages, internal Ask design and
example overview docs. Root catalog and cross-example review integration belong
to this creation batch; this example changes no backend or public API contract.

Public contracts: [Get Recording](https://docs.bota.dev/api-reference/recordings/get),
[List Sessions](https://docs.bota.dev/api-reference/ask/list-sessions),
[Get Session](https://docs.bota.dev/api-reference/ask/get-session), and
[List Messages](https://docs.bota.dev/api-reference/ask/list-messages).
