# Bota Examples: repository design

## Goal

Give customer developers code they can easily find, run and adapt to build
applications across supported platforms using the public Bota API and App SDK.
The example's architecture serves that goal; a single large app or a particular
number of small examples is not a requirement.

Success means a developer can choose a workflow and language/platform, locate
its public calls, run the smallest useful example, and identify the files and
application-owned pieces to copy or replace.

## Exactly two product layers

| Layer | Purpose | Scope |
| --- | --- | --- |
| 1. General platform examples | Teach public capabilities and common integration workflows | Current work: API workflows, platform SDK starters and optional end-to-end references |
| 2. Vertical and app-type examples | Compose those integrations around a specific user and workflow | Later work: sales visits, field-service reports, meeting assistants or other consumer app types |

API recipes, platform starters and reference apps are formats within Layer 1,
not additional product layers. Layer 2 remains later work.

## Chosen architecture: focused workflows plus platform starters

Keep one repository with three complementary formats:

| Format | Developer's question | Shape | Current location |
| --- | --- | --- | --- |
| API workflow | How do I upload/transcribe, read results, summarize, Ask or handle an event? | A small independently runnable server/CLI recipe, organized by meaningful workflow and language | [api/](api/) |
| Platform SDK starter | How do I use this SDK in my application on this platform? | A small idiomatic runnable host with plainly named feature files for supported device workflows | [app-sdk/](app-sdk/) |
| End-to-end reference | How do UI, SDK and customer backend fit together? | A thin, familiar recording app composing those capabilities, with backend code where needed | [end-to-end/](end-to-end/) |

API workflows and platform starters are first-class entry points. The reference
app is optional learning context and an adaptable starting point. A developer
must not need to understand its account model, backend DTOs or complete consumer
UI to use an SDK connection example or an API recipe.

Organize by a useful workflow rather than creating an install root for each
method, endpoint or export variation. Within a platform starter, extend focused
feature files when the same host/setup serves the task. Kotlin, Swift, React
Native, Flutter and Web are first-class SDK examples where public support exists.
Use platform-native controls, permissions, tooling and languages; identical UI
or feature parity is not required.

The current paths and catalog IDs stay valid. The one-starter-per-facade target
is a maintenance direction, not a claim that existing connection/catalog roots
are already consolidated. Add hosts or consolidate roots only with compatibility,
README, catalog and CI changes. No empty proposed directories enter the index.

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

Curate these paths in the README with direct source links and platform/language
choices. Keep configuration, firmware, observation and export variants available
in the extended inventory. Add a new example when it fills a real developer gap
or explains a materially different integration; catalog count is not a target.

## Readability, independence and sharing

- Show the actual public API/SDK call in plain feature code. Keep its runnable
  harness and setup small; do not hide the lesson behind a generic wrapper.
- Name inputs, results and required helpers. Document the complete import graph
  and application-owned auth, identity, storage and UI pieces a developer replaces.
- A focused example installs independently without private repositories, root
  package installation or another example's runtime files.
- Repeat short setup/HTTP/UI glue across independent languages/platforms when
  that keeps an example self-contained. Share tooling, fixtures and conventions
  only where they reduce real maintenance; do not invent a framework.
- Substantial repeated feature logic within the end-to-end references can use
  one concrete sample backend. This is not a new API SDK or a mandatory service
  for standalone SDK/API examples. Backend consolidation needs its own compatible
  auth/DTO/journal plan and does not block useful platform coverage.
- Keep exact public package pins, installation guards and source-level ownership,
  durable uncertainty and lifecycle safeguards. Small must not mean unsafe.

## Optional app reference

Bota Recordings, inspired by Demo/Bota One, shows how these integrations serve
an end user. Its intended flow is import/device input → library → supported
playback/source review → transcript → general notes → recording-scoped Ask.

Use a compact library, a recording detail/player with Transcript/Notes/Ask,
optional supported Devices controls and separate setup/account screens. Ordinary
controls serve the recording user's task. API endpoints and copy instructions
belong in README/source; technical request metadata stays secondary. A focused
SDK demo can have only a device picker, status and recording controls appropriate
to the capability it teaches.

Playback and ordinary mobile import are useful reference-app work, not a gate
for every API/SDK example. Qualify media formats, ownership, expiry and encryption
before claiming playback: original bytes or URL issuance do not prove playable
or decrypted audio. Microphone capture is optional. No full Bota One replica,
production account product or forced cross-platform consumer-app parity is needed.

## Current implementation versus target

| Area | Available now | Important gap |
| --- | --- | --- |
| API workflows | Node/Python workflow recipes and an extended inventory | Curated entry points, clearer copy boundaries and consistent evidence remain ongoing work |
| SDK starters | RN Android/iOS connection; Flutter Android connection; Kotlin Android and Swift macOS connection/catalog; desktop Chromium connection | Native Swift iOS and Flutter iOS hosts are missing; supported workflow coverage varies |
| React web reference | Audio import, library, Transcript/Summary/Ask, synthetic mode and configured API path | Playback is missing; web is API-only |
| RN/Flutter Android references | Cloud library/results/Ask, sample mode and one shared mobile backend; optional RN encrypted-v2 sync or Flutter connection/status | Ordinary import/playback and common-app iOS hosts are missing; Flutter lacks the selected encrypted-sync facade contract |
| Reference backend | Separate web backend and shared mobile backend | Concrete feature duplication; a common reference backend is planned, not implemented |
| Windows | API web app and supported Chromium Web Bluetooth sample | Native Windows/Electron device SDK support is planned upstream |

Keep SDK capability, implemented host and verification as separate facts.
Current independent device examples pin public beta.13; legacy `apps/` remains
beta.6 compatibility code with its local-only authentication/provisioning limits.
No package update, runtime consolidation, device operation or state migration
is part of this architecture clarification. Source, build, live API and hardware
evidence remains specific to each README and the
[implementation review](docs/independent-examples-review.md).

## Acceptance

Each core example identifies the workflow, supported platform, direct public-call
files, prerequisites, run/check commands, expected result, copy/replace boundaries
and recovery limits. Appropriate CI checks install/build and important behaviors
without live credentials or hardware. Synthetic output is labelled and proves
no live service or physical result. Resource identities stay configurable and
server secrets never enter clients or committed fixtures.

[ARCHITECTURE.md](ARCHITECTURE.md) owns integration boundaries;
[ROADMAP.md](ROADMAP.md) orders work;
[the architecture decision](docs/design-decisions/2026-10-12-example-architecture.md)
records the tradeoffs. This document is the current product direction.
