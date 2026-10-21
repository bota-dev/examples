# Read a Bota recording catalog with Swift

A small iOS and macOS SwiftUI application that verifies your exact device serial,
reads fresh pairing state and lists pending recording **metadata** through public
Bota App SDK **2.0.0-beta.19**. Both hosts use the same feature source and require
no backend or API key.

It performs no audio transfer/upload, recording confirmation/deletion, capture,
binding, provisioning, reset or custom GATT work. A metadata snapshot does not
qualify a device recording workflow. New SDK acceptance remains encrypted-upload-v2
only, with exact capture/ciphertext integrity, authoritative cloud verification,
signed completion receipt and receipt-gated cleanup; this sample proves none of
those properties. Legacy metadata remains available without implying plaintext
or legacy transfer acceptance.

## Prerequisites

- macOS with Xcode and Swift 6 to build either host; macOS 13+ to run the Mac app,
  or an iOS 15+ iPhone/iPad for the iOS app.
- Bluetooth and an already-provisioned physical Bota device you are authorized to
  inspect, with supported catalog/pairing firmware. Encrypted-v2 metadata depends
  on the device's advertised public SDK capability.
- The exact printed serial. No test wearable, saved serial, account or credential
  is embedded. No particular device/firmware combination is qualified here.

## Run on iPhone or iPad

From this directory on macOS:

```sh
open ios/BotaCatalog.xcodeproj
```

Choose the **BotaCatalog** scheme, a physical iPhone/iPad and your signing team
under Signing & Capabilities, then run Debug. The checked-in project has an exact
public SwiftPM dependency and resolved lock; no project generator, CocoaPods or
sibling repository is required. Its bundle ID is
`dev.bota.examples.catalog.ios`; choose your own identifier if your signing team
requires it. The iOS simulator is a build/UI target, not Bluetooth proof.

Grant Bluetooth access. If denied, enable it in Settings → Privacy & Security →
Bluetooth, return to the app and choose **Enable Bluetooth** if needed. Enter the
exact serial, **Scan for 10 seconds**, select a candidate, then **Refresh catalog**.
Advertised names are hints; the SDK verifies the connected serial. The app also
checks the returned serial and peripheral ID before admitting catalog reads.

Every refresh clears the old snapshot, then reads pairing state from the exact
current connection. Only `.paired` proceeds to the catalog; unpaired, unknown or
failed reads leave the snapshot unavailable. There is no automatic provisioning.

## Run on macOS

```sh
swift package resolve
bash build.sh
open BotaCatalog.app
```

The script retains the existing macOS bundle, Bluetooth descriptions and ad-hoc
signature. Run that bundle so the permission prompt belongs to this application.
Its bundle ID is `dev.bota.examples.catalog.macos`. If denied, grant access in
System Settings → Privacy & Security → Bluetooth, then reopen. The Mac host uses
one window; the iOS manifest also disables multiple simultaneous scenes.

## Read the result

The UI labels each entry **Legacy catalog** or **Encrypted v2 catalog**:

- Legacy entries show identifier, start time, duration, byte length and the SDK's
  encryption flag. Legacy does **not** mean plaintext.
- Encrypted-v2 entries show exact identifier/generation, start milliseconds,
  duration, ciphertext/plaintext lengths and storage format. These fields report
  metadata; this sample does not fetch or verify the ciphertext.

An empty result means `No pending recordings reported in this snapshot.` It does
not prove historical deletion, cloud commitment, processing success or absence of
older recordings. Pairing does not prove backend end-user ownership or grant
transfer/cleanup authority.

## Copy the feature

- [CatalogModel.swift](Sources/BotaCatalog/CatalogModel.swift) contains direct
  public SDK calls and their identity, fresh-pairing and lifecycle gates.
  `CatalogActions` is a local synthetic-test seam, not a wrapper SDK or custom
  transport.
- [App.swift](Sources/BotaCatalog/App.swift) provides the SwiftUI device picker,
  snapshot display and foreground scene handling shared by both hosts.
- [Package.swift](Package.swift), [resolved package](Package.resolved),
  [macOS Info.plist](Info.plist) and [build.sh](build.sh) retain the Mac install.
- The [iOS project](ios/BotaCatalog.xcodeproj/project.pbxproj),
  [shared scheme](ios/BotaCatalog.xcodeproj/xcshareddata/xcschemes/BotaCatalog.xcscheme),
  [iOS Info.plist](ios/Info.plist) and [build-ios.sh](build-ios.sh) supply the
  second host inside this same install root.

Copy the two Swift files plus the exact public SDK product and your platform's
Bluetooth purpose string. Replace the UI and customer-owned device-selection
inputs. Keep fresh identity/pairing checks and all asynchronous ownership gates.
No other example's runtime code or private application helper is required.

