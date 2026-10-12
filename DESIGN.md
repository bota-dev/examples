# Bota Examples: repository design

## Purpose

Help customer developers build applications for their own end users with the
public Bota API and App SDK. The main template is **Bota Recordings**, a familiar
recording app inspired by Demo and Bota One. It should be useful to run, easy to
adapt and small enough to maintain across platforms.

The app demonstrates an ordinary user journey. Its source and documentation
explain the integration. It is a demo/sample/template, not a complete Bota One
replacement, production SaaS starter or new API SDK.

## Exactly two layers

| Layer | Purpose | Scope |
| --- | --- | --- |
| 1. General platform capabilities | Show the common recording journey and the public calls needed to build it | Current work: Bota Recordings, focused SDK/device workflows and curated public API recipes |
| 2. Vertical and app-type examples | Adapt those capabilities to a particular end-user workflow | Later work: sales visits, field-service reports, healthcare notes, meeting assistants or personal voice notebooks |

Templates, SDK samples and API recipes are formats within Layer 1. They are not
additional layers. Layer 2 composes the general integrations after the baseline
is coherent; it does not drive new implementations in the current phase.

## One template family

Maintain one Bota Recordings family with React web, React Native and Flutter
clients. Give each client normal platform controls and navigation, while keeping
the same user journey and feature meaning. Device input is optional where the
published facade supports it. A developer should be able to start the common app
without owning hardware.

The minimum complete baseline is:

**Import ordinary audio → recording library → supported audio playback and
source review → transcript → general notes → recording-scoped Ask.**

Import and verified upload completion precede processing. Transcription, general
notes and Ask are explicit actions with clear readiness and progress. Source
review connects results to their recording and, where available, timed transcript
excerpts. Playback supports only the media formats and authorized delivery path
that the template documents; original-byte download does not establish playable
or decrypted audio. Microphone capture is an optional later enhancement.

The everyday UI serves a person finding recordings, listening and reading
results. Show titles, dates, durations, useful progress, content and clear
actions. Completed request metadata belongs in a secondary collapsed view.
API endpoints, copy instructions and operator recovery details belong in the
README/source. Keep errors and uncertain outcomes visible without encouraging
duplicate processing.

Use a small, concrete screen structure:

- **Library:** recording list, refresh and an ordinary audio import entry.
- **Recording detail:** supported audio player/source context, then
  Transcript, Notes and Ask views for the selected recording.
- **Devices:** an optional separate screen for capabilities supported by the
  published facade and current host; return to the library after supported sync.
- **Setup/account:** sample/live choice and authentication, separate from the
  everyday recording task. Show useful pending/uncertain progress in context;
  keep technical request tables secondary.

## One customer feature backend: planned

The target has one canonical implementation of common recording features behind
all three clients. It calls public Bota APIs, holds secret keys and derives the
Bota end-user mapping from the customer's authenticated application identity.
Keep the identity adapter replaceable; this repo does not need to build a new
account-management product.

Before consolidation, define the shared recording/transcription/notes/Ask DTOs,
resource ownership, application authentication adapters, operation status and
media delivery contract. Web cookies and mobile application Bearer tokens may
remain different transport adapters. The feature logic and authorization
meaning should be consistent.

This backend is **planned, not implemented**. The current web backend and the
shared mobile backend are separate implementations with overlapping logic and
some different routes/DTOs. Consolidate conservatively after the contract is
defined. Preserve existing links, owner/source checks, journals and unresolved
write intent. Do not move state, erase uncertainty or allow a second write as a
side effect of migration.

The existing `api/`, `app-sdk/` and `end-to-end/` paths remain in place during
this design reset. Any future `templates/recordings/` layout is a proposal, not
an existing directory. `apps/` is the retained legacy workspace; it is not the
destination for the new family.

## Small supporting recipes

