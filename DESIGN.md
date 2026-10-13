# Bota Examples: repository design

## Goal

Give customer developers code they can easily find, run and adapt to build
applications across supported platforms using the public Bota API and App SDK.
The approved architecture is one integrated Bota Recordings sample foundation
with a shared customer backend, platform clients and copyable feature modules.
Small standalone quickstarts remain where they teach a distinct integration.

Success means a developer can choose a workflow and language/platform, locate
its public calls, run the smallest useful example, and identify the files and
application-owned pieces to copy or replace.

## Exactly two product layers

| Layer | Purpose | Scope |
| --- | --- | --- |
| 1. General platform examples | Teach public capabilities and common integration workflows | Current direction: build the integrated Recordings foundation and platform feature modules; retain useful standalone quickstarts |
| 2. Vertical and app-type examples | Compose those integrations around a specific user and workflow | Later work: sales visits, field-service reports, meeting assistants or other consumer app types |

The sample app, feature modules and standalone quickstarts are formats within
Layer 1, not additional product layers. Layer 2 remains later work.

## Approved architecture: one integrated sample foundation

Maintain one concrete Node customer backend for the general API workflows and
normal platform clients for the published App SDKs. The backend centralizes
recording ownership, uploads, transcription, summaries, scoped Ask and webhook
integration. Its browser-cookie and mobile-bearer adapters derive the caller's
authorized principal; clients never hold Bota secret keys.

The target layout is **partially implemented**. Shared recording, processing and
Ask modules and contract tests now exist in `end-to-end/recordings/`. Auth,
persistence and client relocation, plus one executable backend, remain planned:

```text
end-to-end/recordings/
  backend/
    features/
      recordings/ uploads/ transcriptions/ summaries/ ask/ webhooks/
    auth/                       # Browser-cookie and mobile-bearer adapters
    persistence/                # Scoped stores and separate durable journals
  clients/
    web/ react-native/ flutter/ android-kotlin/ apple-swift/
  contracts/                    # Narrow DTOs and synthetic contract fixtures
```

Each client has its own language, package manager, normal UI, permissions and SDK
lifecycle. It builds independently and declares only its implemented and
qualified capabilities. A connection/status module can run without the backend
or a complete recording UI. Native Kotlin and Swift clients begin with the
smallest useful public-SDK host; cloud features can be added where they teach a
useful integration. Identical UI and full feature parity are not requirements.

Developers can run a client, inspect one feature or copy a bounded workflow
without adopting the entire app. Put direct public calls in plain feature files,
with the smallest runnable harness and explicit required helpers. Link focused
snippets to this maintained code where useful instead of creating an install
root for every SDK method or API endpoint. Retain Node/Python quickstarts when
their language or standalone workflow adds distinct value.

Current `api/`, `app-sdk/` and `end-to-end/` paths, catalog IDs and installation
instructions stay valid until compatible migration is implemented. These are
existing formats within Layer 1. The first consolidation moves duplicated cloud
features into one maintained core with compatibility exports; it creates no
empty future client directories and preserves existing runtime launchers.

## Core teaching paths

1. Connect to a device, verify identity, read status and handle disconnect.
2. Read device recordings; transfer and confirm only through supported SDK and
   backend contracts. Metadata access does not grant cleanup authority.
3. Import ordinary audio, verify upload completion and request a transcription.
4. List/read owned recordings and results; generate general notes from an exact
   completed transcription.
5. Ask about one recording with exact source/citation scope and recover known
   operations without repeating uncertain writes.
6. Receive authenticated events and refresh current authorized resource state.

Curate these paths in the README with direct feature-source links and
platform/language choices. Keep configuration, firmware, observation and export
variants available in the existing inventory. Improve the shared foundation and
useful quickstarts instead of expanding toward a catalog count.

## Readability, independence and sharing

- Show the actual public API/SDK call in plain feature code. Keep its runnable
  harness and setup small; do not hide the lesson behind a generic wrapper.
- Name inputs, results and required helpers. Document the complete import graph
  and application-owned auth, identity, storage and UI pieces a developer replaces.
- The integrated foundation must be self-contained in this public repository. A
  standalone quickstart still installs independently without root installation,
  private repositories or another example's runtime files. SDK-only modules do
  not require the shared backend.
