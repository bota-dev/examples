# Export completed transcription JSON (Node.js)

Read one existing completed transcription and publish its full text and selected
segments as a private UTF-8 JSON file. The script checks the exact source
recording and configured end-user ownership before reading content and again
immediately before publishing. It uses public GETs only and starts no job.

**Status:** implemented; independent install and syntax checked on Node 22.23.2
on Windows, October 8, 2026. Runtime, live API, malformed-response handling and
filesystem failure paths remain unverified. This creation pass includes no test
suite or CLI/API execution. No SDK package, audio download or hardware is needed.

## Prepare and run

Use a server-held key in the intended project with **`recordings:read`** and
**`transcriptions:read`**. Choose an existing completed transcription, its exact
recording, and the fixed authorized end user. Use synthetic or consented content;
transcript text and speaker labels can be sensitive. Do not distribute this
project key in a mobile/browser app. In a service, derive the permitted IDs and
owner from authenticated caller context, rather than accepting client choices.

From this directory with Node **22.23.2 or newer**:

```sh
npm ci
cp .env.example .env
# Fill the blank values with authorized resources and the trusted API origin.
mkdir -m 700 private-export
npm run check
npm start
```

On PowerShell, use `Copy-Item .env.example .env` and
`New-Item -ItemType Directory private-export`. Establish and verify a private
Windows directory ACL before exporting sensitive content. Creating a directory
or setting POSIX mode bits alone does not establish private Windows access.
There are no third-party dependencies or sibling repository imports. Install
and syntax checks do not access the API; `npm start` reads the cloud content.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Fixed, independently trusted HTTPS API origin ending in `/v1`; no whitespace, controls, backslashes, URL credentials/query/fragment or redirects |
| `BOTA_API_KEY` | Server-held secret/restricted project key with both read scopes |
| `BOTA_PROJECT_ID` | Required exact expected `proj_` ID followed by 1–64 alphanumeric characters; a returned project field must agree |
| `BOTA_END_USER_ID` | Required fixed authorized owner, matching the recording |
| `BOTA_RECORDING_ID` | Required exact source recording |
| `BOTA_TRANSCRIPTION_ID` | Required existing completed transcription |
| `OUTPUT_PATH` | Required new `.json` destination in an existing trusted private directory |

The default `private-export/` directory, `.env`, `node_modules/` and partial files
are ignored locally. If using another destination, keep it outside Git or add an
ignore rule before running. Keep `.env` private and out of logs/backups as needed.
The API base and key are operator configuration; URL syntax validation does not
establish that a host is trusted.

Success prints only `Exported completed transcription JSON.` to stdout. The
destination, identifiers and transcript content are not printed. A synthetic
output shape is:

```json
{
  "id": "txn_example",
  "recording_id": "rec_example",
  "status": "completed",
  "full_text": "Hello.",
  "segments": [
    { "start": 0, "end": 0.75, "text": "Hello.", "speaker": "SPEAKER_0" }
  ]
}
```

## Content and authorization boundary

The sequence is `GET /v1/recordings/{id}`, `GET /v1/transcriptions/{id}`, stage
the validated output, then `GET /v1/recordings/{id}` again before publication.
Every recording read requires the exact ID and configured `end_user_id`, rejects
`status: deleted`, and accepts `deleted_at` only when absent or null. The job
must have the exact transcription ID, exact `recording_id`, and
`status: completed`. Returned `project_id` fields, when present, must equal the
expected project; null or another value fails. The public GET schemas omit
project/deletion fields, so their absence is accepted. A returned transcription
`deleted_at` also must be null. The project key provides
the server authorization boundary. There is no additional project lookup.

These reads are **non-atomic**. The final observation narrows the race but cannot
prevent changes between the API read and local publication. Nor does it prove
historical authorization, uploaded-byte integrity or authority to delete device
recordings. Current ownership is observed through the recording, not a new
end-user lookup. Use a stronger server contract if your application requires an
atomic authorization/content snapshot.

`full_text` must be a string with at most 500,000 UTF-16 code units. An empty
string is retained; null is rejected. `segments` must be null or an array of
0–5000 entries. Null and an empty list are retained without inferring missing
segments from the full text. Each selected segment requires finite numeric
`start` and `end` in **seconds**, both nonnegative, with `end >= start` and
`end <= 604800` (168 hours). This duration bound is an example limit, not an API
quota. Segment text is bounded to 10,000 UTF-16 code units; a present speaker
must be a string of at most 256 code units. Selected strings must contain valid
Unicode scalar values; malformed UTF-8 responses or unpaired JSON surrogate
escapes fail before output.

