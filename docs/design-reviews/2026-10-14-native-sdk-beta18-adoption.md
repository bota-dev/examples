# Public beta.18 adoption: native and Flutter examples

## Scope and immutable source

The owner requests the latest publicly installable SDK. Native beta.18 became public
after beta.17 adoption at `a7b34175eff07b6ab55af66991ae8a60043930f1`; the
[beta.17 platform review](2026-10-14-native-sdk-adoption.md) and its successful
hosted results qualify that earlier package/source, not this update.
The [repository-wide beta.18 review](2026-10-14-beta18-sdk-adoption.md) owns the
publication inventory and exact consuming hosted results. The
[integrated decision](../design-decisions/2026-10-12-integrated-recordings.md)
and [operation contracts](../example-contracts.md) continue to govern scope.

This pass keeps the same six platform roots, IDs, lifecycle code and recording
scope. All six now select exact public beta.18. Flutter became available on
pub.dev on October 14 Pacific, after the earlier `6dd54747` snapshot retained
beta.17. New Flutter manifests/locks and checks below qualify that later package;
all application/controller source and other locked dependencies remain unchanged.
This pass changes exact SDK pins/locks and current documentation only.
No retained state is reset or migrated, no unpublished package/local SDK source
is required, and no device, live API or provider operation is executed.

## Public inputs verified anonymously

| Artifact | Selected public identity |
| --- | --- |
| Maven AAR | SHA-256 `9547094c3fc20c7a120ce3c4b967435c3de7865de72af447ea75a7ef359b91cc` |
| Maven POM | SHA-256 `ce7dd6747162852efceb34cc6472ab4d97e6dda531743136c771f20f35b322e4` |
| SwiftPM tag | `v2.0.0-beta.18`, peeled commit `0962c8ccb8a4d407179309abae574bffb6e32933` |
| SwiftPM binary | SHA-256 `aded7f6fe9fdb5a2f681c81ce4ade2b9cc67aa14abd90487b97c86fd2f7f6b7a`, matching tagged manifest |
| Flutter archive | Exact public beta.18, 166,142 bytes, SHA-256 `30441cc7c83bb9cef7fddac19d047a59b4ad38c4a3dcb27de3dad4700613ab4a`, matching metadata and anonymous download |

The Swift annotated-tag object is `c3bb24c00a3f37bae0b653368c4d48af9ccc0b7e`;
resolved locks select the peeled commit instead. Public beta.17/beta.18
`DeviceManager.swift`, `RecordingManager.swift` and `DeviceControlManager.swift`
are identical after line-ending normalization, including exact-serial connection,
status streams, fresh pairing and metadata catalogs. No consumer API workaround
is needed. A public checksum/source match does not establish macOS compilation.

The installed public beta.18 Dart `lib/src/managers.dart` is also identical to
the installed beta.17 interface after line-ending normalization. It still lacks the
fresh pairing read and encrypted-v2 host/session/commit contract required for
safe native capture integration. This does not mean the SDK has no legacy
recording list/sync methods. The Flutter examples keep their existing connect/
status scope; a tag-only source check never substitutes for public pub.dev
availability, a verified archive hash or consuming native build evidence.

## Acceptance and checks

| Requirement | Selected-version evidence | Status |
| --- | --- | --- |
| Native public package provenance | Anonymous Maven AAR/POM and Swift binary downloads above; exact manifests/Swift JSON locks | matched |
| Narrow dependency change | Regenerated Gradle locks differ only in the exact Bota17-to18 entry; all other resolved packages retained | matched |
| Kotlin connect/catalog native compatibility | Targeted update builds pass in 74/68 seconds; separate frozen builds pass in 48/50 seconds on JDK17/SDK36; catalog reruns all16 JVM cases, zero failures/errors/skips | matched locally |
| Latest public Flutter package | Both installed package configs resolve public beta.18; normal pub get changes only Bota version/hash and separate enforced-lock resolution succeeds | matched |
| Flutter lifecycle/content compatibility | New beta.18 analysis and existing 6 connect/38 integrated cases pass; 2/10 Dart files format unchanged; license gate 5 fixtures/44 package notices passes | matched locally |
| Flutter Android composition | New public beta.18 debug APKs pass in 43.6 seconds (connect) and 64.4 seconds (integrated), Flutter 3.47.5/JDK17/SDK37; both final-source hosted APK jobs pass | matched locally and hosted at `291706c7` |
| Apple compilation | Both beta.18 SwiftPM resolution/macOS builds pass at `6dd54747`, links below; no local Apple compiler | matched hosted for unchanged native roots |
| Scope/lifecycle/state preservation | No application/controller/native source edits; no local state/device operations | matched in source |
| Physical, provider and storage acceptance | Not executed in this dependency-adoption pass | unverified |

