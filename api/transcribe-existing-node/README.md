# Transcribe an existing recording (Node)

Learn to request one explicit ASR job for an existing uploaded recording, retain
durable creation intent, and observe the saved job to completion. Successful
stdout contains selected job metadata. This independent example does not upload
audio, create recordings, request summaries, export transcript text, delete
resources or operate physical devices.

**Status, October 8, 2026:** implemented with syntax and source review only.
Independent `npm ci` and `node --check` passed on Node 22.23.2 / Windows. The owner
requested creation without unit, functional, live or device tests; runtime,
failure/recovery and API acceptance remain unverified.

## Prerequisites and creation consequences

- Node 22.23.2 or newer on Windows, macOS or Linux. Only Node built-ins are used,
  including experimental `node:sqlite`; there is no SDK or third-party package.
- An explicit trusted API origin, a server-held project API key with
  `recordings:read`, `transcriptions:write` and `transcriptions:read` scopes, and
  fixed authorized project/end-user/recording IDs. Use synthetic or consented
  audio whose upload was already accepted. These IDs are operator configuration,
  not authorization supplied by an untrusted client.
- Coordinate automatic transcription and other callers **before the first run**.
  A create request is a processing operation that can incur provider charges and
  replace earlier results. The script does not change processing settings or
  discover existing jobs. Automatic summaries and other configured downstream
  processing may also run; this example makes no summary request itself.
- One trusted local operator and a private existing journal parent directory.
  On POSIX the directory must have mode `0700` and an existing journal mode
  `0600`; the example checks those modes and creates the file with `0600`.
  On Windows restrict its ACL to the operator; the example cannot verify ACL
  privacy. Protect ancestor directories and avoid paths writable by other users.
  Configuration, filesystem paths and local storage are trusted inputs.

The public create page describes a newly created transcription but omits current
rerun behavior. Source review at backend `1ac67c92c6d72858e29dc264037cb82b6c449825`
found that the service selects the latest job for the recording, deletes a
completed or failed job before creating another, and deletes a processing job
whose `created_at` is over ten minutes old. More recent processing is rejected.
A pending job falls through into another creation; the repository does not
provide an exactly-once or single-job guarantee. These are source findings,
**not live or deployed acceptance evidence**. A local journal cannot coordinate
automatic processing, other applications or distinct journal files. Requesting
this explicit operation is an intentional operator action after reconciliation,
not a safe way to check whether an earlier job exists.

The recording must have the exact configured `id` and `end_user_id`, absent/null
`deleted_at`, and status `uploaded` or the documented legacy `completed` value.
All other statuses are rejected. This gate is checked before POST, on known-ID
resume, and again before completed metadata is emitted. Transcription ID, source,
status and selected provider are checked on every response. Before terminal
completion/failure, the returned language must match an explicit request hint.
Public Recording and Transcription response examples omit `project_id`; it is
checked exactly when present, and project isolation otherwise depends on the
project API key. Separate reads are non-atomic and cannot freeze ownership.

`uploaded` is an API processing prerequisite, not proof of SHA-256 verification,
successful streaming assembly, or permission to delete device/source bytes.
Establish required upload/integrity evidence in the upload workflow beforehand.
The script never calls upload completion or authorizes cleanup.

## Install, configure and run

Work from `api/transcribe-existing-node`:

```sh
npm ci
```

