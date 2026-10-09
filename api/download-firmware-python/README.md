# Download a declared firmware BIN image (Python)

Download one explicitly selected public firmware release's `.bin` image for
private local inspection. Verify its original bytes against the API-declared
SHA-256 and size before publishing a new local file. This example never installs,
flashes, assigns OTA, calls an SDK or writes to a device.

**Status:** implemented; source reviewed and syntax checked on October 9, 2026.
Runtime, live API/storage, filesystem, interruption and device acceptance are
unverified. This creation pass includes no tests or example execution. Python
3.12 or newer and its standard library are sufficient; no hardware is needed.

## Configure and run

Use a server-held project API key with **`devices:read`**. Independently establish
that the key belongs to the configured project, that the end user owns the device,
and that the operator may download this firmware. Fix these values in trusted
server configuration, not directly from an unauthenticated client.

From this directory:

```sh
cp .env.example .env
# Fill the placeholders and export each variable into this process.
# The script does not load .env files.
python -m py_compile main.py
python main.py
```

On PowerShell use `Copy-Item .env.example .env` and `$env:NAME='value'` for each
variable. Compilation performs no network or device operations. Running `main.py`
performs authenticated metadata reads, a storage download and local publication.
There is no install step and no CLI arguments are accepted.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Independently trusted HTTPS API origin, port 443, ending in `/v1`; no URL credentials, query or fragment |
| `BOTA_API_KEY` | Server-held `sk_test_*`, `sk_live_*` or `rk_*` project key with `devices:read` |
| `BOTA_PROJECT_ID` | Fixed expected `proj_` ID; optional returned project fields must match |
| `BOTA_END_USER_ID` | Fixed authorized `eu_` device owner |
| `BOTA_DEVICE_ID` | Exact current bound `dev_` device used for catalog filtering |
| `BOTA_FIRMWARE_RELEASE_ID` | Exact currently released `fw_` ID; no latest-version or model fallback |
| `BOTA_STORAGE_HOST_ALLOWLIST` | Comma-separated exact HTTPS storage DNS hosts independently approved by your operator; no ports, wildcard or schemes |
| `OUTPUT_PATH` | New `.bin` file in an existing private directory, without `..` traversal |

Obtain allowed storage hosts from your trusted deployment/operator configuration;
do not populate the allowlist from the returned signed URL. The `.env.example`
host is a placeholder. Keep signed URLs and API keys out of logs, source control,
browser/mobile bundles and error reports.

Provision the private output directory separately. On POSIX it must belong to
this user with no group/other permissions, for example `mkdir -m 700 exports`;
all ancestors must be existing directories without symlinks or group/other writes.
On Windows, provision private ACLs and trusted ancestry before running. Python's
`0600` creation mode does not configure Windows ACLs. Exclude reparse points and
concurrent filesystem writers through the operator's setup; this is not a path
sandbox. The filesystem must support same-directory hard links. Output images,
partials, `.env` and Python cache files are ignored.

Success emits only selected release ID/version, declared BIN hash/size and evidence
flags. No signed URL, output path, key, device serial, changelog or arbitrary
upstream content is printed. `matches_api_declared_bytes: true` describes what
this invocation checked when actually run; the current syntax-only validation
does not prove any image was downloaded.

## Exact selection and authorization observations

The operation makes six authenticated public GETs:

1. Read the exact device and require the configured current end-user owner and
   `bound` status. Reject non-null deletion markers and available project mismatch.
2. Read `/firmware-releases?device_id=...` and find the exact configured release
   among at most 100 entries. Reject duplicate or malformed release IDs. No public
   `model` field, pagination, version sorting or alternative release is assumed.
3. Read `/firmware-releases/{id}` and require matching ID, exact version,
   `is_released: true`, valid BIN SHA-256 and positive size at most **64 MiB**.
   Catalog and detail must agree on these selected fields.
4. Read `/firmware-releases/{id}/download-url?type=bin`. Require its version,
   SHA-256 and size to match the declared release. Require a valid timezone-aware
   unexpired `expires_at` and an independently allowed HTTPS port-443 storage host.
5. After downloading, verifying and file-fsyncing the image, reread the exact
   release and require the same selected metadata and current released eligibility.
6. Immediately before publication, reread the device with the same owner/project/
   bound rules. If `binding_generation` is available, require a nonnegative safe
   integer whose value and presence remain unchanged across the two owner reads.

