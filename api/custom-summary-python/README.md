# Custom summary (Python)

Learn to request one custom-prompt summary of an existing completed transcription,
retain durable creation uncertainty, and print its completed structured output.
This independent standard-library example does not upload audio, operate devices,
start transcription, select a template, delete cloud resources or verify model claims.

**Status, October 8, 2026:** implemented; syntax and source review only. Functional,
failure/recovery and live API acceptance are unverified. The owner requested this
creation batch without unit, functional, live or device tests.

## Prerequisites and trust boundary

- Python 3.12+ on Windows, macOS or Linux; no packages or SDK installation.
- An explicit API environment, a server-held project API key, and fixed authorized
  project/end-user/recording/transcription IDs. Use synthetic or consented content.
- Key scopes: `recordings:read`, `transcriptions:read`, `summaries:read`,
  `summaries:write`. Keep keys out of client apps, source, shell history and logs.
- One trusted local operator, a private existing directory for the prompt/journal,
  and a private terminal or stdout destination. On POSIX use directory mode `0700`;
  the example enforces this and creates its database with mode `0600`. On Windows,
  restrict the directory ACL to the operator; the example cannot verify ACL privacy.
  Protect ancestor directories and avoid paths writable by other users. The local
  filesystem, directory paths and configuration are trusted, not hostile inputs.
- Coordinate automatic summarization and other writers before requesting this
  billable provider operation. This script does not change processing settings.
  A project key authenticates a project; these configured IDs are operator-owned
  authorization context, not arbitrary IDs accepted from an untrusted client.

Only public `/v1` APIs are used. A recording must match the configured owner and
ID, have absent/null `deleted_at` and not have `status: deleted`; the completed
transcription must link exactly to that recording. Public
recording/transcription GET schemas omit `project_id`, so it is checked when
present; project isolation otherwise relies on the project API key. Summary
`project_id` and `transcription_id` are mandatory exact checks. The summary must
also have `template_id: null`, the exact custom prompt, a documented provider,
and the selected provider when configured. Source scope is checked before any
POST and again before completed output is emitted. Separate GETs are non-atomic;
they cannot guarantee that ownership stays unchanged after a read.

## Configure and run

