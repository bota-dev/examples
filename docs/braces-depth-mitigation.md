# Scoped braces source mitigation

## Historical October 7 five-file guard

High #113 (legacy root), #111 (React Native connection) and #112 (recording-sync
app) remain open on package identity `braces` 3.0.3. Each install root owns its
standalone `scripts/apply-braces-security.mjs`, regression suite and
`vendor/braces-security` runtime/MIT/provenance. No sibling repository or install
root is required. Frozen lockfiles, public SDK versions, device/HTTP code,
existing query-string and Forge hooks remain intact.

The backport uses only five runtime changes from upstream
[PR82](https://github.com/micromatch/braces/pull/82) head
`1f11eb558be9ea0cda87861408bb766e2e714086`, applied to SHA-512-verified public
3.0.3 bytes. It bounds parser containers, AST child depth/visits and child
cycles, removes reliance on caller parent queues and retains reusable/shared
range markers. Unrelated upstream-master quote/comma and proposal range-limit,
step/cardinality/unsafe-endpoint behavior are excluded. Exports, package
manifest/identity/engines/dependencies and MIT license remain unchanged.

The installer attests every runtime vendor asset and locked/installed copy before any
write, rejects unknown identity/manifest/source and escaping paths, verifies
write read-back and is idempotent. `--verify` rejects incomplete application;
known interrupted helper creation can be recovered. Git attributes retain
exact vendor bytes across Windows/Linux. Omitted scoped dev installs are
reported explicitly, and mandatory full-install tests require a physical copy.

Fixed limits are 128 parser containers, 128 AST child edges and 65,536 visits.
Parsed 128-container expressions can exceed walk depth with terminal nodes;
127-container ordinary walks pass. Complexity/child cycles throw `SyntaxError`
with `ERR_BRACES_COMPLEXITY`; escaped/quoted delimiters remain literal. External
parent queues are ignored. Shared/repeated range ASTs retain their markers/children, and
malformed `{(a)` becomes literal instead of an old stale-parent TypeError.
Existing combined explicit-step/options-step behavior is preserved. Total
Cartesian expansion, generated regex, getters/array-valued text and omitted
unsafe-range endpoints are not covered by this scoped correction.

The independently verified public tag
`74b2db2938fad48a2ea54a9c8bf27a37a62c350d` runs 764 passing tests on pristine
and scoped code, zero Mocha pending/failures. Statically excluded fixtures and
the complete 1,137-case proposal suite are outside that count. Ten selected
pristine controls fail; all 16 guarded installer/parser/actual-micromatch tests
pass. Actual importer/build/export/license qualification is performed separately
for each example, and hosted native results remain distinct from installation
or physical device acceptance.

Root `npm test` includes the new suite; both independent app test scripts run
`npm run test:braces-security`. Postinstall remains mandatory. Use ordinary
frozen installs and supported export/native checks; preserve existing unsupported
web/playground and physical boundaries. No production dispatch, package
publication, native installation or device mutation is part of this source fix.
An official compatible fixed version requires requalification and removal of
the temporary assets; no scanner dismissal or suppressed install check is used.

## Recorded qualification and design review

All three fresh frozen installs pass: root758, connection471 and sync471 packages. Root52, connection26 and sync40 tests pass, including all three16-case brace suites. Typechecks, root backend build, root Android/iOS/Web export and both independent supported Android exports pass. The license policy scans696/445/445 packages with no forbidden licenses. Existing unsupported connection Web-export and physical-device limits remain. Exact-source hosted native checks are a separate acceptance gate.

| Requirement / acceptance basis | Evidence | Conformance |
|---|---|---|
| User-requested retained unpatched dependency mitigation | Scoped public upstream depth/AST fix; unchanged locks/identities; independent source review | matched in source |
| Fail closed on unknown bytes and preserve restart recovery | Complete preflight, contained paths, read-back, idempotence, known interrupted-helper repair;16 cases | matched |
| Preserve ordinary consumer behavior | Published-tag764 and separate importer comparison receipts; retained range exclusions | matched within stated scope |
| Mandatory install/test wiring | Existing lifecycle chains and hosted test chains include the guard; scoped omission stays explicit | matched in source |
| Exact-source hosted qualification | Must bind each result to the pushed revision; no inferred success from older runs | pending readback |
| Scanner closure and deployment effectiveness | Locked3.0.3 findings remain open; package/runtime live inspection not performed | unverified |
| Production approval and certificate authority | Existing approval workflow retained; certificate installation disabled | unchanged boundary |

## October 11 six-file migration

The previous five-file guard is retained above as dated historical evidence.
The current physical source extends only `lib/depth-guard.js` and `lib/utils.js`.
Structural `nodes`, `value` and array-index properties must be stable data
descriptors; own/inherited accessors are refused before invocation, and prototype
chains longer than 128 are refused. Caller-created AST/accessor objects are
JavaScript inputs, not a demonstrated remote untrusted-string exploit. Proxy
traps, other metadata access and arbitrary coercion are outside this contract.

AST child/value arrays share fixed depth 128 and 65,536 visits, including repeated
shared children. Options cannot increase them. The mandatory controls accept 127
nested text arrays and refuse 128, and accept 65,533 scalar entries but refuse
65,534. This is an explicit caller input policy change. `utils.flatten` is
iterative with a 128 array-depth/cycle bound and no generic visit/cardinality cap:
90,000-element flat/Cartesian, sparse 90,001, shared arrays and scalar identity
remain supported. Existing undefined omission remains. Total Cartesian growth,
generated regex and range-step/unsafe-endpoint behavior remain unqualified.

`utils.js` becomes the sixth guarded asset. Pristine hash
`b5a7596aa67730412b3c029ef09e84e6b67b8e445cffd35d1d295549c89066c7`
migrates to `64374f5bb740f6e3917d90a453ab8ec64cc0f1b1c85a25a3377779db496f2d11`.
The only permitted previous helper is
`fed13d0e5a013cea39ed2e3707be29133e7293e753b2783a9cbe4b92ed978b9e`;
the final helper is `689e1c8fd14c7224bfcf1bd5fd0ad323fec65714203cfa3b7523933638d92ae0`.
Test-only `fixtures/v1-depth-guard.js.source` and `fixtures/v1-utils.js.source`
are byte references, never installed/imported as runtime. The initially rejected
helper that capped generic flatten cardinality is not a known migration state.

Complete preflight attests all assets/copies before writing. Exact pristine-to-v2
and v1-to-v2 write-prefix interruptions, missing helpers and specified helper/
utils cross-states are repairable. Unknown helper/utils/later-copy drift, missing
utils and the rejected helper refuse before writes. A real read-only-utils failure
may leave a known partial helper; strict verification refuses it until permission
restoration and retry complete all six hashes. The accepted shared installer
transition proof is reused; each of the three Examples roots runs its own updated
22-case suite. Package coordinates/SRI/license/dependencies, compiler/parser/
expand/stringify and manifest/index/constants are unchanged. No aliases or
vulnerable-body renaming are used.

The separate clone starts at `137d4b6a401ba5f0c4c7a55ac84c8b3933a14688`.
Fresh lifecycle-enabled Windows Node22.23.2/npm10.9.8 installs add 758/471/471
packages for legacy root/connection/sync, retaining prior Forge/query-string
hooks. Existing test chains, all typechecks, backend build and catalog checks
pass. Each updated dependency guard additionally passes 22 cases on Node20.20.2;
Node20 is only the dependency profile, not full application compatibility. The
legacy Android/iOS/Web export and both independent supported Android exports
pass. Actual parent comparison results and exact-source first-push hosted native
qualification are recorded separately; no physical upload/cleanup/installation
result or provider operation follows from these local checks.

| Requirement | Evidence | Conformance |
|---|---|---|
| Accepted physical source and explicit input policy | Reviewed Bota 386 assets copied exactly into all three roots | Matched in source |
| Conservative migration and strict final verification | Complete preflight; shared accepted transitions plus updated 22-case suites | Matched in local checks |
| Actual consumer behavior | Current roots/normal exports and bounded original-parent comparisons retained separately | Scoped, not broad parser isolation |
| Mandatory normal install/test wiring | Existing hooks/scripts unchanged; each install applies six assets | Matched in source/local checks |
| Exact-source Linux/macOS/native qualification | Required first-push results must bind the eventual revision | Pending |
| Maintained replacement/scanner closure and physical effectiveness | Package 3.0.3 and three advisory identities retained | Unverified/open |

No package publication, deployment-only branch update, manual dispatch, approval
inheritance, certificate authority change, device write or native installation
is part of this migration. The primary Examples owner's five dirty files remain
untouched. Independent examples retain their separate public package boundaries.
