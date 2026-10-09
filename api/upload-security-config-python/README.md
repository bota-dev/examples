# Read upload-security configuration (Python)

Observe the resolved encrypted-upload policy for one currently bound device
owned by a fixed end user using Python's standard library and public GETs.
The result is selected cloud policy metadata. This example changes no policy,
negotiates no upload profile and transfers no recording bytes.

Status, **2026-10-08**: implemented with source review and syntax compilation
only. Runtime, functional, live API and physical-device acceptance are
unverified. The owner requested creation without tests or runtime CLI/API/device
calls; no unit or functional tests were added or run.

## Prerequisites and configuration

- Python 3.12 or newer on Windows, macOS or Linux; no packages to install,
  SDK dependency, sibling import or hardware access is required.
- An operator-selected trusted HTTPS API and a server-held project secret or
  restricted key. Restricted keys need **`devices:read` and `config:read`**.
- Exact expected project, authorized end user and existing bound device IDs.

Work from this directory. `.env.example` documents process variables;
`main.py` does **not** load `.env` files. Set real values through your shell or
secret manager. Keep credentials and real identifiers out of Git and logs.

| Variable | Meaning and trust boundary |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS destination ending in `/v1`, normally `https://api.bota.dev/v1`. No whitespace, controls, backslashes, credentials, query or fragment; never accept it from an app caller. |
| `BOTA_API_KEY` | Server-only project `sk_test_*`, `sk_live_*` or restricted `rk_*` key with both read scopes. |
| `BOTA_PROJECT_ID` | Expected `proj_*` project. This assertion cannot switch the API key's authenticated project. |
| `BOTA_END_USER_ID` | Fixed operator-authorized `eu_*` current owner. |
| `BOTA_DEVICE_ID` | Exact existing `dev_*` device expected to be currently bound to that owner. |

After configuring the environment, run from the repository root on Windows:

```powershell
cd api/upload-security-config-python
py -3.12 main.py
```

On macOS/Linux:

```sh
cd api/upload-security-config-python
python3 main.py
```

A copied standalone directory works with the same configuration. An app-facing
backend must derive project/end-user scope from authenticated caller identity
and authorize the device before returning selected metadata. Keep both the key
and API destination server-side; this CLI's fixed IDs are not a general caller
authorization layer.

## Read and output contract

The program makes exactly three GETs, once each, then emits selected output:

1. `GET /v1/devices/{id}` checks exact device/end-user IDs and `status: bound`.
   Optional `project_id` must match and optional `deleted_at` must be `null`.
2. `GET /v1/devices/{id}/config/upload_security` accepts the direct section
   **`{ value, source, definition }`**, without an all-sections `data` wrapper.
   Optional section project/deletion markers receive the same checks.
3. Repeat the owned-device read. When `binding_generation` is available, it
   must be an actual integer in `0`–`9007199254740991` and remain equal. A
   generation appearing, disappearing or changing rejects the observation.

Some public device responses omit project, deletion and generation fields.
The authenticated project key and API's project authorization remain the trust
boundary; missing generation cannot detect a rebind. These are separate reads,
not continuous ownership or an atomic snapshot. A current owner observation
does not authorize historical recordings from a previous binding generation.

`selected_upload_security` contains only `encrypted_upload_policy`, which must
be exactly `legacy_allowed`, `v2_preferred` or `v2_required`. Missing, null and
unknown values fail. The server schema currently defaults to `legacy_allowed`,
but this client never fills a missing value or uses that default to recover an
error. No policy is converted into upload/fallback permission.

The output `source` is the section's last participating override level: exactly
`default`, `organization`, `project` or `device`. The security-owned schema does
not admit end-user overrides. `definition.merge_strategy` must be `merge_deep`.
The reviewed resolver separately applies per-field **`ordered_max`** in the
order `legacy_allowed < v2_preferred < v2_required`, so lower-scope overrides
cannot weaken a stricter ancestor. That behavior is source evidence, not a
client merge implementation: the direct section metadata exposes the section
merge strategy, not the per-field order. The last section override may therefore
name a level that did not supply the retained strictest policy; it is **not
field provenance** or evidence that the client verified the merge calculation.

The evidence label is `resolved_cloud_configuration`. `atomic_snapshot`,
`device_enforcement_verified`, `recording_encryption_verified`,
`device_capability_verified`, `upload_authorization_verified`,
`upload_acceptance_verified`, `cloud_commitment_verified`, `integrity_verified`
and `device_cleanup_authorized` are all `false`. A resolved `v2_required` value
does not establish desired/applied policy delivery, firmware enforcement or
the negotiation needed for any recording. The target security design requires
separate durable enforcement and capability evidence. A `legacy_allowed` or
`v2_preferred` observation is not permission to downgrade or send plaintext
after an encrypted-upload failure.

