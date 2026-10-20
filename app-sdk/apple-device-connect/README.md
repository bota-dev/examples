# Connect to a device with Swift

A small iOS and macOS SwiftUI app using the published Bota App SDK
**2.0.0-beta.19** through Swift Package Manager. Enter your device's exact serial,
scan, select a candidate, read battery/storage status and disconnect. Both hosts
use the same feature source. No backend or API key is required.

This teaches connection and status only. It does not record, transfer, provision,
delete or upload audio. Encrypted-upload-v2 acceptance is a separate workflow;
neither a successful connection nor legacy transfer evidence qualifies it.

## Run on iPhone or iPad

Requires macOS, Xcode with Swift 6 and the iOS SDK, an iOS 15+ device, Bluetooth,
and a physical Bota wearable. Open the checked-in project:

```sh
open ios/BotaConnect.xcodeproj
```

Select the **BotaConnect** scheme, your physical iPhone/iPad and your own signing
team under Signing & Capabilities, then run the Debug configuration. The project
has an exact public SwiftPM dependency and a committed resolved lock; no project
generator, CocoaPods, backend or sibling checkout is required. Choose your own
bundle identifier if your signing team requires it.

Grant the Bluetooth prompt, enter the exact printed serial, tap **Scan for 10
seconds**, then tap a discovered device. A successful SDK connection displays the
verified serial, firmware and MTU. **Read status** shows battery/storage/pending
recordings. Advertised names are discovery hints, not identity proof. A wrong
serial or failed connection shows an error rather than an accepted connection.
If permission is denied, enable it in Settings → Privacy & Security → Bluetooth,
return to the app and scan again.

The iOS simulator is a compilation/UI target; it does not qualify physical
Bluetooth discovery or connection. CI compiles Debug for both a generic iOS
simulator and device with code signing disabled. Installing on a phone requires
your normal signing setup.

## Copy the feature

- [ConnectModel.swift](Sources/BotaConnect/ConnectModel.swift) contains the direct
  published configure, scan, exact-serial connect, status, connection updates,
  cancellation, disconnect and destroy calls. `DeviceActions` is a local test
  seam, not another SDK or a custom Bluetooth implementation.
- [App.swift](Sources/BotaConnect/App.swift) supplies the native SwiftUI device
  picker/status screen and scene lifecycle for both hosts.
- [iOS project](ios/BotaConnect.xcodeproj/project.pbxproj),
  [shared scheme](ios/BotaConnect.xcodeproj/xcshareddata/xcschemes/BotaConnect.xcscheme)
  and [iOS Info.plist](ios/Info.plist) supply the runnable app and Bluetooth
  purpose string. [Package.swift](Package.swift), [macOS Info.plist](Info.plist)
  and [build.sh](build.sh) retain the macOS host.

Copy the two Swift files, add the exact public SDK product and the platform's
Bluetooth permission description to your application, then replace the UI and
customer-owned device selection. Keep the SDK identity read-back and lifecycle
gates. No test serial, account or credential is embedded.

## Lifecycle and failure handling

The sample is foreground-only. An inactive/background scene clears visible
connection/status, cancels and joins app actions and connection observation,
requests SDK cancellation, disconnects and awaits SDK destruction. A rapid return
to the foreground waits for that work before reconfiguring. It does not request
background Bluetooth entitlement or automatic reconnection. Observed connection
loss clears status; a late status result cannot restore the retired connection.

An explicit cancellation/disconnect error blocks another connection until the
process is closed. A failed drain may wait for the SDK; the app does not race a
replacement owner against it. Public beta.19 `destroy()` is nonthrowing and its
Apple implementation suppresses some native teardown errors, so awaiting it is
not independent proof of physical disconnection. Unexpected loss is cleared
when the public connection stream reports it; an omitted native callback remains
an upstream physical acceptance gap.

## Current beta.19 adoption and iOS host — 2026-10-20

Both the Swift package and Xcode project pin `2.0.0-beta.19`; their resolved locks
select public tag commit `7a4ff0093629c030416f80113c585e10d0177e68`. Anonymous
public-tag lookup and archive download pass on this Windows host. Archive
SHA-256 `ad00d21ee48249716b5592689df83e6d7f1846ad2cca313ad3976433543393a7`
matches the tagged SDK manifest. The connection/status public signatures used
here are unchanged from beta.18.

Local checks cover project parsing, XML, exact pin/lock agreement and shell
syntax. This Windows host has no Swift/Xcode toolchain, so it cannot execute the
new synthetic Swift tests or compile either Apple host. The
[owning CI workflow](../../.github/workflows/apple-device-connect.yml) runs
`swift test`, the macOS build and unsigned iOS simulator/device builds. Hosted
results and physical iOS/macOS Bluetooth behavior must be recorded separately;
the historical beta.18 builds below do not qualify this source or beta.19.

## Historical beta.18 adoption — 2026-10-14