A missing `project_id` relies on the API key's authenticated project; the configured
project string is not independent proof of that key's scope. Missing generation is
accepted only when absent from both device observations. These independent reads
are not atomic: current ownership and selection can change between or after them.
The final exact-release GET does not repeat device-filtered catalog selection or
establish uninterrupted compatibility. No historical ownership proof is produced.

The tracked backend baseline `1ac67c92c6d72858e29dc264037cb82b6c449825`
guards these firmware endpoints with `devices:read`. Its device-filtered list uses
the project's stored device model internally without exposing a model field.
Service-backed release GET and URL issuance check current project selection and
upstream publication; legacy release paths remain distinct. This sample relies on
the public server's eligibility decisions, not its own model/rollback policy. API
GETs may perform internal reference/cache work; this script submits no mutations.

## Download and private publication

Storage receives a fresh HTTPS connection with only `Accept-Encoding: identity`;
API Bearer authorization, cookies and other API headers are never forwarded.
The signed query is used unchanged and never interpreted or printed. Redirects,
automatic retries, ranges, compressed bodies, duplicate framing headers and
ambiguous transfer framing are rejected. Only HTTP 200 is accepted.

The response streams through `read1` into an exclusive same-directory random
partial file created with POSIX mode `0600`. Hashing covers the original received
bytes. Any supplied `Content-Length` must equal the declared release size, every
chunk remains within that size, and the final byte count and SHA-256 must match.
URL expiry is checked before storage access and after its body completes, using
the host's wall clock; correct clock configuration is required. A URL expiring
mid-download fails without publishing or obtaining another URL.

After file flush/fsync, final release and owner checks, and private-directory
identity recheck, a hard link publishes without overwriting any existing file or
symlink. Only this invocation's partial is removed. There is no directory fsync,
so this does not promise directory-entry durability across power loss. A crash
can retain a partial; cleanup can fail after publication. Inspect and reconcile
private files before retrying; do not delete an existing destination to force a
new download. Apply a suitable retention policy to images and abandoned partials.

The elapsed operation budget is **90 seconds**. Each API metadata request has
at most **15 seconds**; connected socket operations also have a 15-second timeout.
A transport timer interrupts header/body trickling at the relevant deadline,
including a storage stream using the remaining total budget. API JSON bodies are
limited to **1 MiB**, strict UTF-8, unique object keys and finite numbers. DNS
resolution and some filesystem waits cannot be interrupted by these timers.
Limits are teaching limits, not Bota service quotas. Exit 0 means publication and
partial cleanup completed; exit 1 means failure or uncertainty. Raw errors and
upstream failure bodies are never printed.

## Evidence limits and acceptance

Matching an API-declared SHA-256 and size detects disagreement or truncation
relative to those declarations. The same API supplies the declarations and URL;
its checksum is **not an independently trusted firmware-signing authority**.
This example does not verify a boot signature, authenticity against an independent
trust root, physical device compatibility, uninterrupted release selection,
installed firmware or rollback authorization. It never delivers the image to a
device. Do not use its output alone to authorize installation.

Public contracts: [list firmware](https://docs.bota.dev/api-reference/firmware/list),
[exact release](https://docs.bota.dev/api-reference/firmware/get),
[download URL](https://docs.bota.dev/api-reference/firmware/download-url) and
[firmware updates](https://docs.bota.dev/guides/firmware-updates).

| Requirement | Evidence on October 9, 2026 | Status |
| --- | --- | --- |
| Independent public inspection download | Own stdlib source/env/README; explicit BIN, six metadata GETs and one isolated storage GET | Matched in source; deployed behavior unverified |
| Fixed owner/project/generation and exact release | Initial/final owner gates; device-filtered selection; repeated declared metadata/released eligibility | Matched in source; rejection/race acceptance unverified |
| Isolated storage and original-byte verification | Exact independently configured hosts; HTTPS; no forwarded Bearer/redirect/retry; streamed SHA-256 and exact size | Matched in source; runtime transfer acceptance unverified |
| Private no-overwrite output | Exclusive partial; fsync; directory identity check; hard link; only own partial cleanup | Matched in source; filesystem/crash acceptance unverified |
| Python syntax | `python -m py_compile main.py`, Python 3.12.14 / Windows | Passed; syntax only |
| CI | [Compile-only workflow](https://github.com/bota-dev/examples/actions/runs/37995712323) at `95c24d9bb596653913f8b5a28a884a662bc63e15` | Passed; syntax only |
| Runtime/live API/storage/device acceptance | No CLI, function, test, download or device execution in this creation pass | Unverified |

Keep caller authorization, trusted host selection and private storage in your
service. No sibling repository, private app helper or SDK is a runtime dependency.
