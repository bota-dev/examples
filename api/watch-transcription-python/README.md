# Watch an existing transcription (Python)

Observe one existing transcription until its public status becomes `completed`
or `failed`, or this watcher reaches its local observation limit. The script
checks the expected recording's end-user ownership before polling and again
before printing selected status metadata. It performs GET requests only: no
job creation, cancellation, configuration changes, audio reads or device calls.

**Status:** implemented; syntax checked on Python 3.12.14 / Windows on October 8,
2026. Polling behavior, failure handling and live API acceptance are unverified.
This creation pass includes no unit, functional, live API or hardware tests.

Requires **Python 3.12 or newer** and only its standard library. No pip install,
App SDK package, shared example code or sibling repository is required.

## Configure and run

Choose an existing transcription and its expected source recording in the
intended project. Use a server-held project API key with both
**`recordings:read`** and **`transcriptions:read`**, and a fixed authorized end
user matching the recording. Keep the key out of browser/mobile applications.

`.env.example` is a documentation template. The script reads `os.environ`
directly and **does not load `.env` files**. From this directory:

```sh
export BOTA_API_BASE_URL='https://api.bota.dev/v1'
export BOTA_API_KEY='YOUR_SERVER_KEY'
export BOTA_END_USER_ID='YOUR_END_USER_ID'
export BOTA_RECORDING_ID='YOUR_RECORDING_ID'
export BOTA_TRANSCRIPTION_ID='YOUR_TRANSCRIPTION_ID'
python3 -m py_compile main.py
python3 main.py
```

PowerShell equivalents:

```powershell
$env:BOTA_API_BASE_URL='https://api.bota.dev/v1'
$env:BOTA_API_KEY='YOUR_SERVER_KEY'
$env:BOTA_END_USER_ID='YOUR_END_USER_ID'
$env:BOTA_RECORDING_ID='YOUR_RECORDING_ID'
$env:BOTA_TRANSCRIPTION_ID='YOUR_TRANSCRIPTION_ID'
python -m py_compile main.py
python main.py
```

Replace placeholders with your own authorized resources. Prefer server secret
injection for deployments because shell history can retain credentials. The
syntax command executes no API request.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required explicit API origin ending in `/v1`; HTTPS except HTTP on `localhost`, `127.0.0.1` or `[::1]` |
| `BOTA_API_KEY` | Required server-held key for the project with both read scopes |
| `BOTA_END_USER_ID` | Required fixed authorized end user |
| `BOTA_RECORDING_ID` | Required expected source `rec_*` ID |
| `BOTA_TRANSCRIPTION_ID` | Required existing `txn_*` ID |

On completion, output resembles this placeholder-only example:

```json
{
  "transcription": {
    "id": "txn_example",
    "recording_id": "rec_example",
    "status": "completed",
    "word_count": 6
  },
  "outcome": "completed",
  "stop_reason": "terminal_status",
  "successful_polls": 1
}
```

Only transcription ID, source recording ID, the documented status and a
nonnegative integer/null word count are retained. Transcript text, segments,
provider error details, recording names, audio URLs, credentials and arbitrary
response fields are omitted. No progress metadata is emitted while polling;
the final ownership check must succeed first. `transcription-status.json` is
ignored if you redirect output there. Apply an appropriate metadata-retention
policy to retained stdout or local files.

## Observation and recovery boundaries

The script calls `GET /v1/recordings/{id}` and requires its exact ID, matching
`end_user_id` and no deletion marker. It then polls only
`GET /v1/transcriptions/{id}`. Every successful read must match both configured
IDs and one of `pending`, `processing`, `completed` or `failed`. Word count is
validated on each read. Unknown status or mismatched identity fails immediately.

After each nonterminal read the script waits **2 seconds**, then makes the next
GET. Request duration adds to that interval. There are at most **20 transcription
GET attempts**, plus an initial and final ownership GET. It never automatically
retries an HTTP error or transport failure. Repeated nonterminal GETs are the
documented observation flow, not job creation or processing retries.

The overall elapsed budget is **60 seconds**, with the last **10 seconds reserved
for the final ownership read**. Polling stops at its earlier elapsed cutoff or
attempt cap. Each connected request has an absolute remaining-deadline socket
shutdown timer covering send, response headers and body, including trickling
bytes. Cleanup cancels and joins the timer and closes the connection. DNS
resolution and initial TCP/TLS establishment use standard-library/OS behavior
with at most a 10-second socket timeout; these phases may overrun the absolute
post-connect deadline. This is not a strict whole-process wall-clock guarantee.

Every response must use `application/json`, uncompressed or identity encoding,
and at most **1 MiB** of UTF-8 JSON. Redirects are not followed. Connections go
directly to the configured API origin without environment proxy routing. These
are example limits, not platform processing-duration or transcript-size quotas.

| Exit | Meaning |
| --- | --- |
| `0` | An identity-checked `completed` response was observed, followed by successful ownership verification |
| `1` | A `failed` job was observed and printed, or configuration/HTTP/identity/malformed-response verification failed with a sanitized stderr message |
| `2` | Local observation ended inconclusively due to elapsed budget, socket timeout or poll cap |

For a cap or polling-deadline stop, JSON has `outcome: inconclusive`, a stop
reason and the last validated status; `transcription` may be null if no read
completed. A timeout before the final owner can be confirmed emits sanitized
stderr and no job metadata. An early connection timeout also stops observation
inconclusively. An inconclusive result does **not** mean the cloud job failed,
stopped, or was cancelled. This watcher makes no cloud changes. Run it again
with the **same IDs** to continue GET-only observation. Never create a second
job merely because this local watcher stopped.

The initial/final recording reads catch observed ownership changes but are not
an atomic authorization snapshot. In a multi-user service, derive scope and IDs
from authenticated caller identity rather than arbitrary request input. A
completed status and word count do not establish transcription accuracy,
timestamp quality, upload integrity, billing outcome or summary completion.
The script neither fetches audio nor validates those separate concerns.

## Evidence and contracts

| Check | October 8, 2026 evidence |
| --- | --- |
| `python -m py_compile main.py` | Passed on Python 3.12.14 / Windows; syntax only |
| Dependency installation | Not needed; standard library only |
| Poll/timeout/authorization/failure execution | Not run |
| Live API / hardware | Not run |
| Hosted workflow | Configured for syntax checking only on Ubuntu 24.04 |

Public contracts:
[get recording](https://docs.bota.dev/api-reference/recordings/get) and
[get transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get).
No private dashboard endpoint or internal application integration is needed.
There are no cloud resources to clean up because this example performs only reads.
