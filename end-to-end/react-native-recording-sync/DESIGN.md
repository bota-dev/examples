# Common mobile recording app sample

## Purpose and layout

One combined example contains independent React Native (`app/`) and Flutter
(`flutter/`) clients and one customer Node backend (`backend/`). Both clients
serve the same general recording user: choose a recording, read its transcript
and summary, and ask about its content. Use familiar mobile navigation, ordinary
platform controls and short state messages. Public API/SDK recipes belong in
README and source. This is repository Layer 1; vertical workflows remain later work.

Keep the existing directory and native sync implementation so published links
and recovery journals retain their meaning. Each client installs separately.
Sharing this example's backend does not permit imports from another example or
private Bota applications. Demo/Bota One inform the user journey only.

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

This pass supplies Android hosts. An iOS host, full platform parity and physical
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

No microphone capture or audio playback is added in this pass. Device-synced
audio or an existing authorized cloud recording supplies the live library.

## Customer API contract

The new `/api/library` namespace uses selected snake_case DTOs, matching the
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
