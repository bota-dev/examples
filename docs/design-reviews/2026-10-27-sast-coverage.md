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
| Dispositions remain bound to reviewed source | 22 exact annotations, 25 source hashes; changed-hash/path-escape controls fail | Matched locally |
| Adjacent rendering behavior remains valid | Web format/type/build checks and 69 UI checks pass; Python AST and manifest element shapes preserved | Matched locally |
| Exact hosted Linux result and merge enforcement | Requires the exact PR run and separate repository rule readback | Unverified here |
