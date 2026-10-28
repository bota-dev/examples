# Bota Recordings: common web sample app

A familiar recording app template for customer developers building for their
own end users, inspired by Demo and Bota One. Import audio, choose a recording,
load supported audio, then open its Transcript, Summary or Ask tab. The React frontend and Node
backend demonstrate public recordings, upload, transcription, general notes,
recording-scoped Ask and webhook integrations. Shared HTTP, authentication and
durable intent adapters remain in this Web root and use shared feature code.

Recording, processing and Ask public calls now use the
[canonical backend core](../recordings/README.md) through local compatibility
shims. The [combined launcher](../recordings/README.md) now composes the Web and
mobile service factories on one listener, retaining both auth adapters, DTOs and
all three journals. Use a full checkout: the combined runtime needs this Web
installation, mobile backend source and integrated backend. The old Web launcher
remains available with its original CWD rules. Web/backend and state paths stay;
[Flutter](../recordings/clients/flutter/README.md) and
[RN](../recordings/clients/react-native/README.md) now have relocated complete install roots.

Use it as a starting template or copy a small recipe with its helpers. This is a
general Layer 1 capability sample, not a vertical application or production SaaS
starter. API documentation and source recipes are below; the everyday UI focuses
on recordings and results. Activity is secondary and initially collapsed for
explicit saved-operation refresh and notification metadata.

Cloud recording features use the APIs, including ordinary-import playback.
An optional public Web SDK feature connects a wearable and reads its current
status. No device, private package or sibling repository is needed for recording
features. Microphone capture, device transfer and device-audio decryption are unavailable.
Independent API snippets and platform-specific App SDK examples remain useful
for smaller tasks. The common app journey is the direction for mobile-to-web
templates; current connection/catalog snippets do not implement that full journey.

## Try it without credentials

Use Node **22.23.2 or newer**, then run from this directory. The checkout must
include the complete public family described above; the combined README defines
the shared setup and checks.
No legacy root workspace install is needed.

```sh
npm ci
cd ../recordings
npm ci
npm run demo
```

Open **http://127.0.0.1:5173** and select **Open demo**. Choose a
recording, select **Load audio**, open its Transcript/Summary/Ask tabs, or import audio. The
seed recordings play a generated synthetic WAV tone unrelated to their transcripts.
Uploading and processing
are separate actions. The demo simulates the upstream API in-process, makes no
external requests and resets on restart. Its outputs and notifications are
synthetic; they prove no transcription, upload or model-provider acceptance.
Devices is disabled in this mode; it imports no SDK and opens no Bluetooth picker.

Use that exact origin: `localhost` and `127.0.0.1` are different browser origins.
The server binds loopback. Change `PORT` and `APP_ORIGIN` together if necessary.
If that port is occupied, startup reports it and exits; stop the other listener
or select an unused port before running again.

## Pick a recipe

| Feature                       | Public calls                                                                                                                   | Backend sample                                                  | Frontend sample                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| List/read recordings          | `GET /v1/recordings`, `GET /v1/recordings/{id}`                                                                                | [recordings.mjs](../recordings/backend/features/recordings.mjs) | [Recordings.tsx](web/features/recordings/Recordings.tsx)                                                        |
| Upload audio                  | `POST /v1/recordings`, `POST /v1/recordings/{id}/upload-url`, storage `PUT`, `POST /v1/recordings/{id}/upload-complete`        | [upload.mjs](server/features/upload.mjs)                        | [Upload.tsx](web/features/uploads/Upload.tsx)                                                                   |
| Play an ordinary import       | `GET /v1/recordings/{id}`, `GET /v1/recordings/{id}/download-url?format=wav&use_enhanced=false`, storage `GET`                 | [playback.mjs](server/features/playback.mjs)                    | [AudioPlayer.tsx](web/features/playback/AudioPlayer.tsx)                                                        |
| Transcribe and read text      | `GET /v1/transcriptions`, `GET /v1/transcriptions/{id}`, `POST /v1/transcriptions`                                             | [processing.mjs](../recordings/backend/features/processing.mjs) | [Transcript.tsx](web/features/transcription/Transcript.tsx)                                                     |
| Create/read general notes     | `GET /v1/summaries`, `GET /v1/summaries/{id}`, `POST /v1/summaries`                                                            | [processing.mjs](../recordings/backend/features/processing.mjs) | [Summaries.tsx](web/features/summaries/Summaries.tsx)                                                           |
| Ask one recording             | `POST /v1/ask/sessions`, `POST /v1/ask/sessions/{id}/messages`, scoped session/history `GET`                                   | [ask.mjs](../recordings/backend/features/ask.mjs)               | [Ask.tsx](web/features/ask/Ask.tsx)                                                                             |
| Receive/display notifications | Bota delivers to your `POST /webhooks/bota` callback                                                                           | [webhooks.mjs](server/features/webhooks.mjs)                    | [Activity.tsx](web/features/webhooks/Activity.tsx)                                                              |
| Optional device connection    | Public `BotaDeviceClient.create()`, `devices.connect({ expectedSerialNumber })`, `readSnapshot()`, `disconnect()`, `destroy()` | None                                                            | [device-session.ts](web/features/devices/device-session.ts) and [Devices.tsx](web/features/devices/Devices.tsx) |