Work from `api/custom-summary-python`. `.env.example` documents process variables;
the script does **not** load `.env`. Configure them using your trusted environment
or secret manager. Do not paste a live key into a command.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit HTTPS base ending `/v1`, e.g. `https://api.bota.dev/v1`; HTTP allowed only for loopback |
| `BOTA_API_KEY` | Server-held `sk_test_*`, `sk_live_*` or `rk_*` project key with the scopes above |
| `BOTA_PROJECT_ID` | Exact expected project |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` recording owner |
| `BOTA_RECORDING_ID` | Existing `rec_*` source |
| `BOTA_TRANSCRIPTION_ID` | Existing completed `txn_*` linked to that source |
| `BOTA_PROMPT_PATH` | Trusted regular UTF-8 file, e.g. `private/prompt.txt`; final symlinks rejected |
| `BOTA_SUMMARY_PROVIDER` | Empty omits `provider` and uses API default; optional `gemini`, `openai`, `claude` |
| `SUMMARY_STATE_PATH` | Private SQLite journal, e.g. `private/summary.sqlite`; parent must already exist |
| `BOTA_SUMMARY_ID` | Empty normally; recovery can explicitly attach an independently reconciled existing `sum_*` |

Create the private directory yourself, restrict access, and save your prompt in
an editor. For example, ask for technical requirements and action items in a JSON
object. Prompt bytes are sent as `prompt`; no `template_id`, private model settings
or invented template output schema is used. Keep the same exact file bytes during
recovery, including whitespace. Prompt limits are 40,000 UTF-8 bytes, at least 10
Unicode code points and at most 10,000 UTF-16 code units. This conservatively fits
the public 10–10,000-character contract and the service's UTF-16 length boundary;
astral characters occupy two units. These are teaching-example input bounds.

With the environment configured:

```sh
python main.py
```

The first run checks source scope, durably commits pre-POST intent, makes one
`POST /summaries`, durably saves a validated returned summary ID, then polls only
that ID. Completed stdout is private JSON with only `summary_id`, `status` and
the documented generic `output` object. The shape of custom output is not fixed.
Model output is untrusted content: do not execute it or treat its statements as
verified facts or professional guidance. Other API fields (including prompt
echoes, transcript text and signed URLs), keys and raw errors are not printed or
journaled. The selected model output itself can quote sensitive source content;
keep stdout private.

HTTP responses must be uncompressed JSON with strict UTF-8, unique object keys
and finite numbers, at most 1 MiB each. Redirects and automatic HTTP retries are
rejected. A connection timeout is at most 10 seconds; each request has a 15-second
transport budget and observation has a five-minute monotonic budget, polling
every two seconds. Platform DNS resolution can exceed the connection timeout;
the next budget check stops work, but the script cannot interrupt resolver work.
No job is cancelled or replaced when observation expires. Stdout is limited to
2 MiB. General failures print only a fixed explanation; summary failures retain
the known ID without printing the provider's arbitrary error message.

## Restart and reconcile

Keep the SQLite journal and any `*.sqlite-*` sidecars together in private storage.
It pins API origin/base, project, owner, recording, transcription, SHA-256 of
exact prompt bytes and provider selection (including the omitted/default choice).
Changing any pinned value fails before a POST. Keys are not pinned or stored, so
you can rotate a key while preserving its project authorization.

- A known ID resumes using GET only, including after polling timeout or failure.
  Use the same environment, prompt bytes and journal: `python main.py`.
- A crash, network error, cancellation, unexpected HTTP status, malformed response
  or validation failure after durable intent leaves the operation uncertain.
  This includes a crash before the actual network send: absence of a saved ID
  does not prove that no cloud job exists. An uncertain operation never resends.
- Reconcile the operation privately through an authorized API/operator workflow.
  This example assumes no public list/recovery endpoint and does not discover an
  ID automatically. Once you independently identify the exact existing summary,
  set `BOTA_SUMMARY_ID` to its ID and run `python main.py`. It validates project,
  source, prompt/provider and current source ownership before saving that ID.
  A different ID cannot replace an already-known one. Clear the recovery variable
  for later runs; the attached ID stays durable.
- If no matching summary can be proven, retain the journal and treat the outcome
  as inconclusive. Do not delete it or choose a new state path to bypass the guard.
  A separate intentional request requires independent reconciliation and an
  explicit operator decision outside this example.

SQLite `synchronous=FULL` commits durable intent before sending, and saves the ID
before polling. Its conditional atomic claim prevents two processes sharing one
journal from both sending; run one invocation at a time and do not edit the DB.
Durability depends on a reliable local filesystem and preserving the journal.
This is a local guard, **not an exactly-once API guarantee**. No idempotency header
is used or assumed. The public contract warns that another template-based POST
can replace a previous completed/failed or stale-processing result; custom-prompt
creation must likewise not be used as a reconciliation/status check. It does not
promise exactly-once custom creation. Other writers and lost journals remain
outside this sample's guarantee. No cleanup command is provided: retain the cloud
summary and recording, and preserve private recovery state until reconciled.

## Evidence and design review

```sh
python -m py_compile main.py
```

The path-filtered Ubuntu 24.04 workflow performs this syntax check with the runner's
Python and a commit-pinned checkout action. It uses no live credentials and runs
no functional tests.

| Requirement / contract | Implementation evidence | October 8, 2026 status |
| --- | --- | --- |
| Independent public custom prompt | Standard-library `main.py`; `prompt` only, bounded trusted UTF-8 file; optional documented provider | Matched by source inspection; live behavior unverified |
| Exact source/owner/project | `verify_source` before creation and output; mandatory summary project/source/prompt checks in `verify_summary` | Matched by source inspection; malformed/scope rejection execution not run |
| Durable create/recovery | `Journal.claim` commits uncertain intent before POST; `remember` persists returned/explicitly attached validated ID; scope pinning | Matched by source inspection; crash, concurrent-process and SQLite durability tests not run |
| Bounded observation without replacement | Known-ID GET loop; five-minute budget; fixed failure messages; no retry/replacement path | Matched by source inspection; timeout/network behavior unverified; DNS limitation above |
| Generic private completed result | Selected ID/status and object only; strict JSON; current source recheck | Matched by source inspection; model output trust and non-atomic GET limits remain |
| Local syntax | Bundled Python 3.12.14 `-m py_compile main.py` | Passed; establishes parsing only |
| Hosted CI, functional and live/API/device acceptance | Not run for this creation batch | Unverified; no runtime or physical claim |

Reviewed using `bota-skills:compound-engineering` against the repository
[architecture](../../ARCHITECTURE.md), contributor rules and public contracts:
[Create Summary](https://docs.bota.dev/api-reference/ai/summaries/create),
[Get Summary](https://docs.bota.dev/api-reference/ai/summaries/get),
[Get Transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get),
[Get Recording](https://docs.bota.dev/api-reference/recordings/get) and
[idempotency limitations](https://docs.bota.dev/api-reference/idempotency).
The template-based Node summary and Python summary export were reference context;
there are no runtime imports from sibling examples or private code.

For a customer application, derive owner/project/source scope from authenticated
server identity, retain durable intents in your own trusted store, reconcile
unknown outcomes before allowing new requests, and combine verified webhooks
with known-ID GET observation. This single-operator CLI is not a shared service.
