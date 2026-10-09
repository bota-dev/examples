# Export completed summary JSON (Python)

Export an existing completed summary's structured `output` object as a local
JSON document with selected source identity metadata. The script checks the
recording's end-user ownership and the complete recording → transcription →
summary ID chain. It makes only public GET requests and creates no processing
jobs, replaces no summary, fetches no audio, and performs no device operation.

**Status:** implemented; syntax checked on Python 3.12.14 / Windows on October 8,
2026. Runtime authorization, file publication and live API acceptance remain
unverified. This creation pass includes no unit, functional, live or hardware tests.

Requires **Python 3.12 or newer** with only its standard library. No pip install,
SDK package, shared runtime or sibling checkout is required.

## Configure and run

Choose an existing completed summary and its completed source transcription in
the intended project. Use a server-side key with **`recordings:read`**,
**`transcriptions:read`** and **`summaries:read`**. Configure the exact expected
project, fixed authorized end user and all three resource IDs. Never distribute
the key in a browser or mobile application.

The script reads process environment variables; `.env.example` is a documentation
template and **is not automatically loaded**. From this directory:

```sh
mkdir -m 700 exports
export BOTA_API_BASE_URL='https://api.bota.dev/v1'
export BOTA_API_KEY='YOUR_SERVER_KEY'
export BOTA_PROJECT_ID='YOUR_PROJECT_ID'
export BOTA_END_USER_ID='YOUR_END_USER_ID'
export BOTA_RECORDING_ID='YOUR_RECORDING_ID'
export BOTA_TRANSCRIPTION_ID='YOUR_TRANSCRIPTION_ID'
export BOTA_SUMMARY_ID='YOUR_SUMMARY_ID'
export OUTPUT_PATH='exports/summary.json'
python3 -m py_compile main.py
python3 main.py
```

On PowerShell:

```powershell
New-Item -ItemType Directory exports
# Ensure the directory's Windows ACL is private before exporting sensitive data.
$env:BOTA_API_BASE_URL='https://api.bota.dev/v1'
$env:BOTA_API_KEY='YOUR_SERVER_KEY'
$env:BOTA_PROJECT_ID='YOUR_PROJECT_ID'
$env:BOTA_END_USER_ID='YOUR_END_USER_ID'
$env:BOTA_RECORDING_ID='YOUR_RECORDING_ID'
$env:BOTA_TRANSCRIPTION_ID='YOUR_TRANSCRIPTION_ID'
$env:BOTA_SUMMARY_ID='YOUR_SUMMARY_ID'
$env:OUTPUT_PATH='exports/summary.json'
python -m py_compile main.py
python main.py
```

Replace placeholders with your own authorized resources. Prefer server secret
injection over putting credentials in shell history. Syntax checking makes no
API request. `exports/`, `.env` and partial files are ignored by Git; configure
an appropriate ignore rule if you choose a different output location.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required explicit API origin ending in `/v1`; HTTPS except HTTP on `localhost`, `127.0.0.1` or `[::1]` |
| `BOTA_API_KEY` | Required server-held project key with all three read scopes |
| `BOTA_PROJECT_ID` | Required expected project, matching the summary's documented `project_id` |
| `BOTA_END_USER_ID` | Required fixed authorized recording owner |
| `BOTA_RECORDING_ID` | Required expected source `rec_*` ID |
| `BOTA_TRANSCRIPTION_ID` | Required existing completed `txn_*` ID |
| `BOTA_SUMMARY_ID` | Required existing completed `sum_*` ID |
| `OUTPUT_PATH` | Required new destination in an existing private directory |

Success prints `Exported completed summary JSON to OUTPUT_PATH.` and writes:

```json
{
  "summary_id": "sum_example",
  "project_id": "proj_example",
  "transcription_id": "txn_example",
  "recording_id": "rec_example",
  "status": "completed",
  "output": {
    "summary": "Example structured content"
  }
}
```

The output envelope has exactly those six fields. It excludes provider metadata,
custom prompt, upstream error messages, API response timestamps and arbitrary
top-level response fields. The nested `output` object is retained according to
the public generic object contract; no template-specific schema or Markdown
renderer is invented. Empty objects are accepted. Treat model-produced values
as untrusted sensitive data, not executable instructions, trusted facts or safe
HTML. The exporter does not assess their truth, sanitize a future renderer,
or establish clinical/legal accuracy.