React calls this example's authenticated `/api/*` routes. The backend files show
the public Bota calls with fixed owner/source filters; the webhook path above is
your application's receiver, not an endpoint for creating an event in Bota.

The web HTTP [client](server/client.mjs) performs bounded public HTTP calls;
[auth](server/auth.mjs) derives the application principal, and [store](server/store.mjs)
persists write intent and notification metadata. [app.mjs](server/app.mjs) is the
small route map. Browser features share [api.ts](web/api.ts) and
[workflow.tsx](web/workflow.tsx), which fence late results and duplicate clicks.

Local [recording](server/features/recordings.mjs),
[processing](server/features/processing.mjs) and [Ask](server/features/ask.mjs)
files are compatibility shims over the core. They preserve web DTO projections
and explicitly allow omitted `project_id`; supplied projects, exact recording
owner/source chains, session membership and citations still match. Mobile uses
the core's strict default recording/job project checks. Upload/webhooks remain
web-local. This is not a policy to bypass ownership checks.

Copy the selected canonical feature, shared errors, web shim/projection and
HTTP/auth/store pieces it imports. Replace the auth
adapter with your application's authenticated identity and server-derived
end-user mapping. Keep the ownership checks and durable-before-write ordering.
These modules belong to the integrated sample family; they are not a published generic API SDK
or independently runnable standalone snippets. Never copy an API key into React.

## Optional Bluetooth connection

In configured live mode, open **Devices**, choose **Prepare Bluetooth**, enter
the exact printed serial, then choose **Connect device** and select your wearable
in the browser picker. Preparation loads the public SDK/WASM without connecting.
Connect invokes the public chooser before any await; combining lazy import and
the picker in one async click handler can lose browser user activation. Choose
**Read status** explicitly for battery, state and firmware; **Disconnect device**
retires that SDK session. Prepare again before another connection.

This requires foreground desktop Chromium with Web Bluetooth on HTTPS or
localhost and compatible Bota Identity service `0008` firmware (the browser blocks
standard serial characteristic `2A25`). Arbitrary HTTP LAN URLs, Safari/Firefox,
background Bluetooth and mobile-browser parity are unsupported. Demo and
unsupported browsers leave device actions disabled. The recording library remains
usable without preparation or a device, including while Bluetooth closes.

The SDK verifies the exact serial; the feature also checks the returned serial
and peripheral against its public cached connection before releasing status.
There is no public fresh-pairing contract, cloud ownership check, binding,
catalog, capture, audio transfer/upload or recording cleanup in this feature.
Connected status never authorizes those operations. Recording navigation and
device selection are independent; browsing another recording does not disconnect.

One page-owned host spans account/recording views. Observed connection loss,
wrong identity, SDK action error, sign-out or account/page retirement clears
identity/status immediately. Pending preparation, chooser, read, disconnect and
destruction join before another device owner may prepare; failed cleanup keeps
admission closed until reload. An open browser picker may need to be dismissed.
Public Web beta.20 has no connection subscription: a 250 ms observation reads
only `connectedDevice`, without GATT polling. Missing SDK/OS loss callbacks or
browser background throttling can delay clearing. Page unloading cannot await
all asynchronous work; a page restored from back/forward cache remains closed
to Bluetooth and requires reload. No automatic reconnection occurs.
Only errors surfaced by public teardown can close the admission gate; awaited
SDK cleanup is not independent proof of physical disconnection.

