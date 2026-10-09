# Rename one device with Python

Learn to change only an owned device's cloud `name`, keeping durable intent before one PATCH and observing later state without repeating an uncertain write.

Implemented with Python's standard library. Source review and syntax compilation are the evidence for this creation batch; functional, live API and device acceptance are **unverified**. No settings, firmware, binding, command, recording or physical device operation is performed. This is a server-side teaching CLI, not a web/mobile endpoint.

## Prerequisites and configuration

Use Python 3.12+ on Linux, macOS or Windows with SQLite support, a trusted HTTPS API environment and an independently assigned project secret/restricted key with `devices:read` and `devices:write`. No SDK package, hardware, firmware version or third-party Python dependency is required. Keep all values server-side. Authenticate and authorize your application's caller separately before selecting the fixed project/end-user/device configuration.

The device must already be `bound` to the configured end user. Independently coordinate all name and device ownership writers while performing this workflow. The public PATCH has no owner/generation precondition, compare-and-swap or idempotency contract; owner observations cannot close the race between a read and the write. The inspected backend updates by project/id, without a deletion/owner/generation predicate. This sample cannot guarantee it never writes across a concurrent unbind, reset, deletion or rebind. Do not use it when that guarantee is required; a server-side conditional update is the needed platform capability.

From this directory, configure the environment using [.env.example](.env.example). This program does **not** load `.env` files.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS `/v1` base, without credentials, query, fragment, whitespace, controls or backslash |
| `BOTA_API_KEY` | Project secret/restricted key; never a device token or client-side key |
| `BOTA_PROJECT_ID` | Independently assigned expected `proj_*` project; contradictory returned project IDs fail |
| `BOTA_END_USER_ID` | Fixed authorized `eu_*` owner |
| `BOTA_DEVICE_ID` | Exact existing `dev_*` cloud ID; no hardcoded serial number |
| `BOTA_NAME_FILE` | Private UTF-8 input file; default `name.txt` |
| `BOTA_JOURNAL_PATH` | Private durable SQLite intent; default `.state/rename.sqlite` |

Create a trusted private local directory **before** running. On POSIX it must belong to your account with permissions `0700`; the name file must be owned by you with no group/other permissions (`0600` is suitable). On Windows, restrict directory and file ACLs to your service account using your organization's ACL procedures; Python mode bits do not enforce or inspect Windows ACLs. The process checks real parent directories, regular files, no final-component symlink, and single file hard-link count. All ancestor paths must remain trusted and stable, and no other process may replace paths or alter the input/journal during execution. Use a filesystem that honors SQLite locking and durable writes, not network/sync-backed storage.

The input is **exact text**: no trimming, newline or BOM removal, or Unicode normalization. The API's inspected Zod schema is `z.string().max(128)`, counting JavaScript UTF-16 code units and allowing an empty name. An empty UTF-8 file therefore clears the name to the empty string (not JSON `null`); a trailing newline becomes part of the name. Supplementary Unicode characters count as two units. Input must be valid scalar UTF-8, at most 512 bytes and 128 UTF-16 units. The sample deliberately rejects U+0000 before journaling or any network call: Zod's maximum-length rule alone accepts NUL, but PostgreSQL text cannot store it. Other whitespace and BOM text remain exact. Do not put sensitive data in device names.

For example, create the file with an editor that preserves your intended bytes and set environment variables in your shell. On POSIX:

```sh
mkdir -m 700 .state
printf '%s' 'Front desk pin' > .state/name.txt
chmod 600 .state/name.txt
export BOTA_API_BASE_URL=https://api.bota.dev/v1
export BOTA_API_KEY='sk_test_REPLACE_WITH_YOUR_SERVER_KEY'
export BOTA_PROJECT_ID='proj_REPLACE_WITH_YOUR_PROJECT'
export BOTA_END_USER_ID='eu_REPLACE_WITH_YOUR_OWNER'
export BOTA_DEVICE_ID='dev_REPLACE_WITH_YOUR_DEVICE'
export BOTA_NAME_FILE="$PWD/.state/name.txt"
export BOTA_JOURNAL_PATH="$PWD/.state/rename.sqlite"
python main.py
```

Replace the placeholder IDs/key with actual trusted values; placeholder strings are rejected. On Windows set the same values through `$env:VARIABLE`, using absolute paths and a private directory with the required ACLs. No install command is needed.

## Outcome and recovery

The only write is `PATCH /v1/devices/{id}` with JSON body `{ "name": <exact input> }`. Device GETs must return the exact ID, bound status and fixed owner, absent/null deletion marker, and no contradictory optional project. Any supplied `binding_generation` must be a nonnegative safe JSON integer. Its value or absence is retained before the PATCH and must remain identical through the acknowledgment and final read, and through later reconciliation. Appearance/disappearance fails. Missing generation does not prove uninterrupted ownership; even a stable observed generation is separate-read evidence, not an atomic write precondition or historical authorization proof.

