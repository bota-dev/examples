# Independent examples implementation review

Review date: 2026-09-29 UTC. Uses the shared compound-engineering 1.2.5 workflow against [ARCHITECTURE.md](../ARCHITECTURE.md) §§2–6 and the selected public contracts. This expansion adds seven examples alongside the previously verified Node upload example; it does not modify the legacy workspace or the platform/SDK implementation.

## Evidence by example

| Example | Public dependency / runtime | Evidence | Remaining verification |
| --- | --- | --- | --- |
| Node upload/transcribe | Node 22.23.2, no dependencies | 15 tests, live hash verification and transcription; [prior CI](https://github.com/bota-dev/examples/actions/runs/36524299811) | Other formats/providers and live outage recovery |
| Python upload/transcribe | Python 3.12, standard library | Three local contract tests; live synthetic WAV upload, server hash verification, completed transcription; hosted CI passed | Other formats/providers and live outage recovery |
| Node webhook receiver | Node 22.23.2 built-in SQLite | Local and hosted HTTP/SQLite tests for authenticity, duplicates, restart, conflicts, limits | Actual Bota delivery to deployed HTTPS receiver; business worker intentionally outside scope |
| React Native connect | npm beta.7, Expo 57, RN 0.86.3 | Public install, typecheck, identity tests, Android export, local and hosted arm64 debug APK build, zero npm audit findings | iOS link and physical BLE checks unverified |
| Web connect | npm beta.7, Vite | Public install, TypeScript and WASM production build; Vite updated to 7.3.6 and npm audit clean | Browser/firmware BLE session |
| Apple connect | SwiftPM exact beta.7 tag and binary checksum | Public tag/manifest inspected; [macOS CI build passed](https://github.com/bota-dev/examples/actions/runs/36526849885) | macOS permissions and BLE session |
| Android connect | Maven Central beta.7, Gradle 8.13 | Public artifact resolves; local and hosted debug APK assembly passed, dependency lock committed | Android permissions and BLE session |
| Flutter connect | pub.dev beta.7, Flutter 3.47.5 | Public artifact verified; hosted locked resolution, analyzer, and debug APK assembly pass | Android permissions and BLE session |

The live Python run retained `rec_oYZSXYnJcj8Zt3poS4LrOkvC` / `txn_o60mEyL54AfOXb2etr24U2lG`, using the same reserved test key and dedicated end user as the Node verification. Effective auto-processing was disabled. The 333,326-byte fixture is synthetic speech. Secrets, audio, and transcript remain ignored local files. No physical devices were changed.

Local Flutter 3.44 cannot resolve the SDK's `meta ^1.19.0` requirement against Flutter's `meta 1.18.0` pin. Flutter 3.47.5 is selected for hosted verification; Windows Application Control prevented its Dart tool from launching locally. Hosted locked resolution and analyzer pass after correcting missing braces. The initial APK build found the SDK requires the cached Android embedding JAR; documented `flutter precache --android` and added it to CI. The permission plugin also requires compile SDK 37, now explicit in the Android host; minimum device API remains 26. The final Flutter locked install, analyzer, and Android APK build pass in hosted CI. No security policy was changed.

## Hosted checks

| Example | Source revision | Passing run |
| --- | --- | --- |
| Webhook receiver | `cf88479` | [36526850006](https://github.com/bota-dev/examples/actions/runs/36526850006) |
| Python | `fb792f6` | [36527086453](https://github.com/bota-dev/examples/actions/runs/36527086453) |
| React Native Android | `cf88479` | [36526849896](https://github.com/bota-dev/examples/actions/runs/36526849896) |
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
| §3: identity from device read-back | RN verifies connected serial and disconnects on mismatch; other facades receive exact expected serial | Matched in source and RN unit test; physical verification unverified |
| §3: durable completion before processing | Python requires matching recording/status/hash/timestamp, retries only 425 | Matched locally and for live success path; no device deletion claim |
| §4: explicit failure/recovery scope | API examples print IDs, bound polling, preserve local source, never auto-retry creates | Matched; app restart journal intentionally outside API-only scope |
| §4: durable authenticated webhook acceptance | Raw-byte HMAC, timestamp window, SQLite FULL commit, ID deduplication and conflict rejection | Matched in real local HTTP/DB tests; business effects are not implemented |
| §5: full recording-sync migration | Public integration analysis below | Not implemented; retain legacy sample until replacement gates pass |
| §6: isolated CI, no secrets/device actions | One path-filtered workflow per independent example; native runners where needed | Matched; all seven new example workflows passed at the source revisions above |
| §6: platform acceptance evidence | Per-example READMEs separate install/export/build/live/hardware levels | Partial; physical-device checks and RN iOS linking remain unverified |

## Recording-sync replacement

The planned `end-to-end/react-native-recording-sync/` requires more than the compatibility demo's immediate bind and plaintext sync. Its blockers are concrete in the **published** `@bota.dev/react-native-app-sdk@2.0.0-beta.7` artifact:

1. `src/client.ts` exposes `BotaProvisioningMaterial` with `apiEndpoint`, raw `deviceToken`, and `mtu`. `provision` passes this material through the bridge. That does not provide the target opaque, device-key-protected payload with exact prepare/provision/confirm/abort context. Implementing the repository's target with this contract would require SDK/platform work beyond a public consumer example.
2. The package's encrypted-v2 section requires application-native Swift/Kotlin registration through `BotaDeviceSDKEncryptedUploadV2Materials.register(...)`. Sensitive upload material and bytes must remain native. A complete example needs an independently implemented public host adapter and its recovery/ownership tests; copying Bota One's private native module violates the architecture. The SDK also expressly separates this API from release/hardware compatibility gates.
3. Replacement acceptance includes exact binding generation, durable restart recovery, verified receipt before source deletion, and no BLE fallback while direct upload ownership is unknown. No physical test was run here. An API-only live upload or a native build cannot establish these gates.

The end-to-end directory is therefore not created as an empty scaffold or advertised as runnable. Next prerequisite is a public SDK integration contract for target provisioning, followed by the public native encrypted-upload adapter and a scoped, caller-authenticated backend. Then exercise binding failure/abort, restart/retry, completion loss, ownership conflict, and physical deletion ordering before retiring `apps/`. This review records the gap without weakening the authoritative target design.

## Completion boundary

Continuation on 2026-09-29: npm still reports `beta: 2.0.0-beta.7` (`latest` remains beta.0), and the public beta.7 provisioning material still exposes raw `deviceToken`. No newly published contract closes the target-binding blocker. Added a macOS/Xcode 26.3/CocoaPods 1.16.2 iOS Simulator application build to the React Native example workflow; its result is pending. Public example catalog links and compatibility wording are being reconciled with the docs repository. Physical tests and the target recording-sync replacement remain separate gates.

Implementation, public dependency installation, automated checks, native builds for the advertised macOS/Android hosts, API live verification, documentation, and push are complete for the eight independent examples. This is **partial completion of the broader migration plan**: the full recording-sync replacement, hardware acceptance, RN iOS linking, live webhook deployment, and legacy retirement are not complete. No production or hardware conformance is inferred from CI.

## Documentation propagation

Searched changed paths and tokens (`webhook-receiver-node`, `upload-and-transcribe-python`, `react-native-device-connect`, `BotaDeviceClient`, `syncEncryptedRecordingV2`, `WEBHOOK_SECRET`) across `docs/`, `internal-docs/`, and workspace README/ARCHITECTURE/AGENTS/CLAUDE files. Inspected the internal-docs downstream checklist, public webhook contract, upload management and provisioning targets, SDK model signatures, and Bota One integration boundaries.

Affected runnable-example documentation is updated in this repository: root catalog, architecture status/layout, both agent entry points, and every example README. External hits describe unchanged SDK/API/target contracts; this change does not claim to implement those platform requirements. Private reference paths are not installation dependencies. Legacy links remain valid.
