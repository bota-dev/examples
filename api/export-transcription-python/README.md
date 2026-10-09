# Export completed transcription text (Python)

Export an existing completed transcription's `full_text` as a local UTF-8
plain-text `.txt` file after checking its exact recording and configured
end-user ownership. This example performs three public GETs and one local
export. It starts no processing, downloads no audio, converts no segments,
changes no cloud resource and performs no device operation.

**Status:** implemented; syntax checked on Python 3.12 / Windows on October 8,
2026. Runtime authorization, exact text preservation, failure handling, file
publication and live API acceptance remain unverified. The owner requested
creation without unit, functional, live or hardware testing.

Requires **Python 3.12 or newer**, using only the standard library. No pip install,
SDK package, sibling example or private application module is needed.

## Configure and run

Select an existing completed transcription and its source recording in the
intended project. Use a server-held project key with **`recordings:read`** and
**`transcriptions:read`**. Configure the fixed authorized end user and exact
expected project, recording and transcription IDs. Keep the key in your server
or CLI environment; never distribute it to a browser or mobile application.

`.env.example` is a placeholder-only documentation template. The script reads
process environment variables and **does not automatically load `.env` files**.
From this directory:

```sh
mkdir -m 700 exports
export BOTA_API_BASE_URL='https://api.bota.dev/v1'
export BOTA_API_KEY='YOUR_SERVER_KEY'
export BOTA_PROJECT_ID='YOUR_PROJECT_ID'
export BOTA_END_USER_ID='YOUR_END_USER_ID'
export BOTA_RECORDING_ID='YOUR_RECORDING_ID'
export BOTA_TRANSCRIPTION_ID='YOUR_TRANSCRIPTION_ID'
export OUTPUT_PATH='exports/transcription.txt'
python3 -m py_compile main.py
python3 main.py
```

On PowerShell:

```powershell
New-Item -ItemType Directory exports
# Verify that the directory's Windows ACL is private before exporting sensitive data.
$env:BOTA_API_BASE_URL='https://api.bota.dev/v1'
$env:BOTA_API_KEY='YOUR_SERVER_KEY'
$env:BOTA_PROJECT_ID='YOUR_PROJECT_ID'
$env:BOTA_END_USER_ID='YOUR_END_USER_ID'
$env:BOTA_RECORDING_ID='YOUR_RECORDING_ID'
$env:BOTA_TRANSCRIPTION_ID='YOUR_TRANSCRIPTION_ID'
$env:OUTPUT_PATH='exports/transcription.txt'
python -m py_compile main.py
python main.py
```

Replace placeholders with your own authorized resources. Prefer server secret
injection over putting keys in shell history. Syntax checking makes no API
request. This directory ignores `.env`, `.txt`, partial files and `exports/`;
if exporting elsewhere, ensure that location is excluded from source control.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required explicit API origin ending in `/v1`; HTTPS except HTTP on `localhost`, `127.0.0.1` or `[::1]` |
| `BOTA_API_KEY` | Required server-held project key with both read scopes |
| `BOTA_PROJECT_ID` | Required expected project; checked against returned `project_id` fields when present |
| `BOTA_END_USER_ID` | Required fixed authorized owner of the source recording |
| `BOTA_RECORDING_ID` | Required expected source `rec_*` ID |
| `BOTA_TRANSCRIPTION_ID` | Required existing completed `txn_*` ID |
| `OUTPUT_PATH` | Required new `.txt` destination in an existing private directory |

Success prints the fixed message `Exported completed transcription text to
OUTPUT_PATH.` without printing the actual path, IDs or transcript. The file
contains only the decoded API `full_text`, encoded as UTF-8. There is no metadata
envelope, added BOM, added final newline, whitespace normalization, escaping or
segment reconstruction. This preserves text, not the original JSON wire bytes.

An empty string is valid and creates a zero-byte file. Missing, null or nonstring
`full_text` is rejected even when the job is completed; the exporter does not
infer text from `segments`, `word_count` or timestamps. Empty output does not
establish that the audio contained no speech or that ASR was accurate.

## Scope and input boundaries

The order is `GET /v1/recordings/{id}` → `GET /v1/transcriptions/{id}` →
`GET /v1/recordings/{id}`. Both recording reads require the configured exact
recording ID, fixed `end_user_id`, no non-null `deleted_at` when returned, and
no `status: deleted`. The transcription must have its exact configured ID,
exact `recording_id`, `status: completed` and string-valued `full_text`.

If either response includes `project_id`, it must equal the configured project;
a present null or mismatched value is rejected. The public recording and
transcription GET schemas do not require that field, so its absence is accepted
and project isolation relies on the project-scoped API key. Configuring
`BOTA_PROJECT_ID` does not independently prove project ownership when the API
omits it. The optional deletion marker is an additional defensive check, not
a new required field in the public response contract.

The final recording read catches an observed owner/deletion/project change
before publication. These separate GETs do not form an atomic snapshot and
cannot prevent a later ownership change. In a multi-user service, derive allowed
IDs, project and owner from authenticated caller context; arbitrary client IDs
or environment labels are not authorization. There is no polling, redirect
following or automatic request retry.

