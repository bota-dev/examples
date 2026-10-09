# Independent examples implementation review

Review date: 2026-09-29 UTC. Uses the shared compound-engineering 1.2.5 workflow against [ARCHITECTURE.md](../ARCHITECTURE.md) §§2–6 and the selected public contracts. This expansion adds seven examples alongside the previously verified Node upload example; it does not modify the legacy workspace or the platform/SDK implementation.

<a id="api-expansion-october-8"></a>
## Ask, subtitles and Python webhooks — 2026-10-08

Three independent API examples bring the catalog to seventeen. The owner asked
to keep creating without testing; this pass uses independent installation,
syntax/build checks and source review. Behavioral, failure-path and live API
acceptance remain unverified. No credentials, cloud mutations or hardware were
used during implementation.

| Example | Public contract and implemented workflow | Evidence |
| --- | --- | --- |
| `api/ask-recording-node` | GET recording owner; POST empty recording-scoped Ask session; commit ID and message intent; POST one question; validate provider/answer/citations; existing journal uses GET-only reconciliation | Frozen `npm ci` and `npm run check` pass on Node 22.23.2 / Windows; source review |
| `api/export-transcription-node` | GET recording owner and exact completed transcription; convert second-based segments to SRT; publish private completed bytes without overwriting | Frozen `npm ci` and `npm run check` pass on Node 22.23.2 / Windows; source review |
| `api/webhook-receiver-python` | Timestamp + raw-body HMAC `v1=` verification; signed event ID; exact-byte duplicate/conflict handling; SQLite FULL commit before acknowledgment | `python -m py_compile server.py` passes on Python 3.12.14 / Windows; source review |

Each example owns its configuration, README, ignore rules and path-filtered
workflow. The Node examples use only built-ins and their own manifests/locks;
Python uses the standard library. The new workflows perform syntax checks and
require no credentials. Workflow YAML, trigger paths, least-privilege permissions
and existing SHA-pinned actions were reviewed. The existing legacy/device
dependencies, security guards and workflows were preserved.

The Ask journal commits each non-idempotent request's intent before sending.
Unknown session creation remains unresolved rather than adopting an arbitrary
ID. Known sessions resume only by reading a complete single question/answer
pair; reconciliation identifies roles independently of response ordering. The
question hash, known answer ID, provider, recording scope and citations are still
checked. A local journal cannot coordinate other applications, and separate
ownership reads do not provide an atomic snapshot.

The export validates all segments before output, rejects invalid UTF-8 JSON,
normalizes cue text, rounds seconds to milliseconds and preserves original
ordering/overlaps. An exclusive temporary file and no-overwrite hard-link
publication preserve existing destinations; cleanup touches only this run's
partial file. Subtitle-player behavior and filesystem failure paths are unverified.

The Python receiver accepts only signed raw bytes within the timestamp window,
rejects repeated headers and conflicting payloads, and retains a private SQLite
inbox. Downstream processing, HTTPS deployment and authoritative API reconciliation
remain customer responsibilities. Its standard-library HTTP server is a local
teaching host; hosted platform delivery was not exercised.

### Design comparison

