# Ask one recording with Node.js

Ask one question about an existing recording belonging to a fixed, server-configured
end user, then print the assistant's answer and recording citations. This example
creates an empty recording-scoped Ask session, records its ID durably, and sends
one question. It does not upload audio, create a transcription, stream responses,
search a library, manage conversation branches, or expose an HTTP server.

**Status:** implemented; installation and syntax checks only. Live API behavior,
recovery behavior and failure scenarios remain unverified. No automated test
suite was added or run for this example, following the requested creation-only pass.

## Prerequisites and configuration

- Node.js **22.23.2 or newer**, including built-in `node:sqlite` (experimental in
  Node 22). No third-party packages, SDK, hardware or sibling repositories.
- An API environment and project-held secret or suitably permitted restricted
  key. Recording reads require `recordings:read`. Ask operations require access
  to the configured project's Ask sessions and provider; this example does not
  invent a separate restricted-key Ask scope. Verify the deployed key policy.
- An existing recording owned by the configured end user, with a ready
  transcription small enough for single-recording Ask. The provider must be
  configured and allowed for that project. Generating the answer may incur usage.
- A private writable working directory. The SQLite journal contains IDs and the
  question's SHA-256, but no API key, question plaintext or answer text. A question
  hash can reveal predictable questions. On Windows use directory ACLs to restrict
  access; POSIX file modes do not replace Windows access control.

From this directory:

```sh
npm ci
cp .env.example .env
```

On PowerShell use `Copy-Item .env.example .env`. Replace all placeholders:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_ORIGIN` | Explicit trusted API origin, default `https://api.bota.dev`; HTTPS, or HTTP on `localhost`, `127.0.0.1`, or `[::1]` for local development. No path, query, user information or redirects. |
| `BOTA_API_KEY` | Secret/restricted project key, visible only to this server-side process. Device and upload tokens are excluded. |
| `BOTA_END_USER_ID` | Fixed authorized owner, `eu_...`. |
| `BOTA_RECORDING_ID` | The one existing recording, `rec_...`. |
| `BOTA_QUESTION` | One trimmed question, 1–10000 characters. |
| `BOTA_ASK_PROVIDER` | Explicit `gemini`, `openai` or `claude`. |

Keep `.env`, `.state/`, answers and identifiers private. Do not embed the key in
browser or mobile code. A customer application must derive end-user and recording
access from its authenticated caller; client-supplied IDs are not authorization.
This fixed-scope CLI is a server-side teaching path, not a multi-user backend.

## Run and expected result

```sh
npm run check
npm start
```

The first invocation:

1. Reads `GET /v1/recordings/{id}` and verifies both exact ID and end-user owner.
2. Atomically inserts durable creation intent before `POST /v1/ask/sessions`,
   with `{ "scope": { "type": "recording", "recording_id": "rec_..." } }` and
   no `initial_message`. Only HTTP `201` with an empty single-recording session
   is accepted. Recording scope derives the session's owner on the server.
3. Commits the returned session ID, reads its fresh scope, and checks recording
   ownership again before committing message intent. It posts exactly one
   `{ "content": "...", "provider": "gemini" }` to that session's messages.
4. Accepts only HTTP `200`, the exact session ID and a complete assistant answer
   with `finish_reason: "stop"` from the selected provider. It checks every
   citation and source before emitting selected JSON fields. Sources outside the
   configured recording are rejected; no source chunks are printed.
5. Records the answer ID and rechecks recording ownership/session scope and the
   expected two-message count before printing.

The output is JSON containing `session_id`, `recording_id`, `message_id`, `answer`
and `citations` (`recording_id`, `start_ms`). An answer can legitimately have no
citations. Text and IDs are JSON-escaped; arbitrary API metadata, signed audio
URLs, token counts, request bodies and API error bodies are never printed.

All requests share a two-minute deadline. JSON bodies are limited to 3 MiB,
answers to one million characters, parts/sources to 1000 entries. These are
teaching-example bounds, not platform limits. Redirects and non-JSON responses
fail. Errors contain only controlled local descriptions and HTTP status codes.

## Ambiguous outcomes and reruns

