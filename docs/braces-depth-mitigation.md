# Scoped braces depth mitigation — October 7, 2026

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
