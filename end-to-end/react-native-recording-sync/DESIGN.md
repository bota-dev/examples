# Bota Recordings: common mobile sample clients

## Purpose and layout

This combined example contains independently installed React Native (`app/`)
and Flutter (`flutter/`) clients sharing one Node backend (`backend/`). They
belong to the same **Bota Recordings** family as the web client. The target
journey is audio input → library → supported playback → transcript → general
notes → Ask. Use familiar mobile navigation, ordinary platform controls and short
state messages. Public API/SDK recipes belong in README/source.

There are exactly two repository layers: general platform examples now, then
vertical use cases and consumer app types later. A common recording app belongs
to the general layer. Focused API/SDK recipes are secondary ways to learn a
public call, not another product layer or a reason to create overlapping apps.

Keep the existing directory and native sync implementation so published links
and recovery journals retain their meaning. Each client installs separately.
Sharing this example's backend does not permit imports from another example or
private Bota applications. Demo/Bota One inform the user journey only.

## Implemented subset and backend direction

| Capability | Current mobile implementation |
| --- | --- |
| Audio input | RN can sync an already-provisioned encrypted-v2 device recording. Neither client implements microphone capture or file import. Flutter has no device transfer in this example. |
| Library and results | Both clients show owned cloud recordings, transcripts, general notes and recording-scoped Ask. A live library needs existing authorized audio or RN device sync. |
| Playback | Not implemented. The target adds playback only for a supported, authorized audio representation. |
| Device SDK | Optional RN encrypted sync and Flutter connection/status, enabled explicitly in live mode. Their supported workflows differ. |
| Hosts | Android hosts are supplied. Common-app iOS hosts are missing; that is separate from the SDKs' iOS support. |
| Synthetic mode | Local DTO fixtures and synthetic results with no network or SDK work. They do not prove live processing, upload or cleanup. |

The target family uses one canonical customer backend. Today this mobile backend
and the web sample's backend are separate implementations with different local
routes/auth adapters. Consolidation belongs to the [root roadmap](../../ROADMAP.md)
and is not implemented. Preserve the current contract, bearer authentication,
install roots and journals until that migration is reviewed and verified. Do not
add another independent backend or invent a new catalog/metadata schema.

Live responses and synthetic fixtures should follow their client's DTO contract;
the planned canonical backend aligns those contracts across the family. Shared
DTO shapes do not imply identical SDK capabilities or live acceptance.

## Modes and platform support

- **Sample recordings:** in-memory synthetic data, no credentials, network,
  SDK initialization or device permission. Label the mode and generated results.
  Do not simulate a device transfer, signed receipt or cleanup success.
- **Customer backend:** explicit origin and separate application bearer token,
  retained in client memory. The server owns project/end-user configuration and
  the Bota API key. Sign-out clears content and fences late results.
- **React Native device path:** retain the Android encrypted-v2 host and its
  exact public beta.13 SDK. Open it explicitly from the live app; keep fresh
  identity/pairing, idle/no-direct-upload, generation and completion boundaries.
- **Flutter device path:** public beta.13 connection/status only. Its current
  facade lacks the fresh pairing and encrypted-upload host interfaces needed
  for this example's device sync. Do not bypass those gaps.

Keep existing exact beta.13 manifest/lock pins. Version adoption needs its own
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

Audio intake and playback gaps are tracked in the root roadmap. Device paths
remain optional where the published contract supports the selected workflow;
cloud-content access does not depend on Bluetooth presence.

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
