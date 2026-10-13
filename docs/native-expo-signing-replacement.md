# Native Expo signing-tool replacement â€” October 12, 2026

This tree removes `node-forge` from the legacy workspace, independent RN device
connection and RN recording-sync app. GitHub classifies all three alerts as
**runtime/transitive** dependencies. The CLI consumer description does not lower
the scanner scope or establish safe reachability. It replaces the two actual public parents:
Expo CLI 57.0.27 and `@expo/code-signing-certificates` 0.0.6. These local artifacts
use distinguishing `+examples.native.1` build metadata and exact `file:` tar SRI;
they are independently maintained development tools, not official Expo releases.
No private Demo/One provider, helper, adapter or runtime implementation is used.

Each install root contains its own complete source, public provenance, licenses,
artifact inventory and optional `vendor/expo-native-signing/rebuild-payloads.py`
(Python 3.12+ standard library, offline). Normal installation needs Node 22.23.2
and its npm 10.9.8; the Python builder is not an installation prerequisite.
The builder preserves upstream CLI member modes, deterministic archive paths,
zero timestamps/ownership and a portable gzip header. Normal unflagged `npm ci`
runs the native integrity check and every unrelated existing install guard.
The separate lock-only resolver uses no lifecycle qualification credit.

## Public contracts and deliberate bounds

The adapter implements the fourteen synchronous public signing functions using
Node/OpenSSL and exact public ASN.1 packages. Types expose native RSA `KeyObject`,
immutable certificate metadata and native CSR objects. They do not advertise
Forge's general PKI object ABI. The actual public CLI manifest/local-certificate
callers use those fields and are exercised synthetically.

Signing certificate/CSR input is the ordinary RSA/SHA256 profile with AlgorithmIdentifier parameters absent or an empty NULL. Bare SPKI/PKCS8 imports validate `rsaEncryption` parameters
before native key import. Constrained RSA-PSS, EC signing, arbitrary certificate
algorithms and encrypted-key formats are outside this profile. Signing/CSR PEM
imports require one block. Apple identity lookup has a separate algorithm-neutral
DN-only reader that selects the first certificate block from `security` output;
its synthetic caller test does not run Apple Keychain or establish certificate trust.

PEM output retains 64-column CRLF. Printable names retain PrintableString; other
well-formed names use explicit UTF8. NUL, malformed surrogates and oversized names
refuse. Nine-byte serial draws retain the upstream masked numeric value with
minimal positive DER encoding; an all-zero draw refuses rather than inventing a
different serial. Development validity preserves the literal upstream local-calendar
calculation, including its month/DST behavior. The caller must still establish
trusted issuer and app/scope authorization; these synthetic exports provide no
management certificate installation, bootstrap, rotation or recovery authority.

The CLI archive changes only package metadata/dependency removal and its public
Apple certificate reader; the stale map for that adapted file is removed.
Its actual `codesigning.js` and the other 795 upstream assets remain byte-pinned.
Every installed CLI/provider file is verified: 797 CLI and six provider assets.
The guard rejects source/archive drift and any owning lock/physical Forge copy.

## Selected inputs and source reconciliation

The nine exact public additions are `@peculiar/asn1-csr`, `asn1-schema` and
`asn1-x509` 2.10.0, `@peculiar/utils` 2.0.3, `asn1js` 3.0.10, `pvtsutils` 1.3.6,
`pvutils` 1.2.0, `reflect-metadata` 0.2.2 and `tslib` 2.8.1. Each public metadata
body, HTTP clock, selected publish time, URL, SRI, archive member set and license
is retained in each root's `public-provenance.json`. The latest new selected
publication is September 27 11:59:59.091 UTC, giving the seven-day bundle floor
**October 4 11:59:59.091 UTC**. No `expo-updates` is selected; another app's Updates
release floor does not transfer. All other old public content tuples are conserved.