Keep a curated API cookbook for upload/transcription, listing and reading,
general notes, recording-scoped Ask, webhooks and authorized original downloads.
Keep focused App SDK examples for connection/status, recording metadata and
supported device transfer/lifecycle steps. Each recipe should identify the public
call, its inputs, the required helper files and the customer-owned boundary.

A runnable template can use shared helpers inside its install root. A small
recipe must not be described as a single-file copy when it imports authentication,
ownership, HTTP or durable-state helpers. Explain what to copy and what to replace.
Do not introduce cross-example runtime imports or an example-only framework.

The extended catalog remains an inventory. Stop count-driven expansion and
prefer improving an existing recipe over creating another install root for an
export, configuration reader or observer variant. A new example needs a concrete
developer need, a supported public contract and a maintenance benefit beyond
the existing code.

## Current implementation and gaps

| Implementation | Runnable today | Missing from the baseline |
| --- | --- | --- |
| [React web](end-to-end/web-reference/README.md) | Audio import, library, Transcript/Summary/Ask, synthetic demo and scoped live API mode | Audio playback/source listening; canonical shared backend |
| [React Native Android](end-to-end/react-native-recording-sync/app/README.md) | Local sample recordings or live cloud library, Transcript/Summary/Ask; optional already-provisioned encrypted-v2 device sync | Ordinary audio import, playback and iOS host; canonical shared backend |
| [Flutter Android](end-to-end/react-native-recording-sync/flutter/README.md) | Local sample recordings or live cloud library, Transcript/Summary/Ask; optional device connection/status | Ordinary audio import, playback and iOS host; public facade does not support the RN encrypted-sync workflow |

These are runnable **partial implementations**, not the completed journey. The
web app is API-only. RN and Flutter share the current mobile backend, but they
do not share the web backend. Sample content is synthetic; successful fixture
actions prove no live upload, provider result or physical-device behavior.

Focused Kotlin/Android and Swift/macOS connection/catalog examples teach native
SDK integration. They are not full duplicate consumer apps. Add bounded device
workflows before considering another full UI, and require a concrete customer
need for such duplication. Existing React Native connection builds include an
iOS host; that does not provide an iOS host for Bota Recordings.

Windows users can use the API web app. The separate Web SDK connection example
requires desktop Chromium and supported Web Bluetooth/browser/OS behavior.
Native Windows/Electron App SDK support is planned upstream; this repo supplies
no public native Windows recording host.

Independent device examples remain pinned to published **2.0.0-beta.13**. Do not
change that pin as part of documentation or layout work. Per-example READMEs and
the [implementation review](docs/independent-examples-review.md) distinguish
source, build, live API and physical-device evidence. The legacy `apps/` pair
remains isolated compatibility code with its documented authentication and
provisioning limits; it is not the recommended customer backend.

## Quality and acceptance

- Use public packages and public API contracts; no private Bota app dependencies.
- Keep Bota keys on the server. Verify exact owner/source relationships before
  exposing recordings, content, media or citations.
- Separate cloud upload commitment, device cleanup and processing. Legacy
  `uploaded` alone is not verification proof or cleanup authority.
- Retain intent before uncertain writes. Known resources permit GET recovery;
  an unknown outcome does not permit automatic replacement POSTs.
- Bound requests, responses and list traversal. Fence late results after
  selection changes, account reset or logout, including device teardown.
- Keep sample mode explicit and runnable without credentials, hardware or
  external calls. Keep sample and live evidence separate.
- Keep installation instructions, required security scripts and published SDK
  pins accurate. Add meaningful tests for ownership, uncertainty and state
  handling; run the selected platform's appropriate build checks.
- Describe incomplete contracts and unavailable verification honestly. Passing
  source or build checks does not establish live or hardware conformance.

The [roadmap](ROADMAP.md) orders the remaining work.
[ARCHITECTURE.md](ARCHITECTURE.md) defines technical boundaries and acceptance
gates; [AGENTS.md](AGENTS.md) governs changes. This document is the authoritative
product direction for the repository.
