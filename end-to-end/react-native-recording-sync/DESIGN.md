# Bota Recordings: common mobile sample clients

## Purpose and layout

This compatibility root retains the mobile backend and setup for independently installed
React Native ([setup](../recordings/clients/react-native/README.md))
and Flutter ([setup](../recordings/clients/flutter/README.md))
clients sharing the retained mobile adapter (`backend/`). They
belong to the **Bota Recordings** foundation alongside the web client. The target
has one shared customer backend and clients for Web, RN, Flutter, native
Android/Kotlin and Apple/Swift. The [shared feature core](../recordings/README.md)
and combined listener are implemented, preserving original auth/DTOs and three
journals. Flutter and RN clients are relocated; Web/backend retain existing paths and
integrated Kotlin/Swift clients are not implemented.
The recording experience connects
audio input → library → supported playback/source review → transcript → general
notes → recording-scoped Ask. Use familiar mobile navigation, normal native SDK
UI and short state messages. Public-call/copy guides belong in README/source.

There are exactly two repository layers: general platform examples now, then
vertical use cases and app types later. The integrated recording sample and
focused guides belong to the general layer; current `api/`, `app-sdk/` and
`end-to-end/` paths are formats, not extra layers. Guides/snippets link maintained
feature modules, with a few standalone quickstarts for distinct runtimes/languages.
See the [approved decision](../../docs/design-decisions/2026-10-12-integrated-recordings.md).

Keep the existing directory and native sync implementation so published links
and recovery journals retain their meaning. Each client installs separately.
This compatibility backend imports the canonical core in
`end-to-end/recordings/backend/`. Use a full checkout or copy those family roots
together; the mobile backend folder alone is no longer complete. This does not
permit private Bota application imports. Demo/Bota One inform the journey only.

## Implemented subset and backend direction

| Capability | Current mobile implementation |
| --- | --- |
| Audio input | RN can sync an already-provisioned encrypted-v2 device recording. Neither client implements microphone capture or file import. Flutter has no device transfer in this example. |
| Library and results | Both clients show owned cloud recordings, transcripts, general notes and recording-scoped Ask. A live library needs existing authorized audio or RN device sync. |
| Playback | Not implemented. The target adds playback only for a supported, authorized audio representation. |
| Device SDK | Optional RN encrypted sync and Flutter connection/status, enabled explicitly in live mode. Their supported workflows differ. |
| Hosts | Android hosts are supplied. Common-app iOS hosts are missing; that is separate from the SDKs' iOS support. |
| Synthetic mode | Local DTO fixtures and synthetic results with no network or SDK work. They do not prove live processing, upload or cleanup. |

Mobile and web now use one recording/processing/Ask implementation and common
error types under [the integrated core](../recordings/README.md), through thin
compatibility shims. One combined listener composes the original factories, while
auth adapters and three journal models remain unchanged. Older launchers remain
for compatibility; upload/webhook/native service modules remain local. Mobile
uses default strict recording/job project checks, while web's explicit legacy
policy permits missing `project_id` but preserves supplied-project/source/owner
checks and its existing DTO projection. Complete RN/Flutter install roots and
required helper/guard graphs now live under `recordings/clients/`.

Combined-host qualification and client relocation follow the [root roadmap](../../ROADMAP.md).
Fresh processing/Ask claims refuse matching peer intent, even known/complete,
without Web resource-ID adoption. Existing own GET recovery and native/library
exact-known-ID paths remain. Stop old listeners; default configured startup
validates original absolute paths/schema/scope/account mapping before writable
stores open. Fresh initialization permits only all-three-missing journals.
Preserve separate auth, Origin and strict body gates; 10/30-second input limits
do not change upstream processing deadlines or establish external-writer/file-race guarantees.
Preserve bearer authentication, routes/DTOs, install roots, CWD-relative journal
paths and scope/anchors. Retain known IDs and unresolved-write locks without
reinterpreting account/key ownership; do not move or merge databases implicitly.
The combined entry and relocated RN/Flutter clients exist; additional client/auth/store
folders are planned. Package/native identities, SDK pins and locks are preserved.
Old client READMEs forward to new setup; mobile backend launch bases, bearer
authorization, scope hashes and journals stay. Original UI/native-host `8787`
defaults and retained capture backend origin remain; configure the combined host
at the original origin rather than reset journals or rewrite capture identity.

Live responses and synthetic fixtures should follow their client's DTO contract.
Shared cloud features must preserve source identities and customer authorization.
Keep native capture journals separate from cloud processing intent, with SDK
receipt/exact-generation cleanup gates unchanged. Platform clients use plain
feature files, normal native UI and their own public facade models; a shared
backend contract does not imply identical SDK capabilities, full UI/device parity
or live acceptance. Device-only connection/status can run without a backend;
cloud content and authorized upload require it.
The core records syntactically valid returned job/session IDs before later reply
validation; awaited known-resource GET failures retain the same recovery identity
and uncertain action. Saved IDs remain metadata, not content/cleanup authority.

## Modes and platform support

