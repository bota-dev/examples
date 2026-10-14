# Published beta.17 adoption: native and Flutter examples

## Scope and authority

The owner requested the latest published SDK. Public registry checks on
2026-10-14 select synchronized **2.0.0-beta.17**. Beta.18 is prepared and awaits
protected publication; its tag/source alone is not an installable release.
The [integrated sample decision](../design-decisions/2026-10-12-integrated-recordings.md),
[current architecture](../../ARCHITECTURE.md) and [operation contracts](../example-contracts.md)
continue to govern scope, public dependencies and lifecycle boundaries.

This pass updates the two Kotlin connect/catalog samples, the two macOS Swift
connect/catalog samples, the independent Flutter connection sample and the
integrated Flutter Android client. It adds no device feature, state migration,
custom transport or private package. App IDs, cloud/native journal scopes and
application/controller source remain unchanged. The root
[published SDK review](2026-10-14-published-sdk-adoption.md) owns repository-wide
adoption and later exact hosted results.

## Immutable public inputs

- Public Swift tag `v2.0.0-beta.17` peels to
  `b8a31c5a521cdac18c613c7920a277c399296744`. Both `Package.resolved` files pin
  that commit, not annotated-tag object `e7856c11e11f94dcb8f3bb22a449f378e2f680b4`.
- The [tagged Swift manifest](https://github.com/bota-dev/app-sdk/blob/v2.0.0-beta.17/Package.swift)
  downloads `BotaDeviceSDKCore.xcframework.zip`. Its actual downloaded SHA-256
  is `19a72e01b00f202a4683b747717f98231d9a9d41927a20a30949bdf53e9278e3`, matching
  the public manifest checksum.
- Public Maven AAR SHA-256:
  `28430fae86ad07b00f44a89f2c39d8b532a889e2ed473c6527b66d936987c6c8`;
  POM SHA-256:
  `c0642680da0bce057a869b6ddde2749bb482f40ab033bc662287524d86490e96`.
  Both Kotlin lockfiles are package-manager generated using targeted
  `--update-locks dev.bota:bota-app-sdk`; every other resolved dependency entry
  is unchanged. Subsequent builds omit lock-update flags.
- Both Flutter pub locks select archive SHA-256
  `75693410b2c7e41e8e9b3d08ffebdda51c6844d6adfc735803854120945e7a5a`.
  Normal resolution changes only the Bota version/hash; enforced-lock resolution
  succeeds. The published plugin's `android/sdk-version.toml` is beta.17 and its
  iOS podspec depends on `BotaAppSDK` at its own beta.17 version.

## Public facade and lifecycle review

The public beta.17 Apple source retains exact-serial `devices.connect`,
`readStatus`, `connectionUpdates`, throwing `statusUpdates`, fresh
`control.readPairingState` and legacy/encrypted-v2 metadata-list methods used by
the two apps. `connectionUpdates()` still yields cached manager state; the
catalog's separate status observation, connection revisions and exact identity
checks remain. Public signatures/source checks are not Swift compilation or
physical loss-detection evidence.

Installed Flutter beta.17 `lib/src/managers.dart` exposes connect/status and
legacy recording list/sync/confirm APIs. It does **not** expose a fresh
`readPairingState` call or the encrypted-v2 upload/session/commit host callback
contract needed by the retained RN flow. Optional pairing metadata/enum values
are not a substitute. The Flutter clients therefore continue to demonstrate
connection/status only; their cloud-content UI continues to use the customer
backend. The existence of legacy list/sync does not qualify safe encrypted-v2
capture integration. No private native bypass was added.

Existing UI/controller/native source, exact serial configuration, late-result
fences, cleanup ordering and SDK ownership remain. Tests simulate observation
and cleanup; no live device/API/provider call was performed. Historical phone
results remain dated and bound to their original package/source/firmware.

## Verification and conformance

| Requirement | Evidence | Status |
| --- | --- | --- |
| Latest public dependencies, no local SDK source | Exact Maven/pub/Swift inputs above; manifests and locks | matched |
| Narrow upgrade without dependency churn | Only Bota entries change in generated Gradle/pub locks; no application/controller edits | matched |
| Kotlin native compatibility | Separate targeted update and frozen debug builds for connect and catalog on JDK 17/SDK 36 | matched locally |
| Catalog guards remain | All 16 existing JVM cases, zero failures/errors/skips; exact pairing gate and metadata-only source retained | matched locally |
| Flutter connect lifecycle | Enforced lock, clean analysis, six existing widget cases | matched locally |
| Flutter common app isolation/recovery | Enforced lock, format unchanged for 10 files, clean analysis and 38 existing HTTP/controller/device/UI cases | matched locally |
| Flutter dependency licenses | Five gate fixtures and 44 resolved MIT/BSD/Apache notices | matched for bounded package gate |
| Flutter Android native linking | Public beta.17 debug APKs pass for both roots on Flutter 3.47.5/JDK 17/SDK 37; connect 219.3 seconds, common app 257.5 seconds | matched locally |
| SwiftPM and macOS app compilation | Public tag/checksum and consumed signatures verified on Windows; no Apple compiler available | unverified locally; hosted gate required |
| Physical behavior and live providers/storage | Not executed in this dependency-adoption pass | unverified |

Flutter 3.47.5 automatically amends the independent connection sample's analyzer
config during commands. Those unrelated generated exclusions are restored to
the original tracked file; direct Dart analysis checks the original config.
Android builds retain the existing plugin KGP migration warning and local SDK
XML tool-version warning. This pass does not qualify future Flutter toolchains
or close any separate dependency scanner finding.

## Local APK identities

These are local debug artifacts, not installed-device or release-distribution
acceptance. No phone/app data, provisioning or firmware was changed.

| Example | Debug APK SHA-256 |
| --- | --- |
| Kotlin connect | `4f74c889541fb5317b9a30d9e06ee7546b35234562fd68cad56970c0d5261948` |
| Kotlin recording catalog | `0e49027dd46364129aeca9638b9946213bc585000a671c9658d0c102e2ec3a86` |
| Flutter connect | `a4a467f3a0a9f62ad34d6a9c405d9dd8a92fa752666adda0ec500560e0155178` |
| Flutter Recordings | `e7f5150991b4287d5b5daf3eaf4b0af3413822b92cf6d84d28dbe517e273c774` |

Both Apple lock JSON files bind the peeled tag commit exactly. All 44 local
Markdown links across the six platform roots and this review resolve. The
consuming hosted workflows remain responsible for clean-runner qualification,
including macOS compilation unavailable on the Windows host.