Copy [device-session.ts](web/features/devices/device-session.ts),
[Devices.tsx](web/features/devices/Devices.tsx), the App-owned session hooks in
[App.tsx](web/App.tsx) and matching device styles. Replace UI/device selection,
but preserve account/peripheral ownership and joined cleanup gates. The SDK
receives no `storageNamespace`, so its public default has no persistent device
hints or journals; this sample neither creates nor clears retained SDK state.
Keep same-origin SDK/WASM assets and the server's narrow `script-src 'self'
'wasm-unsafe-eval'` policy. JavaScript `unsafe-eval`, external script origins and
backend routes are not required.

The new integration pins **`@bota.dev/web-app-sdk@2.0.0-beta.20`**. Anonymous npm
metadata/archive verification records MIT, 375,802 bytes and the exact registry
SHA-512 in [dependency provenance](web/features/devices/dependency-provenance.json)
and [package-lock.json](package-lock.json). It was published October 21 UTC and
was the public `beta` tag at the recorded check; `latest` remains beta.0. The
owner's latest-SDK request permits its age below seven days; unrelated dependency
age rules remain. Only this SDK entry/pin is added. Vite stays 8.3.4 and every
other lock field is unchanged; the fresh pre-change audit reports zero findings.
The ten existing SDK install roots retain their independently qualified beta.19
pins. Source, synthetic browser tests, production asset build and physical
Bluetooth acceptance are separate evidence; no hardware session is run here.

## Playback contract

Select **Load audio**, then use the browser's audio controls. Playback accepts
owned, nondeleted `api_upload` / `import` recordings in uploaded, processing or
completed state with verified upload metadata, explicit `device_id: null` and
`encryption_version: null` or numeric `0`. Missing or malformed evidence,
device/encrypted sources and unsupported media are unavailable. This is not a
device-audio player or decryption implementation.

The backend requests one public WAV export with `use_enhanced=false`. That API
GET may create/cache a converted object; it does not prove upload commitment,
decryption or browser decoding. The converted bytes do not claim to match the
original recording's SHA-256. The same independently trusted `BOTA_STORAGE_HOSTS`
allowlist applies to uploads and playback. Storage uses HTTPS/default TLS port,
no API credential/cookie forwarding, no redirects and bounded time/bytes.
The descriptor, actual body and WAV signature are checked within a **25 MiB**
download cap. Oversize exports, expired/missing storage objects and unsupported
browser decoding produce errors; another load requires an explicit action.

`GET /api/recordings/{id}/audio` returns complete media through the authenticated
same-origin route only after fresh ownership/source checks and a current-session
check. These observations are non-atomic, not a guarantee against later owner
changes. Signed storage URLs stay in server memory and never enter the browser,
logs or SQLite journals. The browser keeps one temporary Blob URL, with no
autoplay or persistent media cache, and aborts, pauses, clears and revokes it on
refresh, selection changes, Back or sign-out. Data already delivered to an
authorized user cannot be remotely revoked. Byte/signature tests establish no
live-provider export or real customer-audio playback acceptance.

To adapt this feature, copy [shared playback](../recordings/backend/features/playback.mjs),
[shared recording validation](../recordings/backend/features/recordings.mjs) and
[errors](../recordings/backend/errors.mjs), the bounded
[HTTP/storage client](../recordings/backend/http.mjs), Web compatibility exports
in `server/features/` and `server/client.mjs`, route/session gates in [app.mjs](server/app.mjs),
and [AudioPlayer](web/features/playback/AudioPlayer.tsx) with [api.ts](web/api.ts).
Keep the source tuple, host policy, byte limits, release-time session checks and
media teardown. The narrow CSP `media-src 'self' blob:` permits local media
without widening script or API access. Do not copy only the `<audio>` element
and expose signed URLs or project credentials to the browser.

## Connect your authorized project

For the combined listener, use the [integrated setup](../recordings/README.md)
instead of the compatibility commands below. It requires the complete Web/mobile/core
family, original absolute paths/schema/scope/account mapping and stopped old
listeners; fresh initialization accepts only all-three-missing journals. It adds
in-process peer-intent refusal without Web ID adoption, retaining own GET recovery.
Its 10/30-second input budgets are stricter than this standalone launcher's
15/180; upstream processing stays unchanged. Configured account/journal paths and
sidecars are denied in combined development serving. No external-writer/file-race,
production-auth or hardware guarantee is added.

The following instructions retain the older Web launcher. Run them from this
Web install root; do not run it alongside the combined host on the same state.

1. Copy `.env.example` to `.env` (`Copy-Item` on PowerShell).
2. Select `APP_MODE=live`, a trusted HTTPS API base ending `/v1`, server-held
   project key and independently verified `BOTA_PROJECT_ID`.
3. Set `BOTA_STORAGE_HOSTS` to exact trusted upload hostnames supplied by your
   operator context. No wildcard, arbitrary storage URL or API Bearer forwarding
   is accepted. Only HTTPS/default TLS port storage uploads are supported.
4. Create an application account with an existing authorized end-user mapping:

   ```sh
   npm run account -- alice eu_YOUR_ACTUAL_ID
   ```

   The command prints one random **application access token** and saves its
   hash in private `accounts.json`. Deliver the token through your own trusted
   process. It is separate from the Bota key. Add accounts while the server is
   stopped, keep a backup, and restart to load mapping/token changes.

5. Run `npm run dev`, or `npm run build` followed by `npm start`. Sign in with
   the application username/token. Use only synthetic or consented audio.

All accounts in this reference map to one configured Bota project. A restricted
key needs the public `recordings:read`, `recordings:write`,
`transcriptions:read`, `transcriptions:write`, `summaries:read` and
`summaries:write` scopes. Ask requires an authorized project key; no invented
`ask:read` scope is added. Consult the current public contract when restricting
keys: earlier inspected transcription/summary routes omitted read-scope guards,
and local owner checks do not prove deployed scope enforcement.

Accounts, `.env` and live `.state/` must be private. POSIX checks require private
owned files/directories. On Windows provision private ACLs; modes alone do not
configure them. Use trusted symlink/reparse-free ancestry without concurrent
path writers. The account bootstrap writes only local configuration and makes
no Bota account/API operation. Do not edit it concurrently or treat it as a
crash-safe account-management service.

## What each action does

- **Upload:** create an `api_upload`/`import` recording for the server's end user,
  get an upload URL, send original bytes without API credentials, then submit
  their SHA-256 for completion. Audio must be nonempty, at most 25 MiB and use a
  documented MIME type: WAV/x-WAV, MPEG, MP4, OGG, Opus, WebM or FLAC.
- **Transcribe:** reuse an existing job or submit one explicit create after
  server-reported hash verification. `uploaded` alone is insufficient. Coordinate
  automatic transcription and other writers; separate API reads are not atomic.
- **Summary:** reuse existing `tmpl_general_notes` or request it once from a
  completed exact transcription. Display only the five documented notes fields.
- **Ask:** create an empty recording-scoped session and send one question. The
  app verifies owner-filtered membership, exact history and citations before
  displaying an answer. Leading/trailing whitespace is trimmed before hashing
  and sending, matching the public API; equivalent questions reuse one intent.
  Another question uses a distinct intent.
  New intents record `questionFormat: trim-v1`. Older unresolved intents keep
  their exact hashes and IDs. Because a hash cannot reveal its original whitespace,
  an unresolved legacy intent blocks a fresh question on that recording until
  operator reconciliation; requests on other recordings remain available.
- **Refresh:** GET existing resources/notifications or a saved operation. It
  cannot create a replacement job, resend a question, PUT audio or replay
  completion. Known outcomes can reconcile; an unknown resource ID needs
  operator reconciliation. Activity shows selected intent metadata only.
  Open the collapsed Activity panel to refresh a saved operation through GET after reopening
  or restarting the app; recovered response content is withheld from that panel.

Live SQLite uses synchronous durable claims before each uncertain write. The
same file/name/type, recording, transcription/template or recording/question
intent is not submitted twice, including after restart. An ambiguous response
retains the intent; do not remove state or change account scope to force a
replacement. Upload `425 upload_verification_pending` stays pending: this sample
intentionally uses GET-only recovery, even where completion replay is supported.
It cannot finish a completion that requires an operator-authorized replay.

The shared processing/Ask code retains syntactically valid returned resource IDs
before later response validation. Awaited known-resource GET failures preserve
that identity and uncertain intent; saved IDs do not authorize content or another
POST. Web 401/403/404 errors omit operation metadata. There is still no cross-store
lock between the web and mobile listeners; coordinate other processing writers.

API responses are capped at 8 MiB, requests at 10 seconds, storage at 120 seconds
and each request context at 180 seconds. Async scheduling and filesystem waits
are not universal hard deadlines. List traversal and the notification view are
bounded, not a complete/historical audit. JSON uses native last-key-wins parsing
and rejects invalid UTF-8/nonfinite values. Plaintext content is rendered as text;
generated notes/answers still need human review.

## Webhooks

Configure your authorized endpoint URL as `APP_ORIGIN/webhooks/bota` through the
platform's operator setup and put its signing secret in `WEBHOOK_SECRET`.
Without a secret, the endpoint is disabled. Live public delivery requires HTTPS
and a reverse proxy to the loopback listener; this example does not deploy one.

The receiver rejects HTTP content encoding and verifies timestamp-bound HMAC over original bytes, then durably
deduplicates ID/hash and stores only event/type/time/resource-pointer metadata
before acknowledgement. It starts no jobs. The UI fetches each pointer's current
resource/recording source chain before showing notification metadata; the signed
payload's owner is not access authorization. Open **Activity** and refresh to
observe updates; there is no background push subscription or automatic processing.
The demo's internal fixture notifications are separate from real signed delivery.

Raw audio requests also reject HTTP content encoding. File digest/name/type form
a stable intent within the account; changing a key, project or end-user mapping
cannot turn an uncertain existing upload into a new attempt.

## Authentication and deployment boundary

The sample uses expiring in-memory sessions, opaque per-account application
tokens, HttpOnly/SameSite=Strict cookies, exact Origin/Host checks and bounded
sign-in attempts. Tokens are not saved in browser storage. Sign-out/session
expiry clears visible content and fences late reads/mutations.
Sign-out clears content immediately and waits for the cookie response before
enabling another sign-in, so a late expiry cookie cannot erase a new session.

This is an educational single-process auth adapter. Replace it with your IdP,
shared session store, account lifecycle and operational controls for production.
Use `APP_ORIGIN=https://your-app.example` behind a correctly configured proxy;
HTTPS adds the Secure cookie flag. Sessions reset on restart; live journals do
not. Ownership observations are current and non-atomic, with no historical
authorization, device cleanup, encrypted-v2, firmware or full SDK-lifecycle claim.
No infrastructure, physical-device operation or package publication occurs here.

