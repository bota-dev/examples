# List selected OTA history metadata (Python)

Read one bounded backend OTA assignment history selection for a configured cloud
device, checking its current binding to the fixed expected end user before and
after the history request. Use this server-side example only as a trusted project
operator authorized to inspect the device's historical metadata. A timestamp
cutoff limits displayed rows; it does not prove their historical ownership.

**Status, 2026-10-08:** implemented, source reviewed and Python syntax checked.
Runtime, authorization rejection and live API behavior are unverified. This
creation pass includes no unit or functional tests, live API calls or device
tests. Hosted workflow execution remains unverified.

Requires **Python 3.12 or newer** and only its standard library. There is no pip
install, SDK package, sibling repository or shared runtime dependency.

## Configure and run

Use a server-held project key with **`devices:read`**, an existing bound device,
and its fixed authorized end user. A restricted key with that read scope is
sufficient. Explicitly choose the trusted API origin before providing credentials;
HTTPS alone does not identify the intended service. Keep the key out of mobile
and browser applications, logs and commit history.

The key determines API project authorization. `BOTA_PROJECT_ID` is an expected
identity checked against optional returned `project_id` fields; setting it cannot
select another project or establish missing historical provenance.

`.env.example` documents variables only. The script reads the process environment
and does **not** load an `.env` file.

```sh
export BOTA_API_BASE_URL='https://api.bota.dev/v1'
export BOTA_API_KEY='YOUR_SERVER_KEY'
export BOTA_PROJECT_ID='YOUR_PROJECT_ID'
export BOTA_END_USER_ID='YOUR_END_USER_ID'
export BOTA_DEVICE_ID='YOUR_DEVICE_ID'
export BOTA_OTA_HISTORY_LIMIT='10'
export BOTA_OTA_ASSIGNED_NOT_BEFORE='YOUR_AUTHORIZED_OPERATOR_SELECTED_ISO_TIMESTAMP'
python3 -m py_compile main.py
python3 main.py
```

PowerShell equivalents:

```powershell
$env:BOTA_API_BASE_URL='https://api.bota.dev/v1'
$env:BOTA_API_KEY='YOUR_SERVER_KEY'
$env:BOTA_PROJECT_ID='YOUR_PROJECT_ID'
$env:BOTA_END_USER_ID='YOUR_END_USER_ID'
$env:BOTA_DEVICE_ID='YOUR_DEVICE_ID'
$env:BOTA_OTA_HISTORY_LIMIT='10'
$env:BOTA_OTA_ASSIGNED_NOT_BEFORE='YOUR_AUTHORIZED_OPERATOR_SELECTED_ISO_TIMESTAMP'
python -m py_compile main.py
python main.py
```

Replace every placeholder with trusted configuration for your authorized
resources. The required cutoff must be a valid timestamp with timezone, such as
`2026-10-08T00:00:00Z`; this illustrates the format and is not a recommended
ownership boundary. There are no built-in cloud IDs, physical serial numbers or
credentials. Prefer secret injection over retaining keys in shell history.
Compilation does not execute the script or require credentials.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required explicit trusted origin ending in `/v1`; HTTPS except loopback HTTP on `localhost`, `127.0.0.1` or `[::1]` |
| `BOTA_API_KEY` | Required server-held key for the intended project with `devices:read` |
| `BOTA_PROJECT_ID` | Required expected `proj_*` identity, checked whenever a response supplies `project_id` |
| `BOTA_END_USER_ID` | Required fixed expected current `eu_*` device owner |
| `BOTA_DEVICE_ID` | Required expected `dev_*` cloud ID; not a physical serial number |
| `BOTA_OTA_HISTORY_LIMIT` | Integer 1–100; defaults to 10; used on the single history request |
| `BOTA_OTA_ASSIGNED_NOT_BEFORE` | Required trusted operator-selected ISO timestamp; only assignments at or after it are displayed |

Successful output is selected JSON metadata. This empty example is illustrative,
not a captured API result:

```json
{
  "data": [],
  "metadata_only": true,
  "evidence": "backend_assignment_history",
  "assigned_not_before": "2026-10-08T00:00:00Z",
  "requested_limit": 10,
  "pagination_supported": false,
  "history_complete": false,
  "historical_owner_verified": false
}
```

Each displayed row contains only `id`, `device_id`, `firmware_release_id`,
`status`, `assigned_at`, `delivered_at` and `applied_at`. It preserves the
newest-first order and nullable delivery/application timestamps. It omits
`error_message`, which is arbitrary upstream text that may contain sensitive
details, as well as grants, artifact URLs, credentials and other fields. Protect
stdout as operational metadata. `ota-history.json` is ignored for optional
shell redirection; the script itself writes no files or state.

## Public contract and ownership limits

1. `GET /v1/devices/{id}` must match the configured device and end user, report
   `status: bound`, carry no deletion marker and match any optional project field.
2. Make exactly one `GET /v1/devices/{id}/ota/history?limit={limit}` using the same
   project key. The API returns `{ "data": [...] }` newest first.