| Public method | Teaching purpose |
| --- | --- |
| `BotaDeviceClient.configure()` / `destroy()` | Initialize and drain an SDK session. |
| `devices.startScan(timeoutMilliseconds:)` | Bounded discovery. |
| `devices.connect(serialNumber:device:)` | Exact serial read-back. |
| `devices.connectionUpdates()` | Observe cached SDK connection changes. |
| `devices.statusUpdates()` | Observe connection-scoped stream failure/termination; status values are discarded. |
| `controls.readPairingState(from:)` | Fresh `.paired` gate before every catalog read. |
| `recordings.listPendingRecordings(_:)` | SDK-owned capability discovery and unified `.legacy` / `.encryptedV2` metadata. |
| `devices.cancelCurrentOperation()` / `disconnect()` | Retire active discovery/connection and disconnect before destruction. |

The public connection snapshot's `isProvisioned` defaults to false and is never
used as a fresh pairing gate. Unified metadata selection stays inside the SDK;
an error does not authorize a fallback transfer profile or custom GATT request.
See the [public SDK reference](https://docs.bota.dev/api-reference/client-sdks),
[tagged device manager](https://github.com/bota-dev/app-sdk/blob/v2.0.0-beta.19/platforms/apple/Sources/BotaAppSDK/DeviceManager.swift),
[recording manager](https://github.com/bota-dev/app-sdk/blob/v2.0.0-beta.19/platforms/apple/Sources/BotaAppSDK/RecordingManager.swift)
and [pairing method](https://github.com/bota-dev/app-sdk/blob/v2.0.0-beta.19/platforms/apple/Sources/BotaAppSDK/DeviceControlManager.swift).

## Lifecycle and failure behavior

The App owns one session model across window closure/reopening. The sample is
foreground-only, with no background Bluetooth mode or automatic reconnect.
Inactive/background scenes, explicit Disconnect and observed loss
retire the current session: visible identity/catalog clear immediately; app
actions and both observers are cancelled and joined; SDK cancellation,
disconnect and destruction are awaited before another session may configure.
Choose **Enable Bluetooth**, scan and verify again after retirement completes.
Returning to the foreground may configure a new SDK session, but never connects
to a device or refreshes its catalog automatically.

Late pairing/catalog/scan results cannot publish into a retired session. Cached
positive connection notifications alone never establish verified identity.
Connection-stream termination also removes candidates and refuses retained
selection callbacks. Status setup failure, failure or termination retires the
connection; a stale status observer cannot clear a later session.

Public Apple beta.19 connection updates alone do not forward spontaneous native
disconnects. The connection-scoped public status stream forwards observed native
subscription failure. If the OS omits its callback or leaves that stream open,
the snapshot can remain displayed; this sample adds no polling/private workaround.
Physical loss detection, prompt clearing and rediscovery remain unverified.

Cancellation fences presentation; a native read may still need to settle before
teardown can finish. A failed drain keeps replacement admission closed. Visible
SDK cancellation/disconnect errors require closing the process before another
owner can enter. Public `destroy()` is nonthrowing and suppresses some internal
teardown failures: awaiting it is not independent proof of physical disconnect.
Errors use controlled messages; no raw SDK details, audio or grants are logged.

Metadata stays only in UI memory. The app creates no catalog journal/export and
does not reset or delete SDK-owned state. Bluetooth
connect/disconnect, subscription and metadata requests interact with the selected
device, but no recording lifecycle mutation or cloud request is performed.

## Verify and evidence

```sh
swift package resolve
swift test
bash build.sh
bash build-ios.sh
```

The [owning workflow](../../.github/workflows/apple-recording-catalog.yml) retains
the macOS build and adds synthetic Swift tests plus unsigned Debug builds for
both a generic iOS simulator and device. The tests inject public model values;
they use no radio, credentials or hardware.

| Evidence on October 20, 2026 | Result |
| --- | --- |
| Exact public beta.19 tag | Anonymous read peels to `7a4ff0093629c030416f80113c585e10d0177e68`; both host locks and manifest pins match. |
| Published Apple binary | Retained public archive SHA-256 rechecked as `ad00d21ee48249716b5592689df83e6d7f1846ad2cca313ad3976433543393a7`, matching the tagged manifest. |
| Consumed public managers/models | Connection, status, pairing and catalog signatures remain unchanged from beta.18. |
| Local project/XML/lock/shell checks | Checked on Windows; source/configuration evidence only. |
| Ten synthetic regressions | Added for exact identity, fresh pairing, denial/errors, late catalog/pairing, nil/terminated observations, configure/action/destruction ordering and failed-cleanup refusal; execution requires Swift/macOS. |
| Current native builds and physical behavior | Unverified here: this workstation has no Swift/Xcode toolchain. Hosted compilation and phone/macOS Bluetooth require separate exact-source evidence. |

Historical [beta.17 macOS compilation](https://github.com/bota-dev/examples/actions/runs/38654533610/job/116161047359)
passed at `a7b34175`, and
[beta.13 macOS compilation](https://github.com/bota-dev/examples/actions/runs/37876771920)
passed at `9117760`. Those builds do not qualify this source, beta.19 or iOS.
The [beta.18 review](../../docs/design-reviews/2026-10-14-native-sdk-beta18-adoption.md)
retains its earlier evidence.
