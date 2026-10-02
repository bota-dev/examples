# Independent examples implementation review

Review date: 2026-09-29 UTC. Uses the shared compound-engineering 1.2.5 workflow against [ARCHITECTURE.md](../ARCHITECTURE.md) §§2–6 and the selected public contracts. This expansion adds seven examples alongside the previously verified Node upload example; it does not modify the legacy workspace or the platform/SDK implementation.

## Initial beta.7 evidence by example

| Example | Public dependency / runtime | Evidence | Remaining verification |
| --- | --- | --- | --- |
| Node upload/transcribe | Node 22.23.2, no dependencies | 15 tests, live hash verification and transcription; [prior CI](https://github.com/bota-dev/examples/actions/runs/36524299811) | Other formats/providers and live outage recovery |
| Python upload/transcribe | Python 3.12, standard library | Three local contract tests; live synthetic WAV upload, server hash verification, completed transcription; hosted CI passed | Other formats/providers and live outage recovery |
| Node webhook receiver | Node 22.23.2 built-in SQLite | Local and hosted HTTP/SQLite tests for authenticity, duplicates, restart, conflicts, limits | Actual Bota delivery to deployed HTTPS receiver; business worker intentionally outside scope |
| React Native connect | npm beta.7, Expo 57, RN 0.86.3 | Public install, typecheck, identity tests, Android export, local and hosted arm64 debug APK build, hosted iOS Simulator application link, zero npm audit findings; phone permission, identity/mismatch, status, disconnect/reconnect, and manual radio-off recovery pass | Automatic radio-loss event delivery failed; physical iOS and broader coverage unverified |
| Web connect | npm beta.7, Vite | Public install, TypeScript and WASM production build; Vite updated to 7.3.6 and npm audit clean | Browser/firmware BLE session |
| Apple connect | SwiftPM exact beta.7 tag and binary checksum | Public tag/manifest inspected; [macOS CI build passed](https://github.com/bota-dev/examples/actions/runs/36526849885) | macOS permissions and BLE session |
| Android connect | Maven Central beta.7, Gradle 8.13 | Public artifact resolves; local and hosted debug APK assembly passed, dependency lock committed; phone permission, identity/mismatch, status, disconnect/reconnect, and manual radio-off recovery pass | Other phone/firmware pairs and out-of-range recovery |
| Flutter connect | pub.dev beta.7, Flutter 3.47.5 | Public artifact verified; hosted locked resolution, analyzer, debug APK assembly, phone permission, identity/mismatch, status, disconnect/reconnect, and manual radio-off recovery pass | Automatic radio-loss event delivery failed; broader coverage unverified |

The live Python run retained `rec_oYZSXYnJcj8Zt3poS4LrOkvC` / `txn_o60mEyL54AfOXb2etr24U2lG`, using the same reserved test key and dedicated end user as the Node verification. Effective auto-processing was disabled. The 333,326-byte fixture is synthetic speech. Secrets, audio, and transcript remain ignored local files. No physical devices were changed during the API-only run.

Local Flutter 3.44 cannot resolve the SDK's `meta ^1.19.0` requirement against Flutter's `meta 1.18.0` pin. Flutter 3.47.5 is selected for hosted verification; Windows Application Control prevented its Dart tool from launching locally. Hosted locked resolution and analyzer pass after correcting missing braces. The initial APK build found the SDK requires the cached Android embedding JAR; documented `flutter precache --android` and added it to CI. The permission plugin also requires compile SDK 37, now explicit in the Android host; minimum device API remains 26. The final Flutter locked install, analyzer, and Android APK build pass in hosted CI. No security policy was changed.

## Hosted checks

| Example | Source revision | Passing run |
| --- | --- | --- |
| Webhook receiver | `cf88479` | [36526850006](https://github.com/bota-dev/examples/actions/runs/36526850006) |
| Python | `fb792f6` | [36527086453](https://github.com/bota-dev/examples/actions/runs/36527086453) |
| React Native Android | `cf88479` | [36526849896](https://github.com/bota-dev/examples/actions/runs/36526849896) |
| React Native Android and iOS Simulator (Xcode 26.6) | `9e33809` | [36608472277](https://github.com/bota-dev/examples/actions/runs/36608472277) |
| Web (Vite 7.3.6) | `fb792f6` | [36527086420](https://github.com/bota-dev/examples/actions/runs/36527086420) |
| Swift macOS | `cf88479` | [36526849885](https://github.com/bota-dev/examples/actions/runs/36526849885) |
| Kotlin Android with dependency lock | `fb792f6` | [36527086509](https://github.com/bota-dev/examples/actions/runs/36527086509) |
| Flutter Android | `7d7a563` | [36527860720](https://github.com/bota-dev/examples/actions/runs/36527860720) |

Workflows select their own example paths. A passing earlier revision remains applicable when subsequent commits change only other examples or this review. Legacy workspace CI is separate from these independent checks. Its source and dependency security coverage were retained.

## Design comparison

| Requirement | Implementation evidence | Status / acceptance limit |
| --- | --- | --- |
| §2: independent examples, no root runtime | Own manifests and lockfiles; Python standard library; native platform project files | Matched; Flutter lock resolved by hosted toolchain |
| §3: public packages and API, no private Bota One helpers | npm/pub.dev/Maven Central beta.7; public Swift tag; public `/v1` HTTP | Matched for implemented workflows; no sibling dependencies |
| §3: server credential boundary | API keys stay in ignored server config; tests assert no API bearer on storage PUT; device examples have no keys | Matched locally |
| §3: identity from device read-back | RN verifies connected serial and disconnects on mismatch; other facades receive exact expected serial | Matched in source, RN unit test, and all three Android samples on Bota Pin 1.0.19; other platforms unverified |
| §3: durable completion before processing | Python requires matching recording/status/hash/timestamp, retries only 425 | Matched locally and for live success path; no device deletion claim |
| §4: explicit failure/recovery scope | API examples print IDs, bound polling, preserve local source, never auto-retry creates | Matched; app restart journal intentionally outside API-only scope |
| §4: durable authenticated webhook acceptance | Raw-byte HMAC, timestamp window, SQLite FULL commit, ID deduplication and conflict rejection | Matched in real local HTTP/DB tests; business effects are not implemented |
| §5: full recording-sync migration | Public integration analysis below | Not implemented; retain legacy sample until replacement gates pass |
| §6: isolated CI, no secrets/device actions | One path-filtered workflow per independent example; native runners where needed | Matched; all seven new example workflows passed at the source revisions above |
| §6: platform acceptance evidence | Per-example READMEs separate install/export/build/live/hardware levels; independent RN Android/iOS Simulator builds pass | Partial; Android exact-identity/status/reconnect checks pass on the recorded pair, with radio-loss limits below; other physical platforms and legacy RN iOS remain separate gates |
| §6: public catalog reflects the implemented examples | Docs `main` commit `97c1788`, scoped `prod` promotion `1861cec`; eight direct example links plus quickstart and changelog limits | Matched; local Mintlify 4.2.949 renders all three pages, catalog visually inspected; exact production commit's Mintlify deployment succeeded and all three live pages returned HTTP 200 with the new content |

## Android device acceptance

Initial results (superseded by the firmware 1.0.19 continuation below): a USB-connected Samsung SM-A166U1 running Android 16/API 36 was available. Tests used the independent examples and published beta.7 SDK; no wearable provisioning, recording, upload, reset, or deletion was performed. The requested exact wearable serial was not supplied during this execution, and no firmware identity was established. Nearby advertisements are discovery evidence only.

| Requirement / scenario | Evidence | Status / remaining check |
| --- | --- | --- |
| Independent samples coexist | Kotlin application ID changed to `dev.bota.examples.kotlinconnect`; RN keeps `dev.bota.examples.connect`, Flutter keeps `dev.bota.examples.bota_connect`; all three APKs installed | Matched; local Kotlin build and [hosted Kotlin check](https://github.com/bota-dev/examples/actions/runs/36611211316) passed at `50ddf37` |
| Flutter APK reproducible from public packages | [Run 36611211291](https://github.com/bota-dev/examples/actions/runs/36611211291) passed locked resolution, analysis, and build at `50ddf37`; preserved APK installed on phone | Matched for install/build; no local Dart policy changes |
| Kotlin permission denial and recovery | Android dialog denied; app displayed permission-required message; scan refused; retry/grant reached Ready | Matched on this phone |
| Kotlin discovery | Ten-second scan displayed Bota Note and Bota Pin advertisements | Matched for discovery only; identity and firmware unverified |
| Flutter permission denial and recovery | Android dialog denied; app displayed Settings/retry guidance; retry/grant reached SDK-ready state | Matched on this phone; scan and BLE session remain unverified |
| RN on-device startup | APK installed; native screen reported missing JavaScript bundle. Metro was listening on IPv6 `::1`, while IPv4 connection failed. Restarting with IPv4-first DNS produced `127.0.0.1` listener and HTTP 200 status | Partial; app relaunch and permission/BLE flow still need verification |
| Exact/wrong serial, status, disconnect/reconnect, radio loss | No intended wearable serial or firmware recorded; no verified device connection performed | Unverified for all three samples |

Execution stopped before the next Flutter scan and RN relaunch because automatic approval review rejected the combined ADB command as blocked by policy, without a detailed reason. No alternative input mechanism was used to bypass that rejection. The host-side Metro diagnosis was checked read-only afterward. These limits do not close the recording-sync or physical acceptance gates.

## Target identification and firmware update preparation

Continuation on 2026-09-29: the user identified the intended wearable by serial prefix `4kf6` and requested a firmware update before testing. Read-only standard Device Information GATT reads returned exact serial `4KF6NOHWX0` and firmware `1.0.17`. The public certificate on its USB SD volume independently matched that serial. Battery was 100%, compact device state was idle, and pending-recording count was zero. These host diagnostics establish the maintenance target; they are not example-SDK connection acceptance.

Followed the firmware README USB maintenance procedure, the vendor `note.txt` compatibility constraints, and the OTA design. The archived `1.0.19` maintenance image from build `cc7acbe54df89` is 2,663,296 bytes, SHA-256 `cba41b8117f659bf06fa74a3d1a13d0f2abca113f9db6e1e56222f5ebc8c66a4`; the ELF also matches the prior firmware validation record. Source comparison against the `1.0.17` version commit shows unchanged bootloader and reserved/VM layout, with the double-bank update counter increased from 0 to 1. Rechecked the USB certificate before copying and verified the staged file hash. The only device write was staging `update.ufw`; no provisioning, reset, recording deletion, or formatting was performed. Physical safe eject/restart has been requested. Installation, firmware read-back, certificate preservation, and example BLE sessions remain **unverified** until that step completes.

The Android RN startup issue is now resolved in a real phone launch: Metro bundled successfully over IPv4 and the app displayed its UI. Denying Nearby Devices permission produced the initialization error with Scan disabled. Reopening requested permission again; granting it enabled Scan and displayed the ready guidance. This establishes RN startup and permission recovery on the same Samsung/Android configuration above. The earlier command rejection remains historical; these individual phone operations succeeded after the user's continuation. No wearable connection was attempted from the example while its update is pending.

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Current builds | All checks at `2eb7aea` succeeded, including RN Android/iOS, Kotlin, Flutter, and root CI | Matched for builds; no current native compile failure |
| RN startup and permission handling | Actual phone UI after IPv4 Metro launch, deny, reopen, and grant | Matched on Samsung SM-A166U1 / Android 16 |
| Intended wearable identification | Stored GATT serial and USB public certificate agree on `4KF6NOHWX0` | Matched for maintenance targeting |
| Safe firmware update preparation | Idle/battery check, source layout comparison, verified archived image and staged hash | Partial; safe eject/restart and post-update identity/version checks pending |
| Example BLE hardware acceptance | No new example connection during update preparation | Unverified; exact/wrong serial, status, reconnect, and radio-loss tests remain |

Documentation search covered the changed example path, review link, IPv4 guidance, and target serial across public/internal docs and workspace agent/architecture/README files. Only the RN setup/evidence and this review need changed claims; public catalog and target contracts remain accurate.

## Firmware 1.0.19 physical test continuation

2026-09-29: after the user restarted the wearable, standard Device Information reads confirmed `4KF6NOHWX0` running `1.0.19`. Its USB public-certificate SHA-256 is unchanged from before the update. The maintenance installation and identity-preservation checks are now matched. Tests below use Samsung SM-A166U1, Android 16/API 36, published App SDK beta.7, and that exact Bota Pin; the other nearby devices were not accepted by name.

React Native, Kotlin, and Flutter each discovered the target, rejected expected serial `4KF6NOHWX1`, accepted `4KF6NOHWX0`, read 100% battery / idle / zero pending recordings, disconnected, and reconnected. All three also returned a fresh status after turning the phone Bluetooth off and back on (RN and Flutter using the cleanup fix described below). Permission denial/recovery evidence is recorded above. No binding, recording, upload, reset, or deletion was performed by these examples.

Radio-off testing exposed a real limitation: RN and Flutter retained their selected device; status and explicit disconnect calls then failed because the native device was already disconnected. Neither facade delivered a connection-loss event to these sample listeners during this test. Their disconnect handlers now clear UI selection in `finally`, preserving the failure message and permitting a manual reconnect. RN was retested through Metro: after a fresh verified connection, Bluetooth-off and failed Disconnect cleared selection; Bluetooth-on, reconnect, and fresh status succeeded. Flutter's [build at source `61a7471`](https://github.com/bota-dev/examples/actions/runs/36625399596) passed frozen resolution, analyzer, and APK assembly. Its downloaded APK was installed and retested: exact connection, Bluetooth-off failed Disconnect clearing selection, radio-on verified reconnect, fresh status, and final explicit disconnect all passed. Separate CI debug signing keys required uninstalling the old sample before installing the new one; no device recordings or backend resources were affected. Kotlin's status read failed while the radio was off and selecting the candidate after radio-on restored verified connection/status. This does not establish automatic radio-state detection in any sample.

| Requirement | Evidence | Review status |
| --- | --- | --- |
| Intended image and preserved identity | Firmware `1.0.19`, exact stored serial, unchanged public certificate hash | Matched on this device |
| Exact identity and mismatch rejection | Correct and one-character-wrong serial exercised in RN, Kotlin, Flutter; wrong attempt never exposed status controls in RN/Flutter | Matched on this phone/device pair |
| Status and explicit reconnect | All three samples returned status and reconnected following explicit Disconnect | Matched on this pair |
| RN radio-off manual recovery | Updated handler clears selection on failed disconnect; verified reconnect/status after radio-on | Matched for manual recovery; automatic event delivery failed |
| Kotlin radio-off manual recovery | Read fails while off; candidate selection after radio-on reconnects and reads fresh status | Matched for manual recovery; no automatic-loss UI claim |
| Flutter radio-off manual recovery | Updated `61a7471` CI APK installed; failed Disconnect clears selection, radio-on reconnect and fresh status pass | Matched for manual recovery; automatic event delivery failed |
| Regression checks | RN typecheck, identity test, Android export; [RN Android/iOS native checks](https://github.com/bota-dev/examples/actions/runs/36625399255); [Flutter analyzer/APK build](https://github.com/bota-dev/examples/actions/runs/36625399596), all at `61a7471` | Matched locally and in hosted checks |

These results supersede the earlier unverified Android connection rows. Apple/macOS, Web Bluetooth, physical iOS, out-of-range loss, and full recording-sync gates remain outside this evidence. Review follows compound-engineering against architecture sections 3 and 6; no SDK source or GATT workaround was added. Documentation search covered `disconnect(device)`, `connectionStateChanged`, sample paths, and phone-evidence wording across public/internal docs and workspace agent/architecture/README files. Public contracts and catalog remain valid; sample recovery instructions and conformance evidence are updated here.

## Recording-sync replacement

Historical prerequisite review from 2026-09-29 follows. The scoped
[already-provisioned Android implementation](#pre-provisioned-recording-sync)
below supersedes the directory-not-created status without claiming full
replacement or target secure pairing.

The planned `end-to-end/react-native-recording-sync/` requires more than the compatibility demo's immediate bind and plaintext sync. Its blockers are concrete in the **published** `@bota.dev/react-native-app-sdk@2.0.0-beta.7` artifact:

1. `src/client.ts` exposes `BotaProvisioningMaterial` with `apiEndpoint`, raw `deviceToken`, and `mtu`. `provision` passes this material through the bridge. That does not provide the target opaque, device-key-protected payload with exact prepare/provision/confirm/abort context. Implementing the repository's target with this contract would require SDK/platform work beyond a public consumer example.
2. The package's encrypted-v2 section requires application-native Swift/Kotlin registration through `BotaDeviceSDKEncryptedUploadV2Materials.register(...)`. Sensitive upload material and bytes must remain native. A complete example needs an independently implemented public host adapter and its recovery/ownership tests; copying Bota One's private native module violates the architecture. The SDK also expressly separates this API from release/hardware compatibility gates.
3. Replacement acceptance includes exact binding generation, durable restart recovery, verified receipt before source deletion, and no BLE fallback while direct upload ownership is unknown. No physical test was run here. An API-only live upload or a native build cannot establish these gates.

The end-to-end directory is therefore not created as an empty scaffold or advertised as runnable. Next prerequisite is a public SDK integration contract for target provisioning, followed by the public native encrypted-upload adapter and a scoped, caller-authenticated backend. Then exercise binding failure/abort, restart/retry, completion loss, ownership conflict, and physical deletion ordering before retiring `apps/`. This review records the gap without weakening the authoritative target design.

## Completion boundary

Continuation on 2026-09-29: npm still reports `beta: 2.0.0-beta.7` (`latest` remains beta.0), and the public beta.7 provisioning material still exposes raw `deviceToken`. No newly published contract closes the target-binding blocker. Added a macOS 26/Xcode 26.6/CocoaPods 1.16.2 iOS Simulator application build to the React Native example workflow; both Android and iOS jobs passed at source `9e33809`. The first native compile on Xcode 26.3 reproduced Expo's `RuntimeScheduler` ownership-annotation error ([upstream report](https://github.com/expo/expo/issues/50067)); the workflow selects the newer compiler without patching dependency source. Public example catalog links and compatibility wording are now published at [Example Apps](https://docs.bota.dev/api-reference/client-sdks#example-apps). Physical tests and the target recording-sync replacement remain separate gates.

Implementation, public dependency installation, automated checks, native builds for the advertised macOS/Android hosts, API live verification, documentation, and push are complete for the eight independent examples. Android connection/manual-recovery scenarios now have the specific phone/device evidence above. This is **partial completion of the broader migration plan**: full recording-sync replacement, automatic radio-loss recovery, broader hardware coverage, legacy RN iOS linking, live webhook deployment, and legacy retirement are not complete. No production or hardware conformance is inferred from CI.

## Documentation propagation

Searched changed paths and tokens (`webhook-receiver-node`, `upload-and-transcribe-python`, `react-native-device-connect`, `BotaDeviceClient`, `syncEncryptedRecordingV2`, `WEBHOOK_SECRET`) across `docs/`, `internal-docs/`, and workspace README/ARCHITECTURE/AGENTS/CLAUDE files. Inspected the internal-docs downstream checklist, public webhook contract, upload management and provisioning targets, SDK model signatures, and Bota One integration boundaries.

Affected runnable-example documentation is updated in this repository: root catalog, architecture status/layout, both agent entry points, and every example README. External hits describe unchanged SDK/API/target contracts; this change does not claim to implement those platform requirements. Private reference paths are not installation dependencies. Legacy links remain valid.

The continuation also updates public `api-reference/client-sdks.mdx`, `quickstart.mdx`, `changelog.mdx`, and the docs README. Only the scoped examples commit was promoted to `prod`; unrelated `main` content was not merged. The local Mintlify preview emitted an OpenAPI auto-discovery warning for `/docs.json`, but the changed pages rendered successfully and the hosted deployment validated the actual OpenAPI file and site configuration. No API schema or navigation changes were needed.

## Kotlin connection-stream preparation

The native Kotlin sample now observes public `connectionUpdates()` and renders
verified identity or a disconnected/reconnect instruction. It clears old status
when the SDK emits null and cancels the observer with the Activity scope. The
existing connect/disconnect actions no longer duplicate connection rendering.
This uses the same API already demonstrated by the SDK loss-recovery lab.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Public SDK consumption | Existing Flow API, still pinned to published beta.7 | matched in source |
| UI observes connection and disconnect state | Activity-scoped collection; null replaces old status; exact CI APK `416d27c` exercised on Samsung / firmware 1.0.19 | matched for verified connect, explicit disconnect and reconnect |
| Automatic phone radio-loss recovery | Requires the SDK beta.8 fix to be published and adopted | unverified in this example revision |

This source change does not upgrade any dependency or supersede the recorded
beta.7 hardware results. SDK release preparation and the later exact-pin upgrade
remain separate. Reviewed against examples architecture connection/lifecycle
ownership; token search for `connectionUpdates` and the Kotlin example path
found no changed wire/API contract requiring an external documentation update.

The Kotlin workflow also preserves the exact-commit debug APK for the later
physical adoption check. Artifact creation does not establish device acceptance.

[Kotlin CI 36645629255](https://github.com/bota-dev/examples/actions/runs/36645629255)
passed at `fb0ae5c795b39bd23f8f0aff1fee8af438598891`. The subsequent artifact
retention change leaves the app source and beta.7 dependency unchanged.

Physical listener check at `416d27caad9771f9dbb597b2a841fdbad437e2de` used
the preserved APK from [CI 36645931006](https://github.com/bota-dev/examples/actions/runs/36645931006),
SHA-256 `b6d41c2e7cfc4218ac82e98fa7f7ab0753069d5c3e92de24cf124be4ab0c02e8`.
On Samsung SM-A166U1 / Android 16 and exact SDK-verified Bota Pin
`4KF6NOHWX0` / firmware 1.0.19: initial null, verified serial, fresh status
(100% battery, Idle, zero pending recordings), explicit disconnect clearing
status, verified reconnect and final disconnect all passed. The sample was
stopped; Bluetooth remained on. Only this sample was reinstalled to resolve the
CI debug-signature mismatch. No wearable binding, recording, reset or deletion
occurred. Radio-off was not repeated with beta.7; automatic loss recovery still
requires published beta.8 adoption. The exact main Kotlin build also passed in
[CI 36646373292](https://github.com/bota-dev/examples/actions/runs/36646373292).

React Native's workflow now also retains its exact-commit arm64 debug APK for
the later beta.8 physical check. The matching source must serve Metro for that
APK. This changes artifact retention only; SDK pins, current radio-off limits
and the historical hardware acceptance claims remain unchanged. Review against
the architecture's reproducible-build and physical-evidence boundary is matched
in source; hosted upload verification remains a CI gate.

## Beta.8 adoption

2026-09-30 UTC: upgraded the five independent connection examples to the
exact public `2.0.0-beta.8` artifacts. Earlier sections retain their beta.7
evidence. The SDK release source is `8ad1328c8456ee73b98869a6800f137a6f5a8c25`;
[protected release 36652271187](https://github.com/bota-dev/app-sdk/actions/runs/36652271187)
promotes the verified main-CI candidates without rebuilding them. Native/npm
publication, public SwiftPM/Maven/CocoaPods consumers, Flutter publication and
public archive verification all passed. Example CI passed; fresh phone checks below leave recovery partially accepted.

Acceptance: a confirmed phone-radio disconnect clears selection/status through
the existing SDK connection listener without Read status or Disconnect; after
radio restoration, an explicit exact-serial reconnect yields fresh status.
No automatic reconnect loop, provisioning, recording, reset or deletion is added.
Physical macOS/iOS/Web, out-of-range and background behavior remain unverified.

The public Flutter beta.8 archive SHA-256 is
`7354fa6f8c53a07ded252dc6419b96b9aa921126ab65a4d664ef927d343647f1`.
The archive was downloaded and verified against pub.dev metadata. Its dependency
and environment constraints equal beta.7; the lock changes only the direct
package version/hash. Windows Flutter tool startup remained suspended, so
hosted Flutter 3.47.5 enforced the lock, analyzed and built the APK successfully. No security
policy was changed. RN/Flutter listeners now replace stale status text on loss;
initial Flutter null events preserve setup instructions.


### Published-package and build evidence

| Example / gate | Source revision | Successful hosted run |
| --- | --- | --- |
| React Native Android and iOS Simulator | `0995c479ec1dc1885ecb201bc23a66f6780393dc` | [36661341921](https://github.com/bota-dev/examples/actions/runs/36661341921) |
| Web typecheck and Vite/WASM build | `cd5605eb30b11bd4fb820586c5947e2d62b00cb8` | [36660143423](https://github.com/bota-dev/examples/actions/runs/36660143423) |
| Apple SwiftPM/macOS application | `cd5605eb30b11bd4fb820586c5947e2d62b00cb8` | [36660143425](https://github.com/bota-dev/examples/actions/runs/36660143425) |
| Kotlin Android locked dependency/build | `f2d35eb18c29c1c7b7ca9318fa22125fd2c70e94` | [36660614376](https://github.com/bota-dev/examples/actions/runs/36660614376) |
| Flutter frozen pub resolution, analysis, Android APK | `e3041211c956d6058326bea799aefd4dbe53d050` | [36661667401](https://github.com/bota-dev/examples/actions/runs/36661667401) |
| Root legacy regression/export/native build | `e3041211c956d6058326bea799aefd4dbe53d050` | [36661667436](https://github.com/bota-dev/examples/actions/runs/36661667436) |

Later revisions changed other examples or documentation only; each listed source
remains the applicable build for its example. RN local typecheck, identity tests
and Android export passed; Web typecheck/build passed. The Kotlin lock was updated
through Gradle dependency resolution. Flutter's independently verified public hash
was confirmed by hosted frozen resolution. No sibling SDK build is installed by
these examples. SDK publication passed all public consumer gates; npm `beta`
selects beta.8 while `latest` remains beta.0.

### Beta.8 phone acceptance

Tests used the preserved CI APKs below on Samsung SM-A166U1, Android 16/API 36,
with exact SDK-verified Bota Pin `4KF6NOHWX0`, firmware 1.0.19. Each successful
status read showed 100% battery, Idle and zero pending recordings. No status
subscription was used to manufacture a loss event. Only these test samples were
reinstalled where CI debug signatures differed. RN used source-matched Metro;
Windows file-watcher startup timed out, so `CI=1` disabled watching for this run.
No security policy was disabled.

| Sample | Initial verified connection/status | Bluetooth-off without Read status or Disconnect | Explicit reconnect after radio restoration | Acceptance |
| --- | --- | --- | --- | --- |
| Kotlin | Passed | Selection/status cleared and reconnect instruction shown | Passed exact-serial reconnect and fresh status, then final disconnect | matched for this foreground cycle |
| React Native | Passed | Selection/status cleared and reconnect instruction shown | Failed twice with GATT error 133, including after a fresh scan | partial; loss notification passed, recovery failed |
| Flutter | First attempt timed out; an additional phone Bluetooth cycle allowed verified connection/status | Failed: selected device and stale status remained visible after more than 30 seconds | Fresh app launch and scan also failed to reconnect | partial; connection/status passed, loss delivery and recovery failed |

| Sample | GitHub artifact ID | APK SHA-256 |
| --- | --- | --- |
| Kotlin, run `36660614376` | `11073584488` | `d7d1d50bc4c0b935ff260b56ea1689b7e4280d137fd88f9e4859ac8b5bee4265` |
| React Native, run `36661341921` | `11074463817` | `b27b428b7cb83caeeb0f8bd523b1d3ce6c8f022099e71559e04728d8ab942f00` |
| Flutter, run `36661667401` | `11074861430` | `a64d86597c36ef8489e3e09632041da9a14188fdf67f1b198eb27a5698085b8d` |

Downloaded ZIP digests were independently checked against GitHub metadata before
installation. Local evidence retains connected/status and radio-off UI XML plus
artifact metadata; Kotlin also retains reconnected/status XML.

During Flutter radio-off, Android logged `onClientRegistered(100)` and GATT client
cleanup, without `onConnectionStateChange(DISCONNECTED)`. The phone adapter was
confirmed off while the UI stayed connected. Beta.8's
`FrameworkAndroidBluetoothPlatform` emits loss from that GATT callback and has no
adapter-state receiver. This identifies an unhandled adapter-off path; it does
not prove the cause of the separate GATT 133 reconnect failures. RN logs showed
failed client registration/connection followed by SDK GATT cleanup. Do not infer
wearable identity from the candidate name or attribute these failures to firmware
without further evidence.

### Final design comparison and remaining work

| Requirement / authority | Evidence | Status / remaining verification |
| --- | --- | --- |
| Architecture §§2–3: independent public integrations | Five exact published beta.8 pins and locks; successful isolated consumer builds | matched |
| Architecture §§3–4: exact identity and visible stale-state cleanup | Exact-serial phone reads; all three listeners clear selection/status when notified | partial: native adapter-off event missing in the Flutter run |
| Architecture §§4,6: explicitly recover and verify fresh status | Kotlin full cycle; RN GATT 133 and Flutter timeout/loss failures retained above | partial; repeat RN/Flutter after native adapter-off handling and reconnect diagnosis |
| Architecture §6: separate build and hardware claims | Exact CI source/artifact identities and scenario-specific outcomes | matched; physical Apple/iOS/Web, out-of-range, background and other hardware unverified |
| Public catalog/setup accuracy | All five package pins updated; docs `main` `f81b7b1`, scoped `prod` `3232cce`; successful exact-prod Mintlify deployment and live SDK/changelog pages | matched for publication; recovery limitations linked here |
| Architecture §5: full recording-sync replacement | Opaque provisioning/native encrypted-material integration gaps above | not implemented; legacy workspace retained |

The approved beta.8 publication/adoption is complete. Full Bluetooth-loss recovery
is **not** complete. The SDK follow-up must handle adapter shutdown even when
Android omits the GATT callback, preserving generation fencing and observer
teardown; reconnect failures need separate diagnosis. That requires new SDK
source, regression/physical checks and a new immutable public release before
examples can adopt it. Do not patch GATT or duplicate transport policy here.
No wearable provisioning, recording, upload, reset, deletion or firmware flashing
was performed in these read-only connection tests.

<a id="adapter-off-candidate"></a>

## Unreleased adapter-off candidate (2026-09-30)

SDK source `4d36de598de1dbd2e573fca85e06724ac17abf15` closes exact GATT sessions
when Android shuts down its adapter without a disconnect callback, releases
cancelled connection attempts, and preserves replacement generations. Its
[CI](https://github.com/bota-dev/app-sdk/actions/runs/36743986531) and
[License Gate](https://github.com/bota-dev/app-sdk/actions/runs/36743990238)
passed. The [SDK acceptance record](https://github.com/bota-dev/app-sdk/blob/3f02326/docs/parity/android-disconnection-events.md#exact-candidate-evidence)
contains the source, artifact and APK checksums, design review and limitations.

Isolated labs were exported from examples source `022edbb`. They retained the
public beta.8 RN/Dart bindings, resolved only the exact candidate Android AAR
from an isolated Maven repository, and used distinct application IDs. UI-only
diagnostics showed transport identifiers and SDK-read firmware; the connection
and recovery logic was unchanged. These overrides are not example dependencies.

On Samsung SM-A166U1 / Android 16 with SDK-verified serial `4KF6NOHWX0` and
firmware `1.0.19`, both labs passed three successive cycles: phone Bluetooth
off automatically cleared connected/status UI; Bluetooth on, the existing scan
and explicit connect verified identity/firmware and read fresh status. Neither
app was restarted or manually disconnected between cycles. Logs show GATT
closure on all six radio shutdowns without a disconnected callback. No GATT
133 occurred. RN's initial connection timed out once (`Some(-408)`), closed its
GATT client and then succeeded on a same-session retry without another radio cycle.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Architecture §4: native loss reaches example listeners | Automatic UI clearing on all six candidate radio-off checks, without app-side GATT/polling substitutes | matched for this candidate/phone pair |
| Architecture §§4,6: explicit recovery and fresh status | 3/3 post-radio-off first reconnects per framework; verified identity and fresh status | matched for this bounded candidate check |
| Architecture §§2–3: published independent dependencies | Example manifests/locks remain public beta.8; candidate override exists only in isolated labs | matched; new release/adoption pending |
| General connection reliability and wider lifecycle coverage | Initial RN timeout recovered on retry; no new out-of-range, background, iPhone, Web or transfer-interruption evidence | partial; wider cases unverified |

At this candidate checkpoint, the native source fix and bounded phone acceptance
were ready for a new release; the installed public beta.8 examples did not yet
contain it. Bluetooth was left
ON, both labs were disconnected/stopped, and no wearable data or firmware was
changed. Full recording-sync replacement remains blocked as described above.

## Beta.9 adoption

The owner approved synchronized `2.0.0-beta.9` publication and parallel example
adoption. SDK source `89cb6f14eb0ea6327c196ac2cbeb8215df3423bd` passed exact-main
[CI 36758872839](https://github.com/bota-dev/app-sdk/actions/runs/36758872839)
and [License Gate 36758872776](https://github.com/bota-dev/app-sdk/actions/runs/36758872776).
The immutable tag binds that source, main CI run and candidate inventory SHA-256
`1674536aa8496220e5aeb2fe3d0df08ecc5b6ac72ee9d590b1e5c49410d69f92`.
All 49 preserved release files passed promotion verification.

[Protected release 36761509388](https://github.com/bota-dev/app-sdk/actions/runs/36761509388)
completed synchronized publication, exact Maven/npm inventory verification,
public SwiftPM/CocoaPods and Android API 26/35 consumers, Flutter public native
dependencies and the complete pub.dev archive. All five example pins/locks now
use beta.9. Publication does not establish final public-package phone acceptance.

Acceptance remains bounded: use public packages without local SDK overrides;
automatically clear connection/status when the phone radio turns off without
Read status or Disconnect; restore Bluetooth, scan and explicitly reconnect;
verify the exact serial and firmware and read fresh status. Repeat three times
for RN and Flutter without restarting the app or manual cleanup between cycles.
No app-side GATT, polling workaround or automatic reconnect loop is added.
Physical iPhone/macOS/Web, background/out-of-range behavior and other hardware
remain outside this recorded Android phone check.

| Requirement / authority | Evidence | Status / remaining verification |
| --- | --- | --- |
| Architecture §§2–3: independent public dependencies | Exact beta.9 pins/locks for all five examples; only Bota lock entries changed; no private overrides | matched |
| Architecture §§4,6: visible loss and stale-state clearing | RN and Flutter public beta.9 each cleared UI on all three radio shutdowns | matched on the recorded phone/device pair |
| Architecture §§4,6: explicit recovery and fresh status | RN first reconnects 3/3; Flutter 2/3, third recovered after GATT 8/133 with a fresh scan in the same app session | matched for same-session recovery; first-attempt reliability partial |
| Architecture §6: appropriate isolated builds | Kotlin targeted lock and separate frozen build; RN frozen install/typecheck/identity test/Android export and local native lab build; Web frozen install/typecheck/Vite-WASM build; hosted Kotlin/Swift/Web/RN passed at `43a5bd3`; Flutter enforced lock, analysis, native lab build and hosted CI passed | matched for documented build targets; wider physical coverage unverified |
| Architecture §6: separate build, publication and hardware claims | Exact source and release links; historical beta.8/candidate evidence retained | matched during preparation |
| Architecture §5: full recording-sync replacement | Existing public lifecycle/material integration gaps above | not implemented by this bounded connection upgrade |

First adoption source `43a5bd3521fdbc9d24dcfea7e8d714f08359f681` passed
[Kotlin CI 36766071441](https://github.com/bota-dev/examples/actions/runs/36766071441),
[Swift/macOS CI 36766071430](https://github.com/bota-dev/examples/actions/runs/36766071430)
and [Web CI 36766071433](https://github.com/bota-dev/examples/actions/runs/36766071433).
[RN CI 36766071358](https://github.com/bota-dev/examples/actions/runs/36766071358)
also passed both Android APK and iOS Simulator native builds.
The public Kotlin AAR's SHA-256 is
`dc90f8815f38efeaed88b45e89bf5bcd8991efff7b8f6e8453f90fc58b8eb4a1`,
matching the exact SDK main-CI release inventory. These builds do not establish
new physical Kotlin/macOS/browser acceptance.

### Public beta.9 RN phone acceptance (2026-09-30)

The isolated RN lab used the exact public dependencies from examples `43a5bd3`.
Only its application ID and UI diagnostics (selection transport ID and SDK-read
firmware) differ from the example; there is no local SDK override, GATT workaround
or recovery-logic change. Its resolved public AAR matches the SHA-256 above.
The self-contained, debug-signed release-mode APK SHA-256 is
`c06c72759c63cb13511cc11ba093d165fb47d31c17b9d911675cbb12febc7319`.

On Samsung SM-A166U1 / Android 16, the SDK verified serial `4KF6NOHWX0` and
firmware `1.0.19`. Initial connection and status succeeded on the first attempt.
All three consecutive phone-radio-off checks automatically cleared the verified
connection and status UI. After each restore, the existing scan and first
explicit reconnect verified identity/firmware and read fresh status. There was
no app restart or manual disconnect between cycles. Scoped logs show native GATT
closure on all three adapter shutdowns without a disconnected callback, plus
the expected callback/close on final explicit Disconnect. No GATT 133 occurred.

The app was disconnected and stopped, with phone Bluetooth left ON. This is
bounded foreground connection evidence, not universal first-connect reliability
or automatic reconnect. No wearable flash, provisioning, recording, upload,
reset or deletion was performed. Flutter public-package acceptance is recorded below.

### Public beta.9 Flutter acceptance (2026-09-30)

[Flutter CI 36768188319](https://github.com/bota-dev/examples/actions/runs/36768188319)
passed locked installation, analysis and Android APK assembly at source
`a5c36b08a67b28a07efd1a40b4bcfd76a6a4bfca`. The public pub.dev archive SHA-256 is
`004cbeb2d1b3c3d104bc5baf90ea5ab77f28f772cbc909a718ca6e333f08e313`.
Only the direct SDK version/hash changed in the lock; Android and Apple native
pins match beta.9. Local Flutter 3.47.5 / Dart 3.13.4 locked resolution, analysis
with the original lint configuration and Android build also passed.

The isolated debug lab uses that exact source/dependency set, with only a distinct
application ID, selection transport ID and SDK-read firmware diagnostics. Local
build settings bound Gradle memory/workers and select installed toolchain paths;
there is no Maven override or protocol/recovery change. Its public AAR SHA-256
matches the release inventory above. APK SHA-256:
`5d16ac2753177051ad396f33bf839490e96dfa68b5c7d2d2a3cd68f0b6317e60`.

On the same Samsung / SDK-verified serial `4KF6NOHWX0` / firmware `1.0.19`,
initial connection and status succeeded on the first attempt. All three radio
shutdowns cleared stale connection/status UI automatically and disabled status
actions. The first two reconnects verified identity and read fresh status.
The third connected and discovered services, then dropped with GATT status 8.
The loss event cleared the UI, and the SDK closed the native client. An immediate
retry failed with status 133 and closed its client. A fresh scan and selection
then verified the same identity/firmware and read fresh status, without an app
restart, manual Disconnect or additional Bluetooth cycle.

This is **3/3 loss notifications, 2/3 first reconnects**, with the third recovered
in the same app session after a fresh scan. Do not describe it as three flawless
reconnect cycles or a general GATT 133 fix. The controller recorded disconnect
reason 8 and connection-failure reason 62; these logs alone do not identify the
root cause. Remaining first-attempt reliability requires separate diagnosis
across the phone/controller and firmware, not an app-side transport workaround.

Final explicit Disconnect succeeded; the lab was stopped, phone Bluetooth left
ON and no USB reverse forwarding remained. Temporary device UI output was
removed. No wearable firmware, provisioning, recording, upload, reset or data
deletion was performed. Exact UI snapshots and scoped native logs were audited:
RN native log SHA-256 `4219422c2f6dcbde39af1c068bd65426cac12d51ac218ff372001653818af306`;
Flutter native log SHA-256 `00e60bbd66da3dd756ba994c35978ba40c0b4dd2e0b382411fdd4bd077fba14b`.
Physical iPhone/macOS/Web, other phone/firmware pairs, background/out-of-range,
automatic reconnect and interrupted transfers remain unverified here.

## Flutter UI completion ordering (2026-09-30)

Review of the remaining reconnect limitation found a separate example UI race:
the connection stream and connect/status Futures can complete independently.
Previously, a late successful connect could restore a selection after a newer
disconnect notification, and a late status result could replace the loss message.
This is a UI ordering defect, not evidence of the cause of the native GATT 8/133
failures above. Both failed clients in that phone log closed promptly.

The example now fences operation results against newer loss notifications and
keeps explicit reconnect available. It continues to use public beta.9 without
transport overrides or an app-owned retry loop. Widget tests control the order
of SDK events and pending Futures through the published package's test boundary;
the production example imports only the public SDK entry point.

Reviewed against this repository's Architecture sections 3 (UI versus SDK
ownership), 4 (visible failure/recovery) and 6 (scoped evidence), plus App SDK
Architecture sections 5.2, 5.4 and 6.4 (native transport and Flutter delegation).
Before the behavior fix, four regressions failed (late connect/status success
and failure), while normal connection and explicit recovery passed. After the
fix, all six widget tests passed, including the additional stream-error case.
Locked installation, Flutter analysis and Dart analysis with the original lint
configuration passed. Existing package versions and the beta.9 archive hash are
unchanged; only `flutter_test` and its testing dependencies were added. The
[Flutter workflow](../.github/workflows/flutter-device-connect.yml) now runs
the widget suite before its existing Android APK build. Independent code review
found no blocking issue. No new physical-device test was performed for this UI fix.

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Architecture section 3: loss invalidates older UI results | Loss epoch guards connect/status results and operation errors; controlled-order widget regressions pass | matched in widget tests |
| Architecture section 4: explicit recovery remains usable | Normal connection, disconnect event, explicit reconnect and fresh status control passes | matched in widget tests |
| App SDK Architecture sections 5.2, 5.4, 6.4: native transport ownership | Public beta.9 pin/hash unchanged; no GATT, protocol, retry or native implementation added | matched by source/dependency review |
| Architecture section 6: evidence limits | UI regressions distinguished from the previous phone logs and physical acceptance | matched; new physical behavior unverified |
| First-attempt native reconnect reliability | Original 2/3 Flutter first reconnects and prompt native client cleanup retained above | partial; root cause and broader hardware checks remain open |

Changed-token searches covered internal/public documentation and repository
README, ARCHITECTURE, AGENTS and CLAUDE files. This example-only UI change does
not alter the public SDK API or authoritative transport design. The example
README, root catalog, architecture and contributor guidance were updated; the
CLAUDE entry point's stale beta.7 sample note was reconciled to beta.9.

The separate native explicit-disconnect timeout gap was subsequently reproduced
with the adapter on and its disconnect callback withheld. The unchanged SDK
failed four regressions: exact-client closure on API 26/35, delayed driver loss,
and delayed facade cleanup. SDK source
[`2ef8580`](https://github.com/bota-dev/app-sdk/commit/2ef85809e395a9675345f3aece0b967bb305d4cb)
closes the captured GATT and retains one-shot delayed loss delivery without
cancelling queued replacement work. All 61 affected framework, driver, manager
and runtime tests passed locally. See the
[native design review](https://github.com/bota-dev/app-sdk/blob/2ef85809e395a9675345f3aece0b967bb305d4cb/docs/parity/android-disconnection-events.md#explicit-disconnect-without-an-android-callback)
and exact-source [CI](https://github.com/bota-dev/app-sdk/actions/runs/36790626474)
and [License Gate](https://github.com/bota-dev/app-sdk/actions/runs/36790628943),
which gate main integration. At that checkpoint this was an **unreleased source fix**;
public beta.9 and these examples' dependency pins remained unchanged. It is not the observed
GATT 8/133 path and adds no physical reconnect reliability claim.

<a id="beta10-adoption"></a>
## Beta.10 adoption (2026-10-01; Flutter completion 2026-10-02 UTC)

The owner approved the exact [beta.10 release](https://github.com/bota-dev/app-sdk/actions/runs/36798449511)
and direct pushes without a PR. SDK source is
`f5c6482ac4378a2f35e902ade172a5cb779dffa6`. Protected publication completed
successfully in attempt 10 on 2026-10-02 UTC (October 1 Pacific). All five public
packages, native consumers and the full Flutter archive passed. Earlier
CocoaPods commit API timeouts ended when attempt 9 registered the exact pod;
its Flutter dependency check then reached the 30-minute CDN readiness limit.
After the CDN index and exact specification became available, attempt 10
resumed only the failed dependency verification and downstream Flutter stages.
Published artifacts, tag, source and original approval were preserved.
The [SDK publication record](https://github.com/bota-dev/app-sdk/blob/main/release/evidence/2.0.0-beta.10-publication.md)
records those historical failures and final successful gates.

All five App SDK connection examples now adopt exact public `2.0.0-beta.10`.
Flutter's pub.dev archive was independently checked against the registry hash
and all 59 files of the preserved tagged candidate. Its Android Maven and Apple
dependencies select exact beta.10. The Flutter pin/lock change affects only the
SDK version and public archive hash; six UI completion-ordering tests and
runtime source are retained. No private source, candidate package, native
override, example-owned GATT implementation or retry workaround was introduced.
The legacy root workspace remains on beta.6.

Beta.10 retires the exact native Android session when explicit disconnect times
out or is cancelled without a native callback. It clears facade/registry/presence
state, ignores stale/duplicate events, and preserves queued replacement work.
The original fix passed 61 controlled native regressions and exact release CI.
These checks do not prove physical missing-callback behavior or resolve the
separate beta.9 Flutter GATT 8/133 failure, whose native clients already closed
promptly. Examples retain explicit reconnect and SDK-owned transport policy.

### Public artifacts and local/hosted checks

| Example | Exact dependency and evidence | Remaining verification |
| --- | --- | --- |
| React Native | Public beta.10 tarball SHA-512 matches the lockfile; own-directory frozen install, TypeScript, identity regression and Android Metro export pass on Node 22.23.2 / Windows; npm audit reports zero vulnerabilities; hosted Android APK and iOS Simulator builds pass; iOS podspec uses the public SwiftPM dependency | Physical iOS unverified |
| Web | Public beta.10 tarball SHA-512 matches the lockfile; own-directory frozen install, TypeScript and Vite 7.3.6/WASM build pass locally and in hosted CI; local npm audit reports zero vulnerabilities | Physical browser Bluetooth unverified |
| Android | Exact beta.10 Maven AAR/POM verified; Bota-only lock update and separate frozen-lock APK build pass with JDK 17 / Android SDK 36; hosted APK assembly passes | Phone installation blocked by a signing-key mismatch, so no beta.10 Kotlin physical acceptance |
| Apple (SwiftPM) | Exact public tag revision and downloaded archive checksum verified; hosted SwiftPM resolution and macOS application build pass with the committed lock | Physical macOS Bluetooth unverified |
| Flutter | Exact public beta.10 archive verified against registry SHA-256 and all 59 preserved files; native dependencies pin beta.10 | Current example build and phone checks are recorded below; historical beta.9 evidence remains separate |

Verified SHA-256 values:

- React Native npm tarball: `931c783fbd9ec9c3308b5f669c62f462e3c7fe582d42c4c2bacb1e3b3ea7d47c`.
- Web npm tarball: `b90db9f2ea2d746d3387040007f8f6d7442ff4298c5d2e1dd107ec3a41e88b62`.
- Android AAR: `a8fffe299c6ba02e1ac5a808785c68e5c85c093b1ab093e78bb923a2461514de`.
- Android POM: `2c980d25bbadfc7721549eaaa09125feb2af015f468d3abd47083aa8ee625e75`.
- SwiftPM XCFramework archive: `169cc4bc27270447bd159c64b715a278e9877ab656172859e1bf6ecb58d1e425`.
- Flutter public pub.dev archive: `6525ccdb08fb4f53af1d2cc55a432e0d59590770cd00c0e1a7d54ff6de3e8c9c`.
- Flutter normalized archive: `8545b816a7f241420a245f707b9a2c894038d8ee77b67b5c39a1c81deee1ee52`.

The SwiftPM tag resolves to the exact SDK source above. npm `beta` selects
beta.10; `latest` remains beta.0. RN/Web lockfile changes are limited to the SDK
version, public tarball URL and integrity; the RN `xcode` → `uuid@11.1.1` override
is preserved. The following hosted workflows all passed at examples source
`54237e14014f914270ec3c3b7648a82f2e97b9c5` on 2026-10-01 UTC. These results were
recorded in a later documentation-only update; executable source and dependency
locks remain those tested at `54237e1`. Prior beta.9 green builds remain historical.

| Gate | Successful exact-source run |
| --- | --- |
| React Native frozen install, TypeScript, identity test, Android export, Android arm64 APK and iOS Simulator native application | [36893071799](https://github.com/bota-dev/examples/actions/runs/36893071799) |
| Kotlin frozen Gradle resolution, APK assembly and preserved APK | [36893071809](https://github.com/bota-dev/examples/actions/runs/36893071809) |
| Web frozen install, TypeScript and Vite/WASM production build | [36893071814](https://github.com/bota-dev/examples/actions/runs/36893071814) |
| SwiftPM resolution and macOS application build | [36893071878](https://github.com/bota-dev/examples/actions/runs/36893071878) |
| Legacy root verification, all-platform export and Android native build | [36893071904](https://github.com/bota-dev/examples/actions/runs/36893071904) |
| CodeQL Actions and JavaScript/TypeScript analysis | [36893071267](https://github.com/bota-dev/examples/actions/runs/36893071267) |

### React Native public beta.10 phone acceptance

On 2026-10-01 UTC, an isolated Android arm64 release-mode lab consumed the exact
public npm package and Maven AAR above. Its only example changes were application
ID `dev.bota.lab.public10rn` and diagnostic display of discovered transport ID and
SDK-read firmware. Per-file LF-normalized source hashes were recorded and matched
the example source before the later documentation-only phone-result updates.
The APK bundles JavaScript and requires no Metro. Its SHA-256 is
`e96ba9650ff74ef9c64063a7b8f4bd4f6e343abe6c81438ec504733401450f0e`.
Native assembly, resolved public AAR integrity and bundled JS/arm64 inspection
passed locally; this lab build is separate from the successful hosted example gate.

On Samsung SM-A166U1 / Android 16, the SDK verified device serial `4KF6NOHWX0`
and firmware `1.0.19`. Three successive adapter-off cycles each cleared stale
connection/status UI automatically. After Bluetooth restoration and a fresh
scan, each first explicit reconnect verified the same serial/firmware and read
fresh status: **3/3 loss notifications and 3/3 first reconnects**. A separate
graceful Disconnect → fresh scan → first reconnect also verified identity and
read status. Final explicit disconnect passed; the lab was stopped and phone
Bluetooth left on. UI snapshots and the scoped cycle/graceful logs support these
bounded observations. No wearable provisioning, firmware update, recording,
upload, reset or data deletion was performed.

This is foreground evidence for one phone/device/firmware pair. A physical
missing-disconnect-callback fault was not induced. It does not establish general
GATT 8/133 recovery, automatic reconnect, background/out-of-range behavior,
interrupted transfer handling or acceptance on other platforms/hardware. The
earlier beta.9 Flutter 2/3 first-reconnect result and eventual same-session
recovery remain historical evidence; beta.10 Flutter checks are recorded below.

### Flutter public beta.10 adoption checks

The independently downloaded pub.dev archive matches its registry SHA-256 and
all 59 tagged candidate files. The exact beta.10 native dependency constraints
were also inspected. Locked installation, Flutter analysis, direct Dart analysis
with the original analysis configuration, and all six widget regressions passed
locally with Flutter 3.47.5 / Dart 3.13.4 on Windows. The CLI's automatic analysis
configuration edit was reverted; no runtime or test-source changes are included.

Hosted frozen installation, analysis, six widget tests and APK assembly passed
in [Flutter CI 36956252674](https://github.com/bota-dev/examples/actions/runs/36956252674)
at exact examples source `c8c7a896edb3153e0fdd08a7267f4deb6abb2b95`.
[CodeQL 36956252291](https://github.com/bota-dev/examples/actions/runs/36956252291)
and [root CI 36956252654](https://github.com/bota-dev/examples/actions/runs/36956252654)
(legacy tests, types, build, all-platform export and Android APK) also passed
at that source. These checks are separate from the SDK release and
the other four examples' earlier CI runs.

An isolated Android arm64 debug lab also built and installed successfully.
Its runtime changes only the application ID (`dev.bota.lab.public10flutter`)
and diagnostic display of transport ID and SDK-read firmware. Source reconciliation
matched 25 tracked files, including runtime inputs, locks and tests, to `c8c7a89`
before the named lab substitutions. The lab copied an earlier README and the
Flutter CLI's automatic analysis-configuration edit; neither is claimed identical
to the final example. Local paths and Gradle memory/worker limits are build-only
changes. No private SDK, native dependency override or transport workaround is used.
The APK SHA-256 is
`be69ec6405578eb0d35a7a31d67881dbb0ad64ef33fc8344bb48bef46f9f323d`.
Gradle resolved `dev.bota:bota-app-sdk:2.0.0-beta.10` with the public AAR hash
recorded above.

On 2026-10-02 UTC (October 1 Pacific), Samsung SM-A166U1 / Android 16 connected
and verified serial `4KF6NOHWX0` and firmware `1.0.19`. Fresh status read 100%
battery and one pending recording. The device initially reported `syncing`;
the test waited for an observed `idle` before changing the phone adapter.
All three Bluetooth shutdowns automatically displayed the loss message and
disabled Read status and Disconnect. Scoped native logs show GATT close and
unregister at shutdown. In the first cycle, two fresh ten-second scans found
other devices but not the target transport `2B:71:BA:82:23:FF`. The scripted
check stopped at discovery. A third scan several minutes later rediscovered
the target without an app restart or additional Bluetooth toggle; the user
confirmed the Pin remained powered and nearby. Its first subsequent connection
attempt verified identity/firmware and read fresh status. Cycles two and three
found the target in the first scan and also passed their first connection
attempts and fresh status reads. Status sometimes reported `syncing`; the next
radio cycle waited for an observed `idle` without requesting any transfer.

The bounded result is **3/3 automatic-loss observations and 3/3 eventual
reconnections**, with delayed discovery in the first cycle. It does not establish
consistently prompt rediscovery, an SDK or firmware cause for the delay, or a fix
for the historical GATT 8/133 failure. No wearable provisioning, firmware update,
recording, upload, reset or deletion was requested.

A separate graceful Disconnect → fresh scan → first reconnect verified the same
identity/firmware and fresh idle status. Final explicit disconnect passed; the
lab was stopped and phone Bluetooth left on. UI snapshots and scoped native
logs support these observations. Background/out-of-range use, other hardware,
interrupted transfers and forced missing-disconnect-callback behavior remain
unverified.

### Design and acceptance review

The compound-engineering review uses Architecture sections 2–4 and 6 plus the
SDK native cleanup review linked above. Changed-token searches covered example
paths, SDK package names and versions across internal/public documentation and
repository README, ARCHITECTURE, AGENTS and CLAUDE files. Catalog and contributor
docs distinguish completed beta.10 publication from each example's build and
physical acceptance, and keep current results separate from historical evidence.

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Sections 2 and 4: independent exact public dependencies | All five public beta.10 pins/locks; Flutter archive/native constraints independently verified; no private override | matched for the documented dependencies |
| Section 3: native transport ownership | SDK-only dependency upgrades; example runtime unchanged | matched by source review |
| Section 3: Flutter loss events supersede older operation results | Six unchanged widget regressions pass with public beta.10 | matched for simulated UI ordering |
| Sections 4 and 6: visible loss and explicit recovery | RN beta.10 public lab: three loss/first-reconnect cycles plus graceful disconnect/reconnect; Flutter three loss/eventual-reconnect cycles with identity/status, first cycle required a third discovery scan | matched for bounded loss/recovery observations; prompt Flutter rediscovery remains partial; physical missing-callback behavior unverified |
| Section 6: per-platform native/build evidence | Local RN/Kotlin/Flutter APK and Web checks; four beta.10 hosted example workflows pass at `54237e1`, including Apple macOS and RN iOS; Flutter hosted APK passes at `c8c7a89` | matched for documented build targets; physical acceptance remains scoped separately |
| Section 4: honest publication and compatibility status | All five exact public pins, successful protected release and separate dated acceptance evidence | matched; synchronized publication complete |
| General reconnect reliability | Earlier GATT 8/133 failure retained; beta.10 Flutter recovered all three cycles, with delayed first-cycle rediscovery | partial; general reliability and root cause/resolution not established |
| Wider physical and recording workflows | No Apple/Web/Kotlin beta.10 physical or background/out-of-range/transfer-interruption acceptance added | unverified |

<a id="pre-provisioned-recording-sync"></a>
## Already-provisioned Android recording sync (2026-10-02)

The ninth example, `end-to-end/react-native-recording-sync`, implements the
bounded device → encrypted cloud upload → transcription workflow. It has an
independent Expo Android app and Node backend, using exact public beta.10.
It does not implement first binding, recording control, reset, plaintext fallback,
or the full legacy replacement. The architecture applies binding requirements
when an example includes binding; this sample instead requires an already-bound
device and verifies its current server owner/generation and SDK-read serial.

The beta.10 npm archive contains the public native material-registration API;
its audited source files match the registry tarball and lockfile integrity.
The public Kotlin material constructor and RN registration bridge support an
independently implemented host adapter. The SDK checks fresh encrypted-v2
capability before the provider runs, retains native recording bytes and transfer
checkpoints, and owns signed-receipt delivery and device confirmation. The app
does not import a private Bota One helper or implement GATT/cryptography.

The backend fixes the project, end user and device in server configuration,
authenticates a separate app token, rechecks live ownership/binding, and rejects
automatic transcription before the explicit-processing path. SQLite retains
capture identity and uncertain creation intents. Native HTTP/journal callbacks
keep signed documents, staging credentials, manifests and receipts off JavaScript.
They persist intent before returning a PUT request; uncertain staging does not
silently issue another PUT. Cloud publication, device cleanup and transcription
remain separate outcomes. App scope epochs fence late UI updates and cancellation
waits for the existing operation to settle before another starts.

This is a conservative example, not complete automatic recovery: lost create
responses, uncertain PUTs, missing native journal with retained SDK state, changed
nonce and expired/replaced ownership require reconciliation. Journals are retained;
the example does not generate replacement recordings/sessions merely to retry.
The underlying beta.10 transfer checkpoint is removed before final device CONFIRM,
so backend/native session identity is retained independently of that checkpoint.

### Evidence

- Own-directory frozen app install, TypeScript, nine app/HTTP/lifecycle tests and
  Android Metro export passed on Node 22.23.2 / Windows.
- Backend frozen install, syntax checks and 18 HTTP/SQLite regression tests passed.
  Tests cover caller/resource authorization, generation races, manifest identity,
  uncertain creates and reuse of the existing transcription.
- The Android native module compiled against the public beta.10 Maven dependency
  and packaged RN bridge; ten JVM tests passed, with zero skipped. Cases include
  preparation cancellation, late response fencing, blocked-body cancellation,
  journal state and uncertain PUT handling. These host tests do not exercise the
  consumed SDK material registry's registration lifetime.
- Live read-only checks rejected missing app authentication (`401`) and a
  mismatched configured end user (`409`). Configuring the device's actual existing
  owner returned `200` for authorized context and the empty example-owned cloud
  recording list. The device was `4KF6NOHWX0`, current binding generation 2.
  Effective automatic transcription was already disabled. No bind/config changes
  or upload/transcription writes were made by these checks.
- Local full Android APK assembly and installation passed. The APK SHA-256 is
  `b0b817ef61890410d75e70839372fa838e179fc06ac34296d348b04157fc5f88`.
  Phone startup, backend authorization and Bluetooth scanning passed on Samsung
  SM-A166U1 / Android 16. The initial scan found other candidates, but two further
  scans returned no candidates. Exact-device connection and encrypted catalog
  checks remain unverified. The app/backend were stopped and temporary ADB port
  forwarding removed; Bluetooth remains on.
- Exact-source hosted CI and physical encrypted-upload acceptance remain
  unverified. Upload awaits selection of a synthetic or explicitly consented
  recording; no physical upload/receipt/deletion or live transcription result is
  claimed. Earlier RN/Flutter connection results do not establish those behaviors.

### Design review

Compound-engineering review compares the source with Architecture §§2–4/6 and
Upload Management §1.1, keeping target completeness separate from this subset.

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Independent public dependencies and native ownership | Exact beta.10 pins; own app/backend locks; public material registry; no private runtime imports or GATT | matched in source/native compilation |
| Runnable Android host | Local APK assembly/install and phone startup, backend authorization and scan; exact APK hash above | matched for these checks; exact-device catalog, hosted CI and physical upload unverified |
| Caller and resource authorization | Separate app token; fixed server scope; native operations and app cloud routes enforce the observed binding generation; exact capture/session checks | matched in 18 backend tests and read-only live scope checks |
| Opaque native material and SDK-owned bytes | Native Kotlin callbacks and scalar-only JS profile decision | matched in source/native tests; physical profile acceptance pending |
| Fresh upload admission and stale-result fencing | Fresh idle plus `syncActive === false`; operation epoch/abort; partial native configuration rollback | matched in source and nine app checks |
| Stable cloud identity and no unsafe repeat PUT | Durable backend/native journals; exact manifest/receipt identity checks; uncertain writes stop | matched for bounded host tests; broader automatic recovery partial |
| Cloud commitment before source cleanup | SDK receipt/confirmation path; no app confirm/delete operation | source matched; physical receipt/deletion ordering unverified |
| Separate processing and retained results | Published-session gate, effective auto-processing check, one transcription intent, scoped cloud list | matched in backend tests; live transcription unverified |
| Full replacement/target protected first bind | Pairing excluded; existing raw-token contract unchanged; legacy app retained | not implemented by this example |

Searches covered the new example path, native registration API, local route and
environment names across example docs and the public/internal documentation
surface. Catalog/contributor docs and public example guidance distinguish this
subset from full replacement. No SDK/API/wire contract or authoritative design
was changed to mark the example complete.
