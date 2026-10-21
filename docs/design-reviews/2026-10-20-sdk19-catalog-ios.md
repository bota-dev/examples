# SDK beta.19 completion and Swift iOS catalog

## Scope and acceptance

Continue the approved [design](../../DESIGN.md) and
[native-host roadmap](../../ROADMAP.md#3-fill-useful-native-platform-hosts-and-sdk-modules):
customer developers need runnable platform samples with visible public calls,
independent installation and declared limits. This follow-up adds an iOS host
to the existing Swift metadata catalog and completes the owner's request to use
the latest public SDK across the remaining six install roots. The
[earlier iOS/mobile pass](2026-10-20-ios-mobile-recording-flows.md) already
qualified four beta.19 roots and ordinary mobile media; its exact receipts
remain separate.

The remaining roots are the legacy RN workspace, RN and Web connection starters,
both Kotlin starters and the Swift catalog. No install root/catalog identity,
backend, vertical app or universal client abstraction is added. The Swift host
must share its metadata-only feature, require exact serial and fresh pairing,
fence late results and join foreground teardown. Native builds and synthetic
tests establish their stated boundaries, not physical Bluetooth behavior.

No device command, capture, transfer, retained-upload retry, cloud write, SDK
release, firmware installation, signed app or OTA delivery occurs. Legacy
catalog metadata is historical diagnostic scope; new device acceptance remains
encrypted-upload-v2 only with exact capture/ciphertext integrity, authoritative
cloud verification, signed completion receipt and receipt-gated cleanup.

## Public package inputs

Anonymous npm metadata and the public GitHub release list on October 20 confirm
`2.0.0-beta.19` is the current synchronized beta. npm `latest` remains beta.0.
The [public release](https://github.com/bota-dev/app-sdk/releases/tag/v2.0.0-beta.19)
binds tag `v2.0.0-beta.19` to `7a4ff0093629c030416f80113c585e10d0177e68`.
This consumes existing artifacts; it changes no tag, channel or publication.
The owner's latest-SDK request permits the selected October 16 SDK publication
within seven days; unrelated dependency age requirements remain in force.

| Public input | Verified identity |
| --- | --- |
| RN npm archive | MIT; 5,040,594 bytes; SHA-512 `D1zXjM28Iv9DfWAIx3SsVTPquG5a0pOuc8LQJm0xR1Yo/YSrNvRUCHpDOlDhuY7S3lceEbIDRgsIAJHHmxjtwg==` matches registry SRI |
| Web npm archive | MIT; 375,253 bytes; SHA-512 `NfsebvFuTUvDtWdI1xBgt0ZXg8E6tngM5b++S0krd7kQfVmpPt0XK76DrCWwdtuugJmks7p/MosCX2E1HWQZKw==` matches registry SRI |
| Maven AAR | SHA-256 `602abae1051673ef21d24adced5e393a0033d612e0e01b6d0cfbcff5ba3dd31d` matches Central checksum |
| Maven POM | MIT; SHA-256 `18bbfe7cd7ef06d81137ae8c646986b69adaa277e0d5ef414b12a8f95e8b3880` matches Central checksum |
| Maven module | SHA-256 `bd484b3d4dd596d5c6a371ea6246b3989d8960a16dfa773edff76446e9f4530e` matches Central checksum |
| SwiftPM | Exact public tag/peeled commit above; published binary checksum is recorded in the selected README |

The Maven detached signatures are mathematically valid in an isolated artifact
keyring using public fingerprint `E8DF58D6CF224597DF0FF95CC127165AB45FBB93`.
Independent trust in the signer's owner identity is unverified; this is separate
from public Central checksums, source/license review and consuming native builds.

## Implementation review

| Requirement | Evidence | Status |
| --- | --- | --- |
| Current public SDK in all ten roots | Four unchanged beta.19 roots plus six explicitly updated manifests/locks; exact registry inputs and source-bound qualification below | matched within the declared package/build scope |
| Preserve unrelated dependency graph | SDK-only npm tuple/owning pin and targeted Gradle locks; one reviewed Web Vite security patch described below | matched by parsed lock/text comparisons within that explicit exception |
| Swift iOS/macOS metadata-only host | Shared model/view, exact-serial connection, fresh pairing before catalog, explicit foreground lifecycle | matched in source, ten hosted tests and macOS/iOS builds; physical behavior unverified |
| Preserve uncertain state and native identities | No journal/schema/origin/identity migration or physical operation; legacy runtime alone advances | matched in source scope |
| Independent install and required guards | Normal frozen install, original signing/Metro/source-map suites, platform tests/types/builds | matched in local and exact-source hosted checks below |
| Current developer/AI discovery | Existing README/catalog IDs and public example cards updated; catalog, nine regressions, local links and public MDX compilation pass | matched locally; source/hosted/deployed documentation remain separate |
| Physical/loss/media/device acceptance | No corresponding hardware run | unverified |

The legacy lock-only resolver again retained the old nested SDK entry after
updating its manifest. Its SDK version/URL/SRI tuple is taken from the separately
npm-generated beta.19 integrated RN lock and checked against anonymous registry
metadata and the downloaded archive. A parsed comparison confirms every other
lock object/field unchanged, apart from the deliberate app version. The existing
actual-import-context regression must pass after normal `npm ci`; a successful
lock resolver alone provides no SDK-resolution qualification.

Legacy app/package/native runtime advances from 0.4.0 to 0.5.0 under the existing
`appVersion` policy. Rebuild before loading this SDK; do not send the new bundle
to older native runtimes. App identifiers, local-only auth/provisioning limits,
backend origins, journals and SDK cleanup authority stay unchanged. RN examples
retain the public native-workflow compatibility entry; no generated-JS `/runtime`
or old native pending-state migration is claimed.

## Verification

On Node 22.23.2/Windows the legacy normal frozen install passes (766 packages,
audit zero), including the original 803 signing-asset and 1,252 parent-asset
attestations and every required hook. All 111 tests pass, including the actual
app-import SDK-resolution test. Both workspace typechecks, backend compilation
and the 700-package installed license scan pass. Optimized Android/iOS/Web
export passes with 1,613/1,520/1,164 modules respectively. Its CI uses the serial
Metro transform and 4 GiB Node heap from the earlier beta.19 iOS work, preserving
normal minification/Hermes and printing actual host memory/heap limits.

| Local legacy bundle | Bytes | SHA-256 |
| --- | ---: | --- |
| Android Hermes | 10,384,983 | `074f88d88453679163cf198682d7df67235f8e1215adb943090919ae3bdd1f9f` |
| iOS Hermes | 10,176,089 | `185a3a9a9df4052a7d1d9e57f174bf8b85d6dc2f21ac4f81ce1242dd4e56d13c` |
| Web JavaScript | 6,035,678 | `32fe5eeb938cd796f50916f5f00590c3afd821876e77ad0515e1e1c521050b24` |

These local exports retain normal Metro caches and prove no installed bundle or
cold-host memory bound. Native app delivery remains separate.

Both Kotlin APKs pass targeted public-SDK lock updates and separate offline
frozen builds with identical lock hashes. All 16 existing catalog JVM tests pass.
The complete non-Bota lock text is unchanged; consumed Gradle-cache artifact
hashes equal the anonymous Central inputs above. APK IDs, minimum API 26 and
target API 36 remain unchanged.

RN connection normal frozen install (475 packages/audit zero), 58 tests, strict
types and 448-package license scan pass. Web connection frozen install, 15 tests,
types, Vite/WASM production build and 16-package license scan pass. Optimized RN
Android export passes with 633 modules and iOS with 635 modules and an
8,207,619-byte Hermes bundle (SHA-256
`231a2fd3de6162f02a69a474776432dff7a27594a554d58a9fe95c46317b9404`).
Node 22.23.2 measures a 4,144 MiB heap with the 4 GiB setting. The normal Metro
cache is retained, so this does not prove cold-transform memory. The fresh
hosted iOS job then passes cold optimized export (635 modules, 95,623 ms), normal
public resolution of 87 Pods and simulator native compilation, with measured
4,144 MiB V8 heap. The paired hosted Android APK also passes.

The Web starter's retained Vite 7.3.6 produced high advisories
[GHSA-698v-4r3x-3vcv](https://github.com/vitejs/launch-editor/security/advisories/GHSA-698v-4r3x-3vcv),
[GHSA-587h-7wmj-h5pm](https://github.com/vitejs/launch-editor/security/advisories/GHSA-587h-7wmj-h5pm)
and [GHSA-r825-w8mm-5pxw](https://github.com/vitejs/launch-editor/security/advisories/GHSA-r825-w8mm-5pxw).
Its compatible MIT 7.3.7 patch was published October 6, beyond seven days and
supporting the selected Node version. The public archive matches registry SRI;
its dependency/peer/engine/bin contracts are unchanged. This explicit security
exception changes only the Web SDK and Vite lock tuples, leaving every other
field unchanged. A fresh normal frozen install and all checks above pass; its
separate fresh audit reports zero. No blanket audit fix, alert suppression or
claim about other Vite install roots follows.

Swift/macOS/iOS compilation requires the owning hosted macOS
workflow; this Windows workstation cannot qualify Apple native code. Hosted
results bind the exact pushed source, with unchanged-input receipts stated
separately. No synthetic test substitutes for device or deployed-service proof.

Swift source `741bd3b78fad955b8332b52ea1b6db09fba33a0b` passes public SwiftPM
resolution, all ten synthetic tests, the existing macOS application and unsigned
iOS simulator/device builds in
[native CI](https://github.com/bota-dev/examples/actions/runs/39520962585/job/118964409321).
The following `aa726e3` SDK/documentation commit changes no Swift root or owning
workflow input. An independent source review confirms serial/peripheral and
fresh-pairing gates, lifecycle/observer joins, late-result fencing and sticky
cleanup refusal against public beta.19. Neither result establishes physical
callback delivery or proves a disconnect hidden by nonthrowing SDK destruction.
Exact public lifecycle review also confirms that failed initial configuration
does not attach managers or retain a runtime. Cancel/disconnect return early
when no operation/connection exists, before requiring configuration, so that
ordinary denial admits an explicit retry. Genuine cleanup errors remain sticky;
destruction clears runtime only after detach, permitting a joined reconfigure.

| Hosted gate | Exact functional source | Result |
| --- | --- | --- |
| [Swift catalog](https://github.com/bota-dev/examples/actions/runs/39520962585) | `741bd3b78fad955b8332b52ea1b6db09fba33a0b` | Ten tests, macOS app and unsigned iOS simulator/device builds pass |
| [Kotlin connection](https://github.com/bota-dev/examples/actions/runs/39521265119) | `aa726e30b6e1a548ccc4e9e0259af8479e918f41` | Frozen Gradle resolution and Android APK pass |
| [Kotlin catalog](https://github.com/bota-dev/examples/actions/runs/39521265326) | same `aa726e3` | All 16 JVM tests and APK pass |
| [Web connection](https://github.com/bota-dev/examples/actions/runs/39521265114) | same `aa726e3` | Frozen install, tests, types and production build pass |
| [RN connection](https://github.com/bota-dev/examples/actions/runs/39521265349) | same `aa726e3` | Android tests/export/APK and iOS cold optimized export/Pods/native simulator app pass |
| [Discovery](https://github.com/bota-dev/examples/actions/runs/39521265228) | same `aa726e3` | Linux and Windows pass |
| [CodeQL](https://github.com/bota-dev/examples/actions/runs/39521264543) | same `aa726e3` | Actions and JavaScript/TypeScript pass |
| [Legacy workspace](https://github.com/bota-dev/examples/actions/runs/39521265127) | same `aa726e3` | All 111 tests, types, backend build, all-platform export and four-ABI Android APK pass |

The fresh legacy host reports 15,984 MiB total memory and a 4,144 MiB V8 heap.
Normal optimized Web/iOS/Android exports finish with 1,163/1,520/1,613 modules;
the Windows Web module count differs by one, so no cross-host byte-identity claim
is made. The final Android log explicitly completes app CMake builds for
`arm64-v8a`, `armeabi-v7a`, `x86` and `x86_64`, then assembly succeeds in 14m 53s.
All targeted functional workflows above are successful; no workflow was rerun,
test omitted or source/SDK downgraded to obtain these results.

The four earlier beta.19 roots retain their successful native qualification:
[Swift connection at `fafbfe4`](https://github.com/bota-dev/examples/actions/runs/39512379550),
[Flutter connection at `4d79085`](https://github.com/bota-dev/examples/actions/runs/39514738797)
and [both integrated mobile clients at `a10743d`](https://github.com/bota-dev/examples/actions/runs/39517257471).
An exact tree comparison to this functional revision finds only their README
changes; their runtime sources, manifests, locks and owning workflows, as well
as the shared recording backend, are unchanged. These are carried-forward
input-identical receipts, not fresh physical results.

Public example guide/changelog source is pushed at
[`060c739`](https://github.com/bota-dev/docs/commit/060c739da7fd8dc5c4579535fbb4a975585f47f5).
Both affected MDX documents compile locally; Mintlify production delivery remains
separate. Impact search includes current examples guidance/catalog, public docs,
internal docs and the available workspace instruction files. No API schema or
internal device design changes are required by these consumer-only additions.

## Final conformance and evidence-only successor

Independent source and documentation reviews found no remaining blocker in the
approved scope. Source guards, synthetic tests, cached local exports, fresh
hosted compilation and unverified physical acceptance remain separate. The
current catalog has 77 retained identities and 84 indexed documents; its nine
regressions and 517 indexed local-file links pass. The six evidence-only Markdown
files also pass their separate 55-link check and whitespace validation.

The final successor changes only five selected READMEs and this owning review.
Runtime sources, manifests, packages, locks and workflows remain identical to
successful `aa726e3`; the Swift root retains the identical functional inputs
qualified at `741bd3b`. Automatic workflows triggered by those Markdown paths
are separate from the exact-source results above. No phone/media/Bluetooth,
encrypted-v2 capture/cloud/receipt/cleanup, signed-app or production-documentation
acceptance is inferred from these builds.
