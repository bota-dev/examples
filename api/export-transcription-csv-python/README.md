# Export transcription segments as CSV (Python)

Read one existing completed transcription's supplied segments and publish a
private UTF-8 CSV without overwriting a destination. The source recording's exact
current end-user ownership is checked before reading the transcription and again
immediately before publication. Only three public GETs are used; no jobs, audio
downloads, device operations or cloud mutations occur.

**Status:** implemented with source review and syntax verification on October 9,
2026. Runtime, API/failure paths, filesystem and spreadsheet-consumer acceptance
remain unverified. This creation pass includes no tests or example execution.
Python **3.12 or newer**, standard library only, is sufficient. No hardware,
SDK, root installation or sibling repository is needed.

## Configure and run

Use a server-held project API key with **`recordings:read`** and
**`transcriptions:read`**. Independently confirm the key's project and the fixed
end user's authorization to receive the recording/transcript content. Choose one
existing completed transcription with supplied segment timing. Keep all values
in trusted server configuration; resource IDs from an unauthenticated caller are
not access authorization. Use synthetic or consented content and suitable retention.

From this directory:

```sh
cp .env.example .env
# Replace placeholders and export each variable into the process environment.
# The script does not load .env files.
python -m py_compile main.py
python main.py
```

PowerShell uses `Copy-Item .env.example .env` and `$env:NAME='value'` for each
variable. There is no install step and no CLI arguments are accepted. Compilation
needs no credentials or API access; running `main.py` reads content and publishes
a private local CSV. Never distribute the key in a browser/mobile application.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS API origin ending in `/v1`, without credentials, query, fragment, whitespace or backslashes |
| `BOTA_API_KEY` | Server-held secret/restricted project key with both read scopes |
| `BOTA_PROJECT_ID` | Fixed expected `proj_` ID; optional returned project fields must match |
| `BOTA_END_USER_ID` | Fixed authorized `eu_` source recording owner |
| `BOTA_RECORDING_ID` | Exact expected `rec_` source recording |
| `BOTA_TRANSCRIPTION_ID` | Exact existing completed `txn_` linked to that recording |
| `OUTPUT_PATH` | New `.csv` in an existing private directory, without `..` traversal |

Provision the output directory separately. On POSIX it must belong to the current
user and exclude all group/other permissions (for example `mkdir -m 700 exports`);
every ancestor must exclude symlinks and group/other writes. On Windows, provision
private ACLs and trusted ancestry before running; Python mode `0600` does not
configure Windows ACLs. Exclude reparse points and concurrent path writers through
the operator's trusted setup. This is not a filesystem sandbox. Same-directory
hard links must be supported. `.env`, CSVs, partials and cache files are ignored.

## Content and timing

Columns are fixed, in this order:

```text
segment_index,start_seconds,end_seconds,text,speaker
```

Segment indices are generated from 1. The completed transcription must supply
`segments` as a non-null array containing **0–20,000** items. An empty array
creates a header-only CSV; missing/null timing never falls back to `full_text`.
Each item must supply numeric `start` and `end` seconds, excluding booleans.
Values must be finite and nonnegative, starts nondecreasing, and each end strictly
after its start. Equal starts and overlapping intervals are retained in supplied
order. No sorting, timing inference, provider defaults, speaker attribution or
millisecond rounding occurs.

JSON fractions are parsed with exact `Decimal`. Numeric values are limited to
30 significant digits and decimal exponents from -30 through 30 to bound their
formatted length. Seconds are written as fixed decimal numbers without exponent
notation or rounding. Their lexical representation may change (for example an
exponent expands to decimal notation); their accepted numeric value does not.
Provider timing is not independently aligned against audio.

`text` must be a string, including a possible empty string. `speaker` may be an
optional string or null; absence/null becomes an empty cell. Combined original
UTF-8 text and speaker bytes are limited to **4 MiB**. Unsupported Unicode control
and format characters, including NUL, bidi controls and zero-width formatting,
are rejected. Tab, carriage return and line feed are retained. Unpaired Unicode
surrogates are rejected. No confidence, title, full transcript, model/provider,
audio URL or arbitrary response field is exported.

## CSV string-cell handling

Every **nonempty text or speaker cell is prefixed with a literal apostrophe**
before `csv.writer` quoting, regardless of its first character. Empty cells stay
empty. This is an intentional content change: an ordinary sentence also gains the
prefix; an existing leading apostrophe gains another. No formula-like text is
copied into a cell without the prefix. CSV quoting alone does not establish that
a spreadsheet treats a cell as plain text.

