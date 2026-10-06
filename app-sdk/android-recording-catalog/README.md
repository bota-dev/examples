# List device recording metadata with Kotlin

An independent Android example using public Maven Central
`dev.bota:bota-app-sdk:2.0.0-beta.10` (beta). Discover an already-provisioned
device, verify its exact serial through the SDK, read status, and list pending
recording metadata. Optional read-only connection settings and bounded firmware
log observations help diagnose the same device. No backend or API key is required.

This sample never downloads audio, uploads, confirms/deletes recordings, binds,
resets, or starts/stops recording. The SDK sends catalog-request protocol messages
to retrieve metadata; “read-only” means no recording/data mutation, not zero BLE
writes. Catalog data is shown in memory and is not saved or logged by the app.

## Run

Requires JDK 17, Android SDK 36/build tools, an Android 8+ (API 26+) phone, and a
device already provisioned by your existing application. Close other apps using
its Bluetooth connection. This example does not prove backend ownership or grant
access to recordings in the cloud.

From this directory, configure `ANDROID_HOME`, then run:

```sh
./gradlew :app:testDebugUnitTest :app:assembleDebug
./gradlew :app:installDebug
```

Windows uses `gradlew.bat`. Open **Bota Recording Catalog**. Tap **Enable Bluetooth
access**, enter the exact printed serial, and scan. Wait for the ten-second scan
to finish, then select the device. Advertised names do not establish identity:
the SDK verifies the serial before connection is accepted. The connection event
then starts a fresh `client.controls.readPairingState(device)` read. Metadata
actions remain disabled until it reports `Paired`. A different state or failed
read denies metadata access and attempts disconnect. Review that state in your
existing application; an `Unpaired` response is not proof of a factory-clean device.

Do not use `ConnectedDevice.isProvisioned` for this gate: public Android beta.10
hardcodes that snapshot field to `false`. The fresh read is separate and does not
update the snapshot. It reports device-local pairing state, not backend ownership
or complete provisioning/security conformance. Beta.10 maps an empty pairing
response to `Unpaired`; the example does not claim to distinguish those cases.

Android 12+ asks for Nearby Devices permission; earlier Android versions need
location permission and may require system Location enabled. If denied, grant
access in system settings and tap **Enable Bluetooth access** again.

Tap **Read status**, then **List recording metadata**. An empty successful catalog
is reported explicitly. Catalog failures show an error rather than an empty list
or partial success. Reads have a 30-second timeout. Disconnect when finished.
The distinct application ID is `dev.bota.examples.recordingcatalog`.

## Catalog profiles and connection lifetime

The example calls public `recordings.listPendingRecordings(device)` once per tap
and renders the SDK's `PendingRecording` variants:

| SDK profile | Displayed metadata | Interpretation |
| --- | --- | --- |
| `Legacy` | SDK UUID/legacy identifier, start time, duration, file length, encryption flag | Legacy does **not** imply plaintext. The legacy identifier is not proof of a complete v2 UUID/generation. |
| `EncryptedV2` | UUID, generation, start time, duration, ciphertext/plaintext lengths, storage format, ciphertext SHA-256 | The SDK identified the encrypted-v2 catalog profile. This is metadata, not transfer authorization or verified cloud durability. |

The SDK selects supported catalog paths and removes its documented legacy
aliases for encrypted entries. The example does not merge raw catalogs, interpret
GATT bytes, or fall back after a capability/integrity error. Firmware must support
the public SDK's catalog contract; the empty-catalog check below used Pin 1.0.19.

Operations are serialized. A disconnect event clears all displayed status/catalog
metadata and disables reads. A late read success or failure cannot restore data
from an older connection. Restore Bluetooth, scan, and reconnect explicitly;
there is no automatic reconnect or background service. Destroying the activity
cancels UI jobs/subscriptions and destroys the SDK. No recording cleanup is needed
because the sample creates or deletes no recordings.

## Read-only connection diagnostics

After exact-serial verification and the fresh `Paired` gate, **Read connection
settings** calls public beta.10 `client.provisioning.readConnectionSettings`.
It displays SDK-decoded physical WiFi/cellular enablement separately from heartbeat settings,
including unknown heartbeat bits, upload priority, idle timeouts and streaming
policy. A failed or timed-out read shows unavailable; the example supplies no
defaults and never writes settings. These are SDK-decoded fields, not a raw wire
capture; the SDK may supply compatibility defaults for older protocol fields.
The example does not establish the received wire version. Enabled policy does not establish LTE
registration, an active route or backend heartbeat receipt.

**Read firmware logs (15 seconds)** calls public beta.10
`client.logs.streamLogs`. It displays at most 200 lines / 8,192 UTF-8 bytes,
including the SDK backlog/live labels; reaching either cap omits later lines.
The observation window ends after 15 seconds and awaits SDK stream cancellation
and cleanup. Reads are serialized with all other actions. SDK failure or cleanup
failure shows unavailable, rather than an empty successful capture. Disconnect
invalidates late results. Firmware must expose its DEBUG log service; absence of
lines does not prove inactivity. Retained backlog and device-provided timestamps
are preserved; host UTC observation times are not firmware event times.

