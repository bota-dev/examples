# iOS hosts and ordinary mobile recording flows — October 20, 2026

## Approved scope and design

The owner approved the missing iOS hosts and ordinary mobile import/playback
items from the current plan. Basis: [DESIGN](../../DESIGN.md),
[roadmap §§3–4](../../ROADMAP.md#3-fill-useful-native-platform-hosts-and-sdk-modules),
[architecture](../../ARCHITECTURE.md) and
[integration contracts](../example-contracts.md). Continue the existing Recordings
foundation and SDK starters; no vertical app, new catalog identity or duplicate
backend is introduced.

The four touched SDK roots use exact public beta.19: Swift connection, Flutter
connection, Flutter Recordings and RN Recordings. The six other roots retain
beta.18. Public npm/Pod/SwiftPM/Maven/pub contracts remain the authority; this
does not migrate the RN native-workflow compatibility path to generated JS.
No SDK/firmware release, hardware action, retained-upload retry or app delivery
occurs. New device acceptance remains encrypted-v2 only, with exact capture and
ciphertext integrity, authoritative verification, signed receipt and gated cleanup.
Ordinary file import proves none of those device properties.

## Implementation and conformance

| Requirement | Implementation/evidence | Status |
| --- | --- | --- |
| Runnable Swift iOS connection/status | Checked-in [Xcode project](../../app-sdk/apple-device-connect/ios/BotaConnect.xcodeproj/project.pbxproj), shared scheme/lock, Bluetooth usage description and [shared feature](../../app-sdk/apple-device-connect/Sources/BotaConnect/ConnectModel.swift); existing macOS host retained | implemented; native build/physical evidence recorded separately |
| Flutter iOS hosts | Normal pinned-Flutter Runner projects in both existing Flutter roots; permission declarations, iOS target, explicit serial and foreground lifecycle | implemented; native build/physical evidence recorded separately |
| RN common iOS cloud host | Expo iOS config/prebuild/export and native build gate. Device screen remains Android-only; iOS does not pretend to implement the Kotlin encrypted-upload adapter | matched in source/config tests; native build separate |
| One ordinary import/playback implementation | Canonical [upload](../../end-to-end/recordings/backend/features/upload.mjs), [playback](../../end-to-end/recordings/backend/features/playback.mjs) and [HTTP transport](../../end-to-end/recordings/backend/http.mjs); Web compatibility files retain old import paths | matched by affected backend/Web suites |
| Preserve adapter policy | Web wrappers explicitly retain omitted-project response compatibility; supplied foreign projects/owners deny. Mobile uses strict canonical project validation | matched; two regressions failed before wrapper correction, then passed |
| Mobile import | Explicit native picker, canonical MIME/25 MiB limits, raw Bearer-authenticated `/api/library/uploads`; no Bota key or signed storage URL enters a client | matched in source, adapter/controller and loopback HTTP tests |
| Upload uncertainty and identity | Durable intent before writes; same file/name/type/size/hash reuses its own intent; 425 and unknown outcomes use known-resource GET only. A valid returned create ID survives later ownership failure without authorizing another write | matched; returned-ID regression failed before correction, then passed |
| Cross-adapter intent | Fresh Web/mobile imports refuse matching retained peer uploads, including old Web scopes/removed accounts and complete intents, without peer-ID adoption | matched by four real combined-HTTP/SQLite regressions |
| Scoped media and private storage | Fixed public WAV export, exact independently configured storage host, no storage credentials, bounded bytes/deadline and fresh owner/source checks. Mobile decoder sees private temporary files; explicit play, no autoplay | matched as source/HTTP/port contracts; actual native decoding unverified |
| Media lifecycle | Source/account fencing, abort reads, immediate pause, joined native/picker/player finalizers and temporary-file removal; failed cleanup prevents replacement | matched by focused lifecycle tests; real OS behavior unverified |
| Retain existing state | Three original journals, schemas, scope digests, launch bases, native identities and original recovery origin unchanged | matched by retained-state/startup suites; no external-writer/atomic-snapshot guarantee |
| Open-source usability | Existing README/source/catalog entries updated, exact dependencies/locks and mandatory signing/Metro/source-map/license guards retained; platform-specific copy/run instructions | matched locally; hosted checks pending below |

Shared upload/playback extraction initially changed an implicit Web policy:
the old Web recording shim allowed an absent `project_id`, while canonical mobile
validation requires it. Review caught this; explicit compatibility wrappers and
fail-first regressions now preserve both policies. No project/owner mismatch is
permitted. Review also required joining delayed picker/player cleanup during
sign-out before another media session can enter.

Native source review found two Flutter admission/navigation gaps: the standalone
home route must show a closed-session screen after joined destruction instead of
popping its only route, and terminated connection observation must disable even
a retained candidate callback. Both now have focused regressions. RN readiness
uses the public decoder loaded/error status with a bounded local deadline;
asynchronous decode failure retires the player and its file. Invalid picker
metadata also removes its already-proven private cache copy before returning an
error. Neither change substitutes synthetic events for real native acceptance.

The existing Swift SDK's nonthrowing destruction cannot prove physical disconnect;
the starter documents that limitation and blocks replacement on visible cleanup
errors. Public Flutter beta.19 returns a singleton default client and permanently
retires it on destruction; the integrated sample therefore allows one Device
session per process, then requires restart while keeping cloud features usable.
It does not manufacture a new client through private/testing APIs. The Flutter
facade still does not supply this sample's RN encrypted-v2
host/receipt workflow. Neither an iOS host nor beta.19 installation closes it.

## Verification and remaining acceptance

Local Windows checks and hosted results are recorded separately. Initial shared
core qualification passes 109 tests with two POSIX permission skips. Web/backend
and mobile adapter regressions pass, including cancelled storage reads and
GET-only 425 recovery. RN strict types, normal frozen install, license and
mandatory security suites pass. An intermediate RN source passed optimized iOS
Metro/Hermes export; final-source export and native builds are hosted gates.
Both Flutter Android debug applications built locally before the final Dart
lifecycle regressions; hosted Android jobs qualify the final source. Swift/Xcode
and native iOS builds cannot run on this workstation. macOS CI adds
unsigned simulator/device builds for Swift/Flutter and a simulator build for RN.
No build-signing, store publication or physical-phone claim follows from them.

Final RN local checks pass 131 cases (74 application, 32 signing, 21 Metro and
four source-map), strict types and dependency/license guards. Flutter Recordings
passes analysis and 61 synthetic tests, including a phone-sized live-mode UI
import/load/play/sign-out exercise with fake backend/media ports. Web's full
server/UI suites, typecheck, lint, formatting and production build pass. The
catalog validates 77 retained examples and its nine regressions pass. The mobile
backend passes 86 tests with one POSIX permission skip on Windows; the shared
core passes 109 with two such skips. These are source/contract checks.
The standalone Flutter host passes analysis and 13 lifecycle/permission tests.
Its active-scan Close test invokes teardown in the real test zone and awaits its
captured cleanup; a fake-zone cross-await initially stalled the test, not the
ordinary Dart stream cancellation path. No production timing workaround was added.

Swift source `fafbfe4c06aeb3f8fc73ebdb0e18dc142c3d82b3` passes SwiftPM resolution,
tests, the existing macOS application build and unsigned iOS simulator/device
builds in [the native CI job](https://github.com/bota-dev/examples/actions/runs/39512379550/job/118936300796).
This qualifies compilation/linking, not Bluetooth permission or physical identity.

The earlier [October 15 live HTTP run](2026-10-14-web-playback.md#october-15-live-http-acceptance)
remains evidence only for its recorded source and WAV fixture. No new live API
write was needed for this implementation pass. New mobile native decoding,
document-picker behavior and physical iOS Bluetooth permission/identity/loss
acceptance remain unverified until observed on the corresponding source, SDK and
host. Existing browser decoder limitations are unchanged. No customer content,
credentials, signed URLs or device identifiers were added to fixtures or docs.

Documentation impact search covered changed paths/symbols and platform-capability
tokens across examples, public docs, internal docs and workspace
README/AGENTS/CLAUDE/ARCHITECTURE files. Public SDK example cards need the new
host descriptions; API schemas and internal device designs are unchanged.
An independent source review checked backend ownership, durable intent, abort,
peer refusal and schema preservation. A second pass checked Flutter Runner
templates, iOS targets/permissions, exact public beta.19 Apple pins, normal
Pods/SwiftPM integration and native build workflows. It did not perform live or
hardware tests.