The standard CSV writer escapes embedded double quotes and encloses cells when
needed for commas or retained newlines. Tabs remain cell content. Records use CRLF and the file
is UTF-8 without a BOM. Quoted newlines may span multiple physical file lines but
remain inside the original cell. CSV is an interchange format, not a sandbox.

For your chosen consumer, use explicit UTF-8/comma/quote import settings and
configure text/speaker columns as text with formula evaluation disabled where
supported. Preserve the prefix when handling untrusted content. Different
spreadsheet/import tools can interpret or strip it differently, and later edits
or exports can remove it. This example makes **no universal consumer-safety claim**;
its current checks do not verify any spreadsheet application. Prefer a plain-text
viewer when inspecting untrusted exports, and establish your intended consumer's
behavior separately before distributing files.

## Ownership, bounds and private publication

`GET /recordings/{id}` must match the configured recording and exact `end_user_id`,
without a non-null deletion marker or deleted status. The transcription GET must
match its exact ID, recording link and `completed` status, with the same optional
project/deletion checks. An absent `project_id` relies on the authenticated key's
project; a configured project string is not independent proof of that scope.
The final owner GET occurs after CSV bytes are file-fsynced, immediately before
local publication. These separate reads are non-atomic; ownership can change
between or after them, and they do not establish historical authorization.

All requests share a **60-second** monotonic budget and at most **10 seconds per
request**. Connected transports have a timer interrupting slowly arriving headers
or bodies. DNS resolution and some filesystem waits cannot be interrupted by these
timers; deadlines are rechecked before publication. Every API response is bounded
to **8 MiB**, strict UTF-8 JSON, unique object keys and finite numbers. Only HTTP
200 JSON without compression is accepted. Redirects, retries, polling, processing
creation and raw upstream error output are excluded. Final CSV is limited to
**8 MiB**, including quoting/prefix/column overhead. These are example limits,
not Bota service quotas.

After segment validation, an exclusive same-directory random partial file is
created with POSIX mode `0600`, written, flushed and file-fsynced. Private directory
identity is rechecked, then the owner read runs. A hard link publishes without
overwriting an existing file or symlink. Only the partial created by this invocation
is removed. No directory fsync is performed, so directory-entry survival across
power loss is not promised. A crash can retain a partial; cleanup can fail after
publication. Inspect and reconcile private output before retrying; never remove an
existing destination simply to force an export. Apply your retention policy to
content and abandoned partials after ensuring no process uses them.

Exit 0 emits only `segment_count` and these evidence flags:
`string_cells_prefixed: true`, `timing_inferred: false`, `atomic_snapshot: false`
and `spreadsheet_consumer_safety_verified: false`. Transcript/speaker content,
hashes, resource IDs, names, provider data, URLs, output paths, credentials and raw
exceptions are never printed. Exit 1 means failure or uncertainty, with a fixed
sanitized stderr message. No cloud resource requires cleanup.

## Source and acceptance review

Public contracts: [get recording](https://docs.bota.dev/api-reference/recordings/get)
and [get transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get).
Tracked backend baseline `1ac67c92c6d72858e29dc264037cb82b6c449825` uses
project-scoped repositories and stores supplied segment JSON. Recording GET has
an explicit `recordings:read` guard. The transcription router currently lacks an
explicit per-route `transcriptions:read` guard despite that public requirement.
Supply both scopes and review deployed enforcement separately; this example does
not repair platform authorization and does not depend on private source at runtime.

| Requirement | October 9, 2026 evidence | Status |
| --- | --- | --- |
| Independent public GET-only export | Own stdlib source/env/README; exact public IDs and supplied segment fields | Matched in source; deployed/runtime behavior unverified |
| Exact source and current owner/project | Initial recording GET, exact completed transcription, final owner GET after fsync | Matched in source; rejection/race acceptance unverified |
| Supplied ordered numeric seconds | Exact Decimal parsing, bounded precision, positive intervals, overlaps/order preserved | Matched in source; runtime acceptance unverified |
| CSV string handling | Fixed columns; apostrophe on every nonempty string before stdlib quoting; controls rejected | Matched in source; spreadsheet consumer safety unverified |
| Private no-overwrite output | Exclusive partial, file fsync, directory check, hard link and own-partial cleanup | Matched in source; filesystem/crash acceptance unverified |
| Python syntax | `python -m py_compile main.py`, Python 3.12.14 / Windows | Passed; parsing only |
| Hosted CI | Pinned read-only path-filtered compile-only workflow | Result pending integration |
| Runtime/live API/filesystem/consumer/device checks | No CLI, function or test execution in this creation pass | Unverified |
