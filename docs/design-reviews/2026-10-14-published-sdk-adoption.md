# Published SDK adoption — October 14, 2026

Historical beta.17 qualification. The subsequent
[beta.18 adoption](2026-10-14-beta18-sdk-adoption.md) tracks the release that
became public during this pass; results below qualify beta.17 only.

Owner request: use the latest SDK across the examples. This follows the public
package and lifecycle boundaries in [DESIGN.md](../../DESIGN.md),
[ARCHITECTURE.md](../../ARCHITECTURE.md) and
[example contracts](../example-contracts.md). It does not implement the remaining
integrated-client roadmap or establish new live/device acceptance.

## Published version and scope

Anonymous registry reads on October 14 identify **2.0.0-beta.17** as the newest
published synchronized SDK. Both npm packages have `beta` at beta.17 while
`latest` remains beta.0; use exact versions. Maven, pub.dev, CocoaPods and the
GitHub release expose beta.17. At observation, beta.18 is absent from these public
registries and its [protected release](https://github.com/bota-dev/app-sdk/actions/runs/38632018471)
awaits owner approval. Preparing or tagging beta.18 is not public availability.

Public references: [React Native npm](https://registry.npmjs.org/@bota.dev/react-native-app-sdk),
[Web npm](https://registry.npmjs.org/@bota.dev/web-app-sdk),
[Maven metadata](https://repo.maven.apache.org/maven2/dev/bota/bota-app-sdk/maven-metadata.xml),
[Flutter metadata](https://pub.dev/api/packages/bota_app_sdk),
[CocoaPods beta.17](https://trunk.cocoapods.org/api/v1/pods/BotaAppSDK/specs/2.0.0-beta.17)
and [public release](https://github.com/bota-dev/app-sdk/releases/tag/v2.0.0-beta.17).

All seven focused device examples, both integrated mobile clients and the
legacy workspace adopt exact beta.17 pins. SDK-free API examples and the Web
recording application do not gain a device dependency. Matching Maven host
pins, SwiftPM revisions, pub archive hashes and npm SRI move together.

Apple's peeled public tag commit is
`b8a31c5a521cdac18c613c7920a277c399296744`; its SwiftPM archive SHA-256 is
`19a72e01b00f202a4683b747717f98231d9a9d41927a20a30949bdf53e9278e3`.
The Flutter archive SHA-256 is
`75693410b2c7e41e8e9b3d08ffebdda51c6844d6adfc735803854120945e7a5a`.
Downloaded archives match their public checksums. All installs consume public
artifacts; no SDK source checkout or private app helper is a prerequisite.

## Preserved behavior and limits

RN continues to use the public native-workflow compatibility factories.
Installing beta.17 does not implement the generated-JS `/runtime` route, its
OS ports or native-autolinking exclusion. The pending beta.18 BLE PLX generated
adapter MTU correction does not qualify beta.17's generated route here.
SDK receipt/cleanup authority, original backend origins, client identities,
native capture journals and cloud intent journals are retained.
The legacy app's Expo `appVersion` OTA policy advances to 0.3.0 along with its
package metadata, so a beta.17 bundle cannot target the old 0.2.0/beta.6 binary.
No OTA is published. The independent RN clients have no update/runtime policy
or EAS update project configured and retain their identities and versions.

Public beta.17 Flutter still lacks a fresh pairing-state read and the structured
encrypted-v2/session host surface required by RN sync. Its ordinary recording
catalog is not absent; the existing example intentionally remains connect/status.
Web exposes encrypted catalog metadata but lacks the fresh pairing-state gate
needed by that sync workflow. A package bump adds no host, pairing or transfer
acceptance to these samples. Legacy unauthenticated backend/raw-token binding
limitations remain explicit.

Fresh Windows checkouts exposed CRLF conversion of hashed signing provenance.
The narrow `.gitattributes` rule retains LF for those three public metadata files.
Their original Git bytes and declared SHA-256 remain unchanged; integrity guards,
guard indexes and all guarded SDK-independent vendor payloads remain intact.

## Acceptance review

| Requirement / authority | Evidence | Status |
| --- | --- | --- |
| Newest publicly installable SDK, exact pins | Repeated five-registry readback, public release and npm/Maven/SwiftPM/pub manifests and locks | Matched; beta.18 remains unpublished at review |
| Public, reproducible install graph | Ordinary frozen installs with all original hooks; npm SRI, pub/Maven/Apple checksums and independent lock comparison | Matched locally; no non-SDK dependency drift |
| Preserve app behavior and lifecycle | Existing controllers, public methods, authorization, journal/origin and SDK cleanup code retained; existing controller/native callback cases | Matched in source/tests; physical acceptance unverified |
| Native binary / OTA compatibility | Legacy appVersion/runtime 0.3.0; app ID and journals retained; other RN roots configure no OTA runtime/update project | Matched in source; rebuild required, no OTA published |
| Existing dependency mitigations remain enforced | Full legacy 110 tests and mandatory 803-signing/1,252-parent-asset install guards; RN 58/100 tests retain signing, Metro and map checks | Matched locally; original guarded bytes unchanged |
| Browser SDK host | Frozen npm install, 15 tests, TypeScript and Vite/WASM production build on Node 22.23.2 / Windows; hosted Web SDK check | Matched locally and at a7b3417 |
| Kotlin / Flutter host builds | Two frozen Kotlin APKs, 16 JVM tests; Flutter clean analysis, 6/38 tests, both APKs, five license fixtures / 44 notices | Matched locally; [platform details](2026-10-14-native-sdk-adoption.md) |
| RN source and Android hosts | Two frozen installs, typechecks, 58/100 tests, both 448-identity license gates and ordinary Android/Hermes exports; exact-source APK builds and 10 recording-host JVM tests; hosted Android/iOS connection and Android recording jobs | Matched locally and in hosted consumers at a7b3417 |
| Legacy host and exports | Frozen install, 110 tests, both typechecks/backend build; final 0.3.0 Android/iOS/Web exports and hosted four-ABI Android APK pass | Matched locally and at a7b3417 |
| SwiftPM / macOS hosts | Public exact revision/checksum and signatures; both hosted SwiftPM resolution/macOS builds succeed | Matched in hosted consumers at a7b3417; no local Apple compiler |
| Documentation follows manifests | Current README/design/agent/public setup guidance; 77 catalog IDs / 84 documents / 449 indexed links, nine discovery regressions; 474 changed/new Markdown links checked separately | Matched locally; historical package/device evidence retained |
| Physical, live-backend and deployment acceptance | No device, firmware, account, upload, provider or deployment operation performed | Unverified; prior package-specific results are historical |

Only the SDK package versions and required public resolution metadata change
in dependency locks; the legacy npm resolver also moves its SDK entry to the
workspace-local install location and aligns that app's package metadata to 0.3.0.
All other dependency tuples are preserved. Runtime source changes are required only if
actual public-package checks demonstrate incompatibility. Exact hosted results
must be recorded after the validated source is pushed.

RN Android exports used the normal public compatibility entry and default Node
heap. Connection: 633 modules / 247.7 seconds, Hermes bundle SHA-256
`e4096311a491c9191d7418f1ea95150a98e0c6afd6a14915f77d9648fad77c6c`.
Recordings: 644 modules / 314.3 seconds, bundle SHA-256
`00e2028151f55bbe8a46c3e797f446219ed19e65473c5f9be51ff021ab7d73ea`.
The public SDK root includes its generated runtime, increasing transform work;
no deep imports, transform exclusions or heap overrides were introduced.

Windows native builds used independently installed short-path copies to avoid
the documented deep-path CMake limit. All 46/74 public source files matched the
current source by SHA-256 before and after Expo prebuild. Connection APK SHA-256:
`b92341bb96b187defbd96fdd743b99a059bc9f0b37b2a6e572751734a4237d31`.
Recordings APK SHA-256:
`0a5ced9ffa0466f4d84e18c2416e1274b6d2e4d17b63200f3dc6689b8abf2543`.
No APK was installed on a device.

## Hosted qualification of the SDK update

The qualifying runtime source is
[`a7b34175eff07b6ab55af66991ae8a60043930f1`](https://github.com/bota-dev/examples/commit/a7b34175eff07b6ab55af66991ae8a60043930f1).
Subsequent evidence-only Markdown updates do not change its dependency graph,
runtime source, native configuration, installation guards or workflows.

**All 13 source-validation workflows / 22 jobs succeed at this source.** Both
Kotlin builds, both Swift macOS builds, both Flutter APK jobs, RN connection
Android/iOS and the RN recording host pass. Web SDK, Web application,
backend/core, catalog and CodeQL checks pass. Legacy verification and the final
Android job also pass: Gradle completed 418 tasks in 21 minutes 10 seconds,
including arm64-v8a, armeabi-v7a, x86 and x86_64. No workflow, architecture,
timeout, heap or guard bypass was needed.

Direct qualification runs:
[RN connection](https://github.com/bota-dev/examples/actions/runs/38654533685),
[mobile recordings](https://github.com/bota-dev/examples/actions/runs/38654533509),
[legacy app](https://github.com/bota-dev/examples/actions/runs/38654533691),
[Swift connection](https://github.com/bota-dev/examples/actions/runs/38654533797),
[Swift catalog](https://github.com/bota-dev/examples/actions/runs/38654533610),
[Kotlin connection](https://github.com/bota-dev/examples/actions/runs/38654533747),
[Kotlin catalog](https://github.com/bota-dev/examples/actions/runs/38654533536),
[Flutter connection](https://github.com/bota-dev/examples/actions/runs/38654533678),
[Web SDK](https://github.com/bota-dev/examples/actions/runs/38654533700),
[Web app](https://github.com/bota-dev/examples/actions/runs/38654533543),
[core](https://github.com/bota-dev/examples/actions/runs/38654533620),
[catalog](https://github.com/bota-dev/examples/actions/runs/38654533496),
[CodeQL](https://github.com/bota-dev/examples/actions/runs/38654532216).

Public setup documentation is updated on the docs integration branch; Mintlify
production delivery remains separate. New firmware/device, actual upload and
cleanup, background behavior and missing platform hosts remain unverified or
unimplemented as described above; these build results do not close those gates.
