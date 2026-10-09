# Search transcript excerpts with Python

Search one fixed end user's indexed transcripts, verify each returned recording's ownership, and print timestamped excerpts as JSON. Python 3.12+ standard library only: no packages, SDK, sibling runtime or hardware are required. This example retrieves excerpts; it does not generate an Ask answer, upload audio, create processing jobs or change indexing settings.

**Status:** implemented; syntax compilation and source review only. API behavior, deadline enforcement, ownership rejection and failure recovery remain unverified. No functional tests or live requests were run for this creation-only batch.

## Prepare and configure

Use a server-held project secret or restricted API key with `recordings:read` and a fixed authorized `eu_...` end user in that project. An end-user-scoped key must match that owner. Never put the key in browser or mobile code. A `sk_test_*` prefix does not itself isolate resources or suppress provider billing; use a dedicated non-production project with synthetic or consented data.

Recordings need completed transcriptions **and searchable indexed chunks**. Automatic chunking/embedding depends on effective `processing.auto_embedding.enabled` and an allowed embedding-provider route. This CLI does not enqueue indexing, change policy or wait for the index. A completed transcription is not evidence of index readiness. Empty results do not establish completed indexing, absence of recordings or lack of a relevant answer.

**Query egress and cost:** the query reaches Bota and its configured embedding provider under project policy. Search may incur usage even if results are empty, the client times out or a later ownership check rejects output. Confirm provider settings and consent before a live run. Transcript excerpts and redirected output can contain private information.

From this example directory, set environment variables using `.env.example` as a reference. Python does **not** automatically read `.env`; no installation is required.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required trusted API origin ending in `/v1`, normally `https://api.bota.dev/v1`; HTTPS, or HTTP only on explicit loopback. No URL credentials, query or fragment. |
| `BOTA_API_KEY` | Required server-held project secret/restricted key with `recordings:read`. |
| `BOTA_END_USER_ID` | Required fixed authorized owner. |
| `BOTA_QUERY` | Required trimmed query, 1–1000 UTF-16 code units, matching the API's string bound. |
| `BOTA_LIMIT` | Maximum chunks, 1–50; defaults to 8. |
| `BOTA_RECORDING_IDS` | Optional comma-separated allowlist of 1–500 distinct authorized `rec_...` IDs; blank searches the owner's indexed transcripts. |

```sh
# Bash: replace owner/allowlist placeholders with your authorized resources.
export BOTA_API_BASE_URL=https://api.bota.dev/v1
export BOTA_END_USER_ID=eu_REPLACE_ME
export BOTA_QUERY='What was agreed about the budget?'
export BOTA_LIMIT=8
export BOTA_RECORDING_IDS=rec_REPLACE_ME
read -r -s -p 'Bota project API key: ' BOTA_API_KEY
echo
export BOTA_API_KEY
python main.py > results.json
```

```powershell
# PowerShell 7: the API key prompt avoids command-history disclosure.
$env:BOTA_API_BASE_URL = 'https://api.bota.dev/v1'
$env:BOTA_END_USER_ID = 'eu_REPLACE_ME'
$env:BOTA_QUERY = 'What was agreed about the budget?'
$env:BOTA_LIMIT = '8'
$env:BOTA_RECORDING_IDS = 'rec_REPLACE_ME'
$env:BOTA_API_KEY = Read-Host 'Bota project API key' -MaskInput
python main.py > results.json
```

Use your Python executable (`py -3` on Windows if installed). All resource placeholders are rejected until replaced. Remove the key and query from the shell environment when finished; protect the shell session and output file. `.env`, `results.json` and Python bytecode are ignored. Give other output filenames their own ignore rule or keep them outside the checkout.

## Request, scope and output

The CLI sends one `POST /v1/recordings/search` containing only `query`, `end_user_id`, `limit` and the optional `recording_ids`. There are no retries, additional search pages, date filters or answer-generation requests. Results are a top-ranked selection, not a complete transcript export.

Every row is validated before ownership reads: expected `chk_`, `rec_`, `txn_` identifiers, allowlist membership, excerpt text, nullable speaker/date, ordered integer audio offsets and finite relevance score. The CLI then makes one `GET /v1/recordings/{id}` per unique returned recording, requiring its exact ID, configured `end_user_id` and no deletion marker. At most 50 additional reads occur. Only after **every** check succeeds does stdout receive:

```json
{
  "results": []
}
```

Nonempty results contain only `chunk_id`, `recording_id`, `transcription_id`, `chunk_text`, `speaker`, `start_ms`, `end_ms`, `recorded_at` and `score`. JSON escaping preserves excerpt text without terminal control characters. Other API fields, signed audio URLs, storage metadata, the query, credentials and raw HTTP/error details are not printed. Use the offsets with an authorized player; this sample retrieves no audio.

Project scope comes from API authorization; the fixed owner and allowlist narrow this teaching CLI. In a multi-user application, derive permitted identities from authenticated caller context. Separate ownership reads are not an atomic snapshot across changing recordings/indexes, and returned IDs are not a substitute for application authorization.

## Bounds and failures

One **30-second budget** spans the search, ownership reads, response bodies and the final pre-output check. After connection establishment, socket shutdown interrupts trickling HTTP headers/bodies at the remaining deadline. Connection timeouts also use the remaining budget, but blocking OS DNS resolution and sequential TCP/TLS establishment can delay failure beyond it. The standard-library connection setup does not provide strict wall-clock cancellation. No new API operation or output starts after an expired budget is observed.

Each JSON response is limited to **1 MiB** and must be uncompressed JSON with HTTP 200. Redirect responses are rejected without following their destination; credentials stay on the configured origin. Excerpt text is limited to 32,768 characters, speaker labels to 128 and timestamps to safe, nonnegative integer millisecond offsets. These are local teaching bounds, not API quotas. Oversized or malformed responses fail; excerpts are not truncated. Duplicate JSON keys, invalid UTF-8 and non-finite JSON constants are rejected.

Exit status is 0 for a validated response, including empty results, or 1 on failure. Failures print controlled descriptions and HTTP status codes only. An unsuccessful search may already have incurred provider usage; it is never automatically replayed. No excerpts are emitted when a result or ownership check fails. Decide deliberately whether another search is appropriate after investigating the failure.

The script creates no cloud resources and changes no device state. Cleanup is local: retain/delete output according to your content policy. There is no automatic output deletion or cloud cleanup.

## Evidence and review

```sh
python -m py_compile main.py
```

| Requirement | Evidence on October 8, 2026 |
| --- | --- |
| Independent Python setup | Standard-library imports and own configuration/docs; syntax compiled on Python 3.12.14. |
| Public retrieval contract | Search/get docs reviewed; one scoped POST and projected result fields implemented. |
| Fixed owner and optional allowlist | All-row validation, unique recording ownership reads before output present in source; behavioral enforcement unverified. |
| Bounded failures and no automatic replay | Shared deadline, socket shutdown, byte/text limits, no redirect/retry and controlled errors present in source; runtime checks unverified. |
| Live indexing/retrieval/provider behavior | Not run. Empty/nonempty results and playback alignment unverified. |
| Functional tests | Not added or run, following the owner's creation-only instruction. |
| Hosted workflow | Configured for Python version and syntax checks only; local compilation is not hosted evidence. |

Public contracts: [Search Recordings](https://docs.bota.dev/api-reference/recordings/search), [Get Recording](https://docs.bota.dev/api-reference/recordings/get) and [test-prefix limitations](https://docs.bota.dev/api-reference/test-mode). No private Bota helper or internal-app source is required to run the example.
