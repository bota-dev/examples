# Bota Recordings · Swift

A small iOS/macOS app showing a recording library, a selected recording, and its
existing transcript and general notes. Start with local synthetic Sample data,
then connect the same UI to your application's backend. Copy the code into an
ordinary customer app rather than building an API explorer.

| Capability | This sample |
| --- | --- |
| iOS 15+ / macOS 13+ | Shared SwiftUI feature, checked-in iOS host, SwiftPM macOS host |
| Sample | Credential-free synthetic text, no network or SDK initialization |
| Live | Recording list/detail and existing completed Transcript/Notes reads |
| Library size | First page only, at most 20; explicit notice if more exist |
| Processing/import/audio/device | Not included in this first native cloud slice |

There is no Bota SDK package here. For device connection/status and metadata-only
catalog examples, use the independent [Apple connection](../../../../app-sdk/apple-device-connect/README.md)
and [Apple catalog](../../../../app-sdk/apple-recording-catalog/README.md) starters.
The fuller [React Native](../react-native/README.md), [Flutter](../flutter/README.md)
and [Web](../../../web-reference/README.md) clients demonstrate additional recording flows.

## Run Sample

Use macOS with **Xcode 26.3** selected (`xcode-select`) and **Node 22.23.2** for the
dependency/license gate. Swift 6 is required. There are zero third-party runtime
dependencies and no npm install, secrets, API account or physical device is
needed for Sample mode.

```sh
node --test scripts/check-dependencies.test.mjs
node scripts/check-dependencies.mjs
swift test
bash build.sh
open BotaRecordings.app
```

Choose **Open Sample**. Select “A walk and a few ideas”, then switch between
Transcript and Notes. The second synthetic recording shows the ordinary state
where no completed content exists. Sample text establishes no live API, decoder,
audio or device result.

For iOS, open `ios/BotaRecordings.xcodeproj`, select the shared **BotaRecordings**
scheme and run on an iOS 15+ simulator. To check both unsigned native targets:

```sh
bash build-ios.sh
```

Running on an iPhone requires your signing team and provisioning. Simulator and
unsigned device compilation do not qualify signed installation or real-device
behavior. Neither host asks for Bluetooth or microphone permission.

## Connect a Live library

1. Run/configure the existing [combined customer backend](../../README.md#run-an-application)
   or retained [mobile backend](../../../react-native-recording-sync/backend/README.md).
   It must already have a configured application principal and separate mobile
   Bearer authority. The combined synthetic demo does not grant mobile authority.
2. In this app, enter the backend's **origin only**, such as
   `https://your-backend.example`. No credentials, path, query or fragment are
   accepted. HTTPS uses normal OS certificate validation.
3. Enter its separate **application token**, 32–256 visible ASCII characters
   without whitespace. Bota key/grant prefixes `sk_`, `rk_`, `dtok_`, `up_`, `rct_`
   are rejected. Never enter your Bota project key in the app.
4. Choose **Connect to Live library**. Reads start from the first library page.
   Select a recording to read existing completed results. Refresh is explicit;
   this app never starts transcription or summarization.

Development configuration accepts HTTP only for exact `localhost`, `127.0.0.1`
or `[::1]`, with an optional port. The hosts permit local networking without
disabling global App Transport Security. Loopback refers to the current runtime;
a physical phone should use a reachable HTTPS backend. Platform network policy
and certificate errors remain controlled failures; no trust bypass is installed.

Tokens and content are held only in memory. The setup field is cleared after a
connect attempt. Sign-out, window inactivity/disappearance or a 401 clears
content and retires the token; return to Sample or reconnect explicitly. The
next session waits for reader cancellation and URLSession invalidation to join.
Cleanup failure blocks further admission until restart.

## Read contract

These are **customer backend routes**, not direct public Bota API calls:

```text
GET /api/library/recordings
GET /api/library/recordings/{rec_id}
GET /api/library/recordings/{rec_id}/transcriptions
GET /api/library/transcriptions/{txn_id}/summaries
```

The [shared contract](../../contracts/native-library-read.md) defines DTOs,
ownership, source identity, string caps and failures. The backend retains the
Bota key and checks project/end-user ownership on every read; the client also
rejects foreign recording/transcription identities. A library response with
`has_more` is deliberately incomplete. This app does not follow its cursor.

Each response must be JSON and valid UTF-8, fit the 2 MiB streaming byte limit
and finish within the configured 30-second resource deadline. DTO caps count
UTF-16 units, matching the shared adapter. Large otherwise-valid results can
exceed this sample's deliberate byte cap. There are no redirects, cookies,
credential store, cache, retries or raw server-body error messages.

Only completed jobs provide content. The app shows the **first completed**
transcript and general-notes result in the returned snapshot, not “the latest”.
Text is rendered inertly. `upload_verified` and completed content confer no
device cleanup authority. These reads qualify none of encrypted-upload-v2's
capture identity, ciphertext integrity, cloud commitment or signed receipt gates.

## Copy into your application

- Copy this entire directory for a standalone app: `Sources/`, `Tests/`,
  `Package.swift`, `ios/`, both build scripts, plists, license gate and license.
  Regenerate ignored build state; there is no third-party lockfile to recover.
- Set your own iOS bundle identifier/signing team and macOS plist identifier.
  Replace setup with your real application sign-in; never embed a Bota key or
  commit an application token. Keep token/session retirement behavior intact.
- For an existing app, copy the five `Sources/BotaRecordings` files, then replace
  the sample `@main` app with your entry point. Preserve the DTO/source checks,
  fixed backend routes, bounded transport and model reader lifecycle together.
- Copy `.github/workflows/apple-recordings.yml` and adapt its checkout path if
  creating a new repository. Follow your own dependency-update policy; this
  monorepo's Dependabot configuration is maintained centrally.

The local [architecture](ARCHITECTURE.md) explains the boundaries. No runtime
source is imported from other examples or private Bota applications. Existing
server origins, scope, retained journals and unknown uploads remain unchanged.

## Validation and dependencies

The zero-third-party license gate inspects the actual `swift package dump-package`
manifest, Xcode package/binary references, imports and vendored archives. It
fails closed if a dependency is added; extend it only with an explicit
license/security review. The app is MIT licensed and uses Apple system
frameworks. Node scripts are build checks only and use built-in Node modules.

`swift test` includes 20 synthetic/loopback tests covering DTO UTF-16 caps,
required fields, page consistency, actual HTTP headers and cookie isolation,
redirect refusal, streamed/declared byte limits, status/MIME/JSON/source
rejection, cancellation before headers, stale selection, sign-out joins, 401
retirement and sticky cleanup failure. Loopback peers never use a real token
or contact a Bota backend. Sample tests fail if its live factory is invoked.
The test peer uses nonblocking sockets and bounded poll/header/body/hold waits;
failure to join its worker within five seconds fails the test. CI runs contract,
model and transport classes separately with individual step timeouts.

Local October 20, 2026 evidence: the two Node gate regressions pass; project,
plist, workflow and shell structural checks are separate from native compilation.
Swift/Xcode are unavailable on the Windows editing host, so the Swift tests,
macOS app build and unsigned iOS simulator/device builds require the owning
[native CI workflow](../../../../.github/workflows/apple-recordings.yml).
No live API read, signed installation, phone run or physical device test is
claimed by these local checks.

Foundation references: [streaming URLSession bytes](https://developer.apple.com/documentation/foundation/urlsession/bytes%28for%3Adelegate%3A%29)
and [URLSession.AsyncBytes](https://developer.apple.com/documentation/foundation/urlsession/asyncbytes).
