# Native cloud-library read contract

The Kotlin and Swift clients demonstrate one bounded part of Bota Recordings:
read the library, select a recording, and view an existing completed transcript
and general notes. They use the existing mobile Bearer adapter and shared backend
features. They add no routes, processing writes, SDK wrapper or backend service.

## Scope and authorization

- The customer backend retains the Bota project key and derives project/end-user
  scope from its configured application principal. Client IDs are not grants.
- Live mode uses a separate application Bearer token. These native samples keep
  it only in memory, reject Bota key/grant prefixes, and never log or persist it.
  Their setup accepts 32–256 visible ASCII characters, without whitespace.
- Accept an HTTPS origin without credentials, a path, query or fragment. Exact
  loopback HTTP is development-only; Android uses `adb reverse` rather than
  broad cleartext access to LAN hosts. Each README declares supported loopbacks.
- Requests are explicit GETs to the fixed routes below, with no body, cookies,
  redirects or cache. There is no automatic retry, arbitrary proxy path or direct
  request to storage/Bota from the native client.
- Each response has a 30-second cancellation deadline and a 2 MiB byte limit while reading,
  even if `Content-Length` is absent or misleading. Require JSON and reject an
  unexpected final origin/path, invalid UTF-8, malformed JSON or DTO mismatch.
  Large otherwise-valid results can exceed this deliberate client limit.
  Cancellation does not prove native cleanup: Android can wait for an operating
  system DNS call to return before joining its worker. Swift quarantines the
  native owner if finalization does not finish within five seconds. Neither
  client admits a replacement while cleanup is uncertain.
- Sample mode constructs only local synthetic data and performs no network or
  SDK initialization. It establishes no live API, audio or device result.

For live setup use the [combined host](../README.md#run-an-application) or the
retained [mobile backend](../../react-native-recording-sync/backend/README.md).
The combined demo does not provide mobile Bearer authority. Preserve existing
backend origins, journals, scope and uncertainty; no fresh initialization is
needed merely to add another read-only client.

## Routes and projections

These are customer-backend routes, not public Bota `/v1` endpoint aliases. The
public calls remain in the [canonical recording](../backend/features/recordings.mjs)
and [processing](../backend/features/processing.mjs) modules. Current reference
validators are in the [RN client](../clients/react-native/library-api.ts).

| Explicit read                                         | Successful projection                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /api/library/recordings`                         | `{data: Recording[], has_more: boolean, next_cursor: string \| null}`; at most 20 unique IDs  |
| `GET /api/library/recordings/{rec_id}`                | One `Recording` whose ID exactly matches the selected resource                                |
| `GET /api/library/recordings/{rec_id}/transcriptions` | `{data: Transcription[]}`; at most 200, every row matches the selected recording              |
| `GET /api/library/transcriptions/{txn_id}/summaries`  | `{data: Summary[]}`; at most 200, every row matches both selected recording and transcription |

This initial native slice shows the first recording page. If `has_more` is true,
the UI must state the list is incomplete; it must not imply an exhaustive
library. A true `has_more` requires a nonempty page and nonempty cursor. A final
page has a null cursor. Cursors, when supplied by the backend, are bounded to
1,024 UTF-16 code units with no control characters. These clients do not follow
them automatically or change the existing backend pagination policy.

`rec_`, `txn_` and `sum_` IDs use the corresponding prefix followed by 1–128
ASCII letters, digits, `_` or `-`. String caps below count UTF-16 code units to
match the existing JavaScript adapter; transport limits still count UTF-8 bytes.

| DTO              | Required validation                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recording        | `id`, `name` (null or string ≤255), `status`, valid `created_at`, `duration_seconds` (null or finite nonnegative number), boolean `upload_verified`    |
| Recording status | One of `pending`, `streaming`, `uploaded`, `processing`, `completed`, `failed`, `integrity_failure`                                                    |
| Transcription    | `id`, exact `recording_id`, status in `pending/processing/completed/failed`; optional/null valid `created_at`; completed `full_text` string ≤1,000,000 |
| Summary          | `id`, exact `transcription_id` and `recording_id`, status as above, `template_id` exactly `tmpl_general_notes`; completed `output` validates below     |
| General notes    | `overview` string ≤10,000; `key_points`, `action_items`, `participants`, `decisions` each an array of at most 200 strings, each ≤10,000                |

Pending/failed jobs are not completed content. A client may choose the first
completed item in the returned bounded snapshot, but must not call it the latest
result without an ordering guarantee. Render text as inert native text. Do not
execute HTML, trust filenames/URLs from content, or treat `upload_verified` or
job completion as device-cleanup authority.

## Lifecycle and failures

Selection changes cancel old detail/content reads and fence late results to the
current session and exact source IDs. Clear old content before replacement reads.
Sign-out, background retirement and expired credentials immediately clear visible
content and discard the app-owned token; cancellation and reader cleanup must
finish before replacement admission. Do not equate cancellation notification
alone with completion of an underlying blocking transport reader.

A 401 expires the session. Other failures show controlled messages without raw
server bodies, headers, content or credentials. An explicit refresh is another
GET; no write is replayed and no operation journal is created or adopted.
Unexpected/foreign source data leaves the selected content unavailable.

The apps deliberately omit import/playback, starting processing, Ask, device
connection and transfer in this first cloud slice. Their READMEs link the fuller
RN/Flutter/Web flows and independent native SDK starters. New device acceptance
remains encrypted-upload-v2 only; these cloud reads qualify none of capture
identity, ciphertext integrity, cloud commitment, signed receipt or gated cleanup.