The original array order, text, labels and timestamp numbers are retained.
Overlaps, unsorted starts and zero-duration segments are allowed; the public
contract does not establish a global ordering/non-overlap constraint. JSON
escaping and whitespace formatting change the file representation, not the
decoded strings. Speaker labels do not establish a person's identity. The sample
does no ASR, translation, diarization, alignment, timestamp rounding, SRT
conversion or word-timing inference. It does not compare full text against
segments or fetch audio to validate either.

Provider, language, word count, confidence, errors, audio URLs, timestamps and
arbitrary extra response fields are omitted. The output is a selected example
shape, rather than a full API resource backup or integrity certificate.

## Bounded reads and private publication

One 30-second abort deadline covers API requests/body reads and is checked
through publication. Filesystem operations can still be non-interruptible. Each
decoded API response must be HTTP 200 JSON with valid UTF-8, at most 2 MiB. Selected JSON
is fully validated/serialized in memory and bounded to 4 MiB before writing.
Redirects, retries and polling are absent. Failure messages omit credentials,
upstream response bodies, transcript content and raw exception details.

The existing output parent must be a regular directory without a symlink. On
POSIX it must belong to the process user and have no group/other permission bits
(for example `0700`). On Windows, the operator must establish a private ACL;
this sample does not inspect or configure ACLs. Trust all ancestors and prevent
local actors from replacing directories during execution. This implementation
does not defend against concurrent parent/ancestor replacement.

The script creates an exclusive random `.partial` file beside the destination
with mode `0600` where supported, writes the full payload, calls file `fsync`,
closes it, and rechecks ownership. A same-directory hard link then publishes
complete bytes while refusing **any** existing destination, including files and
dangling symlinks. The filesystem must support hard links. Only this invocation's
successfully created partial is removed. Existing destinations are never
deleted or overwritten, even to retry.

File `fsync` does not sync directory entries or guarantee power-loss durability.
A crash can leave a private partial. Cleanup failure can occur after the final
output exists: exit 0 means publication and partial cleanup finished, while exit
1 requires inspecting the trusted private directory before retrying. Apply your
retention policy to local content; the exporter changes no cloud/device state.

## October 8 design review and evidence

The compound-engineering review compares source against the repository
architecture's independent-example/private-export requirements and the public
[Get Recording](https://docs.bota.dev/api-reference/recordings/get),
[Get Transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get)
and `Transcription`/`TranscriptionSegment` OpenAPI schemas. Backend model,
service, controller, repository and provider-type inspection at `1ac67c92`
corroborates project scoping and the segment shape/second-based timing; it is
source evidence, not deployed behavior or a dependency of this example.

| Requirement | Implementation / evidence | Status and remaining checks |
| --- | --- | --- |
| Independent public GET workflow | Own manifest/lock, Node built-ins, explicit recording/transcription endpoints; `npm ci` and `npm run check` passed on Node 22.23.2 / Windows | Matched for setup/syntax; runtime API acceptance unverified |
| Exact source/project/owner and completed result | Configured IDs; pre-read and final owner check; strict present deletion/project fields; completed exact job | Matched by source review; rejection/race cases unverified; reads remain non-atomic |
| Selected bounded JSON content | Full text and only start/end/text/optional speaker; Unicode validation; retained seconds/order/overlaps; null segments supported | Matched by contract/source review; serialization and malformed-response execution unverified |
| Private no-overwrite publication | Existing trusted parent, POSIX owner/mode gate; exclusive 0600 partial, full write/fsync, final owner read, hard link, own-partial cleanup | Matched by source review; filesystem/collision/crash execution unverified; Windows ACL is operator responsibility |
| Minimal disclosure and bounded failure | Single deadline, bounded body/output, no raw errors or content on stdout, no retries/writes/jobs/audio | Matched by source review; failure handling execution unverified |
| Focused CI | Path-filtered workflow, pinned actions/Node, read-only permissions; install/syntax only | [Passed at source `2752a79`](https://github.com/bota-dev/examples/actions/runs/37887199918); runtime acceptance unverified |

No functional tests, live API calls, content export, deployment or physical-device
operations were run for this creation pass. Upload integrity and device cleanup
are outside this export contract. The root catalog and cross-repository public
guidance are maintained by the owning documentation review.
