# List device command history (Python)

Read the newest command lifecycle metadata for one configured, owned device.
The script checks the device's exact ID and fixed end-user binding before
reading its public command history. It creates, cancels and acknowledges no
commands; it performs no recording, provisioning, factory-reset or device call.

**Status:** implemented; Python syntax checked on October 8, 2026. Runtime,
authorization failure handling and live API behavior remain unverified. This
creation pass includes no test suite, functional execution or hardware testing.

Requires **Python 3.12 or newer**. The example uses only the standard library:
no pip install, SDK package, sibling repository or shared runtime is required.

## Configure and run

Use a server-held project key with **`devices:read`**, a device in that project,
and its fixed authorized end user. A read-only restricted key is sufficient.
Keep the key out of browser/mobile applications and commit history.

The script reads the process environment directly. `.env.example` documents
configuration; it is **not automatically loaded**. Set variables in your shell
or server's secret configuration before running from this directory.

```sh
export BOTA_API_BASE_URL='https://api.bota.dev/v1'
export BOTA_API_KEY='YOUR_SERVER_KEY'
export BOTA_END_USER_ID='YOUR_END_USER_ID'
export BOTA_DEVICE_ID='YOUR_DEVICE_ID'
export BOTA_LIMIT='20'
python3 -m py_compile main.py
python3 main.py
```

PowerShell equivalents:

```powershell
$env:BOTA_API_BASE_URL='https://api.bota.dev/v1'
$env:BOTA_API_KEY='YOUR_SERVER_KEY'
$env:BOTA_END_USER_ID='YOUR_END_USER_ID'
$env:BOTA_DEVICE_ID='YOUR_DEVICE_ID'
$env:BOTA_LIMIT='20'
python -m py_compile main.py
python main.py
```

Replace the placeholder strings with your own authorized resources. There are
no built-in credentials, device serials or cloud IDs. Syntax checking does not
execute the script or require API access. Shell history may retain credentials;
prefer your environment's secret injection for deployment.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required explicit API origin ending in `/v1`; HTTPS except HTTP on `localhost`, `127.0.0.1` or `[::1]` |
| `BOTA_API_KEY` | Required server-side key for the intended project with `devices:read` |
| `BOTA_END_USER_ID` | Required fixed authorized end user matching the current device binding |
| `BOTA_DEVICE_ID` | Required expected `dev_*` cloud ID; not a physical serial number |
| `BOTA_LIMIT` | Newest-row cap from 1–100; defaults to 20; this example's cap is not a documented API maximum |

Successful output is selected JSON metadata:

```json
{
  "data": [],
  "requested_limit": 20,
  "at_limit": false,
  "pagination_supported": false,
  "history_complete": false
}
```

For nonempty results, each row contains only `id`, `device_id`, `type`, `status`,
`created_at`, `expires_at`, `delivered_at`, `executed_at`, `has_result` and
`has_error`. Result/error indicators are booleans; arbitrary payloads, result
details, error text, authorization grants, API keys, serials and device settings
are omitted. Validate and protect stdout as operational metadata. To retain
output, redirect it to `commands.json`, which is ignored by Git.

## Read boundaries and lifecycle meaning

`GET /v1/devices/{id}` must return the configured device ID, matching
`end_user_id`, status `bound`, and no deletion marker. Only then does the script
call `GET /v1/devices/{id}/commands?limit=N`. Project scope comes from the API
key. Each command's ID and target are validated before any JSON is printed;
duplicate IDs, malformed timestamps, unexpected types/statuses and oversized
lists fail the invocation.

The public history endpoint returns a **single newest-first `data` list**.
It defines no cursor pagination or status filter. The script issues one history
read, preserves the returned order and sends only `limit`; it never invents a
cursor, loops pages, or visits `/commands/pending`. `at_limit` indicates that
the cap was reached. `history_complete` always remains false because the
endpoint supplies no total or independent completeness proof, even for empty
or short results. This is a recent selection, not an exhaustive audit export.

Command lifecycle metadata must be interpreted according to its evidence:

| Observation | Meaning and limit |
| --- | --- |
| A command row / `created_at` | Backend command creation was recorded; this alone proves no device receipt or action |
| `pending` | Command remains queued in backend history; held delivery is not cancellation or completion |
| `delivered` / `delivered_at` | Backend selected the command for a delivery response; physical receipt is not independently established |
| `executed` / `executed_at` | Backend recorded a terminal execution result; this read does not independently verify hardware execution |
| `has_result` / `has_error` | Backend stored an object; the script intentionally omits its content and does not infer success from mere presence |
| Received or applied state | No separate receipt or applied-state field is supplied by this history contract; do not infer it from acceptance, delivery or result presence |

`failed`, `expired` and `cancelled` are reported as returned. Durable factory-reset
rows may have null expiry; listing one does not execute it. Firmware-gated reset
delivery may remain held with the same command ID. The script neither resumes
delivery nor treats these rows as safe to retry.

The ownership read and history read are separate observations, not an atomic
binding snapshot. In a multi-user service, derive allowed IDs and end-user scope
from authenticated caller identity. Current binding does not establish the
historical binding generation of every command; this export does not audit
generation boundaries or authorize replay.

## Bounded failures and evidence

The two GET requests share a 30-second elapsed-time budget. After each connection
is established, an absolute remaining-deadline timer shuts down its socket;
this covers request sending, headers and body reads, including a server that
trickles bytes. The timer is cancelled and joined during connection cleanup.
DNS resolution and initial TCP/TLS establishment use the standard library and
OS, with a socket timeout of at most 10 seconds; those phases may overrun the
absolute read/header deadline. This is not a strict whole-process wall-clock
guarantee. Each API response must declare `application/json` and is capped at
1 MiB. Redirects and compressed HTTP bodies are rejected. Connections go directly
to the configured origin, without environment proxy routing or automatic retries.

Failure prints a sanitized message to stderr and exits 1. No raw API body,
credential, URL or exception trace is emitted. Success exits 0 after validating
all selected rows. Empty history succeeds but proves no delivery or execution.
No cloud cleanup is necessary because the example performs read-only calls.
Remove any retained local output according to your metadata-retention policy.

| Check | October 8, 2026 evidence |
| --- | --- |
| `python -m py_compile main.py` | Passed on Python 3.12.14 / Windows; syntax only |
| Dependency installation | Not needed; standard library only |
| Runtime / ownership rejection / timeout behavior | Not run |
| Live API / device execution | Not run |
| Hosted workflow | Configured for syntax checking only on Ubuntu 24.04 |

Public contracts:
[get device](https://docs.bota.dev/api-reference/devices/get) and
[list device commands](https://docs.bota.dev/api-reference/devices/list-commands).
The implementation uses their project-authorized `/v1` resources. Backend route
and schema source were read as contract clarification, with no private runtime
dependency or dashboard request added.
