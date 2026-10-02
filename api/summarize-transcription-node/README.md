# Summarize an existing transcription with Node.js

Create one structured summary from an existing completed transcription, then
resume by reading its saved summary ID. This independent server-side CLI uses
Node built-ins and the public Bota API. It uploads no audio, starts no
transcription, changes no processing configuration and deletes no resources.

**Status:** implemented; frozen install, syntax checks, CLI help and 19 regression
tests passed locally on Node 22.23.2. A live Gemini/general-notes run with the
existing synthetic transcript passed on October 2, 2026, including GET-only
resume in a new process. Exact-source hosted CI is pending at this checkpoint;
other providers and live failure recovery remain unverified.

## Requirements

- Node **22.23.2+**, including built-in `node:sqlite`, and npm.
- A server-side test project key with `transcriptions:read`, `recordings:read`,
  `config:read`, `summaries:read` and `summaries:write` permissions. Keep the key
  out of browser/mobile apps and logs.
- An existing completed transcription containing synthetic or consented text,
  with its expected project ID. No recording or transcript content is stored
  in this example's journal.
- Automatic summary processing disabled before the source transcription was
  completed, and no other writer creating/replacing summaries for it during the
  run. The CLI observes current effective device/end-user/project configuration;
  that does not prove historical configuration or lock out concurrent writers.
- An allowed summary provider route with an available credential. Provider policy,
  credentials and billing remain server-managed. A summary request can be billed.

## Run

```sh
cd api/summarize-transcription-node
npm ci
# Copy .env.example to .env and replace every placeholder.
npm start -- --help
npm start
```

| Environment variable | Purpose |
| --- | --- |
| `BOTA_API_BASE_URL` | Public API base, default `https://api.bota.dev/v1`; HTTPS except loopback tests. |
| `BOTA_API_KEY` | Secret/restricted project key, server only. |
| `BOTA_PROJECT_ID` | Expected project; checked against current API resources. |
| `BOTA_TRANSCRIPTION_ID` | Existing completed `txn_*`. |
| `BOTA_TEMPLATE_ID` | Default `tmpl_general_notes`; also `tmpl_sales_call`, `tmpl_clinical_soap`, `tmpl_legal_memo`. |
| `BOTA_SUMMARY_PROVIDER` | Explicit `gemini` (default), `openai` or `claude`. |
| `SUMMARY_STATE_PATH` | Default `./state/summary.sqlite`; one fixed request scope per journal. |

The CLI checks the transcription and recording, observes that auto-summary is
disabled, and enumerates existing summaries before creating. If any summary
already uses the selected template, it stops: a repeat POST can replace a
completed/failed summary or an older processing job, even when the provider
differs. Template discovery or creation and custom prompts are outside this
example; the four built-in IDs are documented public options.

On completion, stdout contains JSON with the summary ID, transcription, template,
provider and generic structured `output`. That output can contain sensitive text;
choose any shell redirection destination deliberately and use
`npm run --silent start` to omit npm's banners when capturing stdout. Errors go
to stderr.
The CLI polls every two seconds for up to five minutes, with bounded individual
requests. A timeout leaves the existing cloud job and local identity intact.

## Resume and reconcile

Run the same command with the same environment and journal to retrieve the
same summary. The known-ID path uses GET requests only, including after a
polling timeout or process restart. Failed jobs and missing IDs stop; they do
not cause replacement requests.

If creation loses its response, inspect candidate metadata without writing:

```sh
npm start -- --inspect
```

After inspecting the same project/transcription in the platform and identifying
the intended existing summary, attach its exact ID:

```sh
npm start -- --summary-id sum_REPLACE
```

Attachment validates the current summary's project, transcription, template,
provider, prompt mode and ID before saving it. It does not infer which resource
belongs to an uncertain create, and never selects the newest candidate for you.
If no candidate exists or the result remains ambiguous, retain the journal and
resolve the operation with your normal project administration/support process.
Do not delete or switch journals, alter request settings, or resend POST to force
a retry. A different API/project/transcription/template/provider is rejected for
an existing journal; key rotation within the same verified project is allowed.

SQLite WAL with `synchronous=FULL` records a single-use idempotency key and an
uncertain creation intent **before** POST. An atomic update prevents two processes
using this journal from both creating. The returned ID is committed before
polling. Only scoped IDs, request settings, key and phase are stored, never API
credentials, transcript text, summary output or provider error bodies. Retain the
database and any WAL files together. Use a local filesystem; this example does
not qualify network filesystems, power loss or external writers.

The public `Idempotency-Key` cache is an additional compatibility guard, not an
exactly-once contract: it has a 24-hour lookup window, does not compare request
bodies and stores responses asynchronously. This CLI therefore does not replay
POST after uncertainty, even with the saved key. A crash after persisting intent
but before sending it can require manual reconciliation too.

## Verify

```sh
npm ci
npm run check
npm test
```

Tests use mocked public responses and temporary SQLite journals. They cover
identity/configuration checks, existing-summary preservation, pagination,
unknown create outcomes, independent SQLite connections, explicit attachment,
read-only restart, cancellation, failed jobs and non-secret persistence.

The compound-engineering review compares this example with repository
Architecture §§2–4 and the public summary/idempotency contracts:

| Requirement | Evidence and status |
| --- | --- |
| Independent public API workflow | Own package/lock, built-ins, fixed public routes; matched in source, install and syntax checks. |
| Current project/transcription and request identity | Preflight, scope-change and explicit-attachment regressions; matched in local tests. |
| No replacement during ordinary resume | Existing-template, known-ID, timeout, failed-job and uncertainty tests; matched for the retained journal. |
| Durable intent and bounded concurrency | SQLite intent committed before POST; competing-connection and restart tests; matched locally, power-loss/network-filesystem behavior unverified. |
| Honest recovery limits | Unknown creation needs explicit inspection/attachment; automatic recovery and exactly-once behavior across external writers are not implemented. |
| Live/provider acceptance | Gemini with `tmpl_general_notes` returned structured output for a synthetic transcript; one POST, followed by same-ID GET-only resume, including a new process. Other providers, live outage recovery and external-writer races remain unverified. |
| Hosted acceptance | Exact-source CI is pending at this checkpoint; no device workflow is involved. |

The live check created one summary for the earlier synthetic API-upload fixture,
with auto-summary already disabled and no existing summaries. Its output contained
`summary`, `overview`, `decisions`, `key_points`, `action_items` and `participants`.
This verifies the workflow and returned object shape, not factual accuracy or
the output of other templates. A separate process reopened the same journal and
issued two GET requests with zero POSTs. Cloud results and the local journal were
retained; no audio, recording or configuration was changed by this test.

References: [Create summary](https://docs.bota.dev/api-reference/ai/summaries/create),
[Get summary](https://docs.bota.dev/api-reference/ai/summaries/get),
[public OpenAPI list contract](https://docs.bota.dev/api-reference/openapi.json),
[idempotency](https://docs.bota.dev/api-reference/idempotency),
[automatic processing](https://docs.bota.dev/guides/auto-processing).
