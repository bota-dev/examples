# Use Bota examples with an AI coding tool

Give your coding tool this repository URL, the feature and target platform.
The same source works with Claude Code, Codex, Cursor and other tools. No Bota
skill/plugin or repository-wide install is required. Relevant installed skills
may guide the work; the selected public contract defines supported behavior.

## Start with the integrated sample

**Bota Recordings** is the sample foundation: copyable recording features, one
shared customer backend and platform clients for Web, RN, Flutter, native
Android/Kotlin and Apple/Swift. The [shared feature core](../end-to-end/recordings/README.md)
now implements recording, ordinary upload/playback, processing/general-notes and Ask logic plus error
types. The combined Node launcher now composes existing Web/mobile factories on
one listener. Both credential-specific adapters, DTOs and all three journals
remain, with compatibility exports at the existing Web upload/playback paths and local webhook/native source. Complete
[Flutter](../end-to-end/recordings/clients/flutter/README.md) and
[RN](../end-to-end/recordings/clients/react-native/README.md) install roots have relocated.
Web/backend paths stay. Small [Kotlin](../end-to-end/recordings/clients/android-kotlin/README.md)
and [Swift](../end-to-end/recordings/clients/apple-swift/README.md) cloud readers
use the same Bearer adapter and [read contract](../end-to-end/recordings/contracts/native-library-read.md).
They read the first recording page and existing transcript/general notes; no
upload, playback, processing writes, Ask or device SDK is added to those clients.

