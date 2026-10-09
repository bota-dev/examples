# Inspect one firmware release (Node.js)

Read one exact public firmware release and print selected **declared** artifact
metadata. This project-operator example needs no device or end user. It makes
one `GET /v1/firmware-releases/{id}` using a server-held project key with
`devices:read`.

**Status:** implemented; source reviewed and dependency installation/syntax
checked on October 8, 2026. Runtime, failure paths and live API acceptance are
unverified. No functional tests, script execution, API requests or hardware
operations were run during this creation pass.

Requires **Node.js 22.23.2 or newer**. Only Node built-ins are used. This folder
installs independently; it needs no SDK package, sibling repository, root
workspace install or shared runtime helper.

## Configure and run

Supply an exact release ID and the intended project ID from a trusted operator
configuration. The API key must actually belong to that project. A restricted
key with `devices:read` is sufficient. Explicitly configure the HTTPS API origin
you trust before supplying the key; HTTPS alone does not identify the intended
service. Keep the key on your server and out of browser/mobile configuration,
logs and commit history.

```sh
npm ci
npm run check
cp .env.example .env
# Edit .env with your trusted origin, server key and exact IDs.
npm start
```

PowerShell equivalents:

```powershell
npm ci
npm run check
Copy-Item .env.example .env
# Edit .env with your trusted origin, server key and exact IDs.
npm start
```

`npm run check` performs syntax checking only and requires no credentials. Only
`npm start` executes the reader; it loads `.env` if present. Prefer deployment
secret injection over a local file. There are no built-in keys or cloud IDs.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required fixed trusted HTTPS origin ending in `/v1`; no URL credentials, query or fragment |
| `BOTA_API_KEY` | Required server-held key for the intended project with `devices:read` |
| `BOTA_PROJECT_ID` | Required expected `proj_*` project; operator configuration, not an authorization credential |
| `BOTA_FIRMWARE_RELEASE_ID` | Required exact opaque `fw_*` release ID |

Success prints a `release` object with `id`, `version`, `is_released`,
`bin_sha256`, `bin_file_size_bytes`, `ufw_sha256` and `ufw_file_size_bytes`, plus
the optional `release_sequence`/`allow_downgrade` pair, and sets
`declared_metadata_only: true`. Protect stdout as operational metadata;
`firmware.json` is ignored if you redirect output there. Changelog, storage
paths, URLs, credentials, publisher fields, timestamps and arbitrary upstream
response/error fields are excluded.

## Contract and interpretation

The returned release ID must match the configured ID and `is_released` must be
`true`. Version text is a bounded, control-free string of 1–128 characters; it
is preserved unchanged, without requiring semantic-version syntax, sorting or
inferring the latest release. The optional sequence must be a positive safe
integer and its downgrade flag must be a boolean. That pair is observed
metadata, not rollback authorization.

Both BIN and UFW hashes must be 64 hexadecimal characters. Both declared sizes
must be positive JavaScript safe integers (1–9,007,199,254,740,991). Missing,
null, zero, fractional, string and unsafe numeric sizes are rejected. The
reviewed public serializer emits numbers: its repository explicitly normalizes
PostgreSQL BIGINT values to Number. The service catalogue requires non-null
hashes and positive integer sizes for both artifacts; nullable fields in the
separate delivery-resolution type do not establish a nullable release-detail
contract. No nullable or decimal-string wire extension is invented here.

The current public serializer omits `project_id` and model identity. If a
response nevertheless includes `project_id`, it must equal the configured
project; any contradiction fails. With the field absent, the key's authenticated
scope is the project boundary. Setting `BOTA_PROJECT_ID` cannot prove which
project an arbitrary key belongs to. Confirm that mapping through your trusted
key administration before running. This reader cannot independently establish
project approval or model compatibility.

In backend source `1ac67c92`, the handler calls
`getPublishedById(auth.organizationId, id, auth.projectId)`. For service-backed
references, it checks the project's selected release and revalidates current
upstream availability and immutable artifact/version/hash/size identity. The
legacy branch checks organization ownership and the stored published flag;
it does not use the service project-selection policy. A successful GET is a
current API eligibility observation under those handler rules. The reader
makes no exhaustive catalogue, atomic approval snapshot or future-delivery
claim.

Declared hashes and sizes do not verify downloaded-byte integrity, signatures,
secure boot, image reachability, physical model compatibility or installation.
The reader obtains no download URL or artifact bytes, requests no OTA grant or
assignment, promotes no release and performs no writes or device/hardware
calls. A release being readable does not authorize those separate operations.

## Bounds and failures

The single GET uses a 10-second abort budget covering fetch and response-body
reading, rejects redirects and makes no automatic retry. It accepts only
uncompressed `application/json`, strictly decodes UTF-8 and bounds the body to
1 MiB before parsing. The stream is cancelled on completion or failure. The
timeout relies on Node's event loop and networking implementation; it is not a
strict whole-process wall-clock guarantee. There is no polling or pagination.

Exit 0 means the selected metadata passed validation. Failure exits 1 with a
sanitized stderr message and no selected output. HTTP status numbers may be
reported; upstream bodies, exception traces, keys and URLs are not. No cloud
cleanup is needed; retained local output follows your metadata policy.

## October 8 compound-engineering review

The review compares the source with repository architecture sections 1–3 and
the public [release detail](https://docs.bota.dev/api-reference/firmware/get),
[release fields](https://docs.bota.dev/api-reference/firmware/list) and
[firmware update guide](https://docs.bota.dev/guides/firmware-updates).
Read-only backend source at `1ac67c92` clarified serializer fields, numeric
sizes, non-null catalogue artifacts and service-versus-legacy eligibility.
These are review sources, not runtime dependencies.

| Requirement | Evidence and status |
| --- | --- |
| Independent public operator workflow | Own source, manifest/lock, env template and workflow; one exact public GET; source matched |
| Exact release/project boundary | ID/released checks, contradictory project rejection and trusted key configuration; source matched; independent key-project proof unavailable |
| Declared artifact contract | Non-null 64-hex hashes and positive safe numeric sizes; optional typed sequence/downgrade pair; source matched, runtime unverified |
| Read-only metadata output | Selected fields only; no downloads, delivery, promotion or device operations; source matched |
| Bounded failures | 10-second signal, 1 MiB body, strict UTF-8 JSON, no redirects/retry, sanitized errors; source matched, runtime unverified |
| Dependency installation and `npm run check` | Passed with Node 22.23.2 / Windows; installation and syntax only |
| Runtime, authorization/failure paths and live API | Not run at the owner's creation-only request; unverified |
| Hosted workflow | Path-filtered install/syntax checks configured; hosted result unverified |
| Byte integrity, signatures, model compatibility, reachability and installation | Outside this metadata reader; no proof supplied |
