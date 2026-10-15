# Bota Recordings: common sample app

## Purpose

A familiar recording sample for customer developers to run, learn from and
adapt for their own end users, inspired by Demo and Bota One. This is the current
web client of the integrated **Bota Recordings** foundation: one shared customer
backend, platform clients and copyable features. Client targets include React
web, RN, Flutter, native Android/Kotlin and Apple/Swift. The
[combined backend](../recordings/README.md) now composes the existing Web/mobile
factories on one listener with original journals/auth/DTOs retained. Integrated
Complete [Flutter](../recordings/clients/flutter/README.md) and
[RN](../recordings/clients/react-native/README.md) clients are relocated under
`recordings/clients/`. Web/backend paths stay; integrated Kotlin/Swift recording clients are not built.

The recording experience is audio input → library → supported playback/source
review → transcript → general notes → recording-scoped Ask. Use normal platform
UI and actual published capabilities; shared cloud features do not require
identical UI, SDK models or full device parity. Device-only connection/status
does not require a backend, while cloud features and authorized upload do.

Exactly two repository layers remain: general capabilities now, then vertical
use cases and app types later. This integrated sample and its focused guides
belong to the general layer. Guides/snippets link maintained feature modules;
a few standalone quickstarts serve distinct languages/runtimes. Current catalog
paths remain intact. The [approved decision](../../docs/design-decisions/2026-10-12-integrated-recordings.md)
defines the foundation. `end-to-end/recordings/backend/` now contains the shared
core and combined launcher; the rest of the target client/auth/store layout
remains planned. Fresh peer claims refuse known/complete intent without Web ID
adoption; own GET recovery remains available. Preserve original state preflight,
credential/input boundaries and the absence of external-writer guarantees.

## Implemented subset and target

| Capability          | Current web implementation                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Audio input         | Import a supported audio file through the customer backend. No microphone capture.                    |
| Library and results | Recording list/detail, explicit transcription, general notes and recording-scoped Ask.                |
| Playback            | Not implemented. The target adds playback only for a supported, authorized audio representation.      |
| Device SDK          | Not integrated. The separate browser connection sample does not make this app a device-sync template. |
| Synthetic mode      | In-process API fixtures and synthetic results; no external upload/provider/device acceptance.         |

The [root roadmap](../../ROADMAP.md) owns the remaining integrated-sample/platform work.
Do not describe target features as available controls or add overlapping app
roots to satisfy a coverage count.

## Backend direction

Recording, processing and Ask public calls now live in
[canonical feature modules](../recordings/backend/features/recordings.mjs), with
shared [errors](../recordings/backend/errors.mjs). This server's feature files
are compatibility shims. The mobile backend imports the same implementation.
Web upload/webhook, HTTP/auth and store modules remain local, composed by the
combined listener with separate cookie/Bearer adapters and all three journals.
Older launchers remain compatibility entries. Preserve cookie/account authentication, routes/DTOs,
upload/job/Ask journals and webhook acceptance; do not silently redirect clients.

The web shims explicitly permit omitted `project_id` for the legacy response
contract, but a supplied project must match. Exact recording owner, source chain,
session membership and citations remain required. Mobile uses the core's default
strict recording/job project checks. The web projection preserves its existing
operation-only mutation and summary DTO shape. Core checks/IDs do not authorize
content without the selected adapter's current principal/source gates.

Use the full repository checkout, or copy this compatibility root together with
`end-to-end/recordings/backend/` and the complete imports. Copying the web folder
alone no longer produces a runnable app. Standalone API/App SDK quickstarts
remain self-contained.

The combined host adds in-process processing/Ask arbitration and peer-intent
refusal, isolated credential/body/Origin gates and original-state preflight.
It preserves server-owned auth/principal mapping and routes/DTOs, retains
journal scope/anchors and known IDs, and preserve unresolved-write locks. A new
account/key/store must not reinterpret an old operation or permit replacement
writes. Native capture state remains separate from cloud processing intent;
shared backend status cannot replace SDK receipt/exact-generation cleanup gates.
Align live responses and synthetic fixtures with the reviewed cloud contract and
exact source identities. Platform SDK models remain idiomatic to their public
facades. Fixture agreement proves neither live API/provider nor hardware success.
Syntactically valid returned job/session IDs are retained before further reply
validation. Awaited known-resource GET failures preserve recovery identity and
uncertainty; they never authorize a replacement write. Web 401/403/404 responses
withhold operation metadata as well as content.

## Experience

- Compact header: **Bota Recordings**, **Sample app** badge, demo/live indicator
  and account/sign-out controls.
- Recording library: title, date, duration and concise state in each row;
  **Upload audio** and Refresh actions. Show the actual selected file before upload.
- Recording detail: title/metadata, then **Transcript**, **Summary** and **Ask**
  tabs. Display one feature at a time with explicit processing actions.
- Short loading, empty, pending and failure states. Use a simple selection prompt
  before a recording is opened; no hero or oversized blank illustration.
- Narrow screens show the library or the selected detail with a Back action.
  Keyboard users can select tabs and return to the library.
- **Activity** is a secondary, initially collapsed panel for saved-operation
  GET reconciliation and webhook metadata. It never resends a write or displays
  recovered answer content.

Use white/gray surfaces, system sans-serif text, modest spacing, clear buttons,
visible focus and useful contrast. Avoid editorial headlines or ornamental
metadata. Keep API endpoints, documentation links and source recipes in README
and code, outside everyday recording controls.

## Boundaries

Keep each integration focused and expose its public calls in README/source.
An integration can span feature, HTTP, auth, verification and durable-state
modules; document the complete import graph needed to adapt it. Do not present
an Ask entry file as a tiny, independently usable integration. Label synthetic
results clearly. Render untrusted transcript/summary/Ask strings as text. Preserve
account/scope fences, action locks and honest uncertain-outcome states. Never
expose API credentials or internal error details in product UI.

The integrated sample should remain useful to its end user rather than become
an API Explorer. Keep web intake/playback gaps honest and make maintained feature
modules easy to locate and copy with their full imports. Kotlin/Swift and other
clients use normal native UI and supported SDK calls; device-only flows can run
without a backend and do not wait for identical app coverage. Retain existing
quickstarts/catalog sources, but prefer a guide linked to a maintained feature
over another overlapping implementation. No universal UI framework, wrapper SDK
or private runtime dependency is introduced to share concrete backend logic.

Use normal platform UI and published public SDK surfaces for optional device
paths. The [Web SDK contract](https://github.com/bota-dev/app-sdk/tree/v2.0.0-beta.18/frameworks/web)
targets foreground desktop Chromium, a secure context and compatible device
Identity service; API-only browser use and browser Bluetooth have different
boundaries. The [October 14 adoption review](../../docs/design-reviews/2026-10-14-beta18-sdk-adoption.md)
records the beta.18 package update separately from this API-only client.
Connection/catalog samples do not establish complete app parity or hardware
acceptance. Vertical workflows and production identity/deployment remain later
or customer-owned work, respectively.
