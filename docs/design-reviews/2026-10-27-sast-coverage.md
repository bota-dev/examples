# Repository static security scan review — 2026-10-27

The repository-wide `Scan` check runs on every PR target, drafts, merge queues,
main pushes, weekly schedules and guarded manual dispatches. It uses the pinned
Semgrep OSS scanner, saved community rules and full source. CodeQL default
analysis remains separate. Retained artifacts identify the exact source,
workflow, scanner, rule snapshots, results and scanned-file counts.

## Reviewed audit notices

These source-specific annotations apply only to the following reviewed matches.
No rule or source directory is broadly suppressed. The machine-readable
[review ledger](../../.github/sast-reviewed-findings.json) records each exact
site, source SHA-256, rationale and authoritative contract. The workflow checks
those source hashes; changes require another review before the annotations can
continue qualifying.

The 19 Python sites require Python 3.12+ and use the unmodified default HTTPS
context. Python's [HTTPSConnection contract](https://docs.python.org/3.12/library/http.client.html#http.client.HTTPSConnection)
establishes default certificate and hostname validation. The selected audit rule
matches every constructor regardless of its secure configuration. Annotation
comments preserve the original Python AST.

The three Android activities are explicit MAIN/LAUNCHER entry points.
[Android's launcher contract](https://developer.android.com/about/versions/12/behavior-changes-12#exported)
requires their exported setting. Each Activity source was inspected: it consumes
no external Intent data or extras, and its device/cloud actions require ordinary
UI interaction and their existing authorization/permission gates. The related
Activity source hashes are also bound in the ledger. Manifest elements remain
unchanged.

| Reviewed source | Line | Audit context |
|---|---:|---|
| [api/api-health-python/main.py](../../api/api-health-python/main.py) | 84 | HTTPS default context |
| [api/connection-config-python/main.py](../../api/connection-config-python/main.py) | 83 | HTTPS default context |
| [api/create-ask-session-python/main.py](../../api/create-ask-session-python/main.py) | 171 | HTTPS default context |
| [api/download-firmware-python/main.py](../../api/download-firmware-python/main.py) | 103 | HTTPS default context |
| [api/download-recording-python/main.py](../../api/download-recording-python/main.py) | 106 | HTTPS default context |
| [api/end-user-ota-config-python/main.py](../../api/end-user-ota-config-python/main.py) | 83 | HTTPS default context |
| [api/end-user-processing-config-python/main.py](../../api/end-user-processing-config-python/main.py) | 83 | HTTPS default context |
| [api/end-user-upload-config-python/main.py](../../api/end-user-upload-config-python/main.py) | 84 | HTTPS default context |
| [api/export-transcription-csv-python/main.py](../../api/export-transcription-csv-python/main.py) | 108 | HTTPS default context |
| [api/export-transcription-html-python/main.py](../../api/export-transcription-html-python/main.py) | 128 | HTTPS default context |
| [api/export-transcription-vtt-python/main.py](../../api/export-transcription-vtt-python/main.py) | 105 | HTTPS default context |
| [api/inspect-ask-session-python/main.py](../../api/inspect-ask-session-python/main.py) | 108 | HTTPS default context |
| [api/inspect-recording-integrity-python/main.py](../../api/inspect-recording-integrity-python/main.py) | 107 | HTTPS default context |
| [api/inspect-summary-python/main.py](../../api/inspect-summary-python/main.py) | 101 | HTTPS default context |
| [api/list-summaries-python/main.py](../../api/list-summaries-python/main.py) | 90 | HTTPS default context |
| [api/ota-config-python/main.py](../../api/ota-config-python/main.py) | 83 | HTTPS default context |
| [api/project-ota-config-python/main.py](../../api/project-ota-config-python/main.py) | 77 | HTTPS default context |
| [api/rename-device-python/main.py](../../api/rename-device-python/main.py) | 208 | HTTPS default context |
| [api/upload-security-config-python/main.py](../../api/upload-security-config-python/main.py) | 85 | HTTPS default context |
| [app-sdk/android-device-connect/app/src/main/AndroidManifest.xml](../../app-sdk/android-device-connect/app/src/main/AndroidManifest.xml) | 11 | Android launcher |
| [app-sdk/android-recording-catalog/app/src/main/AndroidManifest.xml](../../app-sdk/android-recording-catalog/app/src/main/AndroidManifest.xml) | 11 | Android launcher |
| [end-to-end/recordings/clients/android-kotlin/app/src/main/AndroidManifest.xml](../../end-to-end/recordings/clients/android-kotlin/app/src/main/AndroidManifest.xml) | 10 | Android launcher |
| [apps/backend/src/index.ts](../../apps/backend/src/index.ts) | 124 | Device registration API path |
| [apps/backend/src/index.ts](../../apps/backend/src/index.ts) | 149 | Device binding API path |
| [apps/backend/src/index.ts](../../apps/backend/src/index.ts) | 204 | Recording upload URL API path |
| [apps/backend/src/index.ts](../../apps/backend/src/index.ts) | 230 | Recording completion API path |

The four legacy TypeScript matches are generic `bota<any>` calls whose template
arguments are API paths passed to Node's [Fetch API](https://nodejs.org/api/globals.html#fetch).
The helper parses JSON responses, and Express returns them through
[`res.json`](https://expressjs.com/en/4x/api.html#res.json); these sites do not
construct or render HTML. The rule's angle-bracket expression also matches the
TypeScript generic call before a template string. Canonical LF source reproduces
the four notices locally. Exact annotations preserve identical emitted JavaScript.
This disposition does not qualify the legacy backend's existing caller
authentication, ownership or token-boundary limitations.

## Shell parser coverage

Semgrep 1.168 cannot fully parse the canonical Gradle wrapper command lists and
implicit argument loops. The three exact wrapper paths in the ledger are
excluded from Semgrep only while their source hashes match the reviewed bytes.
Pinned ShellCheck 0.11.0 statically analyzes those same files with `--norc`.
Every ShellCheck finding or error fails `Scan`; its official archive SHA-256,
version, exact source hashes, results and exit status are retained. No wrapper
or application source is executed. Upstream wrapper bytes are preserved.

The repository's own public-repository probe escapes its literal pipe delimiter
for parser compatibility. Four expansion fixtures verify identical names/URLs;
no network probe is executed by the security workflow.

## Configuration corrections and limits

### Maintained vendor inputs

Semgrep's default dependency-directory selection omitted maintained code under
`vendor`. The required `Scan` now adds a bounded, read-only source view bridge.
The [current classification](../../.github/sast-maintained-vendor.json) covers all
96 tracked vendor entries: 17 retained sources, 24 archives, 14 integrity and
provenance records, six package manifests, nine notices and 26 retired `.source`
evidence files. The seven official archives are provenance only; 17 derived
runtime archives retain complete member inventories and selected maintained
code. The root `braces-free-public-parents` profiles remain current consumers;
`braces-security` source copies are retired evidence.

The bridge analyzes 32 distinct views: all 17 retained JavaScript, declaration
and Python sources, plus 15 distinct maintained JavaScript archive members.
Thirty-nine selected archive-code origins map to those views, deduplicated only
after exact byte equality. This includes Metro watcher JavaScript/Flow and
literal helpers embedded in rebuild scripts, the current root parent patches,
and the patched Metro members bundled in `metro-config`. Original-to-derived
provenance identifies the selected changed or added code; unchanged official
bundle members are preserved by the complete inventory hashes. Source views
use recognized `.js`, `.ts` or `.py` filenames without changing their bytes.

Trusted inline workflow policy is captured before checkout. All tracked paths
containing a `vendor` component must match its exact regular-file inventory,
modes, sizes and hashes. Historical source cannot supply a different policy.
Git blob sizes and checkout sizes are checked before reading their content.
Archives have finite compressed, member, expanded and view-size limits; paths
must be canonical under `package/`, and duplicate members, links, devices and
special entries fail. Before `tarfile` parses metadata, bounded gzip output and
raw 512-byte TAR headers are checked for count, size, checksum and complete end
blocks. The only supported extended metadata is a bounded single per-file PAX
path record used by the current Metro bundle; global and GNU metadata fail.
Every archive member hash and mode contributes to its
reviewed complete-inventory digest. The bridge never executes, extracts to source
directories or repacks a payload. Existing native/Metro payload-integrity gates
remain unchanged.

Separate vendor JSON/SARIF, the current policy, source-to-view identities and
archive receipts are retained with the ordinary scan. The summary requires the
exact expected view population in Semgrep's actual scanned paths and unchanged
post-analysis hashes. Real local Semgrep 1.168.0 scans all 32 views with the same
11 raw policy snapshots and strict flags: zero findings and zero errors. Canary
controls reject new, changed, missing and symlinked tracked inputs, path traversal,
duplicate archive members, links, devices and unexpected archive inventory.
Thirty-seven local controls include early-parser gzip/PAX/header limits, Windows
path aliases, missing scanned views and post-analysis source-view changes.

All six Dependabot entries explicitly wait seven days for newly published
version updates. This changes their effective three-day default; vulnerability
security updates remain a separate repository setting. Two JSX text entities
preserve their rendered text, and the architecture build variable passes through
an environment variable so embedded shell analysis can parse it.

A full 40-character manual revision is retrospective evidence. It cannot prove
that the original PR passed SAST before merge. Unannotated historical source
without a review ledger receives ordinary analysis. Annotations without a matching
ledger or changes to reviewed sources fail until that exact source is reviewed;
current dispositions are not historical pre-merge evidence. Configured community rules do
not establish complete coverage of Dart or Objective-C. Source, local Windows
static results, hosted Linux results and merge enforcement are distinct gates.

## Conformance review

| Requirement | Evidence | Status |
|---|---|---|
| Every new PR has static analysis | Unfiltered PR events, merge-group trigger, no dependency/secret prerequisite | Matched in source; hosted execution separate |
| Findings and analyzer errors fail | Real Semgrep 1.168 scan: 920 files, zero findings/errors; strict flags and zero-file guard | Matched locally |
| Canonical shell sources retain coverage | Three unchanged source hashes; ShellCheck 0.11.0 zero findings; unsafe fixture fails | Matched locally |
| Maintained vendor source is analyzed | 96-entry current-workflow guard, 32 exact source views, complete archive inventories and rejection controls | Matched locally; new hosted result pending |
| Dispositions remain bound to reviewed source | 26 exact annotations, 26 unique source hashes; changed-hash/path-escape controls fail | Matched locally |
| Adjacent rendering behavior remains valid | Web format/type/build checks and 69 UI checks pass; Python AST, manifest elements and legacy backend JavaScript emit preserved | Matched locally |
| Exact hosted Linux result and merge enforcement | Requires the exact PR run and separate repository rule readback | Unverified here |
