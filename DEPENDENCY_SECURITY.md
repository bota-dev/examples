# Metro image-parser remediation

## Scope and choice (2026-09-26)

Dependabot #100/#101 concern image-size 1.2.1 parser loops:
[ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and
[JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq).

Supported patch updates replace React Native's Metro 0.83.3 with **0.83.8**
within `^0.83.1`, and @expo/metro 56.0.0 with **56.0.2** within `~56.0.0`.
The wrapper pins its aligned Metro family to **0.84.5**. Metro releases were
published August 19, 2026; the wrapper August 21, beyond the seven-day age floor.
These parents remove image-size rather than forcing its incompatible 2.x API
under old Metro, which still passes file paths to the parser.

The lock changes 74 entries, including Metro-family hoisting/nesting and their
Hermes, HTTP content-negotiation and parser/helper dependencies. New/changed
entries declare MIT. React Native 0.81.5, Expo 57.0.4, React 19.1.0, workspace
dependency ranges and example source are unchanged. Expo Metro is now hoisted;
the React Native CLI resolves its own nested 0.83.8 family. Tests resolve from
the actual consumers so hoisting cannot silently hide an affected path.

## Verification and boundaries

On Node 22.23.2:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm ls metro @expo/metro
```

All 11 checks pass: lock safety, each consumer's bounded ICNS/JXL rejection,
malformed HEIF rejection, PNG/SVG dimensions, invalid/non-image handling and
file-based @2x asset metadata. Five checks failed before (one lock check and
four ICNS/JXL regressions); six compatibility checks passed before and after.
The synchronous append budget safely bounds the old loops. Tests are original
examples-repo fixtures against installed upstream consumers, not copied private
application helpers. They are representative, not exhaustive format validation.

Clean install, both workspace typechecks and the backend TypeScript build pass.
The repository previously had no test script or CI workflow; the new read-only
CI repeats frozen install, tests, typechecks and backend build on main/PRs.
Its successful backend build is not a successful mobile build. iOS Hermes export
fails before and after because `hermes-compiler/package.json` is absent, with
1,427 modules processed. The existing mixed Expo/native baseline and deprecated
SDK/tooling warnings remain separate; no dependency bypass or audit suppression
is used. There is no lint or license-gate script; inspected MIT metadata is not
a full transitive license-policy review. Android/native/device operation is
unverified.

Conformance: scoped supported-parent removal and exercised Metro asset contracts
match the remediation requirements. Hosted CI and scanner closure must be
verified separately after the push. No tag, publication, OTA, app deployment,
AWS mutation or compliance-control approval occurs.

Keep the lock and tests together; rerun both consumer paths on future upgrades.
Rollback restores affected dependencies and reopens review.

## UUID / Xcode follow-up (2026-09-26)

Dependabot #56 / [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
is addressed with an exact `xcode@3.0.1` override to UUID **11.1.1**. This is
a deliberate cross-major resolution scoped to the only UUID consumer; Xcode
uses CommonJS `uuid.v4()` without output buffers. The patched MIT release was
published April 29, 2026, beyond the seven-day age floor. Exactly one lock entry
changes, from UUID 7.0.3; workspace dependencies and application code stay fixed.

`npm test` now includes the UUID suite in CI. Its lock/advisory check and
undersized, negative-offset and overflowing-buffer regressions fail before the
fix; Xcode project group generation and serialization pass before and after.
The three UUID tests plus the eleven Metro tests pass after a frozen `npm ci`;
both workspace typechecks, backend build and `npm ls uuid` pass on Node 22.23.2.
These checks match the scoped remediation and actual Xcode consumer contracts.
Native builds, the existing Hermes export gap, hosted CI and scanner closure
remain separate verification gates; no native/device qualification is claimed.

Remove the override when Xcode supports a patched UUID in its own dependency
range, then repeat frozen install and the actual-consumer tests. An ESM-only
UUID release must not be substituted without reviewing Xcode's CommonJS usage.
decode-uri-component #69 remains a separate Medium finding.

## Express query parser follow-up (2026-09-26)

Dependabot #72 / [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx)
and #87 / [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g)
both require **qs 6.16.0**. Supported patches Express **4.22.3** and body-parser
**1.20.8** admit that version; exactly these three lock entries change within
existing parent/workspace ranges. Their releases are September 14, September 8
and August 29 respectively, beyond the seven-day age floor. Express/body-parser
are MIT and qs is BSD-3-Clause. No override or application-source change is needed.

The installed Express and body-parser consumers each reject bracketed comma
arrays above the configured limit and safely stringify attacker-controlled
`constructor.isBuffer` data. All four regressions fail before and pass after.
A loopback HTTP test verifies nested query/form values, Unicode, repeated values
and body-parser parameter-limit rejection before and after. The example app
currently uses JSON middleware; the form check covers the installed parser's
contract, not an additional application endpoint or a reachability claim.

On Node 22.23.2, frozen install, all 19 tests, both typechecks and the backend
build pass. The supported-parent update and exercised middleware contracts
match the scoped acceptance criteria. Hosted CI/scanner closure and deployed
backend behavior remain separate verification gates. Keep the lock and tests
together on future dependency updates.
