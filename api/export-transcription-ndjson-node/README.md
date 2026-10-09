# Export transcription segments as NDJSON (Node.js)

Read one existing completed transcription's supplied segments and publish a
private UTF-8 NDJSON file without overwriting a destination. The source
recording's exact current end-user ownership is checked before reading the
transcription and again immediately before publication. Only three public GETs
are used. This workflow creates no jobs, downloads no audio, and performs no
device operations or cloud mutations.

**Status:** implemented with source review and syntax verification on October 9,
2026 Pacific. Runtime, API/failure paths, filesystem and consumer acceptance
remain unverified. This creation pass includes no tests or example execution.
Node.js **22.23.2 or newer** and Node built-ins are sufficient. The example owns
its manifest and lockfile; no hardware, SDK, root install or sibling code is needed.

## Configure and run

Use a server-held project API key with **`recordings:read`** and
**`transcriptions:read`**. Independently confirm the key's project and the fixed
end user's authorization to receive the recording/transcript content. Choose
one existing completed transcription with supplied segment timing. Keep inputs
in trusted server configuration; IDs supplied by an unauthenticated caller are
not access authorization. Use synthetic or consented content and appropriate
private retention. Keep the key out of browser/mobile applications.

From this directory:

```sh
cp .env.example .env
# Replace placeholders before starting the export.
npm ci
npm run check
npm start
```

PowerShell uses `Copy-Item .env.example .env`. `npm start` loads the local `.env`
with Node's `--env-file-if-exists`; environment variables may also be supplied
directly. No CLI arguments are accepted. `npm run check` parses source without
credentials or API access. Starting the example reads transcript content and
publishes a private local file.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS API origin ending in `/v1`, without URL credentials, query/fragment delimiters (even empty), whitespace, controls or backslashes |
| `BOTA_API_KEY` | Server-held secret/restricted project key with both read scopes |
| `BOTA_PROJECT_ID` | Fixed expected `proj_` ID; optional returned project markers must match |
| `BOTA_END_USER_ID` | Fixed authorized `eu_` source recording owner |
| `BOTA_RECORDING_ID` | Exact expected `rec_` source recording |
| `BOTA_TRANSCRIPTION_ID` | Exact existing completed `txn_` linked to that recording |
| `OUTPUT_PATH` | New `.ndjson` file in an existing private directory, without `..` traversal |

Provision the output directory separately. On POSIX it must belong to the
process user with no group/other permissions (for example `mkdir -m 700
private-export`). Each ancestor must be a directory without symlinks, owned by
root or the process user, and not writable by group/other users. A world-writable
ancestor such as `/tmp` fails this check. On Windows, provision private ACLs and
trusted ancestry first: mode `0600` does not configure Windows ACLs, and Node's
symlink check does not establish the absence of every type of reparse point.
The operator must exclude reparse points and concurrent path writers. Same-directory
hard links must be supported. These checks do not provide a filesystem sandbox.
`.env`, NDJSON files, partials and the default private directory are ignored.

## Local NDJSON format

The file contains one selected JSON object per supplied segment, followed by a
single LF. Its fields are `index`, `start`, `end`, `text`, plus `speaker` only
when the API supplied that property. Indices start at 1. Start/end are numeric
seconds. A supplied speaker string, empty string or null is retained; a missing
speaker stays absent. No speaker label is inferred.

The completed transcription must supply `segments` as a non-null array of
**0–20,000** items. An empty array explicitly creates a **zero-byte file**.
Missing/null segments fail rather than substituting `full_text`. Every segment
must supply finite nonnegative numeric start/end values, a string `text`, and
an optional string/null `speaker`. Booleans and numeric strings fail. Starts
must be nondecreasing and each end must be strictly after its start. Equal starts
and overlapping intervals stay in supplied order. No sorting, timing inference,
speaker attribution, provider defaults or extra rounding occurs.

`JSON.parse` converts source numbers to JavaScript's IEEE-754 `Number` values.
`JSON.stringify` serializes those finite values with its native round-trip
representation; a supplied negative-zero start is explicitly preserved as `-0`.
Original number spellings may change, and decimal precision or large integers
can already change during JSON parsing. This is not exact preservation of an
arbitrary source decimal token, and provider timing is not aligned against audio.

String values must be well-formed Unicode; unpaired surrogates fail. Original
combined UTF-8 `text` and string `speaker` values are bounded to **4 MiB**. Native
JSON serialization escapes quotes, backslashes, CR/LF and ASCII control characters;
the exporter also escapes U+0085, U+2028 and U+2029. Thus retained newlines and
controls stay within a single physical JSON line without changing the string
value when parsed. The file is UTF-8 without a BOM and has no header or IDs.
Total output, including JSON escaping and LF delimiters, is bounded to **8 MiB**.
No confidence, title, full transcript, provider, URL or arbitrary response field
is exported.

NDJSON is this example's **local interchange format**, not a Bota upload or
reimport API contract. Use a JSON-aware consumer and keep the file private.
Parsed string values remain untrusted content; safely handle them when rendering
or forwarding them. No consumer execution, content accuracy or universal viewer
safety is established by this source-only creation pass.