`.state/ask.sqlite` represents **one** configured origin/end-user/recording/
provider/question hash. Do not use a different working directory, delete the
journal, or change configuration to force another POST after a failure.

Every invocation finding existing intent performs **GET-only** reconciliation;
it never resumes a POST, even if the journal says an empty session was created.
SQLite atomically selects one creating invocation across processes sharing this
file; it does not serialize callers using other journals or applications.

- Creation may succeed even when a timeout, malformed body, unexpected status
  or crash prevents the session ID from being saved. Retain the journal and
  reconcile that session manually using trusted project records. This example
  cannot safely infer the missing ID, does not adopt an arbitrary session ID,
  and will stop on every rerun until the outcome is resolved outside the sample.
- If a session ID is known, reruns verify its immutable recording scope and
  fetch `GET /v1/ask/sessions/{id}/messages?limit=3`. They print only a single
  complete pair with exactly one user and one assistant message, irrespective
  of response order. The user message must match the configured question hash,
  and the answer must pass the same provider/citation checks. Extra messages,
  pagination, a missing answer, or a changed journaled answer ID cause failure.
  A rerun can observe a completed answer but does not change the retained intent.
- HTTP `409` means the transcription is not ready; `413` can mean an oversized
  transcript; `502`, interruption and other non-success outcomes all stop.
  Even where the API describes retry, this example deliberately adds no POST
  retry or duplicate-answer risk. Generation may continue after the client
  disconnects. Rerun later for GET-only observation or investigate manually.
- A crash between saving the session and sending the question leaves an empty
  session. Reconciliation reports no complete pair and stops; it never sends
  the missing question automatically.

List Messages does not return `sources`; recording-scoped Ask uses the recording
transcript directly and its normal POST result has empty retrieval sources.
Recovered answers still have their citation parts checked. Separate ownership
reads are not an atomic authorization snapshot. Message order is not used to
identify the pair: public documentation and API versions can differ in ordering.
Do not share this session with
other writers, and preserve application authorization around every operation.

## Cleanup

The recording and transcription remain untouched. The example creates one Ask
session and its messages and performs no automatic deletion. After reconciling
the exact result, remove that session through your authorized session-management
process if desired. Archive the resolved journal securely before intentionally
starting a new question in a fresh directory. Never discard an unresolved intent
to start over; clearing local state does not cancel remote generation or remove
the cloud session.

## Checks and evidence

```sh
npm ci
npm run check
```

The standalone path-filtered workflow runs these same two commands without
credentials or API requests. It performs installation and syntax validation.

| Evidence | October 8, 2026 |
| --- | --- |
| Node 22.23.2 frozen install and syntax | Run locally |
| Public contract/source review | Routes, session serialization and message result reviewed |
| Automated tests | Not added or run, by request |
| Live Ask / provider / failure recovery | Not run |
| Hardware | Not applicable |
| Hosted workflow | Check the exact committed run; local syntax is not hosted evidence |

Design review against the repository's one-workflow/public-contract/trust-boundary
requirements:

| Requirement | Evidence and status |
| --- | --- |
| Independent public setup | Own manifest/lock, built-ins only; frozen install and syntax matched locally. |
| One existing recording, fixed owner | Exact recording ownership and session scope checks present; live enforcement unverified. |
| Durable non-idempotent intent | Atomic SQLite creation claim and pre-message intent present; crash/concurrency behavior unverified. |
| No automatic uncertain POST replay | Existing rows enter GET-only reconciliation in source; failure scenarios unverified. |
| Bounded output and credentials | Origin/ID/JSON bounds, controlled errors and citation/source checks present; adversarial behavior unverified. |
| Behavioral acceptance | Intentionally deferred by the user's creation-only instruction; no live or automated-test claim. |

Public contracts: [Create Session](https://docs.bota.dev/api-reference/ask/create-session),
[Send Message](https://docs.bota.dev/api-reference/ask/send-message),
[Get Session](https://docs.bota.dev/api-reference/ask/get-session),
[List Messages](https://docs.bota.dev/api-reference/ask/list-messages),
and [Get Recording](https://docs.bota.dev/api-reference/recordings/get).
No private source is imported or required by this example.
