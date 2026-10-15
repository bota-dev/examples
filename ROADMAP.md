# Bota Examples roadmap

The goal in [DESIGN.md](DESIGN.md) is easy-to-use SDK/API code across platforms.
The approved direction is one integrated Recordings sample foundation with a
shared Node backend, platform clients and copyable feature modules. Retain useful
standalone Node/Python quickstarts. General capabilities are the current product
layer; vertical/app-type examples come later.

The separately requested [October 14 SDK adoption](docs/design-reviews/2026-10-14-beta18-sdk-adoption.md)
updates all device SDK clients to public beta.18. It does not complete missing
platform hosts or the remaining consolidation below.

## 1. Consolidate the existing backend features compatibly

**Implemented:** shared recording/processing/Ask features and the
[combined launcher](end-to-end/recordings/README.md) compose existing service
factories on one Node listener. Cookie/Bearer adapters, routes/DTOs and all three
journals remain intact. Original absolute paths, schema/index/scope and configured
account mapping validate before writable startup; explicit fresh initialization
requires all journals absent. Mixed credentials are rejected. Processing/Ask
claims coordinate in this process and refuse matching peer intent, even known or
complete, without Web peer-ID adoption. Existing own GET recovery and exact
native/library known-ID reconciliation remain.

**Qualification:** stop old listeners and verify the combined auth/input,
development-file denial, retained-state and startup/shutdown contracts on every
affected consumer. The common 10/30-second incoming header/body limits are
stricter than standalone Web; upstream processing deadlines are unchanged.
Other writers and concurrent filesystem changes remain outside these guarantees.

Use compatibility routes and persistence adapters before moving files or
merging storage. Preserve configured scope, account/resource IDs, existing
journal paths, hashes, anchors, known operations and unresolved writes. Ordinary
cloud intent and native capture/session journals remain separate. Keep SDK
receipt, generation, cleanup and lifecycle gates unchanged. This is sample
feature reuse, not a new API SDK, generic proxy or authentication product.

**Acceptance:** both current backend adapters and all affected clients retain
compatible routes/DTOs and auth/store behavior. Tests exercise ownership and
source isolation, uncertainty recovery and existing native host-callback
boundaries. No uncertain operation is lost or replayed. Report the combined
listener's source/local/hosted evidence separately from production or hardware
acceptance. SDK version upgrades and hardware operations are
outside this work.

## 2. Maintain relocated mobile clients and qualify further moves

Connect the web, React Native and Flutter clients to the shared backend through
their existing auth adapters. Preserve independent manifests, locks, native
identities and install/build instructions. Expose actual public calls in plain
backend/client feature files, with narrow contract fixtures shared where useful.
Keep UI, permissions and SDK lifecycle native to each platform.

**Mobile clients relocated:** complete Flutter and RN Android install roots now
live at `end-to-end/recordings/clients/flutter/` and `clients/react-native/`.
Their license helpers/native/vendor/guard graphs, CI/Dependabot/discovery paths
and old README forwarding entries move together. Native identity, SDK pins and
locks are unchanged. Client/native-host origins retain `8787` defaults; preserve
the original origin for retained capture recovery. The combined host supports
`PORT=8787` with matching `APP_ORIGIN`, while fresh cloud setup may explicitly
use `5173`. Never reset journals or change capture identity to fit the move.
Original Web/mobile backend launch bases and journals stay put.

Web remains coupled to Vite/static/state paths. Further moves require compatible
source/build gates and updated links/install instructions; no new UI or universal
model layer is needed.

Lead the README with workflow → language/platform → source → run/adapt
instructions. Curate connection/status/loss, recording metadata/supported
transfer, import/transcription, results/notes, scoped Ask and webhook/recovery.
Document required helpers and replaceable customer-owned pieces; do not call a
guarded feature graph a single-file snippet. Source snippets should link to the
maintained feature modules when beneficial, rather than multiply install roots.

Retain existing Node/Python quickstarts where standalone execution or another
language teaches a distinct workflow. Improve their scope and recovery guidance.
The existing upload/transcription CLI has no durable journal; this remains a
limitation, not pre-write intent conformance. Never remove an existing journal or
treat another invocation as safe recovery from uncertainty.

