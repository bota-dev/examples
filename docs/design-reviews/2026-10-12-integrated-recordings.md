# Integrated Recordings: first consolidation delivery review

## Basis and scope

The owner approved the [integrated architecture](../design-decisions/2026-10-12-integrated-recordings.md):
one maintained backend, platform clients and clearly copyable features. This
delivery aligns the governing docs and performs the first runtime migration:
one cloud-feature implementation behind the existing web/mobile adapters.

The extraction was qualified from `5f33070dd84be8e7bd5e88690b84ee9c1b4352a5` and
rebased before delivery onto `18fef99cb48b2a8116a3e0bfa39b09153414172d`. The later
independent Metro matching removal is retained along with native Expo signing,
public SDK pins and owning security suites; it changes no extracted feature or
consumer backend code. No package publication,
firmware, app-store, infrastructure or public-site deployment is part of this work.

## Actual change

- [Recording](../../end-to-end/recordings/backend/features/recordings.mjs),
  [processing](../../end-to-end/recordings/backend/features/processing.mjs) and
  [Ask](../../end-to-end/recordings/backend/features/ask.mjs) now live once in the
  integrated core. Old feature paths are compatibility exports/projections.
- Shared errors retain the original mobile `RequestError` identity. Mobile
  remains strict on required project fields; web explicitly retains omitted-field
  compatibility while rejecting supplied foreign scope and exact source/owner
  mismatches. Native/library transcription arbitration remains in its original host.
- Shared processing retains a valid returned identity before subsequent checks.
  Post-create GET reconciliation is awaited inside its uncertainty boundary.
  Web now receives those existing mobile recovery fixes and suppresses operation
  metadata on authorization-denial responses while preserving the private journal.
- Web mutation/recovery responses remain operation-only and its summaries retain
  the original projection. Mobile preserves verified source-linked results.
- Existing auth, stores, launchers, CWD resolution, journal paths/schemas/scope
  hashes/anchors/known IDs and SDK/native files remain unchanged. Upload/webhook
  features and native capture coordination remain local to their owning adapters.
- Added a real core package, contract tests, frozen dev-tool lock, license gate,
  read-only Linux/Windows CI and dependabot entry. Shared paths trigger both
  consumer workflows. No runtime dependency or unofficial API SDK is introduced.
- Catalog entry `recordings` represents implemented core code; original 76 entries
  and order remain, with the new entry appended. No empty future clients/features
  appear in the catalog.

## Requirement conformance

| Requirement | Evidence | Status |
| --- | --- | --- |
| Integrated sample as maintained foundation | Approved decision, DESIGN/ARCHITECTURE/ROADMAP/README and agent/AI guidance | Matched in design/docs |
| Shared backend feature implementation | One canonical recording/processing/Ask core, thin web/mobile adapters | Partial target delivered |
| One executable backend | Two existing listeners/auth adapters still run | Not implemented; next migration gate |
| Preserve authentication and state | Same stores, scope/anchor derivation, launchers and routes; SQLite restart and existing native/library regressions | Matched for this extraction |
| Preserve web/mobile DTOs and ownership | Compatibility projections, default-strict/mobile policy and explicit web omission; actual HTTP/core fixtures | Matched in checked contracts |
| Retain uncertain identities without replay | Valid-ID-before-validation and awaited reconcile; known/unknown restart and no-second-POST regressions | Matched in local synthetic/SQLite tests |
| Preserve SDK transport, receipt and cleanup authority | SDK/native/pin files unchanged; current native backend coordination suite retained | Unchanged; no new physical proof |
| Easy developer copy/run path | Core/public-call links, complete import/context requirements and compatibility-family setup | Matched in docs; broader platform flows remain partial |
| Future platform clients/two layers | General capabilities now, vertical/app-type demos later; native host/SDK gaps explicit | Planned; no new host claim |
| Preserve dependency remediation | Existing native signing/braces/source-map chains untouched; core dev dependencies pinned and license checked | Matched for this scope |

## Verification

Local checks use Node 22.23.2 on Windows:

| Check | Result and scope |
| --- | --- |
| Web consumer | Lint, typecheck, formatting and production build pass; 99 server and 33 UI tests pass; license check scans 250 installed packages |
| Integrated core | Frozen install, syntax, lint and formatting pass; 10 backend contracts and 43 CLI license-gate regressions pass; metadata gate scans 80 installed dev packages |
| Mobile backend consumer | Syntax checks pass; 63 tests pass, one existing POSIX file-permission test skips on Windows |
| New recovery regressions | 11 real Web cookie/HTTP/SQLite cases and 10 core contract cases pass, covering known-ID retention, post-create failure, auth-denial metadata, DTOs, scope and restart behavior |
| Discovery | 77 entries and 84 documents validated; nine portable catalog regression cases pass; independent docs review resolved 441 local/mapped source targets and additional affected design/agent/architecture links were checked; the original 76 entries remain in order |
| Public docs | Both edited MDX pages compile and 57 local page links resolve; source-main update only, no site promotion |
| CI wiring | Four YAML files parse; both push/PR path filters trigger core and both consumers on shared code/test/lock changes; full-SHA actions, read-only permissions and frozen installs retained |
| Independent code review | No actionable extraction defect; auth, scope/owner/source gates, shared error identity, DTOs, uncertainty and native cleanup boundaries match the bounded requirements |

The new license gate's initial shared-template behavior allowed an `AND` copyleft
expression and skipped unknown/invalid metadata. Review rejected that behavior;
the corrected gate and 43 CLI fixtures now enforce a conservative recognized
license subset with AND/OR precedence and parentheses. Missing, unsupported or
unreadable metadata blocks the gate; private flags and duplicate identities do
not bypass scanning. This checks metadata, not bundled source or license texts.
Existing install roots' license policies are outside this extraction.

The installed GitHub Actions skill's optional best-practices reference and a
workflow-validator skill were unavailable. YAML parsing, explicit path/pin/permission
checks and independent workflow review cover this change; no unavailable validator
result is claimed. Existing SDK/native/security files and older locks are unchanged.
RN app dependencies were not freshly installed or locally requalified for this
backend extraction. Exact-source hosted workflow results remain a separate gate.

Source, local HTTP/SQLite fixtures, hosted native builds, live API/provider/storage
and physical-device acceptance are separate evidence.

## Remaining acceptance

One listener requires same-owner arbitration and retained-intent checks across
all stores, isolated cookie/Bearer handling, request limits and compatible
account/journal path resolution. Merely mounting both route handlers would not
provide one safe operation domain. Preserve those gates before layout/state moves.

Playback/import gaps and missing integrated/native iOS hosts remain in the
roadmap. No live Bota API/provider/storage call, device operation, app install or
cleanup acceptance was performed in this extraction.