## Checks and evidence

The [October 14 playback review](../../docs/design-reviews/2026-10-14-web-playback.md)
records 158 backend and 52 UI/client tests passing, plus build/security checks.
The [October 15 live acceptance](../../docs/design-reviews/2026-10-14-web-playback.md#october-15-live-http-acceptance)
verified one synthetic WAV import through the real API/storage, transcription,
summary and Ask, including GET-only upload verification and sign-out denial.
Actual browser decoding, format conversion and customer-audio acceptance remain
unverified; HTTP success and signature checks do not establish them.
The [October 20 mobile/iOS review](../../docs/design-reviews/2026-10-20-ios-mobile-recording-flows.md)
records shared upload/playback extraction. Existing Web source paths remain
compatibility exports, including the explicit omitted-project response policy;
the mobile adapter keeps strict project checks.

The [core README](../recordings/README.md) records shared-core checks and its
compatibility boundary. The dated presentation/quality results below predate
this extraction and are not new validation of the changed import graph.

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run license-check
```

Tests use synthetic Bota/storage responses. They cover cross-user access, CSRF,
scope-forging, storage credential isolation, durable restart/deduplication,
uncertain writes, GET-only recovery, webhook signatures/conflicts and stale UI
results. The HTTP integration runs the complete local fixture workflow.
The October 12 quality pass includes 88 backend tests and 30 UI tests, format/lint,
TypeScript, production build, frozen installation and license checks; dependency
audit reports no known vulnerabilities at that time.
Process regressions cover occupied-port startup and shutdown with an active local
development WebSocket, including closure of Vite watchers before HTTP draining.
No live Bota/provider/storage or hardware acceptance is inferred.

The common-app presentation revision adds three UI regressions: task-focused
controls without API panels, library Back navigation/focus with a late-result
and intent-lock fence, and distinct processing/verification labels. All 33 UI
and 88 backend tests pass locally, alongside frozen install, format, lint,
typecheck/build and the license gate. Desktop and phone-width browser review
covers Transcript/Summary/Ask, returning to the library and synthetic Ask.
See the [template review](../../docs/independent-examples-review.md#common-recording-template-october-12)
for platform coverage and evidence limits.

Status and exact hosted checks are recorded in the
[quality review](../../docs/independent-examples-review.md#general-example-quality-october-12).
The [workflow](../../.github/workflows/web-reference.yml) uses frozen installs,
format/lint/typecheck/tests/build/license checks on Linux and Windows without credentials.

Public basis: [recordings](https://docs.bota.dev/api-reference/recordings/create),
[transcription](https://docs.bota.dev/api-reference/ai/transcriptions/create),
[summaries](https://docs.bota.dev/api-reference/ai/summaries/create),
[Ask](https://docs.bota.dev/api-reference/ask/create-session) and
[webhook verification](https://docs.bota.dev/webhooks/overview#signature-verification).
