# Download one recording with Node.js

Download a selected recording's original stored bytes to a new local file. This server-side CLI uses the public API and Node built-ins. It checks the recording's identity and status, requests a short-lived URL, streams the response to a temporary file, then publishes the completed file without overwriting an existing destination.

**Status:** implemented with offline contract, file-system and loopback HTTP tests. An authorized synthetic live download passed with a trusted fixture hash and no-overwrite verification. The dedicated hosted workflow is pending. No device or App SDK is required.

## Setup

Use Node **22.23.2 or newer** and npm. Obtain a project secret or restricted key with **`recordings:read`**, and select a synthetic or consented recording in that project. Keep this credential in your terminal/server environment, never a browser or mobile application.

From this directory, independently of the root workspace:

```sh
npm ci
cp .env.example .env
```

PowerShell users can run `Copy-Item .env.example .env`. Edit the ignored `.env`:

| Variable | Meaning |
|---|---|
| `BOTA_API_BASE_URL` | Required HTTPS API base ending in `/v1`. Select the intended environment explicitly. |
| `BOTA_API_KEY` | Required server credential with `recordings:read`. |
| `BOTA_PROJECT_ID` | Required expected project ID, checked against the recording response. The key, not this value, determines API authorization. |
| `BOTA_RECORDING_ID` | Required `rec_*` recording selected by the operator. |
| `BOTA_END_USER_ID` | Optional `eu_*` ownership check. Blank allows any accessible recording in the configured project. |
| `OUTPUT_PATH` | Required new destination in an existing, trusted local directory. The sample uses `./recording.bin`. |
| `EXPECTED_SHA256` | Optional SHA-256 of the expected **original stored bytes**, obtained independently from a trusted fixture. Leave blank if unknown. |

Use a local file system supporting same-directory hard links. The example uses a hard link to publish a complete file without replacing an existing path; it does not fall back to an overwrite. POSIX temporary files have mode `0600`; Windows permissions depend on the directory's ACL. Treat downloaded recordings as private data. `.gitignore` excludes the sample `.bin` and partial files, but a custom destination or extension remains your responsibility.

## Run

```sh
npm run --silent start
```

Exit status 0 prints only this result shape:

```json
{
  "recording_id": "rec_example",
  "bytes_written": 1234,
  "sha256": "<64 hexadecimal characters>",
  "expected_sha256_matched": null
}
```

The hash describes the downloaded bytes. `expected_sha256_matched` is `true` only when the supplied trusted hash matched; `null` means no trusted hash was supplied. The download endpoint supplies no checksum. This example does not use `recording.content_sha256` as an assumed checksum of the returned object. Errors exit 1 with a bounded message and no success JSON, API response bodies, credentials or signed URLs.

The two API calls are `GET /v1/recordings/{id}` and `GET /v1/recordings/{id}/download-url`. The latter has **no `format` or `use_enhanced` parameters**. The bearer key is sent only to the API; the storage request has no API credential. Both API and storage require HTTPS and refuse redirects. Tests inject a loopback transport; there is no production HTTP bypass.

This example accepts `uploaded`, `processing` or `completed` recording status and checks exact recording/project IDs plus the optional end-user ID. This is a conservative sample restriction: other statuses are not attempted even if the download endpoint might permit them. The check is a point-in-time observation, not an atomic authorization snapshot across the later storage request.

## Original bytes and recovery limits

“Original” means the object currently referenced by the recording's storage key. The raw path does not convert, enhance or decrypt it. Depending on the stored object and its ingestion path, the bytes can be an encrypted container; a MIME type or recording status does not promise a playable plaintext audio file. Keep the `.bin` extension until your application independently knows the format. Requesting a URL does not prove the storage object exists or that download will succeed.

The example caps metadata at 256 KiB, downloads at **25 MiB**, each API request including its body at **10 seconds**, and applies a **120-second network deadline**, also checked between file operations. Filesystem settlement and cleanup may outlast that deadline. It accepts nonnegative safe-integer byte counts and canonical bounded decimal strings because deployed size fields can be serialized from database bigint values. It checks supplied lengths against streamed bytes, rejects empty files, partial HTTP responses and HTTP content encoding, and checks an optional trusted SHA-256 before publishing.

Ordinary request failures, cancellation, length/hash mismatch and output races close and remove this invocation's temporary file. Existing destination files are never replaced. If another process creates the destination during download, publication fails and preserves that file. An abrupt process kill or power loss may leave a hidden `.partial` file; inspect the selected directory and remove only a partial you know belongs to your invocation. No crash-durability or resume guarantee is made.

There is no automatic retry, range resume, URL refresh or cloud/device mutation. On an expired URL or network failure, correct the cause and rerun with a new destination or after checking that the intended destination does not exist. On 401/403, correct authorization; on 429, wait before rerunning. A cleanup error can occur after a completed file was published; inspect the directory before retrying. A successful download is not upload-verification proof and must not be used to delete device recordings.

## Verification and design review

```sh
npm run check
npm test
```

The public contracts are [Get Recording](https://docs.bota.dev/api-reference/recordings/get), [Download URL](https://docs.bota.dev/api-reference/uploads/download-url) and [OpenAPI](https://docs.bota.dev/api-reference/openapi). Their current schemas, public route permissions and original-download service were inspected on 2026-10-02. Bota One's download integration was used as a behavioral reference; no private helpers or runtime dependencies were copied.

| Requirement | Evidence | Status / remaining verification |
|---|---|---|
| Independent public example | Own manifest/lockfile, Node built-ins, fixed public routes and no sibling imports; clean-copy frozen install/check/tests | Matched locally on Windows / Node 22.23.2 |
| Scope and credential separation | Wrong identity/owner/status rejection; actual redirect traps; storage header checks; live API/storage credential separation | Matched in offline tests and the stated live success path; live rejection cases unverified |
| Bounded original download | Size/body/deadline checks, interrupted and stalled streams, trusted-hash rejection; live original-byte hash match | Matched in offline tests and the stated live download; live outage behavior unverified |
| Preserve files and clean partials | Existing-file check, concurrent destination race, partial cleanup assertions | Matched in offline tests; crash recovery intentionally outside scope |
| Safe runnable CLI | Child process with isolated `.env`, metadata-only JSON, safe errors and help | Matched in offline tests |
| Hosted acceptance | Workflow is path-scoped and uses no live credentials | Pending; local tests do not establish hosted success |

Local checks on Windows with Node 22.23.2 passed **21 tests**, including loopback HTTP redirect refusal and timeouts. Frozen installation, syntax checks and the same suite also passed in a standalone copy outside the repository. These tests contain synthetic bytes only.

At **2026-10-03 01:26:02 UTC** (October 2 local), an authorized live run downloaded a known synthetic fixture using two API GETs and one storage GET. Its **333,326 bytes** matched the independently known original SHA-256, and the storage request contained no API bearer. A second invocation with the same destination refused before making any request, preserving the file's hash. The run performed no cloud mutation, conversion, decryption or playback. This verifies the selected fixture, not the format or integrity of every stored object.

For your own authorized live smoke check, select a known synthetic recording, set its independently known original byte hash, and choose a fresh local destination. Confirm the returned byte count/hash, then rerun with that same destination to verify refusal before any network call. Remove only that downloaded local fixture when finished; the example creates no cloud resources to clean up.
