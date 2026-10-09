# Export transcription segments as HTML (Python)

Read one existing completed transcription's supplied segments and publish a
private, script-free UTF-8 HTML file without overwriting a destination. Exact
current recording ownership is checked before the transcription read and again
after writing the private partial, immediately before publication. The example
uses three public GETs and creates no job, audio download or device operation.

**Status:** implemented with source review and syntax verification on **October
9, 2026 (Pacific)**. Runtime, API/failure paths, filesystem, crash recovery and
viewer acceptance remain unverified. This creation pass runs no CLI, functions,
tests or renderer. Python **3.12 or newer**, standard library only, is sufficient;
there is no SDK, hardware, package-install or sibling-repository prerequisite.

## Configure and run

Use a server-held project API key with **`recordings:read`** and
**`transcriptions:read`**. Independently confirm the key's project and the fixed
end user's authorization to receive this recording/transcript content. Choose an
existing completed transcription with supplied timing. Use synthetic or consented
content and an appropriate private retention policy. Resource IDs from an
unauthenticated caller do not authorize access; all configuration is trusted
server input. Never distribute the key in browser/mobile applications.

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
requires no credentials or API access; running `main.py` retrieves authorized
content and publishes a private local HTML file.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit trusted HTTPS API origin ending in `/v1`, without credentials, query, fragment, whitespace or backslashes |
| `BOTA_API_KEY` | Server-held secret/restricted project key with both read scopes |
| `BOTA_PROJECT_ID` | Fixed expected `proj_` ID; any returned project field must match |
| `BOTA_END_USER_ID` | Fixed authorized `eu_` source recording owner |
| `BOTA_RECORDING_ID` | Exact expected `rec_` source recording |
| `BOTA_TRANSCRIPTION_ID` | Exact existing completed `txn_` linked to that recording |
| `OUTPUT_PATH` | New `.html` in an existing private directory, without `..` traversal or a colon in its filename (including Windows alternate data streams) |

Provision the output directory separately. POSIX requires the current user to
own the parent with no group/other permissions (for example `mkdir -m 700 exports`).
Every ancestor must be owned by that user or root, with no group/other write
permissions or symlinks. Windows requires operator-provisioned private ACLs and
trusted ancestry: mode `0600` does not configure Windows ACLs. The script rejects
observed reparse points, but the operator must exclude reparse/symlink changes
and concurrent path writers throughout the operation on every platform. Same-directory
hard links must be supported. These checks are not a universal filesystem sandbox.
`.env`, HTML output, partials and cache files are ignored.

## Supplied segments and exact seconds

The exact completed transcription must supply `segments` as a non-null array of
**0–20,000** items. Missing/null segments fail without a `full_text` fallback. An
empty array creates the static document with a `No supplied segments.` message;
it does not prove the recording is silent or the transcription complete in meaning.

Each item must supply numeric `start` and `end` seconds, excluding strings and
booleans. Seconds must be finite, nonnegative and **less than `1e30`**. Starts
must be nondecreasing and each end strictly after its start. Equal starts and
overlaps remain in supplied order. There is no sorting, timing inference,
rounding, provider default, audio alignment or inferred speaker attribution.

All JSON integer and fractional tokens are parsed as exact `Decimal`. Tokens
are limited to **96 characters**, their Decimal coefficient to **30 digits**,
and their stored Decimal exponent to **-30 through 30**, before any formatting.
These parser limits apply to numeric metadata as well. Trailing coefficient
zeros count toward precision. The accepted timing range and exponent bound
prevent a short exponent token from producing unbounded fixed-format output.
Times are written in decimal notation without rounding; lexical notation can
change (for example `1e2` becomes `100`) while the accepted value remains exact.

`text` must be a string, including a possible empty string. `speaker` is an
optional string or null; absence/null produces no speaker paragraph. An empty
supplied label stays empty, with no identity inference. Combined original UTF-8
text and speaker bytes are limited to **4 MiB**. Unicode control characters
(category `Cc`), including NUL, are rejected except tab, carriage return and line
feed. Unicode format characters are retained, including multilingual joiners;
bidi and zero-width formatting can affect presentation. Unpaired surrogates are rejected.
No title, `full_text`, confidence, provider, audio URL or arbitrary response
field is exported.

## Static HTML and viewer limits

The file has a static doctype, UTF-8 charset, `lang="en"`, title and heading.
The language attribute describes the fixed English labels, not an inference
about transcript language. Ordered-list entries contain supplied timing, optional
speaker text and a `pre` element for segment text. **Every dynamic value passes
through `html.escape` and appears only in an HTML text position.** Strings such
as markup, ampersands, quotes and apparent URLs remain escaped text. There are no
dynamic attributes, links, resources, styles, scripts or event handlers.
A static newline immediately after each `pre` opening tag accounts for HTML's
leading-newline rule without consuming a supplied leading newline. Browser
whitespace and newline display can still differ from source text.

