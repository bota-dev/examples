# Upload and transcribe with Node.js

Upload a local audio file to Bota, wait for server-side integrity verification, request a transcription, and retrieve its text. This is a server/CLI example using public HTTP APIs and Node built-ins, with no SDK or third-party dependencies.

**Status:** implemented, locally tested, and verified against the live Bota API with a test key and synthetic speech. Local HTTP tests use simulated API responses; the live run used real storage, integrity verification, and Deepgram transcription. No physical device is needed.

## Prerequisites

- Node **22.23.2 or newer** and npm. Local verification used Node 22.23.2.
- A disposable Bota project and an existing test end user in that project.
- A project-scoped server API key with `recordings:write`, `transcriptions:write`, and `transcriptions:read` access. Keep it on your development machine/server. A device token is not a substitute for the transcription credential.
- A configured, permitted transcription provider for that project. The example uses the project's default; it does not select or fall back to a different provider.
- Effective `processing.auto_transcription.enabled: false` for the selected test end user. This example explicitly starts a transcription; automatic processing could create an additional job. Disable other automatic processing for a minimal test. See [automatic processing configuration](https://docs.bota.dev/guides/auto-processing). The script does not modify or verify that configuration for you.
- A short synthetic or consented speech recording in WAV, MP3, M4A, OGG, Opus, FLAC, WebM, or AAC format. Use the extension matching the actual encoding. This example buffers at most **25 MiB** in memory; that is an example limit, not a Bota service limit.

Live runs create cloud resources and may incur storage and transcription charges. They leave the original local audio untouched.

## Setup

Copy this entire directory anywhere, or enter it from the repository root:

```sh
cd api/upload-and-transcribe-node
npm ci
```

Copy `.env.example` to `.env` and replace the placeholders. No root workspace install is required. Do not commit `.env` or audio/transcript files.

| Variable | Value and purpose |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit API URL ending in `/v1`; the template's `https://api.bota.dev/v1` is production. Select the intended environment before running. HTTPS is required except for loopback testing. |
| `BOTA_API_KEY` | Secret or appropriately scoped restricted key for that project; used only on Bota API requests, never on the storage PUT |
| `BOTA_END_USER_ID` | Existing `eu_...` test end user in the same project |

Node loads `.env` at startup; already-set shell environment variables take precedence. To use an existing configuration file outside this directory, run `node --env-file=<path> index.mjs <audio-file>` instead. There is no live credential discovery or built-in key.

## Run

```sh
npm run --silent start -- ./sample.wav
```

Progress goes to stderr:

```text
Recording created: rec_...
Audio stored; waiting for server integrity verification.
Upload confirmed. Starting transcription.
Transcription created: txn_...
```

On success, stdout contains only the result JSON:

```json
{
  "recording_id": "rec_...",
  "transcription_id": "txn_...",
  "text": "The recognized speech appears here."
}
```

To save it, use `npm run --silent start -- ./sample.wav > transcript.json`. That file contains transcript content: handle it as private application data. The example ignores the default output filename in Git. Progress and error messages do not include credentials, signed URLs, response bodies, or transcript text. The final stdout result intentionally contains the transcript.

The process exits nonzero on validation, HTTP, upload, verification, transcription, or timeout failure. `npm start -- --help` prints usage without contacting Bota.

## How it works

1. Validate configuration and file; compute the SHA-256 of the exact bytes to upload.
2. [Create a recording](https://docs.bota.dev/api-reference/recordings/create) with `source: api_upload` and `upload_method: import`. No device identity is fabricated.
3. [Request an upload URL](https://docs.bota.dev/api-reference/uploads/create-url), then PUT the audio directly to storage using the returned content type. The Bota API key is not forwarded to storage, and redirects are rejected.
4. [Complete the upload](https://docs.bota.dev/api-reference/uploads/complete) with SHA-256. The server determines the stored object's byte count; the optional completion size field is omitted. Retry identical completion requests only on `425`, with delays of 2, 4, 8, then 10 seconds. Wait for HTTP `200` and matching recording/hash verification evidence.
5. [Create a transcription](https://docs.bota.dev/api-reference/ai/transcriptions/create) once, after upload confirmation.
6. [Poll that transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get) until completed or failed, using the same bounded backoff. Return the text only for the expected recording/transcription IDs.

API requests have a 30-second timeout; storage PUT has a two-minute timeout. Upload-verification and transcription polling each have a five-minute deadline. These bounds stop this process, not the remote cloud operation. The source file is never deleted.

## Failure and recovery

This intentionally small example has no automatic restart/resume journal. **A new invocation creates a new recording.** Save the printed IDs before troubleshooting, and inspect existing resources before rerunning.

| Outcome | What to do |
| --- | --- |
| Invalid configuration or file | Correct it; no API requests have been made |
| `401` / `403` | Check the key, scopes, project, and end-user configuration |
| Failed/expired storage PUT | Inspect the printed recording; if continuing it manually, request a fresh upload URL and upload the full original file |
| Completion `425` | The script retries the identical request until its deadline; do not start another upload while verification is pending |
| Completion conflict/integrity failure | Inspect recording state. A hash mismatch needs a fresh upload URL and full re-upload; do not bypass the hash check |
| `429` / `5xx` / lost response / request timeout | The script stops without blind retries. A POST may have taken effect; reconcile with the API or Portal before retrying |
| Transcription fails | Inspect the printed `txn_...` through the API for provider/error details; no replacement job is created automatically |
| Transcription polling deadline | Continue GET requests for that same `txn_...`; the job may still be running |

If upload-complete's response was lost, its documented recovery is to retry the exact hash request for the same recording. Creation requests have different semantics; do not infer that a timeout means nothing was created. When recording creation itself has an unknown outcome, reconcile by the generated `API upload example <timestamp>` name in that project. See [idempotency limitations](https://docs.bota.dev/api-reference/idempotency).

The initial live check found that sending the optional numeric `file_size_bytes` on completion could produce `409` on an exact replay: the deployed API returned its stored size as a string. This example supplies size on upload-URL creation and uses hash-only completion, both supported by the public schema. Server-side SHA-256 verification remains mandatory here; this does not fix the platform's optional-size replay discrepancy.

For customer applications, add durable operation tracking and reconciliation for your workflow. This example does not implement authentication for app users, device pairing/sync, encrypted device-upload v2, streaming, summaries, or webhooks.

## Cleanup

After inspecting the result, explicitly delete only this run's recording through the Portal or [DELETE /recordings/{id}](https://docs.bota.dev/api-reference/recordings/delete), using its printed ID and the same project. Associated database rows are deleted and storage cleanup is scheduled asynchronously. The example deliberately performs no automatic cloud deletion, including after failure. Remove any saved local transcript when no longer needed.

## Verification

```sh
npm ci
npm run check
npm test
```

Tests cover upload bytes and credential isolation, ordered hash confirmation and `425` replay, bounded polling, HTTP errors, ambiguous transcription creation, and terminal failure. A CLI test copies the executable into a temporary directory and uses a real loopback HTTP server and `.env`; it does not contact Bota. Test audio is generated synthetic silence, not speech-recognition evidence.

| Check | Evidence / status (2026-09-28) |
| --- | --- |
| Standalone frozen install and syntax | Passed on Windows, Node 22.23.2; no external packages or sibling dependencies |
| Local workflow/CLI tests | 15 passed, including real local HTTP transport with simulated API responses |
| Public request/response contract | Reviewed against Bota's public OpenAPI source and upload/transcription docs; no SDK package is used |
| Hosted CI | Workflow added for changes to this directory or its workflow; not run yet |
| Live Bota upload, integrity verification, and ASR | Passed 2026-09-29 UTC: test key, dedicated end user, 333,326-byte synthetic WAV; matching SHA-256 verified at 05:00:13 UTC; one completed Deepgram job |

Design review: standalone setup, secret isolation, upload-before-transcription ordering, bounded failure handling, and source preservation match the example architecture in local checks. The live run additionally verified storage upload, hash-only completion, and transcript retrieval with one completed job. The transcript recognized the synthetic sentence, rendering the brand name "Bota" as "Boda"; this is workflow evidence, not an ASR accuracy benchmark. Live outage/restart recovery and other audio formats/providers were not tested. The optional-size replay discrepancy above remains a platform follow-up.
