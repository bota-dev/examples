# Public SDK beta.18 adoption — October 14, 2026

The owner requested the latest public SDK. Beta.17 was the newest synchronized
release at the start and passed all 13 workflows / 22 jobs at
[`a7b3417`](https://github.com/bota-dev/examples/commit/a7b34175eff07b6ab55af66991ae8a60043930f1).
Beta.18 began publishing during final verification. Its consumer adoption is a
new qualification; the [beta.17 evidence](2026-10-14-published-sdk-adoption.md)
does not qualify beta.18.

## Scope and public inputs

Eight SDK install roots select exact public `2.0.0-beta.18`: RN, Web, Android
and Swift. The two Flutter roots retain `2.0.0-beta.17`, their latest public
package at the `2026-10-15T00:26:57Z` verification snapshot. These clients install
independently and do not share an SDK runtime. This retains the approved
public [design](../../DESIGN.md), [architecture](../../ARCHITECTURE.md) and
[device/recovery contracts](../example-contracts.md). SDK-free API examples and
the API recording Web application add no device dependency. No new app UI,
protocol implementation, generated-JS factory migration or physical operation
is part of this version update.

At 23:54 UTC, RN npm, Maven and the anonymous Apple archive were public;
Web/npm, pub.dev and CocoaPods were still rolling out. Every selected consumer
artifact must be public; this task does not claim the synchronized beta.18
release has completed while Flutter remains unpublished.
The publisher is [release 38632018471](https://github.com/bota-dev/app-sdk/actions/runs/38632018471);
this task performs no approval, publication, tag or channel mutation.

At `2026-10-15T00:16Z` (October 14 Pacific), Web/npm and the exact CocoaPods
spec are also public. Trunk and CocoaPods/Specs contain beta.18, but the
[canonical discovery index](https://cdn.cocoapods.org/all_pods_versions_b_3_6.txt)
and its public CDN-repository origin still omit it. The latest observed index
build began before beta.18's `23:59:34Z` Trunk registration. The release waits
for this index before compiling clean native Flutter consumers and publishing
Flutter. This is an observed discovery-index propagation gate; no failed build,
SDK consumer incompatibility or need to republish is established.

After verifying that delay independently, this batch adopts the latest public
package **per facade**. It does not wait for equal version labels across
independent clients. Flutter beta.18 adoption requires a later public archive,
normal frozen installation and its own consumer checks. The retained Flutter
beta.17 qualification at `a7b3417` remains valid for its unchanged source/locks.

Apple's public tag peels to `0962c8ccb8a4d407179309abae574bffb6e32933`;
anonymous Swift archive SHA-256 is
`aded7f6fe9fdb5a2f681c81ce4ade2b9cc67aa14abd90487b97c86fd2f7f6b7a`.
Native Apple/Android/Flutter and Web public source changes from beta.17 are
version/identity changes. The RN generated BLE adapter fixes connected MTU
observations with joined `requestMTUForDevice` cancellation. Existing RN examples
retain native-workflow compatibility, so they do not change BLE owners or migrate
retained native capture evidence into generated-JS stores.

Legacy appVersion/OTA runtime advances from the already published sample
0.3.0/beta.17 to 0.4.0/beta.18. App IDs, backend origins, native/cloud journals,
SDK receipts, fresh pairing, authorization and generation gates remain unchanged.
Native rebuilds are required; no OTA or app delivery is performed.

The legacy npm workspace initially retained installed beta.17 under a beta.18
manifest. Both ordinary install and a workspace-targeted install reused the
old nested lock entry; the latter also rewrote the manifest back to beta.17.
The new `scripts/test-sdk-resolution.mjs` reproduced the mismatch by resolving
from the actual app import context. The SDK-only lock tuple was then taken from
the independently npm-generated beta.18 lock and checked against the exact public
registry version, tarball and integrity. A normal frozen install and this
regression must pass before root tests/exports count as beta.18 evidence.
Earlier beta.18-labelled root tests/exports consumed beta.17 and are excluded.

Fresh platform evidence is recorded in the
[React Native consumer review](2026-10-14-beta18-react-native-consumers.md) and
[native/Flutter review](2026-10-14-native-sdk-beta18-adoption.md).

## Acceptance review

| Requirement | Evidence | Status |
| --- | --- | --- |
| Latest public version per family | RN/Web/Maven/Swift beta.18 public; Flutter latest remains beta.17 at the snapshot above | Matched; synchronized beta.18 publication is separate |
| Exact public SDK pins and frozen installs | Four npm roots / Kotlin locks / Swift public inputs match beta.18; two Flutter locks retain publicly verified beta.17 | Matched locally; hosted resolution required |
| Existing behavior, trust and durable recovery | Application/controller/auth/journal source and origins retained; RN 58/100 and native host 10 cases, Kotlin catalog 16 cases | Matched in source and bounded tests; physical acceptance unverified |
| Native binary / OTA separation | Legacy app/package/runtime 0.4.0; three actual SDK resolutions match; Android/iOS/Web exports pass; other clients retain no-OTA configuration | Matched locally; new native binaries required |
| Dependency guards and non-SDK tuples | Original signing/braces/map hooks and source inventories retained; independent diff audit confirms non-SDK package objects unchanged; Flutter manifests/locks unchanged | Matched locally |
| Platform tests and native exports/builds | Legacy 111 tests/types/backend build/all-platform exports; Web 15 tests/types/WASM build; RN and Kotlin qualification in platform reviews; unchanged Flutter beta.17 qualified at a7b3417 | Matched locally for changed roots; fresh hosted checks required |
| Docs/discovery follow actual versions | Current guidance distinguishes beta.18 platforms from retained Flutter beta.17; 77 catalog IDs / 84 docs / 453 indexed links; all 499 local links across 35 changed/new Markdown files pass; dated beta.17 evidence preserved | Matched locally |
| Physical/live/backend/deployment acceptance | No such operation performed | Unverified; unchanged scope limits |

## Local legacy workspace qualification

Node 22.23.2 / npm 10.9.8 on Windows: ordinary `npm ci` verifies all 803
signing assets, 1,252 public-parent assets, and the original physical/lock
absence gates. All 111 root tests pass, including the new actual SDK-resolution
regression. Both workspace typechecks and the backend build pass.
The selected version remains beta.18 after all checks.

Normal `expo export --platform all --max-workers 2` succeeds without a heap
override or changed transforms: Android 115.5 seconds / 1,613 modules, Web
118.2 seconds / 1,164 modules, iOS 180.4 seconds / 1,520 modules.

| Export | Bytes | SHA-256 |
| --- | ---: | --- |
| Android Hermes | 10,355,636 | `af89b09663502646a200fc14ba8b8a5af64977125b84b63d7372961332a41ad0` |
| iOS Hermes | 10,146,797 | `8d3515c4cecec2989ff8fd7670ba3ba7e33de776aa14e14cb1e8c9f7e2331241` |
| Web JavaScript | 6,019,901 | `72ef8a75dd516a708ee677a18ed8c80da804a78d8a57316f56738e9d80ff427e` |

These are export checks, not native four-ABI assembly or installed Bluetooth
acceptance. The existing hosted native job remains required for beta.18.
