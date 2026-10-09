# Watch one existing OTA assignment

Observe a known firmware assignment through bounded GET polling. Configure the
exact project, bound end user, cloud device, OTA assignment and firmware release
before starting. The script never assigns, replaces, cancels, delivers or installs
firmware, requests an OTA grant, downloads an artifact or contacts a device.

**Status, October 8, 2026:** implemented with installation/syntax evidence and
source review only. Runtime, failure paths, live API and physical acceptance are
unverified. The owner requested creation without functional tests or CLI execution;
only installation and syntax checks were run.

## Setup

Use Node.js **22.23.2 or newer**. This independent example has its own package and
lockfile, uses only Node built-ins and needs no App SDK or sibling source.
Use a server-held project secret or permitted restricted API key with
`devices:read`; device/upload tokens are excluded. The operator must independently
be authorized to inspect retained OTA history for this device, including historical
assignment metadata. Current ownership and possession of an exact assignment ID
do not establish that authorization.

From this directory:

```sh
npm ci
cp .env.example .env
```

PowerShell can use `Copy-Item .env.example .env`. Replace every placeholder:

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Fixed trusted HTTPS API base ending in `/v1`; defaults to `https://api.bota.dev/v1`. No credentials, query or fragment. |
| `BOTA_API_KEY` | Server-held project key with `devices:read`. |
| `BOTA_PROJECT_ID` | Required exact expected `proj_*` project. |
| `BOTA_END_USER_ID` | Required fixed authorized `eu_*` current owner. |
| `BOTA_DEVICE_ID` | Required exact `dev_*` cloud device; no physical serial is inferred. |
| `BOTA_OTA_ASSIGNMENT_ID` | Required known `ota_*` assignment, obtained through a separately authorized workflow. |
| `BOTA_FIRMWARE_RELEASE_ID` | Required exact `fw_*` release belonging to that assignment. |

Keep `.env`, the key and captured metadata private. In a multi-user customer
backend, authenticate callers and derive allowed project/end-user/device context
on the server. Client-supplied IDs are not authorization. This operator CLI does
not implement an end-user authorization service.

## Run and observe

```sh
npm run check
npm start
```

The script checks `GET /v1/devices/{id}` for the exact device, owner,
`status: "bound"`, absence of a deletion marker and any returned project ID.
Every poll repeats this owner check before `GET /v1/devices/{id}/ota`, validates
the assignment, then makes a fresh owner GET before considering output.
Any optional binding generation must remain equal to the initial observation;
the public full-device schema does not require that field.

The latest-OTA response must contain `{ "data": assignment }`. Every observation
must match all three configured assignment/device/release IDs. A missing `data`,
`data: null`, replacement ID, unknown status, malformed timestamp, optional project
mismatch, owner change, HTTP error or transport failure stops the watcher.
It never follows a replacement or interprets a missing expected assignment as
proof that firmware was never assigned. The latest endpoint is not an exact-ID
lookup or history search: once a newer assignment appears, this watcher cannot
continue observing the older one through that endpoint.

Known statuses are `pending`, `delivered`, `applied`, `failed` and `cancelled`.
Pending/delivered observations produce no output and wait two seconds before the
next poll. The run has a five-minute monotonic elapsed budget, at most 150 OTA
observations and at most 451 GETs including ownership checks. Each request has at
most ten seconds within that shared budget, including body reading. Responses
must be uncompressed UTF-8 `application/json` and at most 256 KiB. Redirects and
automatic retries are rejected. Ordinary timer scheduling and local JSON/output
work mean this is not a hard real-time process termination guarantee.

After a terminal observation and its fresh owner check, stdout contains only
`data.id`, `device_id`, `firmware_release_id`, `status`, `assigned_at`,
`delivered_at` and `applied_at`, plus observation count/time and explicit evidence
labels. Required `assigned_at` and nullable delivery/application timestamps must
be bounded timezone-bearing strings with valid calendar dates. No raw device
object, arbitrary `error_message`, reason, grant, artifact URL or credential is
printed. No progress rows or output files are created; `ota-status.json` is ignored
for optional private shell redirection.

Backend-reported `applied` exits 0. Backend-reported `failed` or `cancelled` prints
the same selected terminal metadata and a controlled stderr description, then
exits 1. Timeout and other failures exit 1 without assignment output. Failure
does not cancel, restart or repair the assignment; reconcile independently.

## Evidence and authorization limits

`applied` means the backend recorded a device report of the assigned version.
It does not prove fresh physical boot, current installed firmware, image integrity,
successful reboot or independent installation verification. `pending` and
`delivered` do not establish installation. Failure may originate from a device
report or project-transfer settlement; omitted arbitrary error text is not used
to classify its cause. The script uses no firmware-version or heartbeat snapshot
as independent hardware proof.

At reviewed backend HEAD `1ac67c92c6d72858e29dc264037cb82b6c449825`, the latest
controller checks current project access, and `getScopedDeviceOta` checks the
current organization/project and locks the current device before querying the
latest assignment. The repository query selects by device ID, ordered by
`assigned_at`, and rows omit historical project/end-user and `binding_generation`.
Retained assignments can predate transfer or rebinding. The expected `proj_*`
configuration and optional project mismatch checks cannot recover missing
historical provenance. Exact OTA identity does not prove authorization at its
assignment time; `historical_owner_verified: false` remains explicit.

Owner/OTA/owner GETs are separate non-atomic observations. Binding may change
between them, including away and back to the same owner. Optional device
generation checks can reject observed changes but cannot fence the OTA row or
establish continuous ownership. Output reports `atomic_snapshot: false` and
`physical_installation_verified: false`. This reader is unsuitable as a privacy
boundary for serving historical metadata to end users without additional backend
provenance and authorization.

## October 8 design review

The compound-engineering review compared the source with the repository
architecture, public [Get Device](https://docs.bota.dev/api-reference/devices/get)
and [Get Device OTA Status](https://docs.bota.dev/api-reference/firmware/get-ota)
contracts, and `Device-App-Backend OTA Design.md` sections 5–6. Read-only backend
controller/service/repository source at the full HEAD above was used to clarify
current-scope versus historical authorization. These are review sources, not
runtime dependencies.

| Requirement | Evidence / conformance |
| --- | --- |
| Independent public API example | Own built-ins-only source/package/lock/config; source matched. |
| Fixed current owner and exact known assignment | Pre/post owner reads, immutable expected OTA/device/release IDs, optional project/generation rejection; source matched, runtime unverified. |
| Bounded observation and sanitized metadata | Two-second interval, five-minute budget, 150 polls, bounded JSON and selected timestamps/statuses; source matched, runtime unverified. |
| Historical ownership and atomic snapshot | Public provenance unavailable; partial, explicit operator authorization and false evidence labels. |
| Separate assignment reports from installation | Source and README match the narrower backend evidence; physical acceptance unverified. |
| No device or OTA writes | GET-only source, no grant/install/cancel paths; source matched. |
| `npm ci`; `node --check index.mjs` | Passed locally on Node 22.23.2; installation/syntax evidence only. |
| Runtime / failure paths / live API | Not tested or executed at the owner's creation-only request; unverified. |
| Hosted workflow | Path-filtered pinned Node/checkout, read permissions, install and syntax only; hosted result unverified. |

No cloud or device resources need cleanup. Remove private local configuration or
revoke its key when no longer needed; retain captured metadata under your policy.
