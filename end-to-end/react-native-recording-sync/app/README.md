# Bota Recordings — React Native Android app

A common recording app template with a library, recording detail and
**Transcript / Summary / Ask** tabs. Customers can adapt its ordinary React
Native screens and narrow customer-backend interface. It is a general platform
sample, not a vertical product or production authentication system.

This example includes **Android only**. The SDK's Apple facade does not supply
this example's custom Kotlin upload host on iOS; an `ios` npm script is not
evidence of an implemented iOS app. Public SDK beta.13, native adapter and
existing security guards remain pinned.

## Run the sample

Use Node 22.23.2+, JDK 17 and the Android SDK required by Expo 57:

```sh
npm ci
npm run android
```

Choose **Try sample recordings**. This mode uses two synthetic recordings and
in-memory results. It does not import the Device screen, configure the SDK,
request Bluetooth permissions, record audio or call `fetch`. One recording
already has a transcript; the other lets you start a simulated transcription.
Use **Refresh results** to advance synthetic transcription/summary jobs.
Ask returns a clearly labelled fixed answer for every question, with a sample
timestamp. No provider, publication receipt or device cleanup is simulated.
**Exit sample** clears results and starts a fresh fixture set next time.

The application includes a custom native module. Its advertised runnable host
is the Android development build; Expo Go and iOS are not qualified here.

## Connect a customer backend

Start the [companion backend](../backend/README.md), forward its loopback port
with `adb reverse tcp:8787 tcp:8787`, then enter its origin and separate
`APP_ACCESS_TOKEN` under **Connect backend**. Keep the Bota project key on the
server. HTTPS is required except loopback development; URL credentials, paths,
query strings and Bota token prefixes are rejected before an app request.
The app keeps its application token in memory and sends it only as a bearer
credential to that origin; it has no cookie or persistent credential store.

The library reads the backend's fixed authorized end user. It does not require
a Bluetooth connection. Select a recording, refresh its current state, then
explicitly start transcription, summary or Ask when its source is ready.
Summary uses `tmpl_general_notes`; Ask is scoped to one recording and validates
returned citation recording IDs. Source/job IDs are projected into bounded
typed objects; arbitrary backend error text is never displayed.

The independent [library adapter](library-api.ts) calls these customer-owned
routes; they are wrappers around public Bota APIs, not Bota endpoints themselves:

| Customer route | App action |
| --- | --- |
| `GET /api/library/recordings` and `GET /api/library/recordings/:id` | Library and current detail; explicit cursor pagination. |
| `GET/POST /api/library/recordings/:id/transcriptions` | Read transcripts or explicitly request one. |
| `GET/POST /api/library/transcriptions/:id/summaries` | Read general notes or explicitly request a summary. |
| `POST /api/library/recordings/:id/ask` | Send one trimmed question. |
| `GET /api/library/operations` and `GET /api/library/operations/:id` | Saved request metadata and GET-only reconciliation. |

The transport requests `redirect:error`, rejects a differing exposed response
URL, limits normal requests to 30 seconds and Ask to 210 seconds, and checks a
2 MiB declared/content text cap. React Native fetch
buffers native response bodies before returning text, so this application cap
does not establish a streaming network-memory bound. The companion server also
bounds its upstream requests and does not issue redirects. Native fetch redirect
enforcement remains a platform qualification check; a final URL check cannot
undo a native redirect already followed. No app request automatically retries.

## Device recordings

In live mode, choose **Device** to load [DeviceSync.tsx](DeviceSync.tsx). That
explicit action is the only entry into SDK/native code and Bluetooth permission
requests. The retained encrypted-v2 path requires the backend's separately
configured, already-bound device, a fresh SDK-read serial/pairing check,
compatible capabilities and inactive direct upload. It does not provision,
reset, rebind or start/stop recording. Read the enclosing
[device prerequisites and evidence](../README.md) before syncing real audio.
Device uses the live session's origin/token; select **Enable device access** to
authorize that configured device and request permissions. Changing credentials
requires returning to the library and signing out, rather than entering another
token inside the Device panel.

Successful verified sync removes the recording's physical device source only
through the SDK's receipt/confirmation workflow. The app issues no separate
delete or confirm command. Select **Back to recordings** to cancel local work,
wait for any in-flight action and its finalizers, then await final native host
disposal and the public SDK's asynchronous destruction before the cloud library
refreshes. If disposal fails, further device actions remain blocked and the app
asks for a restart; journals are retained. Processing happens in the library,
separately from upload and device cleanup.
The [device session gate](device-session.ts) also serializes owners after an
unmount or expired-account transition, so an old late configure/finalizer cannot
dispose a replacement screen's native host. It registers only on an explicit
action, not during rendering. A failed final cleanup blocks subsequent device
admission until restart.
Cleanup also retires the screen's owner identity before waiting; old SDK events
cannot update a replacement owner. An effect setup after a development cleanup
creates a fresh owner on its next explicit action.

## Interrupted work and adaptation

[RecordingsController](recordings-controller.ts) is used directly by
[Recordings.tsx](Recordings.tsx). Session-level action locks survive tabs,
recording selection and returning to the library. Ask locks use the exact
trimmed question in memory; the backend owns its durable hash/intent. An
uncertain POST is not sent again from that session. The only unlocks are the
backend's known preclaim upload/transcription readiness failures without an
operation property. Known request IDs can be refreshed by GET; unknown IDs
require backend-journal inspection. Restarting or signing out does not delete
or reset the backend's durable operations.

Screen changes and question edits fence late content, including editing away
and back to the original question without unlocking its intent. Summary results
must retain both the exact selected recording and transcription IDs.
**Sign out** clears the application token,
recording text, questions, answers and local request maps, aborts pending local
requests and retires the adapter. Aborting an app request does not cancel a
cloud provider job or undo a POST. The secondary **Request status** panel shows
metadata only; it does not reveal recovered answers from unscoped saved rows.

Keep API credentials and authorization in a customer backend. Replace the
fixed local bearer mapping with your application's authenticated per-user
backend contract before hosting for customers. Device transport/files/receipts
remain SDK/native responsibilities; do not move them into JavaScript state.

## Verification

```sh
npm run typecheck
npm test
npm run export
```

New focused tests exercise the real adapter/controller used by these screens:
synthetic flow without network, source/citation projection, stale content,
signout disposal, lasting action locks and GET-only known-request recovery.
The existing identity/lifecycle, Forge, braces and source-map suites remain in
ordinary `npm test`. These are local synthetic tests and an Android Metro
export, separate from native assembly, rendered phone UI, live APIs, provider
configuration and physical upload/deletion acceptance.