Historical beta.17 build/test/APK evidence is intentionally kept separate. The
platform current READMEs are updated only as their public versions
become available. Apple physical behavior, iOS Flutter host support and native
encrypted-v2 Flutter integration remain separate limits, regardless of version.

## Historical Flutter qualification and publication transition

The [independent Flutter beta.17 job](https://github.com/bota-dev/examples/actions/runs/38654533678/job/116161047442)
and [integrated Flutter beta.17 job](https://github.com/bota-dev/examples/actions/runs/38654533509/job/116161047923)
passed at `a7b34175eff07b6ab55af66991ae8a60043930f1`. The
[beta.17 review](2026-10-14-native-sdk-adoption.md) preserves their original local
checks, archive identity and APK hashes. The `6dd54747` snapshot correctly used
native beta.18 with Flutter beta.17, its latest public package at that observation;
its [independent Flutter beta.17 job](https://github.com/bota-dev/examples/actions/runs/38660573465/job/116180576977)
also passed. Neither historical result is beta.18 Flutter acceptance.

The later public beta.18 archive was verified before changing either pub pin.
Both installed configs now resolve `bota_app_sdk-2.0.0-beta.18`; the plugin's
Android version file and Apple dependency select beta.18. Both regenerated locks
change only Bota version/hash. New analysis, tests, licenses and APK builds above
qualify this package locally; the final consuming hosted jobs also pass below.
The four native beta.18 roots are unchanged. SDK-free API/backend code is unaffected.

## Hosted native beta.18 qualification at 6dd54747

Both SwiftPM resolve/macOS build jobs and both Kotlin package/APK jobs completed
successfully at source `6dd54747ac50d631f4bfb6f2199464707b940808`:

| Native beta.18 example | Successful job |
| --- | --- |
| Swift connect | [116180576687](https://github.com/bota-dev/examples/actions/runs/38660573551/job/116180576687) |
| Swift catalog | [116180577319](https://github.com/bota-dev/examples/actions/runs/38660573607/job/116180577319) |
| Kotlin connect | [116180576348](https://github.com/bota-dev/examples/actions/runs/38660573414/job/116180576348) |
| Kotlin catalog/JVM guards | [116180576423](https://github.com/bota-dev/examples/actions/runs/38660573426/job/116180576423) |

These native roots are unchanged in the later Flutter update. Hosted compilation
qualifies the recorded package/source, not physical Bluetooth or cleanup behavior.

## Local beta.18 Kotlin debug APKs

No artifact below was installed on a phone. These checks establish compilation
and bounded simulated catalog behavior, not Bluetooth/device acceptance.

| Example | SHA-256 |
| --- | --- |
| Kotlin connect | `750103c6b9c25935278b14dd039af6a6016ea442631a88247c3335141acc8d3c` |
| Kotlin catalog | `6fd55ebfbd8f35c43f858e2ccf3ce43b12ab7e0b00a07245fed96d44e25778b0` |

## New local beta.18 Flutter debug APKs

Both APKs below use the newly public beta.18 pub archive, with all existing
application source and native host IDs retained. No APK was installed on a phone.

| Flutter example | SHA-256 |
| --- | --- |
| Connect | `e405f35b5e2e3f1658a23d10374cac5951d831c340f63b9b9d0625abe8fb3008` |
| Recordings | `1f8104e73badef569bb6a2ad6b0fe7c22084f2bff35a4bd99dd61ce917f73e79` |

Flutter 3.47.5 automatically amends the older standalone analyzer config during
commands. That generated exclusion change was restored exactly; direct Dart
analysis with the original tracked config also passes. No analyzer gate is
weakened. The existing plugin KGP migration/SDK XML warnings remain; no claim
covers a later Flutter toolchain, iOS host, live API/provider or physical device.

## Final hosted Flutter beta.18 qualification

Both new package consumers pass at exact all-beta.18 source
`291706c7e5c3cd00dde577ed9fd22f8af4937df7`:

- [Flutter connection](https://github.com/bota-dev/examples/actions/runs/38661965821/job/116185094839): frozen public install, analysis, six widget cases, Android APK assembly/upload.
- [Flutter Recordings](https://github.com/bota-dev/examples/actions/runs/38661965688/job/116185094809): frozen install, license checks, analysis, 38 cases and Android APK assembly.

The four Kotlin/Swift beta.18 source trees and their owning workflows remain
identical to the successful `6dd54747` inputs documented above. The global review
keeps these inherited results separate from the 15 final-source jobs. None of
these builds installs a phone app or qualifies physical transfer/cleanup.
