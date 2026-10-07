# Downstream node-forge parser mitigation — October 7, 2026

Dependabot #108/#109/#110 remain open for [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv). The three affected locks retain node-forge 1.4.0 and their existing dependency edges. There is no advisory-published patched version. The legacy workspace, RN device-connect example and recording-sync app now each apply the same narrow, independently installable parser guard. No sibling repository or shared application code is required to install/run an example.

The source guards follow proposed upstream [#1152](https://github.com/digitalbazaar/forge/pull/1152), head `ceba34402e329f0365134f23fe19898756527d65`, and [#1157](https://github.com/digitalbazaar/forge/pull/1157), head `683ab3344899cc08a581e4d5675a33e87aff7b04`. These proposals are unmerged. The change rejects unconsumed DigestAlgorithm children and nonempty ASN.1 NULL parameters; it introduces no new cryptographic algorithm.

Each root's `postinstall` applies `scripts/apply-node-forge-security-patch.mjs` to the Forge copies actually resolved by root, Expo CLI and Expo certificate tooling. It requires package name/version 1.4.0 and pristine SHA-256 `fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50`; the resulting RSA source must match `5a5be15860c0a10204075331e38a059d2d9675cc500d3f53ec8bf511d7e6c036`. Unknown version/source fails before writing that copy; already patched source is idempotent. The legacy query-string adapter still runs first. Keep install scripts enabled; after a scripts-disabled install, run `npm run postinstall` and `npm run test:node-forge-security` before using the example. Requalify/remove the backport on an official fix; do not falsify package metadata to close alerts.

## Local qualification

The SHA-512-verified public 1.4.0 tarball was published March 24, 2026, and retains its BSD-3-Clause license option. [Registry provenance](node-forge-registry-verification.json) records the archive and source hashes. Each independent pristine fixture combines that exact public Forge with its installed public Expo certificate package. Four of nine tests fail against pristine Forge; all nine pass after the guard, including malformed certificate and CSR calls through the actual Expo consumer. Positive controls cover empty/absent NULL, legacy BER, wrong digest, ordinary PKCS#1/OpenSSL agreement, RSA-PSS, CA/UTF8/PEM/X.509, normal Expo manifest signing and development-certificate issuance. Source/version drift and idempotence are checked. Synthetic signatures use the generated test private key; these cases do not prove keyless forgery or deployed exploitability.

| Install root | Frozen install / mandatory guard | Existing and added tests | Other checks |
|---|---|---|---|
| Legacy workspace | 758 packages, all resolved consumers guarded | 36 pass, including nine Forge/Expo cases | Typecheck, backend build, 696-package license scan, Android/iOS/web export pass |
| `app-sdk/react-native-device-connect` | 471 packages, same guarded source | One identity + nine Forge/Expo cases pass | Typecheck, 445-package license scan, required Android export pass |
| `end-to-end/react-native-recording-sync/app` | 471 packages, same guarded source | 15 host + nine Forge/Expo cases pass | Typecheck, 445-package license scan, configured Android export pass |

The connection example's additional all-platform export attempt fails because its existing app lacks `react-native-web/dist/exports/Button`; no dependency, app source or export gate was weakened to hide that failure. Its existing workflow requires Android export, which passes. The sync app config targets Android; its successful `--platform all` invocation is Android-only evidence. Native CI, compiled binary identity, installation and physical acceptance remain separate.

## Design review

| Requirement | Evidence / conformance | Remaining gate |
|---|---|---|
| Independent installs/public SDK contracts | Each affected root contains its own applier and test; public SDK versions/API/host flows unchanged | Existing hardware/runtime acceptance remains separate |
| Guard actual signing consumers without lock/version spoofing | Frozen installs and actual Expo CSR/certificate calls; identical reviewed RSA hashes, unchanged locks | Scanner records remain open on affected version 1.4.0 |
| Fail on drift and enforce ongoing checks | Mandatory postinstall and tests in existing root/independent CI | Exact-source hosted native/build result |
| Preserve prior dependency/security/lifecycle repairs | Legacy adapter, ordinary tests, typechecks/build/exports pass | No new physical device or production operation |

Documentation search covered `node-forge`, the applier/test names and DigestAlgorithm across internal/public docs and repository instructions. Certificate target architecture and physical runbooks need no normative change: this mitigates Node tooling parsing and does not establish certificate-publisher authority, rotation, installation or recovery controls.