3. Validate every returned row, including those excluded by the cutoff: exact
   device identity, `ota_*` assignment and `fw_*` release IDs, known status,
   required timezone timestamps and nullable delivery/application timestamps.
   Reject optional project mismatches, duplicate assignment IDs, wrong ordering
   and more rows than requested before any output.
4. Select rows with `assigned_at >= BOTA_OTA_ASSIGNED_NOT_BEFORE`, then repeat the
   current device ownership check before printing.

The reviewed backend at `1ac67c92` checks the device's current project in the
history controller, then queries assignments by **device ID only**. The returned
history can retain prior-project or prior-owner assignments after transfers or
rebinding. Public assignment rows carry no historical project, end-user or
binding generation. Current ownership checks and an operator-selected cutoff
do not establish per-row historical tenant or owner authorization. Even an
operator-supplied start of the current ownership tenure remains a selection
assumption, not API evidence. `historical_owner_verified: false` is deliberate.

This example is unsuitable as an end-user history endpoint or a privacy boundary
between owners or projects. Its operator must already be authorized to inspect
the device history, including any retained historical metadata. A backend that
serves end users needs assignment provenance and appropriate authorization
before exposing rows. Rejecting an optional project mismatch applies even to
older rows that the cutoff would otherwise hide.

The three GETs are separate observations, not an atomic snapshot. A transfer or
binding change can happen between reads, including away and back to the same
owner. The assignment response lacks generation fencing; pre/post ownership
reads cannot detect every race or establish the owner at assignment time.

The public history contract supports only `limit`, without cursor or offset
pagination, totals or an exhaustion signal. The script makes no paging loop and
always reports `history_complete: false`, even for an empty or short response.
The bounded list plus cutoff is not an exhaustive audit. An empty displayed list
does not prove the device was never assigned firmware; recent rows may fall
outside the selected cutoff or the bounded response.

## Backend evidence and device boundaries

Statuses are `pending`, `delivered`, `applied`, `failed` and `cancelled`.
`applied` records a device report matching the assigned release through the
backend heartbeat path. It does not independently verify the device's current
installed firmware, image integrity, successful reboot or current OTA success.
`failed` can reflect device-reported failure or settlement during project
transfer; because arbitrary `error_message` is omitted, this reader does not
classify those causes. Earlier rows do not identify the latest assignment or
the firmware running now.

The public latest-status examples call `applied` installed, while their field
definition more precisely states that the device reported the assigned version.
This example retains that narrower backend-evidence meaning. It does not call
the separate latest-status endpoint, read hardware, download firmware, request
grants, assign or cancel OTA, send commands or change device/cloud state.

## Bounds, failures and verification

All three requests share a 30-second elapsed budget. After connecting, a timer
shuts down the socket at the remaining deadline, including request sending,
headers and trickled body reads. Cleanup cancels and joins it. Initial DNS and
TCP/TLS establishment rely on the standard library and OS with a socket timeout
of at most 10 seconds; they may overrun the absolute deadline. This is not a
strict whole-process wall-clock guarantee.

Responses must be uncompressed UTF-8 `application/json` and at most 1 MiB each.
Duplicate JSON keys and nonstandard `NaN`/`Infinity` constants are rejected.
Connections go directly to the configured origin without environment proxy
routing. Redirects are rejected; no automatic retry occurs. Failures exit 1
with sanitized stderr, omitting raw bodies, exception traces, keys and URLs.
Success exits 0 only after all validation and the final owner observation.
Retained local output follows your metadata policy; no cloud cleanup is needed.

| Requirement | 2026-10-08 evidence / status |
| --- | --- |
| Independent public API reader | Own source/config/ignore/README; standard library only; source matched |
| Fixed current owner and project expectation | Pre/post device checks and optional project rejection; source matched, runtime unverified |
| Bounded history selection | One documented 1–100 limit request, 1 MiB response bound, duplicates/ordering/timestamp validation and cutoff; source matched, runtime unverified |
| Historical tenant/owner provenance | Unavailable in public response and tracked repository query; partial, operator scope and explicit unverified label |
| Exhaustive pagination / atomic snapshot | Unavailable; no invented parameters or completeness claim |
| Read-only OTA boundary | GETs only, selected metadata, no arbitrary error text or delivery operations; source matched |
| `python -m py_compile main.py` | Passed with the bundled Python runtime on Windows; syntax only |
| Runtime / failure paths / live API / device | Not run at the owner's creation-only request; unverified |
| Hosted workflow | Path-filtered syntax job, read permissions, pinned checkout; configured, hosted result unverified |

The compound-engineering review compares source against the repository
architecture, public [device read](https://docs.bota.dev/api-reference/devices/get),
[OTA history](https://docs.bota.dev/api-reference/firmware/ota-history) and
[latest OTA status](https://docs.bota.dev/api-reference/firmware/get-ota)
contracts, and the current OTA design's separate delivery, installation and
heartbeat evidence. Backend route, validation, service and repository source at
`1ac67c92` clarified the historical provenance gap. These are review sources,
not runtime dependencies. No runtime, deployed or physical conformance is claimed.
