# Export transcription as WebVTT (Python)

Read one existing completed transcription and publish its supplied timed segments
as a private UTF-8 WebVTT subtitle file, without overwriting any destination.
The example checks the fixed source recording's current end-user ownership before
reading text and again immediately before publication. It makes three public GETs;
it starts no job, downloads no audio, and changes no cloud or device resource.

**Status:** implemented; syntax checked with Python 3.12.14 on Windows,
October 8, 2026. Runtime, API/failure-path, filesystem and player acceptance are
unverified. This creation pass includes no tests or example execution. No hardware,
SDK package or third-party Python dependency is needed.

## Configure and run

Use Python **3.12 or newer** and a project API key with **`recordings:read`** and
**`transcriptions:read`**. Independently confirm that the key belongs to the intended
project and that the fixed end user may receive this recording's content. Choose an
existing completed transcription with supplied segment timing. Keep the key and
resource configuration in your server process; do not accept these values directly
from an unauthenticated client or distribute them to a browser or mobile app.
Use synthetic or consented content and apply your content-retention policy.

From this directory:

```sh
cp .env.example .env
# Fill the placeholders and set them in your process environment.
# The script does not load .env files.
python -m py_compile main.py
python main.py
```

PowerShell uses `Copy-Item .env.example .env` and `$env:NAME='value'` to set each
variable. There is no install step. Compilation needs no API access; running
`main.py` performs authenticated reads and publishes local subtitle content.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit HTTPS API origin ending in `/v1`, without URL credentials, query, fragment, whitespace or backslashes |
| `BOTA_API_KEY` | Server-held secret/restricted project key with both read scopes |
| `BOTA_PROJECT_ID` | Fixed expected `proj_` ID; available returned project fields must match |
| `BOTA_END_USER_ID` | Fixed authorized `eu_` owner of the source recording |
| `BOTA_RECORDING_ID` | Exact expected `rec_` source recording |
| `BOTA_TRANSCRIPTION_ID` | Exact existing completed `txn_` transcription linked to that recording |
| `OUTPUT_PATH` | New `.vtt` file in an existing private directory; no `..` traversal |

Create the output directory separately. On POSIX it must belong to the current
user and exclude all group/other permissions (for example `mkdir -m 700 exports`);
its ancestors must exclude group/other writes and symlinks. On Windows provision
private ACLs for the existing directory and trusted ancestors **before running**;
Python's `0600` creation mode does not establish a Windows ACL. Reparse points or
concurrent path writers must be excluded by the operator's trusted filesystem
setup. This script is not a filesystem sandbox. Same-directory hard links must be
supported. `.env`, `exports/`, `.vtt`, `.partial` and Python cache files are ignored.

Success prints only `Exported N WebVTT cues to OUTPUT_PATH.` and publishes:

```text
WEBVTT

1
00:00:00.000 --> 00:00:02.500
Hello, thanks for joining us today.

```

## Content, timing and trust boundaries

`GET /v1/recordings/{id}` must return the exact recording and fixed `end_user_id`
without a non-null deletion marker or deleted status. Optional `project_id` must
equal the configured project. The same rules apply to the transcription, which
must additionally match its exact ID, recording link and `completed` status. A
missing project field relies on the authenticated project's key; the configured
project string is not independent proof of the key's scope. Separate reads are
non-atomic; ownership can change after the final read. Adapt these checks to a
service's verified caller context rather than treating an arbitrary ID as access.

The exporter requires **1–5000 supplied segments** and uses only `start`, `end`
and `text`. Missing/null timing, booleans, nonfinite numbers, times outside
0–168 hours, decreasing starts and end not strictly after start are rejected.
No segment sorting, word timing, speaker inference, ASR, transcript repair or
audio alignment occurs. Numeric JSON fractions are parsed as exact `Decimal`;
up to 30 significant digits and decimal exponents from -30 to 30 are accepted.
Start is rounded **down** and end **up** to whole milliseconds, widening each
valid cue by less than a millisecond on either side. Existing overlaps and equal
starts are retained. Hours have at least two digits, so durations above 99 hours
retain all hour digits. Millisecond formatting is an export convention, not proof
that provider timing matches the audio.