Use the [README entry paths](../README.md#start-with-bota-recordings), then choose
the feature/platform below. Run only the relevant documented install root(s)
and copy the feature's complete imports. Use a full repository checkout or include
the Web installation, mobile backend source and `end-to-end/recordings/backend/`
when copying the combined runtime. An old web/mobile folder alone is no longer
a complete runtime copy.
Do not silently redirect a client to another listener or store.
The [approved decision](design-decisions/2026-10-12-integrated-recordings.md)
defines the foundation. Exactly two product layers remain: general capabilities
now, then vertical use cases and app types later.

Customers can start with a feature without reading the whole design. Before
editing this repository, read [AGENTS.md](../AGENTS.md) and local instructions;
follow their design, verification and delivery rules. If adapting into a customer
app, follow that application's instructions and replace its identity/auth adapter.

## Find the maintained public-call feature

| Feature | Current public-call source | Run/setup |
| --- | --- | --- |
| List/read recordings | [Shared recordings](../end-to-end/recordings/backend/features/recordings.mjs); [React library](../end-to-end/web-reference/web/features/recordings/Recordings.tsx) | [Web README](../end-to-end/web-reference/README.md) |
| Import/verify audio | [upload.mjs](../end-to-end/web-reference/server/features/upload.mjs); [React upload](../end-to-end/web-reference/web/features/uploads/Upload.tsx) | Web; storage PUT keeps API credentials separate |
| Play an ordinary import | [shared playback](../end-to-end/recordings/backend/features/playback.mjs); [Web player](../end-to-end/web-reference/web/features/playback/AudioPlayer.tsx); [RN media](../end-to-end/recordings/clients/react-native/media-controller.ts); [Flutter media](../end-to-end/recordings/clients/flutter/lib/recording_media.dart) | Web/mobile; authenticated bounded WAV export, no device decryption |
| Transcript/general notes | [Shared processing](../end-to-end/recordings/backend/features/processing.mjs); [Transcript](../end-to-end/web-reference/web/features/transcription/Transcript.tsx) / [Summary](../end-to-end/web-reference/web/features/summaries/Summaries.tsx) | Web or [mobile README](../end-to-end/react-native-recording-sync/README.md) |
| Recording-scoped Ask | [Shared Ask](../end-to-end/recordings/backend/features/ask.mjs); [React Ask](../end-to-end/web-reference/web/features/ask/Ask.tsx) | Exact owner/session/source checks and durable intent |
| Webhook/saved-operation refresh | [webhooks.mjs](../end-to-end/web-reference/server/features/webhooks.mjs); [Activity](../end-to-end/web-reference/web/features/webhooks/Activity.tsx) | Signed customer callback; refresh never resends a write |
| Android RN encrypted sync | [DeviceSync.tsx](../end-to-end/recordings/clients/react-native/DeviceSync.tsx) | [Complete host/backend setup](../end-to-end/react-native-recording-sync/README.md) |

The web [recipe table](../end-to-end/web-reference/README.md#pick-a-recipe) names
the public `/v1/*` calls and UI/backend modules. Those files also depend on HTTP,
auth, source verification and durable-state helpers. Copy that complete import
graph, including core/errors and the consumer policy/projection shim, and replace
only the application-owned identity mapping. The web adapter permits omitted
`project_id` while retaining supplied-project and owner/source checks; mobile
uses strict default recording/job project checks. The Ask entry or
DeviceSync file is not independently safe to paste into another app.

Focused snippets/guides should point at these maintained features. A few
standalone quickstarts remain useful for a distinct runtime/language, including
[Node upload/transcribe](../api/upload-and-transcribe-node/README.md),
[Python upload/transcribe](../api/upload-and-transcribe-python/README.md) and
[Python webhook](../api/webhook-receiver-python/README.md). Keep existing advanced
recipes discoverable through the [catalog](../README.md#example-catalog), not as
another count-driven set of primary implementations.

## Find the platform SDK source

Use the [platform table](../README.md#current-platform-coverage) and normal
platform UI. Integrated client targets do not imply identical public SDK
capabilities, full device parity or a universal UI/model layer. Device-only
connection/status requires hardware, but no backend or Bota key; cloud features
and authorized upload use the customer backend.

| Platform | Existing public-call source | Current host/support |
| --- | --- | --- |
| Kotlin / Android | [SDK connection](../app-sdk/android-device-connect/README.md); [cloud reader](../end-to-end/recordings/clients/android-kotlin/README.md) | Native Android SDK starter and separate GET-only recording library/results |
| Swift / Apple | [SDK connection](../app-sdk/apple-device-connect/README.md); [cloud reader](../end-to-end/recordings/clients/apple-swift/README.md) | Shared iOS/macOS SDK starter and separate GET-only SwiftUI library/results |
| React Native | [App.tsx](../app-sdk/react-native-device-connect/App.tsx); [recording app](../end-to-end/recordings/clients/react-native/README.md) | Android/iOS cloud app; encrypted device sync stays Android-only |
| Flutter | [main.dart](../app-sdk/flutter-device-connect/lib/main.dart); [setup](../app-sdk/flutter-device-connect/README.md) | Android/iOS connection/status and cloud app; no selected RN encrypted-v2 host workflow |
| Web / Chromium | [device-session.ts](../end-to-end/web-reference/web/features/devices/device-session.ts); [setup](../end-to-end/web-reference/README.md) | Optional connection/status in the recording app; explicit lazy preparation/chooser, secure context and supported Web Bluetooth |

Missing public capability, missing host and missing verification are different
gaps. Native Windows/Electron SDK support is planned upstream. Do not use private
Bota One helpers, custom transports/crypto or invented facade methods to hide gaps.

## Preserve the migration and copy boundary

1. Inspect the selected README, source/imports, manifest and lockfile. Eight existing
   SDK roots use exact public beta.19; the React Native and Flutter recording apps
   and optional Web app feature use exact public beta.20. Native Kotlin/Swift cloud readers use HTTP without a Bota SDK.
   Historical prose does
   not override current manifests. RN uses native compatibility factories, not
   the generated-JS `/runtime` route. See [current adoption](design-reviews/2026-10-20-sdk19-catalog-ios.md).
2. Install only in documented roots with lifecycle scripts enabled. Keep native
   Expo signing integrity, braces and other mandatory guard/test chains; do not
   bypass postinstall to get a clean install.
3. Keep Bota keys server-side. Derive project/end-user authorization from the
   customer's authenticated identity and retain exact owner/source checks.
4. The combined listener retains separate auth adapters and three journal models.
   Default startup validates original absolute paths/schema/scope/account mapping;
   fresh `--initialize` requires every journal absent. Stop old listeners. Mixed
   credentials refuse; preserve separate body/Origin gates and 10/30-second input
   budgets, with upstream processing deadlines unchanged. Fresh processing/Ask
   claims refuse matching peer intent even known/complete, without Web ID adoption.
   Own GET recovery and native/library exact-known-ID paths remain. These are
   in-process guards, not external-writer or atomic file-race guarantees. Preserve current
   routes/DTOs, journal scope/anchors, known IDs and unresolved writes. No journal
   deletion, account remapping or replacement write may force apparent success.
   Retain syntactically valid returned job/session IDs before later validation;
   awaited known-resource GET failures preserve identity/uncertainty. Saved IDs
   do not grant content access, and web 401/403/404 errors withhold operation metadata.
5. Keep upload commitment, SDK receipt/device cleanup and processing separate.
   Metadata or legacy `uploaded` grants no cleanup authority. Drain native work
   and preserve source/selection/session fences before replacement admission.
6. Keep features plain and visible. Share concrete backend features inside the
   integrated foundation after compatibility checks; do not introduce a general
   wrapper SDK, hidden cross-root dependency or universal UI framework.

Sample content is synthetic. Web implements ordinary-import WAV playback; its
[live HTTP acceptance](design-reviews/2026-10-14-web-playback.md#october-15-live-http-acceptance)
does not establish browser decoding. Mobile now implements ordinary import/WAV
playback; its [host/media evidence](design-reviews/2026-10-20-ios-mobile-recording-flows.md)
is distinct from actual native decoding and physical device acceptance.
Original downloads are not necessarily playable/decrypted audio.
Read [CONTRIBUTING.md](../CONTRIBUTING.md) and
[example contracts](example-contracts.md) before repository changes.

## Check and report evidence

[examples.json](../examples.json) remains `schema_version: 1`; match its purpose,
language, platform and hardware requirement, then read the linked setup/evidence.
The original 76 IDs/paths remain unchanged; the implemented core is appended as
`recordings`. Legacy `apps/` is excluded. Adding a
feature needs no new catalog schema or install root.

Run the selected appropriate checks. Source/syntax, unit, native build, live API
and physical-device evidence are distinct; fixtures and builds do not qualify
live provider/upload/cleanup behavior. Use the [implementation review](independent-examples-review.md)
for exact source/SDK/hardware results and remaining gates. Catalog CI checks
metadata/links rather than example behavior:

```sh
node scripts/check-catalog.mjs
node --test scripts/test-catalog.mjs
```

## Copy this prompt

```text
Use Bota Examples to implement <feature> in <platform/language/host>.
Hardware available: <none or platform/device details; no credentials>.
Requested verification: <source, unit, build, live API or physical>.

Start with Bota Recordings and find the maintained feature/public-call files.
Read the relevant client README, complete imports, manifest and lockfile. Use
existing SDK-only sources for device capabilities; those need no backend for
connection/status. If editing this repo, follow AGENTS.md/local instructions.

Report the source/setup/copy boundary, then adapt the feature with my application's
auth mapping. The combined listener shares recording/processing/Ask while retaining
separate auth adapters and three journal models. Copy the Web installation, mobile
backend source, core and compatibility
adapters; preserve routes/DTOs, journal scope, known IDs and uncertain writes.
Use original explicit paths/schema/scope/account mapping; initialize only a fresh
all-missing set and stop old listeners. Refuse fresh peer known/complete claims
without Web ID adoption; retain own GET/native-library exact-known-ID recovery.
Flutter and RN now live under end-to-end/recordings/clients; old READMEs forward.
Web/backend launch bases and journals remain at existing paths. Client/native-host
origin defaults stay 8787. Retained native capture recovery keeps its original
origin: configure combined PORT=8787 and matching APP_ORIGIN where needed; do not
reset journals or rewrite capture scope. Fresh cloud setup may explicitly select
5173 with matching phone forwarding.
Kotlin/Swift cloud readers implement only first-page library and existing results
through the same Bearer backend. Optional Web connection/status uses beta.20;
its demo is inert. No external-writer or atomic file-race guarantee is added.
Keep keys server-side, SDK pins unchanged,
owner/source and receipt/cleanup gates intact. No private helpers, hardcoded
devices or duplicate uncertain writes. Use normal platform UI and supported
capabilities; report exact checks and deferred live/hardware acceptance.
```

## Independent React Native dependency review

The two independent RN roots keep their public SDK/Expo/device contracts and
ordinary install/test chains. Read [public Metro matching removal and delivery
limits](metro-public-matching-removal.md) before changing their parent artifacts,
overrides or zero-braces asset guard. The legacy root uses its separate
[public-parent matching and absence verification](legacy-public-parent-matching-removal.md)
and source/scanner limits.
