# Bota Examples roadmap

The goal in [DESIGN.md](DESIGN.md) is easy-to-use SDK/API code across platforms.
Use focused API workflows and small platform starters as first-class entry
points, with end-to-end references for application composition. General
capabilities are the current product layer; vertical/app-type examples come later.

## 1. Make the developer entry path clear

Lead with workflow → language/platform → source → run/adapt instructions.
Curate the core paths: connection/status/loss, recording metadata/supported
transfer, import/transcription, results/notes, scoped Ask and webhooks/recovery.
Keep the extended catalog and existing paths/IDs. Explain a feature's required
helpers and replaceable customer-owned pieces; do not describe an entire guarded
feature graph as a single-file snippet.

**Acceptance:** README and agent guidance direct an API task to its recipe,
an SDK task to its platform starter, and an application task to a reference.
Each core entry links actual public-call source, setup and evidence. No root
install, private sibling repository or example framework is required.

## 2. Fill useful SDK platform and workflow gaps

Kotlin, Swift, React Native, Flutter and Web examples have equal importance.
Complete small supported host/workflow paths; prioritize missing Swift iOS and
Flutter iOS hosts alongside documented RN iOS support. Use ordinary platform
code and focused connection/status/recording feature files. Extend an existing
starter where its setup already fits; do not create another root per SDK method.

Keep capability, host and verification separate. Flutter's selected facade
cannot provide the RN encrypted-sync path; adding an iOS host or bumping a
version does not solve that contract gap. Web Bluetooth is limited to supported
desktop Chromium environments. Native Windows device examples depend on the
upstream public SDK; the API web sample already serves Windows users.

**Acceptance:** a developer can install/build the host and locate the public SDK
calls for its declared workflow. Permissions, device identity, lifecycle and
native cleanup tests cover important boundaries. Record physical claims only
for the tested package/OS/device/firmware. This work does not wait for every
reference client to implement import, playback or a full consumer UI.

## 3. Improve the curated API workflows

Keep independent Node/Python server examples for the core calls and meaningful
workflows. Improve existing recipes before adding another export/observer
variant. Expose direct integration functions, a small CLI/server harness,
configuration and full helper requirements. Preserve honest scope: a one-shot
script with documented manual recovery is not a durable resume service.
The existing upload/transcription CLI has no durable journal; that is a current
limitation, not evidence of pre-write intent conformance. New or extended write
workflows still need the required intent/reconciliation safeguards. Never remove
an existing journal or treat another invocation as safe recovery from uncertainty.

**Acceptance:** each recipe demonstrates its stated input → public calls →
result with bounded requests, authorized sources, safe credential handling and
clear uncertainty recovery. Syntax, behavioural tests and live evidence remain
separate. New roots require a distinct developer need and maintenance rationale.

## 4. Improve end-to-end references when they add learning value

Keep Bota Recordings as a familiar app-composition reference. Add ordinary input
and qualified playback where that makes the existing reference useful. Its web,
RN and Flutter clients need not demonstrate identical device capabilities or
wait for each other to deliver a useful example.

The separate web/mobile backends have substantial overlapping processing/Ask
logic. Define the small common feature, ownership and operation contract before
consolidating that logic behind their existing cookie/Bearer adapters. Reuse one
concrete sample backend where it reduces maintenance; it is optional to standalone
SDK/API examples. Keep cloud intent and native capture journals separate,
preserving scope, IDs, paths, anchors and unresolved writes. No cosmetic folder
move or new unofficial API SDK is a prerequisite.

**Acceptance:** the reference demonstrates an understandable declared end-user
flow and documents its gaps. If a backend is shared, every affected client and
auth/store adapter has compatibility evidence. Media playback requires a
supported public representation, owner checks and safe expiry/errors. Reference
improvements must not delay an independently useful API/SDK sample.

## 5. Add vertical and app-type examples later

Select a concrete user/workflow, then compose the qualified general integrations
around it. Reuse relevant features; do not clone all clients/backends for every
scenario. Choose the platforms needed by that use case.

**Acceptance:** a named user, meaningful workflow, supported public contracts,
clear reuse/adaptation points and a maintenance rationale. This roadmap does
not implement or approve a particular vertical app.

## Delivery rules

Current source paths, catalog entries, locks and SDK pins stay unchanged during
this design clarification. Consolidation or moves require compatible links,
catalog/workflow updates and preserved state; legacy retirement retains its
existing gates. Do not erase uncertainty, weaken cleanup/ownership safeguards,
add speculative hosts or claim platform parity from a connection build.

Run the selected example's appropriate checks. For shared changes, exercise all
affected consumers; default CI uses no live credentials, hardware mutation or
deployment. Record actual source, build, live and physical evidence separately.
See [ARCHITECTURE.md](ARCHITECTURE.md), [AGENTS.md](AGENTS.md) and the
[architecture decision](docs/design-decisions/2026-10-12-example-architecture.md).