Each 1–10,000-character supplied text becomes one plain payload line. Unicode
whitespace, control and format characters (including bidi controls) become spaces,
then whitespace collapses. This also removes zero-width formatting/joiners and
can change visual layout; original transcript content is not edited in the cloud.
Unpaired Unicode surrogates and empty resulting text are rejected. Ampersands,
less-than and greater-than characters are escaped as named character references.
That prevents supplied markup, inline timestamps and literal `-->` injection.
Text such as `NOTE`, `STYLE` or `REGION` remains cue payload after generated numeric
identifiers and timing lines; it cannot create a separate block. No untrusted
speaker, confidence, `full_text`, language, title, style or positioning is emitted.

The formatting basis is the [W3C WebVTT May 20, 2026 Candidate Recommendation
Draft, §4.1](https://www.w3.org/TR/2026/CRD-webvtt1-20260520/#webvtt-file-structure)
and [§4.2.2 cue text](https://www.w3.org/TR/2026/CRD-webvtt1-20260520/#webvtt-cue-text).
Those rules require start ordering, positive cue duration and safe payload syntax;
they permit overlaps. This example emits subtitles, not a chapter track. Source
review against the draft is not browser/player rendering evidence.

## Bounded failures and private publication

The operation has a 40-second elapsed budget, with at most 10 seconds per
connected request, and 2 MiB per uncompressed JSON response. DNS resolution and
some filesystem operations are not interruptible by these timers. UTF-8 JSON
must have unique object keys and valid finite numbers. Compressed responses,
redirects, non-200 reads, polling and automatic retries are excluded. No upstream
error body, transcript text, resource ID, key, URL or raw exception is printed.
Output is limited to 4 MiB; these are teaching limits, not Bota service quotas.

After all segments validate, the script exclusively creates a same-directory
random partial file with POSIX mode `0600`, writes and file-fsyncs complete bytes,
then rechecks the private directory identity. The fresh owner read occurs **after
that flush, immediately before the hard link**. Publication refuses an existing
file or symlink. It removes only the partial file created by this invocation;
failure cleanup never deletes an existing destination. No directory fsync is
performed, so file flush and no-overwrite publication do not promise directory
entry survival across power loss. A process crash may retain a partial file.

Exit 0 means publication and partial cleanup completed; exit 1 means failure or
uncertainty. Cleanup can fail after publication, so inspect the private directory
before retrying. Preserve any existing destination and reconcile its provenance;
never delete it just to force another export. There are no cloud resources to
clean up. Remove sensitive local output and abandoned partial files according to
your retention policy, after verifying that no process still uses them.

## Source and acceptance review

Public contracts: [get recording](https://docs.bota.dev/api-reference/recordings/get)
and [get transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get).
The tracked backend baseline `1ac67c92c6d72858e29dc264037cb82b6c449825`
uses authenticated project-scoped repositories and stores segment JSON. Its
recording GET has an explicit `recordings:read` guard; its transcription router
does not currently attach an explicit per-route `transcriptions:read` guard,
although the public contract requires that scope. Supply both scopes and review
deployed enforcement separately; this example does not fix platform authorization.

| Requirement | Evidence on October 8, 2026 | Status |
| --- | --- | --- |
| Independent public GET-only workflow | Own standard-library source/env/README; public fields and scoped backend source inspected | Matched in source; deployed behavior unverified |
| Exact owner/source/project gates | Initial recording check; exact completed transcription; final recording check immediately before link | Matched in source; rejection and race behavior unverified |
| WebVTT timing and plain payload | W3C draft reviewed; Decimal outward rounding, ordered starts, positive duration, escaped single-line payload | Matched in source; player acceptance unverified |
| Private no-overwrite publication | Exclusive partial, file fsync, trusted-directory check, hard link and invocation-only cleanup | Matched in source; filesystem/crash acceptance unverified |
| Python syntax | `python -m py_compile main.py`, Python 3.12.14 / Windows | Passed; syntax only |
| Runtime, API, failure paths and player rendering | Not run, per creation-only instruction | Unverified |
| Hosted CI | Matching path-filtered compile-only workflow | Configured; run result recorded by repository review |

To integrate, keep authorization in your server, choose private storage and
retention appropriate to your users, and validate rendering in your intended
player before delivering subtitle files. No sibling repository or private helper
is a runtime/install prerequisite.
