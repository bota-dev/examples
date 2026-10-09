# Read one device's cloud status

Read the latest cloud-reported battery, storage, recording and heartbeat values
for one device owned by a fixed end user. This server-side Node.js example makes
three GET requests and prints selected JSON. It adds no polling, SDK connection,
recording control, configuration update, binding, reset or device mutation.

**Status:** implemented with installation/syntax checks and source review only.
Runtime, failure and live API behavior remain unverified. The owner requested
creation without testing; no functional tests, live calls or hardware operations
were added or run.

## Setup

Use Node.js **22.23.2 or newer**. The example uses built-ins and has no SDK,
third-party dependencies, hardware requirement or sibling-repository dependency.
You need an API project key with `devices:read` access and a cloud device already
bound to the configured end user. Device/upload tokens are excluded.

From this directory:

```sh
npm ci
cp .env.example .env
```

PowerShell can use `Copy-Item .env.example .env`. Replace every placeholder:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_ORIGIN` | Trusted API origin, default `https://api.bota.dev`; HTTPS, or HTTP on explicit `localhost`, `127.0.0.1`, or `[::1]`. No path/query/credentials. |
| `BOTA_API_KEY` | Server-held project secret or permitted restricted key with `devices:read`. |
| `BOTA_END_USER_ID` | Fixed authorized bound owner, `eu_...`. |
| `BOTA_DEVICE_ID` | One existing cloud device ID, `dev_...`; no physical serial is hardcoded. |

Keep the key in the server environment; never put it in a browser, mobile app or
logs. This CLI's configured IDs represent an operator-authorized scope. A customer
multi-user backend must authenticate callers and derive their allowed device and
end user on the server. Client-supplied IDs are not authorization.

## Run

```sh
npm run check
npm start
```

The public workflow is:

1. `GET /v1/devices/{id}` checks exact `id`, `end_user_id` and `status: "bound"`.
2. `GET /v1/devices/{id}/state` checks its distinct `device_id` field and validates
   selected reported readings. Missing optional readings become `null`; unknown
   device-state values become `"unknown"`. No raw heartbeat object is printed.
3. `GET /v1/devices/{id}` repeats ownership/binding checks before any output. If
   binding generations are returned, the example rejects observed changes or a
   differing state generation. This additive check does not require an undocumented
   generation field in the full-device response.

Output includes `device_id`, `observed_at`, `evidence: "cloud_reported_snapshot"`,
heartbeat timestamp/age/freshness, battery/storage, reported device state and
pending recordings, plus last sync timestamp and known historical channel tags.
Serials, settings, WiFi names, operator names, metadata, recording IDs and optional
client-connection reports are omitted. No arbitrary API objects are forwarded.

The three requests share a 30-second deadline and a 256 KiB JSON limit per response.
There are no retries, redirects, POSTs or external storage requests. Unexpected
status, malformed/oversized JSON, invalid readings, scope mismatch and network
failure stop without output. Errors contain controlled descriptions and HTTP
status codes; upstream error bodies, URLs and keys are never printed.

## Interpret heartbeat freshness carefully

`heartbeat_freshness` is derived using the local clock:

| Value | Interpretation |
| --- | --- |
| `not_reported` | No heartbeat timestamp was returned. |
| `future_timestamp` | The reported timestamp is ahead of the local clock; age is unknown. |
| `recent_report` | A report is less than 15 minutes old. |
| `stale_report` | The report is at least 15 minutes old. |

This is report age, **not proof the device is connected or reachable now**. Clock
skew affects the classification. Battery, storage, pending counts and recording
state belong to the last report, even when that report is recent. Historical
`last_seen_by`/`last_synced_by` channel names do not establish current radio state,
an idle uploader, a local Bluetooth session or authorization to start BLE fallback.
The sample emits no `online`, `connected` or fresh-presence decision.

Unknown optional channel names become `null`, rather than being interpreted as a
current transport. Client Bluetooth observations are excluded; they have their own
server-time/expiry/session rules and are not hardware-connectivity proof either.
Resolved settings are also excluded because cloud values do not prove device
application. Use the public App SDK for a separately authorized local-device flow.

Separate ownership reads are not an atomic snapshot. Rebinding can happen between
requests; matching owner IDs alone cannot detect a rebind back to the same owner
when generation fields are absent. The example checks observations, not continuous
ownership or physical identity. A production backend must enforce caller scope
and apply its required authorization/concurrency policy.

## Cleanup and evidence

No cloud resources, recordings, settings, local journal or device state are
created or changed. Delete the private `.env` file or revoke its key when it is
no longer needed. Keep any captured status output private.

```sh
npm ci
npm run check
```

The path-filtered workflow performs those installation/syntax commands with no
credentials or API requests.

| Requirement / evidence | October 8, 2026 status |
| --- | --- |
| Independent built-ins-only setup | Own manifest/lock; frozen install matched locally on Node 22.23.2. |
| Public routes and owner/state IDs | Public Get Device/Get Device State plus backend route/source review matched. |
| Syntax | `node --check index.mjs` passed locally. |
| Scope/output/deadline/error boundaries | Present in source; runtime behavior unverified. |
| Report age separate from connectivity | Selected labels and explanations matched in source review. |
| Automated, functional or live tests | Not added or run, by user instruction. |
| Hosted workflow | Check the exact committed run; local syntax is not hosted evidence. |
| Physical-device acceptance | Not claimed; no hardware operation is performed. |

Public contracts: [Get Device](https://docs.bota.dev/api-reference/devices/get)
and [Get Device State](https://docs.bota.dev/api-reference/devices/get-state).
