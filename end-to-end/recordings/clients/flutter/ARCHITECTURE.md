# Flutter recordings template architecture

The common Android/iOS app uses import/playback and a library/detail layout with Transcript, Summary
and Ask. It belongs to the current general-platform layer; it is not a vertical
application or a replacement for Bota One.

```
Flutter Material UI → account/recording state → RecordingsApi
                                                ├─ SampleApi (local fixtures)
                                                └─ BackendApi (app Bearer HTTP)
                                                      → ../../backend
                                                      → public Bota /v1 API
Live-only device screen → public beta.19 Flutter SDK → Bluetooth
Live media → file_selector / just_audio → private transient app cache
```

`models.dart` validates the narrow presentation DTOs. `api.dart` holds the
customer-backend origin and memory-only app token, refuses redirects, bounds
responses to 2 MiB and sets one request deadline: 30 seconds normally, 210 seconds
for Ask, 180 seconds for raw uploads and 120 seconds for 25 MiB WAV playback.
It makes a single attempt, refuses redirects and aborts failed/timed-out HTTP work.
`sample_api.dart` returns disposable synthetic fixtures without network or SDK
initialization; it contains no audio, signed material or fake device receipts.

`recordings_controller.dart` owns an account epoch, selection epoch and individual
read revisions and a canonical question revision. Text-field edits clear answers
and fence pending responses even after returning to the original text. Signout
and disposal clear content, credentials, operations and presentation locks.
Late results cannot restore old account/source content. Summary
reads occur only when its tab is requested and require both exact recording and
transcription links; transcript/Ask remain usable if an unrelated summary read
fails. Ask citations must refer to the current recording. React-style HTML/code
rendering is absent; Flutter displays API text as text.

Ordinary imports select one extension-filtered file with `file_selector`, verify
declared length, stream at most 25 MiB and send raw bytes/MIME plus an encoded
filename to the authenticated customer backend. Only that backend owns Bota
credentials, recording creation and durable uncertainty. Incomplete upload
operations retain their presentation lock; known operations recover through GET.

`recording_media.dart` exposes replaceable native picker/player ports. WAV fetches
check MIME, exact RIFF/WAVE bytes, RIFF length and response bounds. The native
decoder receives only a private temporary WAV filename; no remote URL or token.
Load never plays automatically. Selection, Back, refresh, signout, disposal and
backgrounding fence bytes, await pending load, dispose the player and delete its
cache file. Replacement picker/player admission joins both cleanup and any old
picker. Failed cleanup keeps the lifetime gate closed. Process crashes can leave
cache for OS eviction; no offline media persistence or background playback exists.

Processing intents are locked before POST and remain account-owned across detail
navigation. Uncertain/malformed responses never unlock a write. Only a documented
preclaim readiness rejection without operation metadata may unlock. Known journal
operations refresh with GET; refreshed metadata cannot inject answer content.
Detail notices disappear only for completed, idle requests without a recorded
error. Busy/error/uncertain requests keep their recovery notice, while completed
metadata remains available in the collapsed Recent requests section.
The shared backend owns durable intent, project/end-user authorization and public
API calls. App memory is a UI fence, not durable replay or authorization storage.
Use the [combined backend](../../README.md) launcher. Its mobile route adapter
and original journals stay at their compatibility paths; moving this client
does not move backend state or change authorization.

`device_page.dart` owns a public SDK client only after visiting Live settings;
configuration/permission requests occur only on an explicit action. Its cached
UI is fenced to SDK connection events and destroyed on navigation, session end
or app disposal. Device navigation drains subscriptions/configuration and awaits
SDK destruction. The public facade has one process singleton and destruction is
terminal. `DeviceSessionAdmission` consumes that single lifetime on opening the
page; its production instance survives account changes and Home rebuilds. After
return, the Device menu is disabled with a restart notice while cloud features
remain usable. A destruction failure keeps its visible failed gate. Injected
builders/admission instances are app test seams, not production SDK factories.
SDK transport errors/native
omissions remain SDK concerns.
It offers no recording catalog/upload/cleanup because published Dart beta.19
lacks the required public gates and encrypted-v2 host callback contract.

The generated Android host has a distinct application ID, minimum API 26,
compile SDK 37 and debug-only loopback cleartext allowance. Sample mode works
without Bluetooth hardware. The normal Flutter iOS Runner targets iOS 15+ and
uses `dev.bota.examples.mobileRecordingsFlutter`; CocoaPods enables only its
Bluetooth permission handler. iOS never queries Android device metadata. No
desktop/web host is supplied. Tests/builds verify source/runtime composition;
native linking, live providers and physical device behavior stay separate evidence.

The [adoption review](../../../../docs/design-reviews/2026-10-14-native-sdk-beta18-adoption.md)
records the public Flutter beta.18 archive, regenerated lock and consuming
checks at that dated checkpoint. Application/controller source was unchanged then. Historical `a7b34175` and
`6dd54747` snapshots used Flutter beta.17; those results do not qualify beta.18
or add a host/device capability.

## Implementation review

| Requirement | Evidence | Status |
| --- | --- | --- |
| Ordinary import/playback and transient native media | Bounded raw-Bearer upload/WAV HTTP cases; media-port tests for stale picker/load, late play completion, unknown intent and teardown | source/local checks; native decoding unverified |
| Normal Flutter iOS host | Pinned Flutter template, iOS 15 Runner/Podfile, explicit Bluetooth-only permission test and unsigned hosted build gate | host source; macOS linking/phone acceptance separate |
| Common library/detail/transcript/summary/Ask flow | Local sample/controller journey and four connected UI widgets, including 360×640 navigation, completed-detail focus and uncertain recovery | matched locally |
| Separate live backend credentials and bounded single-attempt HTTP | Nine actual loopback HTTP tests; HTTPS/loopback validation; no key, redirect or retry forwarding | matched locally |
| Source/account/question isolation and durable uncertainty boundary | Fifteen controller regressions; account-owned locks, exact source/citations, GET recovery; backend owns durability | matched locally |
| Public SDK connection/status with bounded UI lifetime | Ten SDK-platform lifecycle regressions, including terminated observations, pending configuration and destruction failure | matched in simulation |
| Runnable Android host with public packages | Frozen pub lock, analysis, format and final-source debug APK build on Flutter 3.47.5/JDK 17/SDK 37 | matched locally |
| Native encrypted-v2 recording transfer from Flutter | Missing released Dart host/gate surfaces; no workaround implemented | not implemented |
| Live Bota API/providers, real Bluetooth and other native hosts | No live/physical calls or other hosts tested in this pass | unverified |