The selectable output remains in memory. No upload, external sharing, log
acknowledgment, clear, or persistent export is performed. Keep any manually
captured diagnostics private: firmware text may contain device/network/customer
data. This instrument observes the firmware ring; it cannot reveal a private
production app checkpoint or impose an exact receipt/power-loss fault boundary.

### Diagnostics design review (October 5, 2026)

The cached public beta.10 AAR descriptors confirm both API methods and their
typed models. The dependency and lock remain unchanged. Review against example
architecture §§3–6:

JDK 17 / Android SDK 36 local frozen-lock validation passed
`:app:testDebugUnitTest :app:assembleDebug --offline`: 15 tests (the 10 existing
tests plus five settings/log admission, stale-result, failure and capture-limit
checks). The five new tests initially failed to compile against the unchanged
main classes because the read helpers did not yet exist. No hosted or physical
diagnostics pass is inferred from this local build.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Public SDK only; metadata observation | Settings read and bounded log Flow; no raw GATT, settings writes, log ACK or backend calls | Matched in source and local package build |
| Exact serial, fresh pairing and connection lifetime | Both actions use the existing admission gate and revision fence; stale success/failure tests | Matched in local tests |
| Honest failures and bounded sensitive output | No settings defaults, distinct failed log read, independent masks and UTF-8/line caps | Matched in local tests |
| Physical diagnostics | No new phone installation or device read by this implementation task | Unverified until a separately recorded physical run |

## Verification and design review

Verification date: 2026-10-02. The contract was inspected in the public beta.10
Maven sources archive (SHA-256
`48bfc230edf2913c25a8afd4e3f6b9d583f65c4053eb38cc6c4c894e824003de`).
The original four local unit tests and Android APK assembly passed, but those
tests incorrectly treated the snapshot field as fresh provisioning evidence.
The corrected fresh-pairing gate and connect-completion ordering passed ten unit
tests and frozen-lock Android APK assembly on JDK 17 / Android SDK 36. The fresh
read waits for connect to release the SDK operation slot; a newer connection
event invalidates the waiting probe. A bounded physical pass is recorded below.
The exact-serial mismatch cleanup and ten-second scan
default were inspected in the published SDK source; the example's unit tests
exercise its display/lifecycle logic, not a Bluetooth transport.

| Requirement / architecture authority | Evidence | Status |
| --- | --- | --- |
| §§2–3: independent public integration | Own Gradle wrapper, manifest and lock; exact public Maven pin; public facade calls only; frozen build passes | Matched for installation/build |
| §3: identity and read-only scope | SDK exact-serial connect, fresh pairing-state gate, status and metadata listing only | Matched for the bounded physical success path below; physical denial cases unverified |
| §§4,6: profiles and asynchronous failures | Ten passing tests cover false snapshot with fresh Paired success, non-Paired/error denial and disconnect, connect/read ordering, loss during the probe or wait, distinct profiles and late reads | Matched for tested state/callback flow; physical denial/races and populated profiles unverified |
| §6: platform evidence | [Hosted CI](https://github.com/bota-dev/examples/actions/runs/37045526800) passed at `daabf16`; local APK exercised on Samsung SM-A166U1 / Android 16 and Pin firmware 1.0.19 | Matched for build and bounded phone coverage below |

The October 2 physical pass used source `daabf16` and local APK SHA-256
`28e6a2d628f220a70633d444ab4bdb86f6dd98f98688440a556855dee0707586`.
One scan found the target; the first connection attempt failed before the pairing
check, and the second succeeded. SDK-read serial `4KF6NOHWX0`, firmware `1.0.19`
and fresh `Paired` state were displayed. Status reported idle, no active upload
and zero pending recordings; catalog listing succeeded with an empty result.
Explicit disconnect cleared metadata and disabled reads. The app was stopped,
temporary forwarding was absent, and Bluetooth remained on. No audio, recording
control, provisioning or firmware mutation was performed. This does not prove
populated catalog decoding or consistently successful first-attempt connections.

Tests of display state do not establish actual BLE behavior. Physical acceptance
still needs permission denial/recovery, wrong-serial and non-Paired
rejection, populated legacy/encrypted catalogs, disconnect during a
read, stale-result rejection and explicit reconnect. Record
phone OS/model, device model, firmware and exact APK/source. Other hardware,
background operation and interrupted audio transfers are not covered.

The shared compound-engineering review uses the repository's
[architecture](../../ARCHITECTURE.md) §§2–6. See the
[SDK reference](https://docs.bota.dev/api-reference/client-sdks) and
[public Android package](https://repo.maven.apache.org/maven2/dev/bota/bota-app-sdk/2.0.0-beta.10/).
