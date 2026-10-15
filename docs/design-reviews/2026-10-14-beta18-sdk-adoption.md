# Public SDK beta.18 adoption — October 14, 2026

The owner requested the latest public SDK. Beta.17 was the newest synchronized
release at the start and passed all 13 workflows / 22 jobs at
[`a7b3417`](https://github.com/bota-dev/examples/commit/a7b34175eff07b6ab55af66991ae8a60043930f1).
Beta.18 began publishing during final verification. Its consumer adoption is a
new qualification; the [beta.17 evidence](2026-10-14-published-sdk-adoption.md)
does not qualify beta.18.

## Scope and public inputs

All ten SDK install roots select exact public `2.0.0-beta.18`: RN, Web, Android,
Swift and Flutter. They install independently and do not share an SDK runtime.
This retains the approved
public [design](../../DESIGN.md), [architecture](../../ARCHITECTURE.md) and
[device/recovery contracts](../example-contracts.md). SDK-free API examples and
the API recording Web application add no device dependency. No new app UI,
protocol implementation, generated-JS factory migration or physical operation
is part of this version update.

The [synchronized release](https://github.com/bota-dev/app-sdk/actions/runs/38632018471)
succeeded at `2026-10-15T00:39:15Z` (October 14 Pacific): all 12 normal jobs
passed, with two recovery-only jobs skipped. Public native consumers, the
49-file inventory, Flutter publication and its separate 59-file archive gate
pass. This task only observes that publication; it performs no approval,
publication, tag or channel mutation. npm `beta` is beta.18; `latest` stays beta.0.

The earlier example source
[`6dd5474`](https://github.com/bota-dev/examples/commit/6dd54747ac50d631f4bfb6f2199464707b940808)
adopted beta.18 for eight roots while Flutter beta.17 was still its latest public
package. CocoaPods' registered spec preceded its discovery-index update, which
held the ordered Flutter gate. That gate then passed; the Flutter beta.18
archive became public at `00:38:38Z`. This follow-up adopts that actual public
archive in both Flutter roots and qualifies it separately from beta.17.

Apple's public tag peels to `0962c8ccb8a4d407179309abae574bffb6e32933`;
anonymous Swift archive SHA-256 is
`aded7f6fe9fdb5a2f681c81ce4ade2b9cc67aa14abd90487b97c86fd2f7f6b7a`.
The anonymous Flutter archive has 166,142 bytes and SHA-256
`30441cc7c83bb9cef7fddac19d047a59b4ad38c4a3dcb27de3dad4700613ab4a`,
matching pub.dev metadata; the publisher verifies all 59 source files at `0962c8c`.
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
| Latest public version across five families | All five public registries and successful synchronized release verify beta.18 | Matched for package publication; app delivery remains separate |
| Exact public SDK pins and frozen installs | Four npm roots / Kotlin locks / Swift public inputs match beta.18; both Flutter configs resolve public beta.18 and normal/enforced installs pass | Matched locally; final hosted resolution required |
| Existing behavior, trust and durable recovery | Application/controller/auth/journal source and origins retained; RN 58/100 and native host 10 cases, Kotlin catalog 16 cases | Matched in source and bounded tests; physical acceptance unverified |
| Native binary / OTA separation | Legacy app/package/runtime 0.4.0; three actual SDK resolutions match; Android/iOS/Web exports pass; other clients retain no-OTA configuration | Matched locally; new native binaries required |
| Dependency guards and non-SDK tuples | Original signing/braces/map hooks and source inventories retained; independent diff audit confirms non-SDK npm/native/pub objects unchanged; original Flutter analyzer config restored and direct analysis passes | Matched locally |
| Platform tests and native exports/builds | Legacy 111 tests/types/backend build/all-platform exports; Web 15 tests/types/WASM build; RN/Kotlin qualification in platform reviews; Flutter 6/38 tests, license gates and both new beta.18 APKs pass | Matched locally across all selected roots; final hosted checks required |
| Docs/discovery follow actual versions | Current guidance selects beta.18 in every SDK root; 77 catalog IDs / 84 docs / 453 indexed links pass, plus all 322 local file links in 14 follow-up Markdown files; dated beta.17 and initial per-facade evidence remain separate | Matched locally |
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

## Qualification carried forward from unchanged beta.18 inputs

The final Flutter adoption changes no tracked input in the six independent
RN-connect, Web-SDK, Kotlin or Swift roots. An independent review compared all
99 tracked Git blobs and six owning workflow blobs against `6dd54747`; all match.
Their seven successful beta.18 job receipts remain qualified at that source:

| Unchanged example | Successful beta.18 job at `6dd54747` |
| --- | --- |
| RN connection Android | [116180577264](https://github.com/bota-dev/examples/actions/runs/38660573320/job/116180577264) |
| RN connection iOS | [116180576754](https://github.com/bota-dev/examples/actions/runs/38660573320/job/116180576754) |
| Web SDK | [116180577334](https://github.com/bota-dev/examples/actions/runs/38660573691/job/116180577334) |
| Kotlin connection | [116180576348](https://github.com/bota-dev/examples/actions/runs/38660573414/job/116180576348) |
| Kotlin catalog | [116180576423](https://github.com/bota-dev/examples/actions/runs/38660573426/job/116180576423) |
| Swift connection | [116180576687](https://github.com/bota-dev/examples/actions/runs/38660573551/job/116180576687) |
| Swift catalog | [116180577319](https://github.com/bota-dev/examples/actions/runs/38660573607/job/116180577319) |

The existing path filters select seven final-source workflows / 15 jobs for
the Flutter follow-up: both Flutter hosts, mobile/backend, Web app, core,
legacy verification/native, catalog and CodeQL. Those fresh results must be
recorded separately. The seven receipts above are not exact-final-source runs.
