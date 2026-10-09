# List selected firmware metadata (Python)

Read the public firmware catalog for one configured cloud device owned by a
fixed end user. The script checks ownership before and after the catalog read,
then prints a small set of release metadata. It makes three GET requests and
does not download artifacts, promote/stop releases, request grants, assign OTA,
send device commands or flash hardware.

**Status:** implemented; source reviewed and Python syntax checked on
October 8, 2026. Runtime, authorization rejection and live API behavior are
unverified. This creation pass includes no unit or functional tests, live API
calls or hardware tests.

Requires **Python 3.12 or newer**. Only the standard library is used; there is
no pip install, SDK package, sibling repository or shared runtime dependency.

## Configure and run

Use a server-held project key with **`devices:read`**, an existing bound device
in that project, and the device's fixed authorized end user. A restricted key
with that read scope is sufficient. Explicitly configure the API origin you
trust before supplying the key; HTTPS alone does not identify the intended
service. Keep keys out of browser/mobile applications and commit history.

`.env.example` is documentation only. The script reads process environment
variables and does **not** load an `.env` file.

```sh
export BOTA_API_BASE_URL='https://api.bota.dev/v1'
export BOTA_API_KEY='YOUR_SERVER_KEY'
export BOTA_END_USER_ID='YOUR_END_USER_ID'
export BOTA_DEVICE_ID='YOUR_DEVICE_ID'
python3 -m py_compile main.py
python3 main.py
```

PowerShell equivalents:

```powershell
$env:BOTA_API_BASE_URL='https://api.bota.dev/v1'
$env:BOTA_API_KEY='YOUR_SERVER_KEY'
$env:BOTA_END_USER_ID='YOUR_END_USER_ID'
$env:BOTA_DEVICE_ID='YOUR_DEVICE_ID'
python -m py_compile main.py
python main.py
```

Replace placeholders with your authorized resources. There are no built-in
keys, cloud IDs or serial numbers. Compilation does not execute the script or
require API credentials. Prefer server secret injection over keeping a key in
shell history.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required explicit trusted origin ending in `/v1`; HTTPS except loopback HTTP on `localhost`, `127.0.0.1` or `[::1]` |
| `BOTA_API_KEY` | Required server-side key for the intended project with `devices:read` |
| `BOTA_END_USER_ID` | Required fixed authorized `eu_*` owner |
| `BOTA_DEVICE_ID` | Required expected `dev_*` cloud ID; not a physical serial number |

Successful output is selected JSON metadata. This empty example is illustrative,
not a captured API result:

```json
{
  "data": [],
  "metadata_only": true,
  "pagination_supported": false,
  "list_complete": false
}
```

Each nonempty row contains `id`, `version`, `is_released`, `created_at` and
`updated_at`, plus `release_sequence` and `allow_downgrade` when the API supplies
that optional pair. The script preserves the returned order and chooses no
recommended or latest release. Version text is not sorted or interpreted as
rollback authorization. It omits changelog text, image details, signed URLs,
storage paths, credentials and arbitrary response fields. Protect stdout as
operational metadata; `firmware.json` is ignored if you redirect output there.

## Public contract and safety gates

1. `GET /v1/devices/{id}` must match the configured device and end user, have
   status `bound`, and carry no deletion marker.
2. `GET /v1/firmware-releases?device_id={id}` reads one catalog selection using
   that same project key. The API derives model selection from its stored device.
3. Validate every release ID, bounded version token, released flag, timestamp,
   and optional positive integer sequence/boolean downgrade pair. Reject duplicate
   IDs, responses over 1 MiB or lists over 100 rows before printing any output.
4. Repeat the ownership read before emitting the selected metadata.

The 100-row and 1 MiB bounds are teaching-example limits, not API service limits.
An oversized list fails; it is never silently truncated. The public list
contract advertises no cursor, offset, limit or model-ID query. The script sends
only `device_id`, makes no paging loop and always reports `list_complete: false`,
including for an empty or short response. It supplies no exhaustive audit or
atomic catalog snapshot. The ownership reads are separate observations; an
ownership change between them may go undetected.

The public release serializer omits model identity. Exact configured model-ID
matching is therefore unavailable here; the script does not invent a model
filter, infer a model from version/ID, or access dashboard/internal endpoints.
The API's cloud device selection does not establish compatibility with an
independently observed physical device.

Project selection and upstream publication are separate decisions. Service
releases are visible only while selected for this authenticated project and
still available upstream; a sibling project's selection grants no authority.
No matching entries can mean no currently selected release. Cached metadata,
`is_released`, sequence and downgrade flags are metadata observations, not
installation authorization or proof that an update is safe for hardware.
Publication, promotion, authorized delivery and physical installation require
their own evidence. This reader neither starts nor verifies those phases.

Public project-key Promote/Stop APIs remain unavailable in the reviewed
contract; project administrators use the Portal. Download URLs, grants and
assignments are separate public workflows. This example never requests them
and makes no physical-device compatibility, installed-version, secure-boot or
firmware-integrity qualification claim.

## Bounds, failures and verification

All three GET requests share a 30-second elapsed budget. Following connection,
an absolute remaining-deadline timer shuts down the socket, covering request
sending, headers and body reads, including trickled responses. Cleanup cancels
and joins the timer. Initial DNS resolution and TCP/TLS establishment rely on
the standard library and OS with a socket timeout of at most 10 seconds; these
phases may overrun the absolute deadline. This is not a strict whole-process
wall-clock guarantee.

Each response must be uncompressed UTF-8 `application/json`; duplicate keys
and nonstandard `NaN`/`Infinity` constants are rejected. Connections go
directly to the configured origin without environment proxy routing. Redirects
are rejected and no request is retried automatically. Failure exits 1 with a
sanitized stderr message; raw API bodies, keys, URLs and exception traces are
omitted. Success exits 0 only after all validation and the final ownership read.
No cloud cleanup is needed. Retained local output follows your metadata policy.

| Requirement | October 8, 2026 evidence / status |
| --- | --- |
| Independent public reader | Own source/config/ignore/README; standard-library-only imports; source matched |
| Project/device ownership | Public `devices:read` routes and fixed owner checks before/after read; source matched, runtime unverified |
| Bounded catalog / metadata output | One documented device-filtered GET; 100 rows, 1 MiB, selected fields; source matched, runtime unverified |
| Exact model matching / exhaustive pagination | Unavailable in public contract; explicitly limited, no invented parameters |
| Read-only OTA boundary | GETs only; no artifact/download/grant/assignment/device writes; source matched |
| `python -m py_compile main.py` | Passed on Python 3.12.14 / Windows; syntax only |
| Runtime / failure paths / live API / hardware | Not run at the owner's creation-only request |
| Hosted workflow | Configured for syntax checking on Ubuntu 24.04; hosted result unverified |

The compound-engineering review compares the source with the repository
architecture and the public
[device read](https://docs.bota.dev/api-reference/devices/get),
[firmware list](https://docs.bota.dev/api-reference/firmware/list),
[release detail](https://docs.bota.dev/api-reference/firmware/get),
[download metadata](https://docs.bota.dev/api-reference/firmware/download-url)
and [firmware update guide](https://docs.bota.dev/guides/firmware-updates).
Backend route, query schema and serialization source clarified the omitted
model identity and pagination; the current OTA architecture clarified project
selection versus delivery. Those sources are review evidence, not runtime
dependencies. Runtime acceptance remains a separate future check.