## Ownership, bounds and private publication

`GET /recordings/{id}` must match the exact configured recording and
`end_user_id`, with no non-null deletion marker or deleted status. The
transcription GET must match the exact configured transcription, source
`recording_id` and `completed` status, with the same optional project/deletion
checks. Available `project_id` must match. An absent project marker relies on
independently established authenticated-key scope; an expected project string
alone does not prove that scope. Initial/final owner checks observe current
ownership and do not establish historical authorization or an atomic snapshot.
Ownership or the source can change between or after the separate reads.

Requests share a **60-second monotonic budget**, with an abort signal bounding
each HTTP request and body read to at most **10 seconds** or the remaining
budget. Deadlines are checked during rendering and before publication. Blocking
filesystem work and delayed event-loop callbacks can exceed elapsed budgets;
this is not a universal hard deadline. Recording metadata is bounded to **1 MiB**
per response and transcript content to **8 MiB**. Only HTTP 200, uncompressed
`application/json` with strict UTF-8 is accepted. Parsed retained strings/keys
must be well-formed and retained numbers finite. Node's native `JSON.parse`
uses **last-property-wins for duplicate object keys**; earlier duplicates are
discarded before validation. Duplicate-key rejection is not claimed. No redirect,
retry, polling or raw upstream-error logging occurs. These are example limits,
not Bota quotas.

After validation, an exclusive random partial is created in the same directory
with requested POSIX mode `0600` (the process umask can make it more restrictive).
It is written, file-fsynced and closed. Directory ancestry and identity are
rechecked, then the final exact recording-owner GET runs immediately before
publication. A hard link publishes without overwriting any existing destination,
including a dangling symlink. Only this invocation's exclusively created partial
is removed, after an identity check. Trusted filesystem setup and absence of
concurrent path writers remain prerequisites.

No directory fsync is performed, so directory-entry survival across power loss
is not promised. A crash can leave a partial, and cleanup can fail after the
destination was published. Exit 1 can therefore leave a completed output.
Inspect and reconcile private storage before retrying; never delete an existing
destination merely to force the export. Apply retention to output and abandoned
partials only after ensuring no process is using them.

Exit 0 prints only `segment_count` plus false evidence flags:
`timing_inferred`, `atomic_snapshot`, `consumer_acceptance_verified` and
`filesystem_acceptance_verified`. Content, speaker labels, IDs, paths, hashes,
credentials, URLs, provider data and raw exceptions are not printed. Exit 1 uses
a fixed sanitized stderr message. There is no cloud resource to clean up.

## Source and acceptance review

Public contracts: [get recording](https://docs.bota.dev/api-reference/recordings/get)
and [get transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get).
Tracked backend baseline `1ac67c92c6d72858e29dc264037cb82b6c449825` has
project-scoped repositories and stores supplied segment JSON. Recording GET has
an explicit `recordings:read` guard. The transcription router lacks an explicit
per-route `transcriptions:read` guard despite its public requirement. Supply
both scopes and separately verify deployed enforcement. This example does not
repair platform authorization or depend on backend source at runtime.

The compound-engineering review compares the implementation with the supplied
creation requirements, public fields and repository architecture. Root/catalog
and public documentation integration belong to the coordinating batch.

| Requirement | October 9, 2026 Pacific source/check evidence | Status |
| --- | --- | --- |
| Independent public GET-only export | Own Node-built-in source, manifest/lock, env, README and path-filtered workflow | Matched in source; runtime/deployed compatibility unverified |
| Exact source/current owner/project/deletion | `verifyRecording`, `availableIdentity`, exact completed transcription, final owner GET after fsync | Matched in source; rejection/race acceptance unverified |
| Supplied timing and selected NDJSON | `renderNdjson`: finite ordered seconds, positive intervals, overlaps retained, optional speaker, empty-array handling | Matched in source; runtime/consumer acceptance unverified |
| Unicode, response/content/output bounds | Strict UTF-8, `finiteJson`, native duplicate-key semantics, byte counters and request/render deadlines | Matched in source; malformed input/time-budget acceptance unverified |
| Private no-overwrite publication | Private ancestry/identity checks, exclusive partial, file fsync, hard link and own-partial cleanup | Matched in source; ACL/reparse/filesystem/crash acceptance unverified |
| Public read-scope enforcement | Public contract versus tracked transcription router | Partial in platform source; deployed enforcement unverified |
| Independent install and JavaScript syntax | `npm ci` and `npm run check`, Node 22.23.2 / Windows | Passed; installation/parsing only |
| Workflow syntax and pins | Parsed YAML and source review; full-SHA actions, read-only permissions, no API secrets | Matched statically; hosted run unverified |
| Runtime/live API/filesystem/consumer/device checks | No example CLI, function or test execution in this creation pass | Unverified |

The workflow runs `npm ci` and syntax-only `npm run check` on relevant main/PR
changes or manual dispatch. It uses no live credentials or hardware. A hosted
result must be observed for the exact delivered source before being reported.