A static meta Content Security Policy requests `default-src 'none'; base-uri
'none'; form-action 'none'; script-src 'none'`. It is defense in depth subject to
viewer support; it is not a meta sandbox, a universal viewer-safety guarantee,
or proof of your consumer's behavior. The source excludes active content
independently of this policy. Viewers, extensions, subsequent edits or conversions
can behave differently. Validate your intended viewer separately before sharing.
Escaping cannot establish model accuracy, correct speaker attribution, faithful
audio timing or absence of misleading text. Treat the transcript as untrusted
content and retain it privately according to the recipient's authorization.

## Ownership, bounds and publication

`GET /recordings/{id}` must match the exact configured ID and `end_user_id`, with
no non-null deletion marker or deleted status. `GET /transcriptions/{id}` must
match its exact ID, recording link and `completed` status, with the same optional
project/deletion checks. An absent `project_id` relies on the authenticated key's
project; the configured string alone is not independent scope proof. The final
recording owner GET occurs after file fsync and immediately before publication.
Separate reads are non-atomic: they do not prove uninterrupted or historical
authorization, and ownership/content may change between or after them.

All three requests share a **60-second** monotonic budget, with at most **10
seconds per request**. A connected-transport timer interrupts slowly arriving
headers/bodies; DNS resolution, some connection setup and filesystem waits cannot
always be interrupted. The budget is checked again before publication, so this
is not a universal hard deadline. Recording metadata responses are limited to
**1 MiB** and the transcription response to **8 MiB**. Only HTTP 200, uncompressed
`application/json`, strict UTF-8, unique object keys and bounded finite numbers
are accepted. Redirects, automatic retries and polling are absent. Final HTML is
limited to **8 MiB**, including escaping and markup; escaping expansion can
cause otherwise accepted input to exceed that output limit. These are example
limits, not service quotas.

After validation, an exclusive random partial in the same directory is created
with POSIX mode `0600`, written, flushed and file-fsynced. Directory identity is
checked around the final owner read. A hard link publishes without overwriting an
existing destination or symlink. Only this invocation's created partial is removed.
No directory fsync occurs, so directory-entry survival across power loss is not
promised. A crash can retain a partial, and cleanup can fail after publication.
Failure may therefore leave a completed HTML file. Inspect private output before
retrying; never delete an existing destination simply to force success. Apply
retention to completed content and abandoned partials only after confirming they
are no longer in use. No cloud resources require cleanup.

Exit 0 prints only `segment_count` and false evidence flags: `timing_inferred`,
`atomic_snapshot`, `content_accuracy_verified` and `viewer_safety_verified`.
Transcript/speaker content, hashes, IDs, names, provider data, URLs, paths,
credentials and raw exceptions are never printed. Exit 1 emits a sanitized
stderr message and means failure or uncertainty.

## Source and acceptance review

Public contracts: [get recording](https://docs.bota.dev/api-reference/recordings/get)
and [get transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get).
Tracked backend baseline `1ac67c92c6d72858e29dc264037cb82b6c449825` uses
project-scoped repositories and stores supplied segment JSON. Recording GET has
an explicit `recordings:read` guard. The transcription router currently lacks
an explicit per-route `transcriptions:read` guard despite the public requirement.
Supply both scopes and separately review deployed enforcement; this example
does not repair that platform gap or require private source at runtime.

The compound-engineering review compares the public contracts, repository
architecture and requested creation-only acceptance criteria to [main.py](main.py).
Current source is not proof that a future/deployed service enforces these gates.

| Requirement | October 9, 2026 (Pacific) evidence | Status / remaining verification |
| --- | --- | --- |
| Independent public GET-only export | Own stdlib source/env/README; no sibling imports or dependencies | Matched in source; standalone runtime unverified |
| Exact completed source and current owner/project | `verify_recording` before GET and after fsync; `render_html` identity/link/deletion checks | Matched in source; live rejection/race paths unverified |
| Supplied ordered bounded seconds | `decimal_number` token/coefficient/exponent bounds; `seconds` range; nondecreasing starts and positive intervals | Matched in source; runtime/timing accuracy unverified |
| Script-free escaped text | Static document constants; `html.escape` for every supplied timing/text/speaker value in text positions | Matched in source; viewer/content accuracy unverified |
| Text/output/transport bounds | Aggregate original text limit, incremental encoded output bound and bounded JSON GETs | Matched in source; runtime failure acceptance unverified |
| Private no-overwrite publication | `private_directory`; exclusive partial, file fsync, final owner read, hard link and own-partial cleanup | Matched in source; ACL/filesystem/crash paths unverified |
| Python syntax and workflow YAML | `python -m py_compile main.py`, Python 3.12.14 / Windows; workflow parsed with Node 22.23.2 and existing YAML parser | Passed; syntax/static configuration only |
| Hosted CI | Workflow added, no hosted run attributed here | Unverified; parent checks exact integrated source |
| Runtime/API/viewer/filesystem/device checks | No CLI, function, test, renderer, API or device execution in this pass | Unverified |