## Scope, integrity and JSON boundaries

The script reads the recording first and checks its exact ID, fixed
`end_user_id`, no deletion marker, and expected `project_id` when that optional
field is present. The transcription must match its exact configured ID and
source recording, have `status: completed`, and match the project when returned.
The summary must match its exact ID, exact source transcription, documented
`project_id` and completed status, with an object-valued `output`. Summary project
identity is mandatory, not inferred from an omitted field.

After validating the full chain, the recording owner is read again before file
publication. There are **four GETs** and no polling or automatic retries. The
initial/final checks catch observed ownership changes but are not an atomic
snapshot. Project scope also relies on the API key. In a multi-user service,
derive allowed resource IDs and owner from authenticated caller identity.

All API responses must declare `application/json`, use identity/uncompressed
encoding and contain at most **1 MiB** of strict UTF-8 JSON. Duplicate object
keys, invalid UTF-8, nonstandard `NaN`/`Infinity` constants and floating-point
overflow to nonfinite values are rejected. Export serialization also rejects
nonfinite values and unpaired Unicode surrogates. Numbers use ordinary Python
integer/float semantics; this is not a byte-preserving or arbitrary-precision
archive. The serialized file is limited to **2 MiB**. These are example bounds,
not API service quotas or guarantees about model output shape.

Four GETs share a **30-second elapsed budget**. After connection establishment,
an absolute remaining-deadline timer shuts down the socket during request send,
response headers or body, including trickling responses. Cleanup cancels and
joins the timer and closes the connection. Standard-library/OS DNS resolution
and initial TCP/TLS establishment use at most a 10-second socket timeout and may
overrun that absolute post-connect deadline. Local filesystem operations are
not interruptible; the budget is checked before publication. This is not a
strict whole-process wall-clock guarantee. Redirects are not followed, API
credentials are sent only to the configured origin, and environment proxy
routing is not used.

## File publication and failure behavior

The output directory must already exist and must not itself be a symlink. On
POSIX, the script requires no group/other permission bits (for example mode
`0700`). Use a trusted private directory and trusted ancestors; this sample
does not defend against a local attacker replacing directory paths mid-export.
On Windows, Python's POSIX mode bits do **not** establish a private ACL: verify
the directory's owner/access rules before use. File permission mode `0600`
applies where supported and does not replace Windows ACL configuration.

No local output is opened until the complete response chain is validated and
the final owner check passes. The script exclusively creates a random partial
file in that directory using mode `0600`, writes complete JSON, flushes it,
calls `fsync`, then publishes via same-directory `os.link`. Hard-link creation
refuses an existing destination, including a dangling symlink. The filesystem
must support hard links. A race that creates the destination causes failure;
the existing path is not replaced.

Cleanup removes only a partial file this invocation successfully created.
Failures before link publication leave no destination; cleanup failure after
publication may report failure with a complete destination already present.
A process crash may leave a private partial file. File `fsync` is not directory
entry `fsync` and does not guarantee publication survives a power loss. Inspect
the private directory after a failed/crashed invocation, and never remove an
existing destination blindly to retry. Choose a new filename for another export.

Exit is 0 after publication and cleanup, or 1 with a sanitized stderr message.
No credential, signed URL, raw upstream body, prompt, summary content or exception
trace is logged. There is no cloud cleanup because no cloud writes occur. Remove
local exports according to your authorized content-retention policy.

## Evidence and public contracts

| Check | October 8, 2026 evidence |
| --- | --- |
| `python -m py_compile main.py` | Passed on Python 3.12.14 / Windows; syntax only |
| Dependency installation | Not needed; standard library only |
| Authorization / JSON / no-overwrite / failure execution | Not run |
| Live API / hardware | Not run |
| Hosted workflow | Configured for syntax checking only on Ubuntu 24.04 |

Public contracts:
[get recording](https://docs.bota.dev/api-reference/recordings/get),
[get transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get),
and [get summary](https://docs.bota.dev/api-reference/ai/summaries/get).
No internal application module, private dashboard API or local SDK override is
required. This JSON export complements the separate general-notes Markdown
example without sharing runtime code.