- Share concrete API integration code in the backend and DTO/fixture contracts
  among its clients. Keep cross-language UI and SDK lifecycle implementation
  native; share concepts rather than imposing a universal controller/UI package.
- Short local setup/HTTP/UI glue can repeat where this keeps a module easy to
  understand and adapt. Do not turn the sample into a new Bota API SDK, generic
  proxy or framework that customers must adopt.
- Consolidate the existing backend features with explicit auth/store adapters
  before moving folders. Preserve routes, DTOs, principal scope, journal paths,
  IDs, anchors, uncertainty and native receipt authority; no naive database merge.
- Keep exact public package pins, installation guards and source-level ownership,
  durable uncertainty and lifecycle safeguards. Small must not mean unsafe.

## Ordinary recording UI

Bota Recordings, inspired by Demo/Bota One, is the foundation's common app
experience. Its intended flow is import/device input → library → supported
playback/source review → transcript → general notes → recording-scoped Ask.

Use a compact library, a recording detail/player with Transcript/Notes/Ask,
optional supported Devices controls and separate setup/account screens. Ordinary
controls serve the recording user's task. API endpoints and copy instructions
belong in README/source; technical request metadata stays secondary. A focused
SDK demo can have only a device picker, status and recording controls appropriate
to the capability it teaches.

Playback and ordinary mobile import complete the recording app, but are not
gates for useful SDK modules or missing platform hosts. Qualify media formats,
ownership, expiry and encryption before claiming playback: original bytes or
URL issuance do not prove playable
or decrypted audio. Microphone capture is optional. No full Bota One replica,
production account product or forced cross-platform consumer-app parity is needed.

## Current implementation versus target

| Area | Available now | Important gap |
| --- | --- | --- |
| API workflows | Node/Python workflow recipes and an extended inventory | Curated entry points, clearer copy boundaries and consistent evidence remain ongoing work |
| SDK starters | RN Android/iOS connection; Flutter Android connection; Kotlin Android and Swift macOS connection/catalog; desktop Chromium connection | Native Swift iOS and Flutter iOS hosts are missing; supported workflow coverage varies |
| React web reference | Audio import, library, Transcript/Summary/Ask, synthetic mode and configured API path | Playback is missing; web is API-only |
| RN/Flutter Android references | Cloud library/results/Ask, sample mode and one shared mobile backend; optional RN encrypted-v2 sync or Flutter connection/status | Ordinary import/playback and common-app iOS hosts are missing; Flutter lacks the selected encrypted-sync facade contract |
| Shared backend target | One recording/processing/Ask implementation in the integrated core, used by existing web/mobile adapters | Two listeners and separate auth/stores remain; shared write arbitration, upload/webhook consolidation and client relocation are not implemented |
| Windows | API web app and supported Chromium Web Bluetooth sample | Native Windows/Electron device SDK support is planned upstream |

Keep SDK capability, implemented host and verification as separate facts.
Current independent device examples pin public beta.13; legacy `apps/` remains
beta.6 compatibility code with its local-only authentication/provisioning limits.
The first runtime consolidation preserves SDK pins, device behavior and journal
locations. The core has pinned development tools and no runtime dependencies.
See the [core entry point](end-to-end/recordings/README.md) and
[consolidation review](docs/design-reviews/2026-10-12-integrated-recordings.md).
Source, build, live API and hardware evidence remains specific to each README
and the [implementation review](docs/independent-examples-review.md).

## Acceptance

Each core example identifies the workflow, supported platform, direct public-call
files, prerequisites, run/check commands, expected result, copy/replace boundaries
and recovery limits. Appropriate CI checks install/build and important behaviors
without live credentials or hardware. Synthetic output is labelled and proves
no live service or physical result. Resource identities stay configurable and
server secrets never enter clients or committed fixtures.

Backend consolidation is accepted only after both current auth models and all
affected route/DTO/store contracts retain compatible behavior. Existing cloud
intent and native capture/session journals remain separate, and unresolved
writes retain their recovery path. Platform feature delivery can proceed without
waiting for full recording-app parity; SDK upgrades and hardware operations are
outside this architecture migration.

[ARCHITECTURE.md](ARCHITECTURE.md) owns integration boundaries;
[ROADMAP.md](ROADMAP.md) orders work;
[the approved architecture decision](docs/design-decisions/2026-10-12-integrated-recordings.md)
records the tradeoffs. This document is the current product direction.
