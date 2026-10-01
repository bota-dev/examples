# Connect to a device with Swift

A macOS SwiftUI app using the published Bota App SDK **2.0.0-beta.10** through Swift Package Manager. It scans, verifies the exact serial you supply through the SDK, reads status, and disconnects. No backend/API key or device mutation.

## Run

Requires macOS 13+, Xcode with Swift 6, Bluetooth, and a physical Bota device. From this directory:

```sh
bash build.sh
open BotaConnect.app
```

The script builds an app bundle with Bluetooth usage descriptions and an ad-hoc signature. Run the bundle so macOS can associate its permission prompt with the application. Grant Bluetooth permission, enter the exact printed serial, scan for ten seconds, select a candidate, then read status or disconnect. If access is denied, grant it in System Settings → Privacy & Security → Bluetooth and reopen. Advertised names do not establish identity.

The package pins the public Git tag exactly; its binary framework is downloaded by SwiftPM with the upstream checksum. No sibling checkout is required. This is a macOS example, not an iOS project; the SDK's broader platform support does not establish example coverage.

2026-10-01 UTC, beta.10: the manifest and lock pin public tag `2.0.0-beta.10`, revision `f5c6482ac4378a2f35e902ade172a5cb779dffa6`. The public tag revision and downloaded SwiftPM archive were verified locally; archive SHA-256 is `169cc4bc27270447bd159c64b715a278e9877ab656172859e1bf6ecb58d1e425`, matching the tagged package checksum. The lock was updated to that exact public revision on Windows; SwiftPM resolution and the macOS application build remain pending hosted CI. Physical Bluetooth acceptance remains unverified. See the [current review](../../docs/independent-examples-review.md).

Historical beta.9 evidence, 2026-09-30 UTC: public SwiftPM resolution and the macOS application build passed in [CI 36766071430](https://github.com/bota-dev/examples/actions/runs/36766071430) at source `43a5bd3521fdbc9d24dcfea7e8d714f08359f681`, with tag `2.0.0-beta.9` and revision `89cb6f14eb0ea6327c196ac2cbeb8215df3423bd`. That build does not establish beta.10 compatibility or physical Bluetooth acceptance.

Historical beta.8 evidence, 2026-09-30 UTC: public SwiftPM resolution and the macOS application build passed in [CI 36660143425](https://github.com/bota-dev/examples/actions/runs/36660143425). Physical macOS Bluetooth acceptance remains unverified. See the [beta.8 review](../../docs/independent-examples-review.md#beta8-adoption).

## Verify

```sh
swift package resolve
bash build.sh
```

Native build evidence is recorded in the [implementation review](../../docs/independent-examples-review.md). The Windows development host cannot run macOS binaries. Physical Bluetooth grant/denial, scan, correct/wrong serial, status, unexpected disconnect, and reopen checks remain unverified. [Public SDK reference](https://docs.bota.dev/api-reference/client-sdks).