The exact public SwiftPM tag peels to
`0962c8ccb8a4d407179309abae574bffb6e32933`; both the manifest and resolved lock
select beta.18. The anonymous public binary archive matches its tagged SHA-256
`aded7f6fe9fdb5a2f681c81ce4ade2b9cc67aa14abd90487b97c86fd2f7f6b7a`.
The consumed manager sources are identical to beta.17. Fresh macOS compilation
requires the hosted workflow; physical behavior remains unverified. See the
[beta.18 adoption review](../../docs/design-reviews/2026-10-14-native-sdk-beta18-adoption.md). Previous successful builds qualify their original packages.

## Historical beta.17 adoption — 2026-10-14

The manifest pins `2.0.0-beta.17`; `Package.resolved` selects the peeled public
tag commit `b8a31c5a521cdac18c613c7920a277c399296744`, not its annotated-tag
object. The published SwiftPM binary archive matches the tagged checksum
`19a72e01b00f202a4683b747717f98231d9a9d41927a20a30949bdf53e9278e3`.
The consumed public connection/status signatures remain available. This Windows
host cannot run SwiftPM/macOS compilation; the existing hosted build is required
for this source, and physical beta.17 acceptance remains unverified. Historical
builds qualify their original versions. See the [SDK adoption review](../../docs/design-reviews/2026-10-14-native-sdk-adoption.md).

## Historical beta.13 adoption

The manifest pins version `2.0.0-beta.13`; `Package.resolved` selects public tag
`v2.0.0-beta.13` at commit `958696b603be0ff6b30adba95e499dc1b5bc05b7`.
The public tag was verified, but this Windows host cannot execute SwiftPM or the
macOS application build. Hosted resolution/build and physical Bluetooth behavior
must be verified separately. Historical beta.10/9/8 results below do not qualify
beta.13. See the [adoption review](../../docs/independent-examples-review.md#beta13-adoption).

## Run on macOS

Requires macOS 13+, Xcode with Swift 6, Bluetooth, and a physical Bota device. From this directory:

```sh
bash build.sh
open BotaConnect.app
```

The script builds an app bundle with Bluetooth usage descriptions and an ad-hoc signature. Run the bundle so macOS can associate its permission prompt with the application. Grant Bluetooth permission, enter the exact printed serial, scan for ten seconds, select a candidate, then read status or disconnect. If access is denied, grant it in System Settings → Privacy & Security → Bluetooth and reopen. Advertised names do not establish identity.

The package pins the public Git tag exactly; its binary framework is downloaded
by SwiftPM with the upstream checksum. No sibling checkout is required. The
macOS app bundle remains separate from the iOS Xcode host above.

2026-10-01 UTC, beta.10: the manifest and lock pin public tag `2.0.0-beta.10`, revision `f5c6482ac4378a2f35e902ade172a5cb779dffa6`. The public tag revision and downloaded SwiftPM archive were verified locally; archive SHA-256 is `169cc4bc27270447bd159c64b715a278e9877ab656172859e1bf6ecb58d1e425`, matching the tagged package checksum. The lock was updated to that exact public revision on Windows; SwiftPM resolution and the macOS application build passed in [CI 36893071878](https://github.com/bota-dev/examples/actions/runs/36893071878) at examples source `54237e14014f914270ec3c3b7648a82f2e97b9c5`. Physical Bluetooth acceptance remains unverified. See the [current review](../../docs/independent-examples-review.md).

Historical beta.9 evidence, 2026-09-30 UTC: public SwiftPM resolution and the macOS application build passed in [CI 36766071430](https://github.com/bota-dev/examples/actions/runs/36766071430) at source `43a5bd3521fdbc9d24dcfea7e8d714f08359f681`, with tag `2.0.0-beta.9` and revision `89cb6f14eb0ea6327c196ac2cbeb8215df3423bd`. That build does not establish beta.10 compatibility or physical Bluetooth acceptance.

Historical beta.8 evidence, 2026-09-30 UTC: public SwiftPM resolution and the macOS application build passed in [CI 36660143425](https://github.com/bota-dev/examples/actions/runs/36660143425). Physical macOS Bluetooth acceptance remains unverified. See the [beta.8 review](../../docs/independent-examples-review.md#beta8-adoption).

## Verify

```sh
swift package resolve
swift test
bash build.sh
bash build-ios.sh
```

The six synthetic tests cover empty/exact serial admission, configure/permission
failure, late status after observed loss or observation termination,
teardown-before-foreground admission and failed-disconnect replacement refusal.
They use no radio, credentials or live
device. Native build evidence is recorded in the
[implementation review](../../docs/independent-examples-review.md). The Windows
development host cannot run Apple binaries. Physical Bluetooth grant/denial,
scan, correct/wrong serial, status, unexpected disconnect and reopen checks
remain unverified. [Public SDK reference](https://docs.bota.dev/api-reference/client-sdks).