Copy `.env.example` to a private `.env` in an editor, or supply variables through
your trusted environment/secret manager. `npm start` loads `.env` if it exists.
Keep keys out of mobile/browser apps, committed files, shell history and logs.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_ORIGIN` | Explicit HTTPS origin, e.g. `https://api.bota.dev`, with no path, query or credentials; HTTP is loopback-only |
| `BOTA_API_KEY` | Server-held `sk_test_*`, `sk_live_*` or `rk_*` project key |
| `BOTA_PROJECT_ID` | Exact expected project |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` recording owner |
| `BOTA_RECORDING_ID` | Existing owned uploaded-compatible `rec_*` source |
| `BOTA_TRANSCRIPTION_LANGUAGE` | Empty omits `language`; otherwise a 2–10-character code such as `en` or `en-US` |
| `BOTA_TRANSCRIPTION_PROVIDER` | Empty omits `provider`; otherwise `whisper`, `deepgram`, `assemblyai` or `elevenlabs` |
| `TRANSCRIPTION_STATE_PATH` | Private SQLite file, default `.state/transcription.sqlite`; its parent must already exist |

Create the journal directory privately. On POSIX, for example:

```sh
mkdir -m 700 .state
```

On Windows, create `.state` and restrict its ACL to your account before running.
Keep any custom state path and SQLite sidecars private and outside source control.
The script rejects final symlinks for the parent and journal, but trusts ancestor
paths and does not defend against a hostile local user changing files mid-run.

With those prerequisites satisfied:

```sh
npm start
```

The first run checks recording scope, commits uncertain intent to SQLite, sends
one `POST /v1/transcriptions`, durably retains a validated returned ID, then polls
only `GET /v1/transcriptions/{id}`. The body contains `recording_id` and only the
configured optional `language`/`provider`. No `diarization`, custom vocabulary,
template, prompt or private model fields are sent. Omission delegates selection
to the API; the public page describes the provider default as project
configuration, while reviewed source uses `DEFAULT_ASR_PROVIDER`. This sample
does not infer a particular default. Actual provider/language metadata is checked
and reported; provider support and language detection are platform concerns.

Successful stdout resembles:

```json
{
  "transcription_id": "txn_abc123",
  "recording_id": "rec_abc123",
  "status": "completed",
  "provider": "whisper",
  "language": "en",
  "word_count": 6
}
```

No transcript, segments, signed URLs, keys, arbitrary provider errors or raw API
error bodies are logged or journaled. Keep metadata and the journal private too.
Completed `full_text` must exist but is not emitted. This observation does not
verify the transcription's accuracy. An explicitly selected provider must match
exactly. The submitted language is a hint retained exactly in the journal, while
terminal language is provider result metadata and can differ legitimately: for
example `en-US` can become `en`. The script reports that result without inventing
normalized equivalence as identity proof. Omitted language may change from null
to a detected code on completion. Exact job/source IDs establish the observed
job's identity; language does not prove which caller created it.

Observation uses a five-minute monotonic budget, a maximum 15-second request
budget, and two-second poll delays. Each response must be uncompressed JSON,
valid UTF-8, and at most 1 MiB, including any transcript returned by GET. Larger
jobs stop at this teaching-example bound. Redirects and automatic HTTP retries
are rejected. Timeout, cancellation, HTTP errors and invalid/mismatched JSON stop
the run; no job is cancelled, replaced or retried. Runtime DNS/OS scheduling can
delay timeout delivery; execution of these limits remains unverified.

## Resume and uncertain outcomes

Preserve the journal and any `*.sqlite-*` sidecars together on reliable private
local storage. Its scope pins origin, `/v1`, project, owner, recording, and exact
language/provider choices, including the omitted/default choice. The API key is
not persisted or pinned, allowing rotation with the same project authorization.

- A known ID is immutable. Running `npm start` with the same settings resumes
  using GET only, including after timeout, failure or a subsequent job deletion.
  A failed job or `404` is not permission to request a replacement.
- A crash after durable intent, transport failure, unexpected HTTP response,
  malformed/mismatched result or failure to save the ID leaves uncertainty.
  This includes a crash before the actual send: no saved ID does not prove that
  no job was created. The next invocation stops without making any API request.
- Reconcile privately through an independently authorized operator/API workflow.
  This example has no list/discovery or ID-adoption command and does not infer a
  matching job from a recording. Preserve uncertain state; do not delete the
  journal, edit it, or change paths to bypass the guard. A new intentional
  request requires reconciliation and a separate operator decision outside this
  example, including its possible replacement of prior results.

SQLite `synchronous=FULL` commits the conditional atomic claim before POST and
the returned ID before polling. Two callers sharing this one journal cannot both
claim the create. Run one invocation at a time and do not edit the DB. This is a
local durability guard, not an exactly-once API guarantee; filesystem reliability,
preserved state and external coordination remain prerequisites. No
`Idempotency-Key` header is sent or assumed. The generic documented header does
not compare bodies and cannot by itself prove creation or selected options.
No cleanup command is provided; retain the cloud recording/job and recovery
state until independently reconciled.

## Evidence and design review

```sh
npm ci
npm run check
```

The dedicated path-filtered workflow uses Node 22.23.2, commit-pinned actions,
read-only repository permissions and those install/syntax commands. It has no
live secrets and runs no unit, functional, live or device tests.

| Requirement / contract | Implementation evidence | October 8, 2026 status |
| --- | --- | --- |
| Independent public ASR operation | Own manifest/lock; Node built-ins; `recording_id`, optional documented language/provider only | Matched by source review; live behavior unverified |
| Source/owner/project and active upload gate | `checkRecording` before POST/resume and completed output; strict deletion and status checks; optional exact project field | Matched by source review; malformed/ownership rejection execution not run |
| Durable one-attempt intent | Scoped SQLite `Journal.claim` before POST; `remember` retains one validated ID; uncertainty stops | Matched by source review; crash, storage and concurrent-process behavior unverified |
| Known-ID observation | Exact ID/source/selection checks; GET-only resume; terminal failure stops; bounded request/response/polling | Matched by source review; runtime timeout/provider behavior unverified |
| Safe metadata output | Selected ID/source/status/provider/language/count only; current recording recheck; no transcript/raw errors | Matched by source review; non-atomic reads remain a limit |
| Independent installation and syntax | Bundled Node 22.23.2 on Windows: `npm ci`, `npm run check` | Passed; installs a dependency-free manifest and establishes parsing only |
| Hosted CI, unit/functional/live/device checks | Not run for this creation batch | Unverified; user requested creation without these tests |
| Public/source discrepancy | Replacement/pending concurrency behavior and server default documented above | Partial public prose; requires owning platform documentation follow-up, no platform fix claimed |

Reviewed using `bota-skills:compound-engineering` against the repository
[architecture](../../ARCHITECTURE.md), contributor rules and public contracts:
[Create Transcription](https://docs.bota.dev/api-reference/ai/transcriptions/create),
[Get Transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get),
[Get Recording](https://docs.bota.dev/api-reference/recordings/get),
[recording statuses](https://docs.bota.dev/api-reference/recordings/create),
[Complete Upload](https://docs.bota.dev/api-reference/uploads/complete),
[ASR providers](https://docs.bota.dev/guides/auto-processing), and
[idempotency limitations](https://docs.bota.dev/api-reference/idempotency).
The provider/language schema was checked against public OpenAPI. Existing
summary examples informed durable-intent concepts; there are no sibling runtime
imports or private dependencies.

For customer applications, derive project/owner/recording scope from verified
server identity, coordinate automatic and explicit processing, retain durable
operation intent, and reconcile uncertain results before allowing new creates.
Use verified webhooks and known-ID GETs for asynchronous observation. This CLI
is for a single trusted operator and is not an arbitrary-ID client proxy.
