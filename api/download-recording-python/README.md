# Download original recording bytes (Python)

Download one configured recording's original stored object to a new private
local binary file. The script checks its fixed end-user owner before requesting
the URL and again after download, before publishing the file. It uses only
public GET requests and Python **3.12 or newer**, with no pip packages, SDK,
shared runtime module or sibling checkout dependency.

**Status — 2026-10-08:** implemented and syntax checked with Python 3.12.14 on
Windows. Source review is recorded below. No unit, functional, live API, device
or CLI execution tests were run in this creation pass. Runtime authorization,
download and filesystem behavior remain unverified; CI checks syntax only.

## Configure and run

Use a server-held project secret/restricted API key with **`recordings:read`**.
Select a synthetic or consented recording assigned to the exact configured
end user. API credentials belong in server secret injection, never mobile or
browser configuration. In a multi-user service, derive these allowed IDs from
authenticated caller identity; IDs supplied by an untrusted caller are not
authorization.

`.env.example` is a configuration template; **the script does not load `.env`**.
Set process environment variables independently of the root workspace:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required independently trusted HTTPS API origin ending in `/v1`, with no query or URL credentials |
| `BOTA_API_KEY` | Required server-held project key with `recordings:read` |
| `BOTA_PROJECT_ID` | Required exact expected `proj_*` project; the key determines API authorization |
| `BOTA_END_USER_ID` | Required fixed authorized `eu_*` owner |
| `BOTA_RECORDING_ID` | Required selected `rec_*` recording |
| `BOTA_STORAGE_HOST_ALLOWLIST` | Required comma-separated exact storage DNS hostnames, configured independently by a trusted operator; up to 16 entries |
| `OUTPUT_PATH` | Required new local filename in an existing trusted private directory |
| `EXPECTED_SHA256` | Optional independently known hash of the original stored bytes; blank means no trusted hash verification |

Obtain storage hostnames from your trusted deployment/operator configuration.
Do not populate the allowlist by parsing the returned signed URL, guessing a
bucket name, or accepting arbitrary upstream hostnames. Entries have no scheme,
path, wildcard or port. Storage URLs must use HTTPS on port **443**; host matching
is exact and case insensitive. The API origin may use an explicitly configured
valid HTTPS port. The sample requires DNS hostnames and has no HTTP bypass.

Example shell setup (replace every placeholder before use):

```sh
mkdir -m 700 downloads
export BOTA_API_BASE_URL='https://api.bota.dev/v1'
export BOTA_API_KEY='YOUR_SERVER_KEY'
export BOTA_PROJECT_ID='YOUR_PROJECT_ID'
export BOTA_END_USER_ID='YOUR_END_USER_ID'
export BOTA_RECORDING_ID='YOUR_RECORDING_ID'
export BOTA_STORAGE_HOST_ALLOWLIST='YOUR_TRUSTED_STORAGE_HOST'
export OUTPUT_PATH='downloads/recording.bin'
export EXPECTED_SHA256=''
python3 -m py_compile main.py
python3 main.py
```

On PowerShell:

```powershell
New-Item -ItemType Directory downloads
# Set a private Windows directory ACL before writing sensitive content.
$env:BOTA_API_BASE_URL='https://api.bota.dev/v1'
$env:BOTA_API_KEY='YOUR_SERVER_KEY'
$env:BOTA_PROJECT_ID='YOUR_PROJECT_ID'
$env:BOTA_END_USER_ID='YOUR_END_USER_ID'
$env:BOTA_RECORDING_ID='YOUR_RECORDING_ID'
$env:BOTA_STORAGE_HOST_ALLOWLIST='YOUR_TRUSTED_STORAGE_HOST'
$env:OUTPUT_PATH='downloads/recording.bin'
$env:EXPECTED_SHA256=''
python -m py_compile main.py
python main.py
```

Prefer secret injection over placing keys in shell history. Syntax compilation
makes no network request. The script takes no arguments and prints only
`Downloaded original stored bytes to OUTPUT_PATH.` after publication and partial
cleanup. Failure exits 1 with a fixed sanitized message. It prints no recording
content, filename, actual digest, signed URL, credentials, upstream error body
or exception trace. The file contains binary stored bytes, without a JSON envelope.

## Public workflow and bounds

The requests are `GET /v1/recordings/{id}`, then
`GET /v1/recordings/{id}/download-url`, one storage GET, and a final recording
GET. The download-URL request supplies **no `format` or `use_enhanced`**. The
recording's `audio_url`, remote filename and `Content-Disposition` are ignored;
only the operator's `OUTPUT_PATH` selects the destination. Each request uses
a fresh HTTPS connection. Only the three configured API GETs carry the bearer
key. The separate storage connection sends no authorization, cookies or
referrer, and does not use environment proxies. Neither client follows redirects.

Both recording reads must match exact recording/end-user IDs, an absent/null
deletion marker and status `uploaded`, `processing` or `completed`. If
`project_id` is present it must match; the public Get Recording page does not
promise that field, so its absence relies on project scope enforced by the key.
These reads catch observed ownership changes and are **not an atomic snapshot**.
The raw service rejects pending/streaming; this sample conservatively excludes
all other states outside its three-state allowlist, including integrity failure.
An allowed status does not establish server hash verification or authorize
device cleanup.