- **Sample recordings:** in-memory synthetic data, no credentials, network,
  SDK initialization or device permission. Label the mode and generated results.
  Do not simulate a device transfer, signed receipt or cleanup success.
- **Customer backend:** explicit origin and separate application bearer token,
  retained in client memory. The server owns project/end-user configuration and
  the Bota API key. Sign-out clears content and fences late results.
- **React Native device path:** retain the Android encrypted-v2 host and its
  exact public beta.17 SDK. Open it explicitly from the live app; keep fresh
  identity/pairing, idle/no-direct-upload, generation and completion boundaries.
- **Flutter device path:** public beta.17 connection/status only. Its current
  facade lacks the fresh pairing and encrypted-upload host interfaces needed
  for this example's device sync. Do not bypass those gaps.

Keep existing exact beta.17 manifest/lock pins. Version adoption needs its own
public-contract/build/recovery evidence; do not assume a new version closes a
facade gap. Native Windows SDK support is
[planned upstream](https://github.com/bota-dev/app-sdk#supported-platforms);
it is a capability gap rather than only a missing example host.

This example supplies Android hosts. An iOS host, full platform parity and physical
qualification require separate implementation/evidence. API library access is
independent of device presence and grants no device-cleanup authority.

## User flow

1. Try sample recordings, or connect to a configured customer backend.
2. Open the recording library: readable title, date, duration and honest state.
3. Open one recording with Transcript, Summary and Ask views.
4. Refresh existing results by GET. Start a transcription/summary or ask a
   question only through an explicit action and its required source readiness.
5. Return to the library without losing uncertain-write locks. A known saved
   operation may be refreshed through GET; an unknown outcome must not be sent again.

Audio intake/playback and new integrated clients are tracked in the root roadmap.
Implement each platform's supported subset through normal native SDK UI; do not
require identical controls or invent an unavailable facade. Existing SDK-only
sources can teach connection/status without a backend. Device input remains
optional where the public contract supports the workflow; cloud-content access
does not depend on Bluetooth presence.

## Customer API contract

The current `/api/library` namespace uses selected snake_case DTOs, matching the
public Bota resource fields. It is separate from the existing native sync
routes and capture journal. Every live request uses the application bearer token.

| Customer route | Result / action |
| --- | --- |
| `GET /api/library/recordings?cursor=...` | `{data, has_more, next_cursor}`; fixed end-user filter, bounded pagination |
| `GET /api/library/recordings/:id` | Recording metadata after current project/end-user checks |
| `GET /api/library/recordings/:id/transcriptions` | `{data}`; completed content only after exact recording/source checks |
| `POST /api/library/recordings/:id/transcriptions` | Empty JSON body; verified upload, durable intent, known operation/result |
| `GET /api/library/transcriptions/:id/summaries` | `{data}` for the exact owned transcription/recording |
| `POST /api/library/transcriptions/:id/summaries` | Empty JSON body; completed transcript, `tmpl_general_notes`, durable intent |
| `POST /api/library/recordings/:id/ask` | `{question}`; one trimmed question, recording-scoped session and citations |
| `GET /api/library/operations` | `{data}` containing narrow saved-operation metadata |
| `GET /api/library/operations/:id` | Reconcile the known operation by GET; never resend its original write |

Operations have `id`, `kind`, `state`, `resource_id` and `updated_at`. Mutations
return an `operation`, plus verified `transcription`, `summary` or
`answer`/`citations` when available. Frontends validate source IDs and render
untrusted content as literal text. Backend ownership remains authoritative.

The separate library journal binds API origin, project/end user and key scope.
Claim before uncertain writes; retain known IDs and unknown outcomes across
restart. Existing native capture/session/generation journals and routes keep
their contracts. Credentials, audio, signed material and generated content are
not persisted in these journals. Production identity and deployment remain
customer responsibilities.

## Acceptance

- Both clients run sample mode without backend/device access and show the same
  recognizable library/detail journey.
- Live clients use only explicit customer routes with bounded HTTP, redirect
  refusal, safe error messages and credentials kept out of logs/storage.
- Selecting another recording, returning, signing out or disposing fences late
  results; uncertain writes remain locked; recovery is GET-only.
- Backend tests cover cross-owner/source rejection and durable write recovery;
  the existing native/device/security test chains remain required and unchanged.
- Frozen installs, appropriate analysis/typecheck, tests and Android builds
  establish source/build evidence. Live API/provider and device acceptance are
  recorded separately; fixtures do not qualify them.
- Update catalog, README, architecture and review with actual platform support.
- Treat a family feature as a feature, not a new install root or catalog entry.
  A copied integration includes its complete import graph, authorization and
  durable-state requirements; it is not necessarily one tiny file.
- Keep the integrated client's recording-user UI coherent and feature/public-call
  files copyable with their full imports. Guides link maintained feature code;
  retain useful distinct-runtime quickstarts and current advanced inventory.
  Do not add overlapping feature implementations or a universal UI/wrapper SDK
  to share concrete backend logic. SDK-only flows need no backend or forced
  full device parity.