**Acceptance:** a developer can run a selected client or quickstart and locate
the relevant direct calls and full helper graph. SDK-only connection/status
modules require no backend. API-backed clients share the qualified routes but
have independent builds and declared capabilities. No private sibling repository,
root install or universal example framework is required.

## 3. Fill useful native platform hosts and SDK modules

Kotlin, Swift, React Native, Flutter and Web examples have equal importance.
Complete small supported host/workflow paths; prioritize missing Swift iOS and
Flutter iOS hosts alongside documented RN iOS support. Native Kotlin and Swift
clients start with an idiomatic runnable SDK host and focused
connection/status/recording feature files. Add cloud/library UI where it teaches
a useful platform integration; do not duplicate full clients by default or
create another root per SDK method.

Keep capability, host and verification separate. Flutter's selected facade
cannot provide the RN encrypted-sync path; adding an iOS host or bumping a
version does not solve that contract gap. Web Bluetooth is limited to supported
desktop Chromium environments. Native Windows device examples depend on the
upstream public SDK; the API web sample already serves Windows users.

**Acceptance:** a developer can install/build the host and locate the public SDK
calls for its declared workflow. Permissions, device identity, lifecycle and
native cleanup tests cover important boundaries. Record physical claims only
for the tested package/OS/device/firmware. This work does not wait for every
client to implement import, playback or a full consumer UI. Each host states its
actual capabilities and keeps its SDK-only path independent of the backend.

## 4. Complete the ordinary recording flow and migrate the layout

**Web playback implemented:** the ordinary-import path requests a fixed public
WAV export, bounds storage bytes and rechecks owner/source/session before release.
Signed URLs remain server-side; the browser clears its transient media on source
refresh, selection changes and sign-out. Device/encrypted sources are unavailable.
Synthetic tone playback does not establish live API/export/media acceptance.
The [October 15 live HTTP test](docs/design-reviews/2026-10-14-web-playback.md#october-15-live-http-acceptance)
passed for one synthetic WAV import through export, transcription, summary and
Ask. Browser decoding and other input formats remain acceptance gaps.

Keep Bota Recordings familiar: add/import audio → library → playback/source →
transcript → general notes → scoped Ask. Ordinary UI serves recording users;
technical request metadata and copy instructions remain secondary. Add mobile
import and playback only where public format, encryption, ownership and expiry
contracts support them. Encrypted originals and URL issuance do not prove
playable/decrypted audio. The platform clients need not have identical device
capabilities, UI or delivery dates.

After compatible feature consolidation, migrate toward the planned
`end-to-end/recordings/` layout: `backend/features/`, `backend/auth/`,
`backend/persistence/`, `clients/{web,react-native,flutter,android-kotlin,apple-swift}/`
and `contracts/`. Keep old setup/source links and catalog identities compatible;
update affected CI and documentation with the move. Do not add empty proposed
roots to the catalog or relocate journals as a cosmetic change.

**Acceptance:** every client documents an understandable declared user flow and
its gaps. Shared changes have evidence for every affected client/auth/store
adapter. Qualified playback has owner checks and safe expiry/errors; source,
mock, native build, live provider and hardware results remain distinct. New
SDK hosts do not wait for this complete recording-app journey.

## 5. Add vertical and app-type examples later

Select a concrete user/workflow, then compose the qualified general integrations
around it. Reuse relevant features; do not clone all clients/backends for every
scenario. Choose the platforms needed by that use case.

**Acceptance:** a named user, meaningful workflow, supported public contracts,
clear reuse/adaptation points and a maintenance rationale. This roadmap does
not implement or approve a particular vertical app.

## Delivery rules

Existing launch paths, catalog identities, locks and SDK pins remain unchanged.
The implemented core adds its own catalog entry and frozen dev-tool lock.
Further consolidation or moves require compatible links,
catalog/workflow updates and preserved state; legacy retirement retains its
existing gates. Do not erase uncertainty, weaken cleanup/ownership safeguards,
add speculative hosts or claim platform parity from a connection build.

Run the selected example's appropriate checks. For shared changes, exercise all
affected consumers; default CI uses no live credentials, hardware mutation or
deployment. Record actual source, build, live and physical evidence separately.
See [ARCHITECTURE.md](ARCHITECTURE.md), [AGENTS.md](AGENTS.md) and the
[approved architecture decision](docs/design-decisions/2026-10-12-integrated-recordings.md).
