# Connect to a device with Swift

A macOS SwiftUI app using the published Bota App SDK **2.0.0-beta.18** through Swift Package Manager. It scans, verifies the exact serial you supply through the SDK, reads status, and disconnects. No backend/API key or device mutation.

## Current beta.18 adoption — 2026-10-14

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

## Run

Requires macOS 13+, Xcode with Swift 6, Bluetooth, and a physical Bota device. From this directory:

```sh
bash build.sh
open BotaConnect.app
```

The script builds an app bundle with Bluetooth usage descriptions and an ad-hoc signature. Run the bundle so macOS can associate its permission prompt with the application. Grant Bluetooth permission, enter the exact printed serial, scan for ten seconds, select a candidate, then read status or disconnect. If access is denied, grant it in System Settings → Privacy & Security → Bluetooth and reopen. Advertised names do not establish identity.

The package pins the public Git tag exactly; its binary framework is downloaded by SwiftPM with the upstream checksum. No sibling checkout is required. This is a macOS example, not an iOS project; the SDK's broader platform support does not establish example coverage.

2026-10-01 UTC, beta.10: the manifest and lock pin public tag `2.0.0-beta.10`, revision `f5c6482ac4378a2f35e902ade172a5cb779dffa6`. The public tag revision and downloaded SwiftPM archive were verified locally; archive SHA-256 is `169cc4bc27270447bd159c64b715a278e9877ab656172859e1bf6ecb58d1e425`, matching the tagged package checksum. The lock was updated to that exact public revision on Windows; SwiftPM resolution and the macOS application build passed in [CI 36893071878](https://github.com/bota-dev/examples/actions/runs/36893071878) at examples source `54237e14014f914270ec3c3b7648a82f2e97b9c5`. Physical Bluetooth acceptance remains unverified. See the [current review](../../docs/independent-examples-review.md).

Historical beta.9 evidence, 2026-09-30 UTC: public SwiftPM resolution and the macOS application build passed in [CI 36766071430](https://github.com/bota-dev/examples/actions/runs/36766071430) at source `43a5bd3521fdbc9d24dcfea7e8d714f08359f681`, with tag `2.0.0-beta.9` and revision `89cb6f14eb0ea6327c196ac2cbeb8215df3423bd`. That build does not establish beta.10 compatibility or physical Bluetooth acceptance.

Historical beta.8 evidence, 2026-09-30 UTC: public SwiftPM resolution and the macOS application build passed in [CI 36660143425](https://github.com/bota-dev/examples/actions/runs/36660143425). Physical macOS Bluetooth acceptance remains unverified. See the [beta.8 review](../../docs/independent-examples-review.md#beta8-adoption).

## Verify

```sh
swift package resolve
bash build.sh
```

Native build evidence is recorded in the [implementation review](../../docs/independent-examples-review.md). The Windows development host cannot run macOS binaries. Physical Bluetooth grant/denial, scan, correct/wrong serial, status, unexpected disconnect, and reopen checks remain unverified. [Public SDK reference](https://docs.bota.dev/api-reference/client-sdks).
