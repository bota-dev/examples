# Read a Bota recording catalog with Swift

A focused macOS SwiftUI app that verifies the serial you enter, reads fresh pairing state, and lists pending recording **metadata** through public Bota App SDK **2.0.0-beta.13**. It performs no audio download/upload, recording confirmation/deletion, binding, provisioning, reset or custom GATT work. No backend or API key is needed.

**Status:** implemented; public-tag contract and source reviewed. This Windows host has no Swift/macOS toolchain, so local Swift compilation, application execution and physical Bluetooth behavior are unverified. The independent hosted workflow performs resolution and app compilation only; no unit, live or hardware tests were added, following the owner's creation-only instruction.

## Prerequisites and run

- macOS 13+, Xcode with Swift 6 and Bluetooth.
- An already-provisioned physical Bota device you are authorized to inspect, with supported catalog/pairing firmware. Encrypted-v2 catalog support depends on that firmware's advertised public SDK capability. No tested device/firmware combination is claimed for this example.
- The exact serial printed on that device. There is no saved/default serial or credential.

From this example directory:

```sh
swift package resolve
bash build.sh
open BotaCatalog.app
```

SwiftPM fetches the exact public package independently. The build script creates a macOS `.app` with Bluetooth usage descriptions and an ad-hoc signature. Bundle ID `dev.bota.examples.catalog.macos` differs from the connection sample. Run the bundle so macOS can associate its Bluetooth prompt with this app. Grant permission; if denied, use **System Settings → Privacy & Security → Bluetooth**, then reopen.

Enter the expected serial, scan for ten seconds, select a candidate, then choose **Refresh catalog**. Advertised names are discovery hints: the SDK verifies identity against the supplied serial during connection. A wrong serial does not authorize a catalog read. Refresh first reads pairing state from the current connection and proceeds only on `.paired`; a missing/unpaired/error result stops. It never provisions a device automatically.

Expected UI: a metadata snapshot labeled **Legacy catalog** or **Encrypted v2 catalog**, or `No pending recordings reported in this snapshot.` Legacy entries show identifier, start date, duration, bytes and the SDK's encryption flag. Encrypted-v2 entries show identifier/generation, start milliseconds, duration, ciphertext/plaintext lengths and storage format. These are reported metadata; no recording contents are opened. Legacy does **not** mean plaintext. An empty pending snapshot is not proof that cloud processing succeeded or that no historical recordings exist.

## Public package and methods

`Package.swift` pins `2.0.0-beta.13`; `Package.resolved` pins public tag `v2.0.0-beta.13` at commit `958696b603be0ff6b30adba95e499dc1b5bc05b7`. Its SwiftPM manifest downloads the checksum-verified published binary framework. This example has no sibling source/runtime dependency or local binary override.

Methods were reviewed at that immutable public tag:

| Public method | Use |
| --- | --- |
| `BotaDeviceClient.configure()` / `destroy()` | SDK lifecycle. |
| `devices.startScan(timeoutMilliseconds:)` | Bounded discovery stream. |
| `devices.connect(serialNumber:device:)` | Exact-serial identity verification. |
| `devices.connectionUpdates()` / `disconnect()` | Cached SDK connection notifications and explicit disconnect. |
| `devices.statusUpdates()` | Connection-scoped public status subscription; observed setup/stream failure or termination clears the catalog. Status values are not displayed. |
| `controls.readPairingState(from:)` | Fresh pairing check before every catalog read. |
| `recordings.listPendingRecordings(_:)` | Unified pending metadata, `PendingRecording.legacy` / `.encryptedV2`. |

The published Apple connection snapshot's `isProvisioned` defaults to false. This example therefore uses the fresh public pairing read instead of trusting that snapshot or advertised pairing hints. Pairing confirmation does not establish backend end-user ownership, transfer authorization, upload capability or cloud commitment.