Qualification fixtures bind da2347777a9890dd4996e2e4e0c2d237409e5e8e. Current base
985c4f606ef7616c022c1a53ebc1440f75326d0b changes fourteen documentation paths only;
all 186 selected owning source/guard/workflow inputs are exactly conserved.
The current recording-family design reset and historical archives are preserved.
The full owning tests, types, license, export and physical inventory records below
remain the exact-input da234 fixture evidence. Fresh current985 ordinary `npm ci`,
all 32 installed native/caller cases and full `npm ls` are separately green after
canonical source/provenance formatting and the physical manifest-name guard
correction. They retain all unrelated hooks; canonical source locks are unchanged.

| Owning root | Raw Git â†’ normal baseline â†’ candidate lock | Actual manifests / absent Windows slots | Local owning checks |
| --- | --- | --- | --- |
| Legacy `.` | 0 + 12 = 12 entries | 758 â†’ 765 / 45 â†’ 45 | Ordinary ci; 108 tests; types/backend build; 703 license identities; all-platform export |
| RN device connect | 0 + 47 = 47 entries | 471 â†’ 480 / 10 â†’ 10 | Ordinary ci; 1 identity + 32 signing + 22 braces + 4 source-map cases; types; 453 license identities; Android export |
| RN recording-sync app | 0 + 47 = 47 entries | 471 â†’ 480 / 10 â†’ 10 | Ordinary ci; 43 app + 32 signing + 22 braces + 4 source-map cases; types; 453 license identities; Android export |

The 47-entry standalone deltas include normal CLI/child/peer path relocation,
not 47 new packages or a hand-edited lock. Tuple changes are only removal of
official CLI/certificates/Forge identities and addition of native artifacts plus
the nine public components (eight newly present in legacy because tslib exists).
All three full actual `npm ls --all --json` graphs have zero problems before and
after. Beta.6 stays in legacy; beta.13 and Expo 57.0.4 stay in standalone roots;
legacy Expo 57.0.25 stays selected. Missing platform-optional slots are explicit.

Actual final standard exports pass: 57 legacy all-platform files and two Android
files each standalone. Additional JavaScript exports have complete byte parity
against their owning baselines. Raw Hermes bytecode has random compiler-temp
source names and retained differences; no raw bytecode equality is claimed.
Explicit strict declarations and the normal owning type checks pass. License
checks report no forbidden licenses, without claiming every unknown license was cleared.

## Review and remaining admission

| Requirement | Evidence | Status |
| --- | --- | --- |
| Public, independently installable development tooling | Three ordinary npm10 installs; own sources/archives; no sibling/private code; unchanged SDK/Expo tuples | Matched locally |
| Actual signing/reader boundaries and parameter refusal | 25 installed provider cases plus seven actual CLI/integrity cases per root; native verification; drift/Forge refusal; independent component review | Matched locally in stated profile |
| Preserve current app/device/backend/auth/journals | 186 byte-equal owning inputs; zero graph problems; unchanged public SDK and runtime selections | Conserved inputs; no broader conformance claim |
| Native builds and distribution | Existing legacy Android, connection Android/macOS26-Xcode26.6-CocoaPods1.16.2, recording-sync Android unit/assembly gates | Unverified for this replacement until exact-source hosted execution |
| Scanner remediation | Exact High #108/#109/#110 reads remain open with no first-patched version | Pending source publication and separate exact scanner readback |
| Source admission | Current-base reconciliation and literal code/docs/artifact nomination | Independent whole-source and parent-controlled delivery gates pending |

The previous parser-only mitigation and all failures remain dated evidence.
The first component review found and corrected bare-key parameters, leading-zero
serial value changes and multiple Apple certificate handling. A nested test-runner
observation and explicit TypeScript6 fixture invocation were corrected separately;
normal owning checks were never bypassed. Public-contract, hosted/native, scanner
and physical acceptance remain distinct. Certificate installation remains disabled.

The local project-certificate integration generates synthetic keys, writes and
reads them through the unchanged public CLI in an isolated temporary directory,
and deletes that directory in `finally`. No private key bytes are retained in
the evidence. Reviewer fixtures keep private values in process. The cached and
online Expo-root development certificate-chain branch remains unverified beyond
the declared ordinary RSA/SHA256 conversion profile; no service chain trust or
project-scope acceptance is inferred from the configured-file tests.