No response definitions, defaults, security keys, tokens, grants, arbitrary
device/config fields, signed URLs or recording content are printed. There are
no writes, context/grant/session creation, fallback, commitment, receipt relay,
SDK/device operations or recording deletion.

## Failure and recovery

Responses must be uncompressed UTF-8 `application/json`, at most 1 MiB each.
Duplicate keys, nonstandard constants and floating-point overflow to non-finite
numbers are rejected. Requests have a 10-second elapsed-time budget inside one
30-second read budget, socket timeouts and connected-transport interruption
for slow headers/bodies. OS DNS resolution is outside Python's socket timeout
control and may delay termination beyond either budget. Redirects and automatic
retries are rejected. No responses are saved; error bodies and exception details
are not logged.

Any HTTP, scope, owner, generation, section, policy or deadline failure exits
nonzero before selected metadata is emitted. Correct access/configuration or
network problems, then deliberately rerun this GET-only workflow when ready.
Failure does not authorize policy changes or a weaker upload path. No cloud
resources or recordings are created, so cleanup is unnecessary.

## Checks and design review

Compile without executing the CLI or its functions:

```sh
python3 -m py_compile main.py
```

Windows equivalent: `py -3.12 -m py_compile main.py`. The independent
[`upload-security-config-python.yml`](../../.github/workflows/upload-security-config-python.yml)
uses Ubuntu 24.04's Python, a commit-pinned checkout, disabled credential
persistence, read-only repository permissions and syntax compilation only.
There are no live credentials or runtime tests in that workflow.

Compound-engineering 1.2.9 review, **2026-10-08**:

| Requirement | Implementation evidence | Status / remaining verification |
| --- | --- | --- |
| Standalone public read | Standard-library imports; three fixed GETs | Matched by source review; execution unverified |
| Server project/owner boundary | Trusted destination/key; exact bound owner; strict optional project/deletion and stable available generation | Matched by source review; deployed authorization and failure behavior unverified |
| Narrow security policy | `select_policy`: exact enum, supported source levels, required direct section and `merge_deep`, no local default | Matched against public guide and backend schema/resolver; deployed response unverified |
| Source metadata limitations | `source_meaning`, constant evidence flags and no inference from resolved policy to applied enforcement | Matched by source/design review; security delivery, negotiation and hardware evidence outside scope |
| Strict bounded failures | UTF-8 JSON, duplicate/non-finite rejection, 1 MiB response, 10/30-second budgets, no redirects/retries | Matched by source review; runtime failures unverified; DNS limitation above |
| Syntax | Bundled Python 3.12 `py_compile main.py` on Windows | Passed locally; compilation does not execute the program |
| Formatting | `git diff --check` scoped to this directory/workflow | Passed locally |
| Hosted CI | [Separate syntax workflow](https://github.com/bota-dev/examples/actions/runs/37896123514) | Passed at implementation `50279b28e58e8cd385df93a740a7cbf1f3567c3c`; compilation only |
| Unit/functional/live/device acceptance | Owner's creation-only instruction | Not run; advertised success/failure behavior remains unverified |

Public contract basis: [Hierarchical Configuration](https://docs.bota.dev/guides/hierarchical-config)
and [Encrypted Upload v2](https://docs.bota.dev/api-reference/uploads/encrypted-v2),
reviewed at documentation source `76b0a4f`. Repository requirements are in
[ARCHITECTURE.md](../../ARCHITECTURE.md). Neither source proves deployment.

Maintainer-only backend review at `1ac67c92` covered
[`devices/index.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/devices/index.ts),
[`config/controller.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/routes/v1/config/controller.ts),
[`config.service.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/services/config.service.ts)
and [`definitions/upload-security.ts`](https://github.com/bota-dev/bota/blob/1ac67c92/api/src/config-schema/definitions/upload-security.ts).
Both read scopes are enforced on their respective routes, and the child section
controller resolves against the authenticated expected project. Privileged
security rollout/write permissions are separate and unused here.

The [Hierarchical Configuration design](https://github.com/bota-dev/internal-docs/blob/main/Hierarchical%20Configuration%20Management%20Design.md)
and [Encrypted Upload v2 policy design](https://github.com/bota-dev/internal-docs/blob/main/device/Encrypted-Upload-v2.md#6-backend-downgrade-policy)
require strictest-policy resolution and separate desired/applied enforcement;
[Upload Management](https://github.com/bota-dev/internal-docs/blob/main/device/Upload-Management.md)
separates cloud commitment from signed-receipt device cleanup. These private
references are optional maintainer evidence, not runtime prerequisites. This
example closes no platform enforcement, upload integrity or deletion gate.