The unified catalog API performs capability discovery and its legacy/v2 selection inside the SDK, including alias checks; errors are not treated as permission to silently choose another transfer profile. The app adds no GATT implementation. Its only catalog operation is metadata listing; it never calls a sync, transfer, upload or confirmation API.

Public references: [SDK reference](https://docs.bota.dev/api-reference/client-sdks), [tagged connection/status manager](https://github.com/bota-dev/app-sdk/blob/v2.0.0-beta.13/platforms/apple/Sources/BotaAppSDK/DeviceManager.swift), [tagged recording manager](https://github.com/bota-dev/app-sdk/blob/v2.0.0-beta.13/platforms/apple/Sources/BotaAppSDK/RecordingManager.swift), [tagged pairing read](https://github.com/bota-dev/app-sdk/blob/v2.0.0-beta.13/platforms/apple/Sources/BotaAppSDK/DeviceControlManager.swift) and [catalog models](https://github.com/bota-dev/app-sdk/blob/v2.0.0-beta.13/platforms/apple/Sources/BotaAppSDK/Models/EncryptedUploadV2ContractModels.swift).

## Connection loss and errors

Public Apple beta.13 `connectionUpdates()` reports the SDK's cached connection state and does not itself forward spontaneous native disconnects. After exact-serial connection succeeds, this app starts a public `devices.statusUpdates()` subscription scoped to that connection revision, device ID and verified serial. Status values are discarded. Observed subscription setup failure, stream failure or termination clears catalog, pairing and verified identity, cancels the pending UI task and increments the connection revision. In the published source, native disconnect fails active subscriptions, and the public status stream forwards that failure. A nil connection notification also fences a pending connect, even before its result has populated the UI.

Explicit disconnect clears and cancels the status observer **before** awaiting the SDK; a disconnect failure preserves the cleared UI and reports that native cleanup is unconfirmed. Late catalog/pairing results must match both the current operation ID and connection revision before rendering. The status observer also checks cancellation, connection revision, device identity and verified serial before clearing state, so an older observer cannot clear a newer connection. Connection success starts the observer only after establishing verified UI identity, with no later connection-success UI writes. Cleared connections reject delayed positive connection notifications until another explicit connect begins.

Refresh clears the previous snapshot first and preserves no successful-looking catalog on read failure. Errors use controlled messages, avoiding raw SDK details or packet contents. There are no automatic retries or reconnection loops. Cancellation fences the UI; it is not evidence that every native operation settled immediately. A later attempt may report an SDK operation still in progress. Scan/reconnect deliberately after checking the device and Bluetooth permissions; do not interpret a failure as lost credentials.

The app depends on observed SDK stream failure/termination and connection notifications. An OS that omits its disconnect callback or leaves the subscription open can leave the snapshot displayed; this example adds no polling or private GATT workaround. These source guards do not establish physical loss detection, prompt clearing, reconnect reliability or prompt rediscovery. macOS radio behavior, stream termination and firmware compatibility remain unverified. Bluetooth connect/disconnect, status subscription and SDK metadata-list requests interact with the selected device, but no audio or durable recording lifecycle mutation is requested.

## Build evidence and cleanup

```sh
swift package resolve
bash build.sh
```

| Evidence on October 8, 2026 | Status |
| --- | --- |
| Exact published version/tag and method/model inspection | Matched by public-tag source review. |
| Local plist/lock and shell syntax | Checked on Windows; does not compile Swift. |
| Local Swift package/app compilation | Not run; macOS/Swift toolchain unavailable. |
| Hosted package/build | Build-only workflow configured; inspect its exact committed run. |
| UI ordering, pairing rejection, Bluetooth/hardware | Not run; unverified by owner's creation-only scope. |

Metadata stays in UI memory; no journal or export is created. Close the window to cancel the UI operation and status observer, then destroy the SDK client. Cleanup of the local build is limited to this example's `.build`, `.swiftpm` and `BotaCatalog.app` artifacts. No cloud resources or device recordings are created or removed. Treat screenshots or copied metadata according to the device owner's content-retention policy.
