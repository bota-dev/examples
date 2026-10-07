# Dependency security remediation

Current migration checkpoint: the [App SDK migration](docs/app-sdk-migration.md)
aligns Expo 57 with React Native 0.86.3 and React 19.2.3. The historical versions
and export limitations below describe their dated checks. The decoder/Xcode
overrides and guarded adapter remain required; the existing security tests
must pass against the new consumer graph before release.

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

## URL decoder follow-up (2026-09-26)

Dependabot #69 / [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)
is addressed by a `query-string@7.1.3`-scoped **decode-uri-component 0.5.0**
override. This MIT release was published June 29, 2026. Both Expo Router 56.2.15
and React Navigation core 7.21.5 resolve the same query-string copy. The decoder
is ESM, so `scripts/patch-query-string.mjs` adapts its single import to
`require('decode-uri-component').default` at postinstall. Complete original and
patched source SHA-256 hashes plus an exact consumer-version check reject
unexpected source; repeated application is harmless. This uses no additional
dependencies. The lock changes one package entry plus root install-script and
engine metadata. Node >=20.19.4 matches the README's existing supported minimum
and supports the synchronous ESM import; verification uses Node 22.23.2.

Run normal `npm ci` with lifecycle scripts enabled. If installation intentionally
disables scripts, run `npm run postinstall` before using the app or testing.
Do not remove the override or adapter independently: an unadapted CommonJS
consumer receives an ESM namespace rather than a callable decoder. Remove both
when upstream query-string and both router consumers support a patched decoder,
then rerun frozen install, router regressions and platform exports. A new nested
query-string copy fails the lock test and requires a fresh compatibility review.

Two deterministic regression checks previously required 258/259 native decoder
calls for 36 malformed characters and failed their linear work budget. Both
now pass through the actual Expo and React Navigation route parsers. Unicode,
repeated/empty values, literal plus, malformed bytes and encode/decode behavior
pass before and after. Patch repeatability/drift rejection and lock coverage are
also checked. All **25 tests**, frozen install, both typechecks and backend build
pass; `npm audit` reports **zero vulnerabilities** at this checkpoint.

Metro exports JavaScript for iOS (1,425 modules) and Android (1,517 modules) with
`expo export --platform ios --platform android --no-bytecode`. This establishes
bundler compatibility, not Hermes bytecode/native/device qualification; the
missing Hermes compiler noted above remains a separate baseline issue. The
scoped decoder replacement, guarded interop and exercised route contracts match
the acceptance criteria. Hosted CI and scanner closure must still be confirmed
after push, independently of this source and local-audit evidence.

<a id="node-forge-open-advisory"></a>
## Open node-forge advisory (2026-10-02)

Subsequent October 7 checkpoint: a pinned downstream parser guard is now
mandatory in all three affected install roots. See [mitigation and checks](docs/node-forge-parser-mitigation.md).
The following October 2 investigation remains historical; all three alerts
remain open on unchanged 1.4.0 with no official patched version.

Dependabot [#108](https://github.com/bota-dev/examples/security/dependabot/108),
[#109](https://github.com/bota-dev/examples/security/dependabot/109) and
[#110](https://github.com/bota-dev/examples/security/dependabot/110) remain open for
[GHSA-86w9-cpqp-85rv / CVE-2026-85393](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
This high-severity RSA signature-verification issue affects node-forge through
1.4.0, including the latest version returned by the
[npm registry](https://registry.npmjs.org/node-forge) on this date. The advisory
lists no patched version; [upstream fix #1152](https://github.com/digitalbazaar/forge/pull/1152)
is still unmerged. The earlier zero-vulnerability audit above is historical.

The recording-sync app lock resolves `expo@57.0.4` → `@expo/cli@57.0.27` →
`node-forge@1.4.0`, both directly and through
`@expo/code-signing-certificates@0.0.6`. The current CLI is already the latest
stable release. The newer certificates package 0.0.7 still uses node-forge 1.4.0
and its verification functions, so that update does not fix this advisory.

Inspected consumers are Expo's Node signing tools, including certificate/CSR
verification. No direct node-forge use was found in the example app/backend,
native upload adapter, or public RN SDK source. The app does not configure
Expo update signing. These observations do not prove the vulnerability
unreachable or qualify the dependency as safe.

No lockfile override, local crypto patch, audit suppression or alert dismissal
was applied. Keep the alerts open; adopt a reviewed patched upstream release
when available, then verify the actual Expo signing consumers and scanner
results. Current build/test success does not remediate this dependency finding.

## October 7 scoped braces source guard

The legacy root and both independent React Native apps retain their existing
query-string/Forge hooks and add standalone mandatory guarded `braces` 3.0.3
installation. Locks/public SDKs/device and HTTP code remain unchanged. Root
`npm test` and each independent app test chain require 16 installer/parser/actual
micromatch controls. Source qualification, scanner identity, hosted native builds
and physical installation remain separate. See [review](docs/braces-depth-mitigation.md).

## October 7 new build-dependency fixes

Four independent locks select source-map-js 1.2.2; the legacy root also selects
shell-quote 1.11.0 and a qualified parent-scoped selector-parser 7.1.6 override.
Each install root has required public-consumer tests; Web CI now runs `npm test`.
See the [source compatibility review](docs/build-dependency-remediation.md) for aged tarballs, tests and
bundled-parser limits. Hosted/scanner and physical acceptance remain separate.
