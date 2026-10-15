# Latest public SDK adoption: native beta.18, Flutter beta.17

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
scope. Android/Apple select beta.18; both Flutter roots retain beta.17, the
latest public pub.dev version. Flutter manifests, locks and application source
remain identical to qualified source `a7b34175`. This pass changes exact native
SDK pins/locks and current documentation only.
No retained state is reset or migrated, no unpublished package/local SDK source
is required, and no device, live API or provider operation is executed.

## Public inputs verified anonymously

| Artifact | Selected public identity |
| --- | --- |
| Maven AAR | SHA-256 `9547094c3fc20c7a120ce3c4b967435c3de7865de72af447ea75a7ef359b91cc` |
| Maven POM | SHA-256 `ce7dd6747162852efceb34cc6472ab4d97e6dda531743136c771f20f35b322e4` |
| SwiftPM tag | `v2.0.0-beta.18`, peeled commit `0962c8ccb8a4d407179309abae574bffb6e32933` |
| SwiftPM binary | SHA-256 `aded7f6fe9fdb5a2f681c81ce4ade2b9cc67aa14abd90487b97c86fd2f7f6b7a`, matching tagged manifest |
| Flutter archive | Exact public beta.17, SHA-256 `75693410b2c7e41e8e9b3d08ffebdda51c6844d6adfc735803854120945e7a5a`; beta.18 registry entry is absent |

The Swift annotated-tag object is `c3bb24c00a3f37bae0b653368c4d48af9ccc0b7e`;
resolved locks select the peeled commit instead. Public beta.17/beta.18
`DeviceManager.swift`, `RecordingManager.swift` and `DeviceControlManager.swift`
are identical after line-ending normalization, including exact-serial connection,
status streams, fresh pairing and metadata catalogs. No consumer API workaround
is needed. A public checksum/source match does not establish macOS compilation.

The tagged beta.18 Dart `lib/src/managers.dart` is also identical to the
installed beta.17 interface after line-ending normalization. It still lacks the
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
| Latest public Flutter package | Both roots retain beta.17 manifests/locks/source from `a7b34175`; actual pub.dev latest is beta.17 and exact beta.18 lookup returns404 | matched for beta.17 |
| Flutter compatibility | Qualified beta.17 local checks and two hosted Flutter jobs at `a7b34175` are unchanged; all22 repository CI jobs passed at that source | matched for beta.17; no beta.18 build claim |
| Apple compilation | Existing macOS workflow must resolve/build these exact new pins | unverified locally |
| Scope/lifecycle/state preservation | No application/controller/native source edits; no local state/device operations | matched in source |
| Physical, provider and storage acceptance | Not executed in this dependency-adoption pass | unverified |

Historical beta.17 build/test/APK evidence is intentionally kept separate. The
platform current READMEs are updated only as their public versions
become available. Apple physical behavior, iOS Flutter host support and native
encrypted-v2 Flutter integration remain separate limits, regardless of version.

## Retained Flutter qualification

The [independent Flutter beta.17 job](https://github.com/bota-dev/examples/actions/runs/38654533678/job/116161047442)
and [integrated Flutter beta.17 job](https://github.com/bota-dev/examples/actions/runs/38654533509/job/116161047923)
passed at `a7b34175eff07b6ab55af66991ae8a60043930f1`. The
[beta.17 review](2026-10-14-native-sdk-adoption.md) preserves their exact local
checks, archive identity and APK hashes. No beta.18 Flutter pin, lock or native
build is asserted. SDK-free API/backend code is unaffected by this per-facade
selection. Later Flutter upgrades require an actual public archive and new
consuming checks; a native beta.18 package or Git tag cannot substitute.

## Local beta.18 Kotlin debug APKs

No artifact below was installed on a phone. These checks establish compilation
and bounded simulated catalog behavior, not Bluetooth/device acceptance.

| Example | SHA-256 |
| --- | --- |
| Kotlin connect | `750103c6b9c25935278b14dd039af6a6016ea442631a88247c3335141acc8d3c` |
| Kotlin catalog | `6fd55ebfbd8f35c43f858e2ccf3ce43b12ab7e0b00a07245fed96d44e25778b0` |
