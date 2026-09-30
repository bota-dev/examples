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

The native source fix and bounded phone acceptance are ready for a new release;
the installed public beta.8 examples do not yet contain it. Bluetooth was left
ON, both labs were disconnected/stopped, and no wearable data or firmware was
changed. Full recording-sync replacement remains blocked as described above.