API bodies are limited to **256 KiB** and must be uncompressed `application/json`
with strict UTF-8. Duplicate keys, nonstandard/nonfinite numbers and unpaired
Unicode surrogates are rejected. All four download descriptor fields must be
present according to the public OpenAPI schema. `expires_in` must be a positive
integer no greater than one day; the inspected service returns 3600. Nullable
`content_type` is checked as bounded text, and non-null byte metadata must
be nonnegative integers or canonical bounded decimal strings. The latter
accommodates backend database bigint serialization despite the public integer
schema. Booleans, fractions and malformed strings are rejected. Only identity
HTTP encoding and whole `200` responses are accepted; duplicate framing headers,
partial responses and ambiguous content-length/chunked framing are rejected.

The file is capped at **25 MiB**; this is an example limit, not an API quota.
Non-null recording/descriptor sizes and any storage content length must match
the complete, nonempty streamed bytes. Optional trusted SHA-256 must match
before publication; no actual digest is emitted. The endpoint supplies no
checksum, and the script does not interpret `content_sha256` as the object hash.

The workflow has a **120-second elapsed budget**, with a **10-second budget per
API GET** and at most 10 seconds per socket operation. After connect, a deadline
timer shuts down the socket during send, headers or body, including trickling
responses. DNS and initial TCP/TLS establishment are standard-library/OS
operations and can exceed the absolute budget; local filesystem operations are
not interruptible. Deadline checks precede publication. This is not a strict
whole-process wall-clock guarantee.

“Original” means the object referenced by the recording's storage key. The raw
path does no conversion, enhancement or decryption and may return an encrypted
container. MIME metadata does not establish a playable audio codec. Keep a
`.bin` extension until your own authorized application knows the actual format.
URL issuance performs no object-existence check and proves neither successful
download nor upload commitment. A download is never permission to delete the
device source.

## Private publication and recovery

The parent directory must already exist and must itself be a regular directory,
without a symlink. On POSIX it must have no group/other permission bits (for
example `0700`). Trust its ancestors and prevent local actors from replacing
directory paths during execution. This example does not defend against hostile
directory replacement. On Windows, POSIX mode bits do **not** create a private
ACL; verify access rules and ownership before use.

The script exclusively creates a random same-directory `.partial` regular file
with mode `0600` where supported, streams bytes into it, verifies sizes/hash,
flushes and calls file `fsync`, closes it, then rechecks recording ownership.
It publishes the complete file with `os.link`, which refuses every existing
destination, including a dangling symlink or a destination created during
download. The filesystem must support same-directory hard links; there is no
overwrite fallback. No upstream text becomes a filename.

Cleanup removes only the partial file this invocation created. Ordinary errors
before publication leave no destination. Cleanup can fail after publication,
so a failure message can coexist with a completed output. A crash/kill can leave
a private partial. File `fsync` does not sync directory entries or guarantee
power-loss publication durability; runtime filesystem behavior is unverified.
After any failure inspect the private directory before retrying. Remove only a
partial you know belongs to that invocation. Preserve an existing destination
and choose a new filename if another download is desired.

There is no automatic retry, range resume, URL refresh, playback, cloud mutation
or device operation. Correct expired URL/network/authorization/rate-limit
conditions before manually rerunning. There are no cloud resources to clean up;
remove only authorized local downloads according to your retention policy.
`downloads/`, `.env`, `*.bin` and partial files are ignored. A custom path or
extension needs your own ignore rule and privacy policy.

## Source review and evidence — 2026-10-08

The compound-engineering 1.2.9 review compared this implementation with the
repository architecture, [Get Recording](https://docs.bota.dev/api-reference/recordings/get)
and [Download URL](https://docs.bota.dev/api-reference/uploads/download-url),
the public [OpenAPI](https://docs.bota.dev/api-reference/openapi), existing
independent Node download and Python JSON publication examples,
and the API original-download controller/service at reviewed backend source
`1ac67c92`. Private source is read-only contract evidence, never a runtime
dependency. No decryption or cleanup design is claimed to be implemented.

| Requirement | Implementation evidence | Status / remaining acceptance |
| --- | --- | --- |
| Independent public GET workflow | Standard-library `main.py`, environment template and own path-scoped workflow | Matched by source review; clean-copy execution unverified |
| Fixed owner/project and credential boundary | `verify_recording`, exact host trust and separate credential-free storage connection | Matched by source review; rejection/redirect/network execution unverified |
| Original bounded bytes and trusted integrity | No query transforms; body/size/deadline checks; optional caller hash | Matched by source review; runtime integrity/failure behavior unverified |
| Private regular file, no overwrite | Exclusive partial, `fstat`, flush/file `fsync`, final owner read and exclusive hard link | Matched by source review; Windows/POSIX runtime and crash durability unverified |
| Restricted creation evidence | Python 3.12.14 `py_compile` passed; workflow contains syntax compilation only | Syntax matched; no unit/functional/live/device/CLI execution tests; hosted CI unverified |
| Contract differences documented | Optional public project field; bigint strings; conservative statuses | Intentional sample restrictions and compatibility handling; deployment behavior unverified |

The changed-token documentation search covered internal/public docs and repo
instruction/overview files, including download routes and `EXPECTED_SHA256`.
Public catalog/download links are affected; repository-level integration review
and catalogs are maintained by the coordinating change. Existing Node test/live
evidence is specific to that example and is not Python acceptance evidence.