Every response must declare `application/json`, use identity/uncompressed
encoding, and contain at most **1 MiB** of strict UTF-8 JSON. Duplicate object
keys, invalid UTF-8, `NaN`/`Infinity`, floating-point overflow to nonfinite values
and unpaired Unicode surrogates in any parsed string/key are rejected. Python's
ordinary integer/float parsing limits apply. Exported UTF-8 text is also bounded
to **1 MiB**. These limits belong to the teaching example, not the API service.

Three GETs share a **30-second elapsed budget**. After each connection is
established, an absolute remaining-deadline timer shuts down its socket during
request send, response headers or body reads, including trickling responses.
Cleanup cancels and joins the timer and closes the connection. Standard-library
and OS DNS resolution may outlast the budget; initial TCP/TLS establishment uses
a socket timeout of at most 10 seconds but is not protected by the postconnect
absolute timer. Local filesystem operations are not interruptible, and the
budget is checked before publication. This is not a strict whole-process
wall-clock guarantee. Credentials are sent only to the configured origin;
environment proxy routing is not used.

## Private local publication and recovery

The output directory must already exist and must not itself be a symlink. On
POSIX it must have no group/other permission bits, for example `0700`. Use
trusted ancestors and a trusted private directory; this sample does not defend
against a local attacker replacing directory paths during export. Windows
privacy depends on the directory's ACL, which the script cannot establish with
POSIX mode bits. Verify the Windows owner/access rules before use. File mode
`0600` applies where supported and does not replace Windows ACL configuration.

No output file is opened until the full response chain is validated and the
second owner check passes. The script exclusively creates a random `.partial`
file beside the destination, writes the complete bytes in binary mode, flushes
them, calls `fsync`, and publishes through same-directory `os.link`. The
filesystem must support hard links. Publication refuses an existing destination,
including a dangling symlink or one created by a competing process; no existing
path is replaced.

Cleanup removes only the partial file this invocation successfully created.
Failure before link publication leaves no destination. Cleanup failure after
publication can report failure with a complete destination already present.
A process crash can leave a private partial file; inspect the directory before
retrying. File `fsync` does not sync directory entries or guarantee publication
survives power loss. Never remove an existing destination blindly to repeat an
export; select a new filename after reconciling the previous outcome.

Transcript text may contain sensitive or untrusted content. The exporter does
not echo it to the terminal and does not sanitize it: preserved control
characters, escape sequences, bidirectional text and markup may affect an OS
viewer, terminal or future renderer. A `.txt` extension is not a guarantee that
every application will display it safely. Use an appropriate text viewer;
escape or sanitize separately at the eventual rendering boundary. Do not
execute exported text or treat it as trusted instructions or verified facts.

Exit is 0 after publication and partial cleanup, or 1 with a sanitized stderr
message. No API credential, signed URL, raw response, transcript or raw exception
trace is logged. There is no cloud cleanup because only GETs occur. Remove local
exports according to your authorized retention policy.

## Evidence and design review

Source/design review used the repository's `AGENTS.md` and `ARCHITECTURE.md`,
the public recording/transcription GET contracts, and the independent Python
summary and Node subtitle exporters as integration references. Helpers are
local to this example; those references are not runtime dependencies. The
compound-engineering review distinguishes source conformance from execution.

| Requirement | Implementation evidence | October 8, 2026 status / remaining check |
| --- | --- | --- |
| Independent Python 3.12 standard-library example | Local `main.py`, configuration/ignore files and standalone workflow; no external imports | Matched by source review; no install required |
| Existing completed full-text export only | Exact transcription ID/source/status checks and binary UTF-8 encoding of `full_text`; no POST, audio or segments path | Matched by source review; success/null/empty execution unverified |
| Fixed owner/project and exact recording chain | Initial/final recording checks plus optional returned project checks | Matched by source review; rejection/race behavior unverified; no atomic snapshot claim |
| Strict bounded input and controlled failures | Bounded JSON reads, duplicate/nonfinite/surrogate rejection, fixed sanitized errors and absolute postconnect timer | Matched by source review; malformed/trickle/DNS behavior unverified |
| Private no-overwrite publication | Directory checks, exclusive partial creation, binary write/flush/fsync, hard link and own-partial cleanup | Matched by source review; filesystem/crash/ACL behavior unverified |
| Exact text and honest renderer boundary | No transformation or console transcript output; rendering caveats above | Matched by source review; downstream viewer safety unverified |
| Owner's creation-without-testing instruction | Only `python -m py_compile main.py` performed | Intentionally diverged from runtime acceptance gates; unit/functional/live/device checks not run |
| Hosted syntax-only workflow | Ubuntu 24.04, pinned checkout and `python3 -m py_compile main.py` | Configured; hosted execution not run |

The syntax check passed using the bundled Python 3.12 runtime on Windows. It
proves parsing only. No runtime authorization, text round-trip, failure-path,
filesystem, live API, hardware or viewer test was run. Broader catalog and
public guidance are maintained by the owning repository documentation review;
this example does not claim those acceptance gates are complete.

Public contracts:
[get recording](https://docs.bota.dev/api-reference/recordings/get) and
[get transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get).
Use this read/export boundary inside your authenticated service with an
appropriate content-retention policy before deploying it for multiple users.
