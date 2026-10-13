# Integrated Recordings: one-server migration

## Scope and acceptance

Continue the owner-approved [integrated architecture](../design-decisions/2026-10-12-integrated-recordings.md)
from `536511f60b84096171bf4b08947147072de9d024`. Deliver one executable Node
server using the existing Web and Mobile adapters, without a database merge,
SDK change, client move or live/device operation. Both original launchers remain
available during compatibility migration. The previous core/Web/mobile and
legacy CI runs have passed, including Android and Flutter builds.

The new launcher uses public source in this repository. Its Web adapter still
resolves Express/Vite in the existing Web install root; install that root before
running the combined server. The core's feature/config checks remain separate.
Moving install/client roots follows this migration, with their import graph and
native/dependency guards intact.

## Implementation decisions

- Dispatch credentials before body parsing. `GET /api/recordings` has different
  Web and native DTOs. Authorization selects the Mobile handler and must never
  fall back to a cookie after failure. Library routes remain Bearer-only;
  browser routes retain cookie/Origin/Host checks. Reject mixed Cookie and
  Authorization headers. Webhooks retain separate raw-byte HMAC processing.
- Retain all body, path/query and binding-generation checks. The combined
  listener uses 10-second headers and 30-second request-input limits, matching
  Mobile and deliberately tightening Web's old 15/180-second input budgets.
  This is an explicit new-host difference; original launchers and upstream
  processing/storage timeouts retain their original behavior.
- Share the existing process lock for recording transcription. Summary and
  canonical Ask requests also use a common key. No distributed-lock or external
  writer guarantee is claimed.
- Before a fresh processing/Ask claim, inspect peer journals, including Web rows outside
  the 50-row Activity view and removed accounts/older scopes. Any matching peer
  intent conservatively refuses a new claim; legacy incomplete Ask on the same
  recording also refuses. Return no peer account, operation or resource metadata.
  Existing caller-owned recovery stays GET-only. Native/library's original exact
  known-ID coordination remains; the new Web bridge does not adopt peer IDs.
- Preserve distinct Web, native capture and Mobile library journals, identity
  formulas, known IDs, uncertainty and SDK receipt/cleanup authority. Native
  creation checks both cloud journals before a new transcription.
- Configure explicit existing launch bases/absolute state paths. Check accounts,
  schemas, private paths and physical file aliases before opening writable stores.
  Normal startup refuses missing journals. Explicit `--initialize` is only for a
  fresh installation with all three journals absent; partial/existing sets refuse.
  Stop original listeners before starting the combined process; other writers
  and filesystem races are outside this single-process sample's guarantee.
- Mobile's configured end user must map to a server-owned Web account in the
  same API/project/key namespace. An explicit username resolves duplicate
  mappings. Account mapping is never taken from a client. Cloud-only mode retains
  the existing optional device policy; no device permission is inferred.
- Credential-free demo is Web-only and in-memory. Existing RN/Flutter sample
  modes remain local to their clients. Do not create fake native/Bearer authority.
- Development serving denies configured private files/sidecars, retains Vite's
  defaults and disables the public-directory bypass. Static publication checks
  demo and live build trees: at most 10,000 entries/depth 32, no nested links or
  nonregular entries, and no hardlinks matching configured private files/sidecars.
  Arbitrary copied private content and concurrent external changes are outside
  this metadata preflight. Operators own public-build contents and Windows ACLs.
- Shutdown drains HTTP/HMR and pending route work independently of disconnected
  sockets before closing all stores; startup failure closes every resource already
  acquired. Preserve journals on any failure.

## Requirement review

| Requirement | Evidence | Status |
| --- | --- | --- |
| One listener and compatible credential/DTO dispatch | `backend/server.mjs`; real HTTP cookie/Bearer/library DTO fixtures in `integrated-host.test.mjs` | Matched locally; hosted gate pending |
| Exact ownership and credential boundaries | Original adapters; mixed/duplicate/invalid headers, Origin and denial fixtures; unchanged exact source checks | Matched locally |
| Request bounds and raw media/webhook handling | Original parsers, byte-audio storage fixture, signed raw webhook and body/path/query/binding regressions | Matched locally; intentionally stricter incoming 10/30-second budgets above |
| Cross-journal refusal and process arbitration | Full private probes beyond Activity/removed accounts/scopes; retained known/unknown/legacy intent and concurrent create fixtures | Matched in one process; external writers unverified/unsupported |
| Restart/CWD/state preservation | Read-only column/order/PK/unique/scope preflight; actual child-process restarts preserve seeded IDs and fail on missing original files | Matched locally; POSIX privacy checks await Linux CI |
| New-install usability without accidental recovery reset | Actual all-missing initialization, every partial/existing set refused without replacement | Matched locally |
| Private publication and durable shutdown | Demo/live alias fixtures; actual Vite raw/fs/URL denials; EADDRINUSE, HMR/signal, active/aborted Web/Mobile write regressions | Matched locally; Windows ACLs and external file races are operator gates |
| Runnable public copy graph | Combined setup/account/environment guide; full public Web install + mobile backend + core; consumer CI path filters | Matched locally; hosted gate pending |
| Native transport/cleanup authority | No SDK, firmware, client, native manifest or lock changes | Matched source boundary; physical acceptance unverified |

## Qualification

October 12 local Windows checks with Node 22.23.2:

- Core: syntax, formatting, lint and 80-package metadata license gate pass;
  111 tests, 109 passed and two POSIX permission checks skipped.
- Web: formatting, lint, TypeScript, 142 server + 33 UI tests, production build
  and 250-package metadata license gate pass. This includes the combined HTTP,
  child-process startup/shutdown, Vite privacy and aborted-write fixtures.
- Mobile backend: syntax and 77 tests, 76 passed and one POSIX check skipped.
- Discovery: 77 examples, 84 documents, 404 local links; all nine checker
  regressions pass. Four workflow/Dependabot YAML files parse; both affected
  public MDX files compile and 57 local public-document links resolve.
- Independent reviews found the Vite public-directory bypass and socket-only
  shutdown gap; regressions now cover both repairs. Final independent source
  review clears demo/static aliases and pending-work preservation.
- Changed-symbol/env/path search covered internal/public docs and repository
  README/agent/architecture surfaces. No platform protocol, public API or SDK
  contract changed; internal design propagation is unnecessary for this host move.

Exact-source hosted results will be appended after the ordinary direct push.
No live API/provider/storage, application install, physical device, SDK release
or docs-production promotion was performed. The next compatible change is the
complete Flutter client-root move, after the combined-server hosted gate passes.

Passing synthetic HTTP/SQLite tests does not prove live API/provider/storage,
multi-process coordination, installed applications or physical-device behavior.