Review basis: [ARCHITECTURE.md](../ARCHITECTURE.md) §§2–4 and §6, selected public
[Ask](https://docs.bota.dev/api-reference/ask/create-session),
[transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get) and
[webhook](https://docs.bota.dev/webhooks/overview) contracts, and the owner's
October 8 instruction, “dont need testing. keep creating.”

| Requirement | Implementation evidence | Status / verification limit |
| --- | --- | --- |
| §§2, 4: standalone setup and public contracts | Own directories, manifests/configuration, public routes and standard libraries; no sibling runtime | Matched by install/source review |
| §3: credential and resource boundary | Server-only keys; fixed recording/end-user checks; bounded responses and sanitized failures; webhook signature before persistence | Matched in source; behavior unverified |
| §3: uncertainty and durable acceptance | Pre-POST Ask intent; GET-only recovery; exclusive export; authenticated SQLite inbox commit before reply | Matched in source; crash/failure behavior unverified |
| §4: documented setup, cleanup and actual status | Example READMEs, root catalog/agent docs and public catalog identify the three examples and their evidence limits | Matched |
| §6: functional checks | No new functional test suites or live execution in this pass | Intentionally diverged under the owner's instruction; runtime acceptance unverified |
| §6: isolated CI | Three path-filtered syntax workflows with read-only permissions and no live credentials | Matched in source; hosted outcomes are reported by their run checks |

Independent review found and corrected the message-order dependency in Ask
reconciliation. Documentation searches covered the three paths, Ask endpoints,
new environment variables, SRT and inbox terms across workspace overview files,
public docs and internal docs. Current catalog/changelog/agent owners were
updated. Existing API designs and dated webhook/instrument evidence were not
changed; the internal-docs downstream matrix introduces no contract change.

<a id="beta13-adoption"></a>
## Public beta.13 adoption — 2026-10-08

The seven independent device examples now select exact public
`2.0.0-beta.13`: React Native, Web, Apple, Android and Flutter connection samples,
Android recording catalog, and React Native encrypted recording sync. The legacy
`apps/` workspace remains on beta.6. This is dependency adoption and validation;
example workflow scope and host callback behavior are unchanged.

The public tag resolves to SDK source `958696b603be0ff6b30adba95e499dc1b5bc05b7`.
SDK [CI](https://github.com/bota-dev/app-sdk/actions/runs/37848944999),
[License Gate](https://github.com/bota-dev/app-sdk/actions/runs/37848944972) and
[protected publication](https://github.com/bota-dev/app-sdk/actions/runs/37851464527)
succeeded. The [publication review](https://github.com/bota-dev/app-sdk/releases/download/v2.0.0-beta.13/beta13-publication-review.md)
records npm, pub.dev, Maven Central, SwiftPM and CocoaPods verification. npm's
`beta` tag points to beta.13; `latest` remains beta.0. Publication proves package
availability, not acceptance of every consuming example.

| Example | Beta.13 verification | Remaining check |
| --- | --- | --- |
| React Native connect | Frozen public install, typecheck, 30 tests (identity and existing security regressions), Android Metro export passed locally; hosted Android APK and iOS Simulator builds passed | Physical beta.13 session |
| Web connect | Frozen public install, 4 tests, typecheck and Vite/WASM production build passed locally and hosted | Browser/firmware session |
| Apple connect | Exact SwiftPM tag/source revision; hosted package resolution and macOS app build passed | Physical permissions/BLE |
| Android connect | Public Maven resolution and debug APK build passed locally and hosted | Physical beta.13 session |
| Android recording catalog | Public Maven resolution, 16 unit tests and debug APK build passed locally and hosted | Physical beta.13 catalog |
| Flutter connect | Frozen pub.dev resolution, original-config analysis, six widget tests and debug APK build passed locally and hosted | Physical beta.13 session |
| React Native recording sync | Frozen public install, typecheck, 44 app/security tests, Android Metro export, backend syntax check and 22 backend tests passed locally; hosted backend, native adapter tests and APK build passed | Physical upload/receipt/cleanup/recovery |

### Hosted example results

All seven workflows completed successfully. Six ran at examples source
`c1feec5fc46d80a31f8636602245a44da0c58bef`; Flutter's final run used
`6a35e098042a894835dd187891609f1bc252a2ac`, which only excludes generated Kotlin
build state and documents that exclusion. The remaining examples are unchanged
between those revisions. Later edits to this review do not change their source.

| Workflow | Passing run |
| --- | --- |
| React Native connect: Android and iOS Simulator | [37860425798](https://github.com/bota-dev/examples/actions/runs/37860425798) |
| Web connect | [37860425682](https://github.com/bota-dev/examples/actions/runs/37860425682) |
| Apple macOS connect | [37860425815](https://github.com/bota-dev/examples/actions/runs/37860425815) |
| Kotlin connect | [37860425738](https://github.com/bota-dev/examples/actions/runs/37860425738) |
| Kotlin recording catalog | [37860425752](https://github.com/bota-dev/examples/actions/runs/37860425752) |
| Flutter connect | [37860502313](https://github.com/bota-dev/examples/actions/runs/37860502313) |
| React Native recording sync: backend and native adapter/Android | [37860425725](https://github.com/bota-dev/examples/actions/runs/37860425725) |

The existing standalone Forge/braces guards, source-map tests and non-SDK npm
dependency entries are retained. Passing these suites does not close the existing
scanner advisories or establish native runtime security. Native applications must
be rebuilt after this upgrade.

The local Flutter APK SHA-256 is
`1dda1c081cb10b22353987b8f7acbe433e1384e89fa255daa50c6a55840f6f3d`.
Local Gradle/Kotlin compiler state is ignored; no generated compiler session
files are part of the final source tree.

Public Android beta.13 still initializes the connection snapshot's `isProvisioned`
to false (`DeviceManager.kt` at the tag). Catalog and sync retain fresh public
pairing-state reads, exact connected-serial checks and connection ownership fences.
No real device identifier or credential becomes a runtime default.

Beta.13 includes the previously released Android failed-connect/MTU cleanup.
Unpublished pending-425 recovery work is outside this immutable release and is
not part of these examples. The sync adapter continues to retain uncertain
creates/PUTs and stop for reconciliation; adoption does not establish automatic
recovery or replace its existing HTTP/journal responsibilities.

No example was installed or exercised on the shared test phone during this
adoption. Its retained Demo recovery state belongs to a separate campaign.
Earlier beta.10 and older physical results below remain dated evidence, and
internal-app observations cannot establish these examples' beta.13 acceptance.

### Design comparison

Reviewed against [ARCHITECTURE.md](../ARCHITECTURE.md) §§2–6 and the immutable
public SDK tag, using the compound-engineering workflow.

| Requirement | Evidence and verification | Status |
| --- | --- | --- |
| §§2, 4: independent installs and exact public SDK dependencies | Own manifests/locks, public package resolutions, no sibling or local SDK override; legacy workspace unchanged | Matched |
| §3: SDK owns transport, files and receipt confirmation | Dependency changes preserve existing public integrations and host callbacks; no GATT/crypto/transfer implementation added | Matched in source; physical behavior unverified |
| §3: identity, authorization and uncertain-outcome boundaries | Fresh pairing reads, serial admission, backend binding checks, journals and app/native module interfaces retained; app/backend regressions pass | Matched for unchanged source/local tests; hardware and recovery remain partial |
| §4: current pins and evidence distinguish verification levels | Catalog, agent docs and per-example READMEs identify beta.13; prior phone/build results retain exact versions | Matched |
| §6: isolated platform checks | Local results and seven successful hosted workflows above; existing path filters retained | Matched for build/test acceptance; hardware remains unverified |
| §5: full replacement and legacy retirement | No new pairing or full recovery implementation; no new hardware acceptance | Not implemented by this adoption |

Documentation search covered package/version and all seven example path tokens
across public/internal docs and workspace README, architecture and agent files.
The public SDK catalog and changelog were updated on docs `main` at
[`cdc625c`](https://github.com/bota-dev/docs/commit/cdc625c3ba110e1b77e4ea259bd33818762d5ab1).
Mint validation and local rendering of both pages passed; live-site promotion
is separate. Dated security and hardware evidence stays unchanged. The
internal-docs downstream matrix introduces no target-contract change for this
dependency adoption. Independent source review found no actionable compatibility,
security, lockfile or documentation-link defects.

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

The app's Expo Node signing tools retain an [open node-forge advisory](../DEPENDENCY_SECURITY.md#node-forge-open-advisory) with no published fix; source inspection found no direct use in the app/SDK upload path, but does not establish unreachability or remediation.

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
  After the final generation-fence fix, these read-only checks passed again;
  cloud listing rejected a missing binding header (`400`) and a stale generation
  (`409`), while the current generation succeeded.
- Local full Android APK assembly and installation passed. The APK SHA-256 is
  `b0b817ef61890410d75e70839372fa838e179fc06ac34296d348b04157fc5f88`.
  Phone startup, backend authorization and Bluetooth scanning passed on Samsung
  SM-A166U1 / Android 16. The initial scan found other candidates, but two further
  scans returned no candidates. Exact-device connection and encrypted catalog
  checks remain unverified. The app/backend were stopped and temporary ADB port
  forwarding removed; Bluetooth remains on.
- Hosted [recording-sync CI](https://github.com/bota-dev/examples/actions/runs/37038166401)
  passed both backend and Android jobs at `1145dffcc72d42dca1d87ecea9a5dc684d718e9b`,
  including native adapter tests, app checks/export and APK assembly.
- The public catalog and changelog were deployed from docs prod `278f577` after
  validation; [Mintlify deployment](https://github.com/bota-dev/docs/runs/110942619161)
  succeeded and both live pages returned the new example.
- Physical encrypted-upload acceptance remains unverified.
  Upload awaits selection of a synthetic or explicitly consented
  recording; no physical upload/receipt/deletion or live transcription result is
  claimed. Earlier RN/Flutter connection results do not establish those behaviors.

### Design review

Compound-engineering review compares the source with Architecture §§2–4/6 and
Upload Management §1.1, keeping target completeness separate from this subset.

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Independent public dependencies and native ownership | Exact beta.10 pins; own app/backend locks; public material registry; no private runtime imports or GATT | matched in source/native compilation |
| Runnable Android host | Local APK assembly/install and phone startup, backend authorization and scan; exact APK hash and passing hosted Android build above | matched for these checks; exact-device catalog and physical upload unverified |
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

<a id="summary-and-recording-catalog"></a>
## Structured summaries and Android recording catalog (2026-10-02)

These two independent examples extend the catalog to eleven. They add neither
an API SDK nor private Bota One helpers. The summary CLI uses Node built-ins and
public HTTP; the native catalog pins public Maven beta.10 with its own Gradle
wrapper and lock. Both have path-filtered, credential-free CI workflows.

### Summary evidence and recovery boundary

`api/summarize-transcription-node` has 19 passing local tests, frozen installation,
syntax checks and CLI help. Its SQLite journal commits a fixed scoped request
and single-use key before POST. Unknown creation requires explicit inspection
and validated attachment; normal resume reads the saved ID. Current processing
configuration is an observation, not proof of historical settings or a lock
against other writers. The summary service can replace a result on a new
same-template POST, so the CLI does not use POST for status recovery.

A live test on October 2 at 17:51 UTC used the earlier synthetic transcript
`txn_AdJdzz5CAwyTPInJMEwcDmu2`. It was completed, its device-less recording matched
the test project/end user, auto-summary was disabled, and the filtered summary
list was empty. Exactly one POST created `sum_2p7CBziLiZEouPAVtaTgjHxi` with
`tmpl_general_notes` and Gemini. Structured output included summary, overview,
decisions, key points, action items and participants. Reopening the journal,
including in a separate process, retrieved the same ID with zero new POSTs.
No audio or configuration was changed; cloud results and local journal remain.
This is workflow/shape evidence, not an accuracy benchmark. Other providers,
live outages, power loss and external-writer races remain unverified.

### Catalog and provisioning observations

`app-sdk/android-recording-catalog` verifies the exact serial, checks fresh SDK
pairing state, and displays pending recording metadata. Legacy and encrypted-v2
entries remain distinct; legacy is not a synonym for plaintext. No app-side GATT,
audio transfer, cloud upload, delete/confirm, pairing or recording control is added.
Connection revisions prevent older reads from repopulating a retired selection.

The initial phone pass exposed an invalid example assumption: public beta.10
`DeviceManager` initializes the immutable connection snapshot's `isProvisioned`
to false. A rejection based on that field did **not** establish that the Pin was
unprovisioned. The catalog now uses a fresh public control read; the React Native
sync example gains the equivalent fresh preflight. Unknown/false/error results
block admission without implying that reset or rebinding is appropriate.
Pairing state does not replace backend binding-generation/ownership checks or
the SDK's fresh encrypted-capability, authorization and receipt requirements.

The React Native change passed TypeScript, 15 app tests and an Android Metro
export (609 modules). It checks fresh pairing after connection and before catalog
and sync admission. False/error results block access and attempt disconnect;
older probes cannot admit or disconnect a replacement connection. Native code
and dependency pins are unchanged.

The native catalog also waits for the SDK connect call to settle before its
event-triggered pairing read: beta.10 publishes the connected event before
releasing its operation slot. Regression tests cover this ordering and connection
loss while waiting, as well as fresh-state denial and retired results.
Ten catalog unit tests and frozen-lock debug APK assembly passed. The resulting
APK SHA-256 is
`28e6a2d628f220a70633d444ab4bdb86f6dd98f98688440a556855dee0707586`.
This artifact supersedes the snapshot-based and premature-read builds; physical
checks of it remain separate from those earlier attempts.

A second React Native read-only run refreshed the Metro JavaScript from
`daabf16` while retaining the previously recorded native debug APK
(`b0b817ef61890410d75e70839372fa838e179fc06ac34296d348b04157fc5f88`).
It verified `4KF6NOHWX0` and fresh paired state on the first connection after one
scan. Catalog listing performed another fresh pairing read and reported zero
encrypted and zero legacy recordings. Graceful disconnect disabled listing.
The phone was Samsung SM-A166U1 / Android 16; firmware was not exposed by this
UI. This verifies the new guard's successful connection/catalog path, not physical
denial races, upload, receipt/source cleanup or transcription.

The final native-catalog APK then passed on the same Samsung/Android combination.
After one scan, its first connection attempt failed before pairing; the second
verified SDK serial `4KF6NOHWX0`, firmware `1.0.19` and fresh `Paired` state.
Status reported idle, no active upload and zero pending recordings. Listing
returned an empty catalog. Explicit disconnect cleared metadata and disabled
reads. The app was stopped and Bluetooth left on; temporary port forwarding was
absent. No recording, audio, firmware or provisioning mutation was performed.
Populated legacy/encrypted catalogs, physical rejection/races and first-attempt
connection reliability remain unverified.

Before that guard correction, the existing React Native sync app verified
`4KF6NOHWX0` on the third connection attempt across two scans on Samsung SM-A166U1
/ Android 16, returned an empty catalog (zero encrypted and zero legacy entries),
and disconnected gracefully. This observation does not verify the new guard or
audio transfer. The first native-catalog APK's startup/permission checks passed,
but its snapshot-based rejection was invalid evidence and was corrected.
No audio, provisioning, recording control or deletion was performed in this pass.

### Design review

The compound-engineering review compares repository Architecture §§2–4/6,
public summary/idempotency contracts and the public beta.10 catalog/control APIs.
Source-token searches covered public/internal docs and repository contributor,
architecture and README files; target designs and SDK/API behavior are unchanged.

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Independent public integration | Own manifests/locks, fixed public routes and public Maven facade | matched in source and local installs/builds |
| Preserve summary identity through uncertainty | Durable intent/CAS, explicit attachment, exact scope checks, GET-only resume | matched in 19 tests and live known-ID resume; ambiguous live writes unverified |
| Bounded processing and secret handling | Deadline/late-response/body-cancellation tests; server-only key, metadata-only journal | matched locally; no credentials or generated text committed |
| Exact device and fresh observation | SDK serial contract plus fresh pairing read; connection-scoped admission; both phone apps admitted the exact Pin with fresh paired state | matched for bounded successful connection/catalog paths; physical denial races unverified |
| Metadata-only catalog and retired-result fencing | Public `PendingRecording` variants, ten state/callback regressions, empty physical catalog and clean disconnect | matched for tested paths; populated physical catalogs and broader reconnect coverage unverified |
| Honest acceptance and public guidance | Per-example README, catalog and summary re-run guidance | local/live/hosted/hardware evidence remain distinct |

Hosted runs and final phone checks are recorded after their completion; neither
initial source inspection nor an earlier APK establishes those results.

The source was pushed directly to `main` as
[`daabf16`](https://github.com/bota-dev/examples/commit/daabf16c0865afeb7a63279da9581092c80498dc).
The standalone [summary workflow](https://github.com/bota-dev/examples/actions/runs/37045526764)
passed for that exact source.
The [catalog workflow](https://github.com/bota-dev/examples/actions/runs/37045526800)
also passed its ten tests and Android assembly, and GitHub's
[CodeQL run](https://github.com/bota-dev/examples/actions/runs/37045526997) passed
Actions and JavaScript/TypeScript analyses. The
[recording-sync workflow](https://github.com/bota-dev/examples/actions/runs/37045526827)
passed backend tests, native adapter tests and Android assembly. The
[root CI](https://github.com/bota-dev/examples/actions/runs/37045526669) passed
verification and the legacy Android native build. All four expected workflows
and the additional CodeQL run completed successfully at `daabf16`; none was rerun.

Public guidance was pushed to docs `main` as `4096d51` and promoted selectively
to `prod` through `ec200e2` and `a23b331`. The fourth promoted page corrected the
older production idempotency guidance to match the already-reviewed main page:
the current response cache is asynchronous, does not compare request bodies,
and is not a durable job journal. The scoped promotion preserved unrelated
production OTA/reset content. Mintlify validation with `--disable-openapi` and
all four local renders passed; no OpenAPI schema changed. The exact-source
[Mintlify deployment](https://github.com/bota-dev/docs/runs/110966597951) succeeded,
and the SDK catalog, summary-create, idempotency and changelog pages returned
HTTP 200 with the new guidance on `docs.bota.dev`.

### Device selection review

Application code contains no fixed physical-device serial. Connection samples
accept operator input; recording sync receives the serial from the backend's
authorized, environment-selected device resource. One unit-test fixture that
used the physical test serial was changed to `TESTPIN0001`; its four scope/HTTP
tests passed. TypeScript and the complete 15-test app suite also passed before
that fixture-only substitution. Searches of tracked executable/configuration
files found no remaining occurrence of the real test serial. Documentation
references remain dated hardware evidence, not runtime defaults. This matches
Architecture §§2–4's reusable-example and server-derived identity requirements.

The fixture-only change was pushed as `dcb6571b51b142f36802b7554aba204f79c79cc9`.
GitHub API checks confirmed successful completion for that exact source:
[root CI](https://github.com/bota-dev/examples/actions/runs/37062121777)
(verification and legacy Android native build),
[recording-sync CI](https://github.com/bota-dev/examples/actions/runs/37062121865)
(backend and Android), and
[CodeQL](https://github.com/bota-dev/examples/actions/runs/37062121527)
(Actions and JavaScript/TypeScript analyses). The summary and catalog workflow
evidence remains the separate `daabf16` runs above. These hosted checks add no
physical encrypted upload, receipt/source-cleanup or live transcription evidence.

### Read-only phone continuation — 2026-10-02

At 17:06:42 local time, a synthetic-fixture connection attempt timed out after
ten seconds before reaching connected state; no device commands followed. The
public example entrypoint was restored, with `App.tsx` SHA-256
`3bff08ca3470050efe93739cd689114306ea6137179a8a3da1bb94ade17bd3ca`
matching the repository, and the existing native APK remained
`b0b817ef61890410d75e70839372fa838e179fc06ac34296d348b04157fc5f88`.
After one phone Bluetooth OFF/ON cycle and one fresh scan, the first connection
attempt began at 17:08:47, reached connected at 17:08:48.943, negotiated MTU 512
at 17:08:50.974 and completed service discovery. The SDK accepted the exact
serial and fresh `Paired` state; catalog listing returned zero encrypted and
zero legacy recordings. This is a bounded recovery observation, not proof of
the timeout's root cause or encrypted-upload acceptance.

No audio capture, clock update, action grant, recording start/stop, upload,
configuration or firmware change occurred. The synthetic clip had not started;
device positioning confirmation remained pending. Explicit disconnect then
succeeded, clearing the connection and disabling catalog access. The app was
force-stopped, the original lab entrypoint restored and checked against its
backup, and all five owned services stopped. Temporary 8787/8788/8081 forwarding
was removed, phone Bluetooth remained on, and journals were retained.

## Recording-list example and binding-check review — 2026-10-02

The twelfth independent example, `api/list-recordings-node`, reads public
`GET /v1/recordings` with an optional end-user filter. It follows opaque cursors,
projects selected metadata, limits pages and distinguishes an incomplete list
from end-of-list. API keys stay server-side. It never requests audio or performs
a write; it is not a snapshot export or a multi-user authorization service.

Frozen installation, syntax checks and all 12 local tests passed both in the
example directory and a standalone temporary copy. Coverage includes opaque
cursor propagation, caps, empty lists, cycles, metadata projection, malformed
responses, authorization/HTTP failures, redirect refusal and a child-process CLI
against a local fake API. Independent review confirmed the projected nullable
fields and seven status values against the public Recording schema.

Live read-only checks used the reserved test-project key on October 3 UTC
(October 2 local). With page size one and a three-page cap, both the configured
end-user and project listing returned three distinct IDs and reported
`complete: false` / `page_limit`. A separate end-user listing with page size 100
returned 16 distinct IDs in one request and reported `complete: true` /
`end_of_list`. Seven GET requests were made; only counts and completion metadata
were retained in verification output. No recordings were created or changed.

The recording-sync backend review reproduced four stale-binding paths:
rebinding during processing-configuration lookup could precede recording or session POST;
rebinding during existing-job lookup could precede transcription POST; and
rebinding during a known recording GET could return old identity. Fresh checks
at those boundaries now reject the observed change. All four regressions failed
against the original implementation; all 22 backend tests pass with the fix.
Separate API reads and writes still leave a race window. These checks do not
establish atomic API-enforced generation fencing or new physical acceptance.

| Requirement / authority | Evidence | Conformance and limits |
| --- | --- | --- |
| Independent example, public contract — Architecture §§2–4 | Own Node manifest/lockfile/workflow; public listing and pagination contract | Source matched; no sibling runtime dependencies |
| Bounded read-only pagination | Live three-page caps and end-of-list checks | Matched for the test project; concurrent changes are not a snapshot |
| Metadata and credential boundary | Explicit field projection, fixed GET endpoint, redirect rejection | Source reviewed; no audio, names or credentials in verification output |
| Current binding before releasing identity or writing — Architecture §3 | Four reproduced regressions and 22 passing backend tests | Matched for changes observed during those reads; atomic fence remains outside the example |
| Synthetic physical recording and full upload recovery | No new device commands or upload performed | Unverified; positioning and fresh applied settings remain prerequisites |

The new [recording-list workflow](https://github.com/bota-dev/examples/actions/runs/37081961622)
passed at source `4511f40ac27c5989def8fc024725b6edc304bd3e`, including
the independent install, syntax checks and all 12 tests.
The [recording-sync workflow](https://github.com/bota-dev/examples/actions/runs/37081961685)
also passed for the same source, including all 22 backend regressions and the
Android native tests/application build. These hosted checks do not add physical
upload, receipt or device-cleanup evidence.
The same-source [root CI](https://github.com/bota-dev/examples/actions/runs/37081961621)
passed verification and the legacy Android build, and
[CodeQL](https://github.com/bota-dev/examples/actions/runs/37081961552) passed.
All four workflows completed successfully without reruns.

Public documentation was committed to docs `main` as `101f354` and promoted
selectively to `prod` as `67d157f3f35037d107f7898db19c3e1a54c7da95`.
Only the SDK catalog, recording-list reference, pagination guide and changelog
changed. The guide's JavaScript now keeps its page variable in scope, checks
HTTP failures and detects cursor cycles; the extracted snippet passed two-page,
reserved-character cursor, HTTP failure and cycle checks. Mintlify validation
with `--disable-openapi` and all four local renders passed; no schema changed.
The exact [Mintlify deployment](https://github.com/bota-dev/docs/runs/111084329870)
succeeded, and all four live pages returned HTTP 200 with the new example link.
The rendered pagination page also contained the corrected loop and cursor guard.

## Recording download and transcript search — 2026-10-02

The catalog now has fourteen independent examples. Two server-side Node CLIs use
public APIs and Node built-ins, with their own manifests, lockfiles and scoped
workflows. Neither needs a device or imports private application helpers.

`api/download-recording-node` verifies a selected recording's configured project
and optional end user, requests the original download URL and streams its stored
bytes to an exclusive temporary file. It limits size/time, isolates the API key
from storage, optionally compares a trusted SHA-256 and publishes without
overwriting a destination. It performs no conversion, enhancement, decryption,
playback or cloud mutation. Original stored bytes can be an encrypted container;
URL issuance and MIME metadata do not prove playable audio or verified upload.

`api/search-transcripts-node` sends one search POST for a configured end user and
optional recording allowlist. Before emitting excerpts, it validates all citation
fields and GETs each unique recording to verify ownership. It limits responses
and overall time, rejects redirects and makes no automatic retry. This retrieves
text through the embedding-provider path and may incur provider usage; it creates
no Ask session or generated answer. Ownership reads are not an atomic snapshot.

Frozen installs, syntax checks and the download's 21 tests and search's 12 tests
passed on Node 22.23.2 / Windows, both in place and from separate clean copies
outside the repository. Tests cover the real HTTP redirect/deadline behavior,
authorization/scope failures and sanitized output. Download tests additionally
exercise streamed limits, interrupted writes, trusted-hash mismatch and a
destination created during transfer. Independent source/test review found no
blocking issue.

Initial read-only live checks selected the earlier synthetic, device-less Python API-upload
fixture. Fresh metadata confirmed its project, dedicated end user and completed
transcription. On October 3 at 01:26:02 UTC (October 2 local), download made two
API GETs and one storage GET, retrieved 333,326 bytes and matched the independently
known fixture SHA-256. The storage request had no bearer credential. A second
invocation with the existing output refused before any request and preserved its
hash. No cloud recording or device state changed.

At 01:21:23 UTC, search made one POST with that exact recording allowlist and
limit three. HTTP 200 returned an empty array, so no ownership GET or excerpt
output occurred. This verifies only the bounded empty-result path.
Automatic indexing requires effective `processing.auto_embedding.enabled`
and an allowed provider route; completed transcription alone is not indexing
evidence. The check did not change processing configuration or enqueue indexing.

A second, isolated check at 01:49 UTC created one new synthetic end user and one
device-less recording. Only this new identity enabled automatic embedding while
automatic transcription, summary and enhancement stayed disabled. Original audio
matched the trusted 333,326-byte fixture hash; server upload completion verified
the same hash. One manual transcription completed with three timestamped segments.
After a 60-second wait, one search POST (limit three, exact recording allowlist)
returned one excerpt. Its recording/transcription IDs and timestamp field shapes
passed validation; one recording ownership GET succeeded before returning it.
No excerpt text or credential was retained in verification output. The new cloud
fixture and private durable operation journal remain available for reconciliation.
No existing identity, project/provider policy or physical device changed. This
adds nonempty retrieval evidence for one fixture, not corpus search-quality,
playback timestamp-alignment or indexing-latency guarantees.

| Requirement / authority | Evidence | Conformance and limits |
| --- | --- | --- |
| Independent setup — Architecture §§2,4,6 | Clean-copy frozen installs and all 33 offline tests; both scoped workflows passed at `ccbdd422a540d361bc7a2818ffa83c5d19ec12b7` | Matched locally and in hosted CI |
| Public contract — public recording GET/download/search schemas and services | Exact public routes, selected fields and bounded configuration | Matched in source/tests; no sibling runtime requirement |
| Scope and credential boundary — Architecture §3 | Download scope/storage-header tests plus live download; search allowlist/ownership failure tests | Matched for stated checks; multi-user caller authentication remains the integrator's responsibility |
| Complete original-file output | Live byte/hash match; existing-file and concurrent destination tests | Matched for synthetic original bytes; no decryption, crash-durability or upload-commitment claim |
| Search citation correctness | Offline valid/malformed citation and scope tests; one live excerpt with exact fixture IDs, validated timestamps and ownership GET | Matched for tested metadata; playback alignment and corpus relevance unverified |
| Documentation and honest status | Catalog/contributor/architecture and per-example evidence updated; public validation/render checks, exact deployment and four live page checks passed | Matched for the published pages; no broader API or hardware acceptance inferred |

All four workflows passed at source
`ccbdd422a540d361bc7a2818ffa83c5d19ec12b7` without reruns:
[download](https://github.com/bota-dev/examples/actions/runs/37086235029),
[search](https://github.com/bota-dev/examples/actions/runs/37086234980),
[root CI](https://github.com/bota-dev/examples/actions/runs/37086234986), and
[CodeQL](https://github.com/bota-dev/examples/actions/runs/37086235115).
The two example workflows passed their independent install, syntax checks and
21/12 tests respectively. Root CI passed verification and the legacy Android
build; CodeQL passed JavaScript/TypeScript and Actions analysis. Hosted checks
do not extend the live fixture or search-result coverage described above.

Public documentation was committed to docs `main` as `fa75381` and promoted to
`prod` as `f5b33fe`. The exact
[Mintlify deployment](https://github.com/bota-dev/docs/runs/111097801346)
succeeded. The SDK catalog, download reference, transcript-search reference and
changelog all returned HTTP 200 in live checks. Local validation and rendering
also passed for these four pages; no API schema changed.

Changed-path, configuration and endpoint searches covered available internal and
public docs and repository README/ARCHITECTURE/AGENTS/CLAUDE surfaces. The public
catalog, download/search reference pages and changelog now include the new runnable
links; search guidance includes the indexing-policy qualification. Existing target
design and historical firmware download contracts are unchanged.

### Related Android SDK source verification

The Android connect/MTU handshake cleanup follow-up was pushed directly to SDK
`main` at `14270786dc041e3c2a96dcda6ac3c61ae2fb5551`. It retires the failed
handshake's exact generation and closes its native session, preserving the
original failure and queued replacement work. Cleanup has a separate bounded
settlement wait; it does not extend the connect deadline or add automatic retries.

All 74 focused/facade tests passed locally. The Windows full-suite run passed
268 of 270 tests; both transfer failures also reproduced on the unchanged base.
The exact-source [SDK CI](https://github.com/bota-dev/app-sdk/actions/runs/37086421649)
passed all eight jobs, including the full Linux Android suite, and the
[License Gate](https://github.com/bota-dev/app-sdk/actions/runs/37086423029) passed.
Its candidate release inventory artifact `11261450084` has SHA-256
`4ec5e7290b90ca1d4eec7a1ce5dc5ec6acd69f6d17bf20e96598f3c2a12a0173`.

This is source verification only. The fix is absent from public beta.10 and the
published beta.11 release; these examples' beta.10 dependencies are unchanged.
No physical test establishes that the follow-up fixes delayed connection/MTU
behavior or the separate GATT 8/133 reconnect failures.

## Later October 7 braces dependency supplement

[Scoped source mitigation](braces-depth-mitigation.md) adds mandatory local
installer and CI regressions to both independent React Native apps and the
legacy root. Earlier scanner/native/physical observations remain dated; no
SDK, wire behavior, runtime distribution or scanner closure follows from this
source guard.

## October 7 new build-dependency fixes

Four independent locks select source-map-js 1.2.2; the legacy root also selects
shell-quote 1.11.0 and a qualified parent-scoped selector-parser 7.1.6 override.
Each install root has required public-consumer tests; Web CI now runs `npm test`.
See the [source compatibility review](build-dependency-remediation.md) for aged tarballs, tests and
bundled-parser limits. Hosted/scanner and physical acceptance remain separate.