Success prints only the device ID and selected Boolean evidence:

```json
{
  "device_id": "dev_example",
  "validated_patch_acknowledgment": true,
  "observed_name_matches": true,
  "binding_generation_observed": true,
  "atomic_ownership_check": false,
  "physical_name_verified": false
}
```

Actual names, hashes, credentials, URLs, journal/input paths, serial numbers, settings and arbitrary API errors are never printed. A later observed match cannot identify which writer caused that name. A stored validated acknowledgment means this CLI once received a well-formed HTTP 200 with matching scope/generation/name; it does not prove the current value remains its own write or that hardware adopted any name.

Before any network call a newly created journal stores canonical origin/project/owner/device/exact-name SHA-256 intent (excluding the key). A `BEGIN IMMEDIATE` transaction with `synchronous=FULL` claims uncertainty before the sole PATCH. A validated acknowledgment is committed separately. Existing intent in **any** phase, including prepared intent from a crash before PATCH, permits GET reconciliation only. Concurrent processes sharing the same stable journal cannot each claim a write; coordination with external API writers remains required.

Timeout, HTTP failure, malformed response, changed ownership or a crash may leave an uncertain result even if the server changed the name. Preserve the journal and exact input/configuration. Rerun to perform GETs only. Exit `0` requires a retained validated acknowledgment and a final observed name match; exit `2` emits selected evidence with uncertainty/mismatch, and exit `1` indicates a rejected observation/configuration or operational failure. No result triggers a retry. The journal may conservatively block a write that never reached the server. Never delete, edit or replace intent to force another PATCH; investigate through your authorized operator process and explicitly coordinate a distinct future operation.

Retained journal schema/version, integrity, one-row state and fingerprint are validated. Existing corrupt, empty, mismatched or unsupported journals are rejected without repair or overwrite. Fresh-file POSIX parent-directory fsync precedes any network call; Windows directory durability and physical power-loss behavior are unverified. SQLite durability depends on filesystem/OS guarantees. The private name file and journal remain after completion. No cloud resource is created or deleted; no automatic rename reversal or cloud cleanup is performed.

## Bounds and evidence

The operation has a 40-second network-work deadline; each API connection/body has a 10-second budget. Responses are bounded to 1 MiB, strict UTF-8 JSON, duplicate-key/non-finite-number rejection, HTTP 200 and uncompressed `application/json`. No HTTP redirect or automatic retry is followed. System DNS, local filesystem calls and SQLite's up-to-five-second lock wait are not interruptible by the HTTP timer, so the CLI has no strict process-wall-clock guarantee.

Run a syntax check without running the CLI:

```sh
python --version
python -m py_compile main.py
```

The path-filtered workflow performs only this syntax compilation. It uses no API credentials.

| Requirement / reference | Evidence, 2026-10-08 | Status / remaining check |
| --- | --- | --- |
| Independent server-side workflow | Own source/config/ignore/README; standard library only | Matched by source inspection |
| Public name-only PATCH | Public Update/Get Device pages; controller parses schema; service/repository persist name by project/id | Matched in inspected source; deployed behavior unverified |
| Exact name semantics | UTF-16 max128, no trim/min, UTF-8 scalar input; NUL rejected before journal/network for database compatibility | Intentionally narrower than Zod for NUL (parent-requested review correction); functional cases not run |
| Current ownership/generation gates | `check_device` before PATCH, on acknowledgment and final GET; retained generation checked | Partial: observation gates implemented; server CAS absent, physical/historical ownership unverified |
| Single write / durable uncertainty | Exclusive journal, exact schema, FULL/IMMEDIATE transactions, pre-PATCH claim, retained GET-only | Implemented; crash/concurrency/filesystem tests not run |
| Bounded private output | Fixed ID/Boolean projection and sanitized errors | Matched by static review; runtime rejection checks not run |
| Python 3.12 compilation | Bundled Python 3.12, `python -m py_compile main.py` passed locally | Syntax matched; no runtime/API/device tests |

Contracts: [Update Device](https://docs.bota.dev/api-reference/devices/update), [Get Device](https://docs.bota.dev/api-reference/devices/get), [API authentication](https://docs.bota.dev/authentication). The implementation review inspected backend `1ac67c92c6d72858e29dc264037cb82b6c449825`, `api/src/routes/v1/devices/{index,validation,controller}.ts`, `api/src/services/device.service.ts` and `api/src/repositories/device.repository.ts`; these are maintainer evidence, not runtime dependencies. Public pages omit optional `project_id`/`binding_generation` shown in that source; absent fields retain the stated limits. Scope middleware explicitly requires `devices:read`/`devices:write`; deployed authorization is unverified. No platform fix or target binding/lifecycle conformance is claimed.
