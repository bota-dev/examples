# Bota Examples roadmap

This roadmap follows [DESIGN.md](DESIGN.md): exactly two layers, one Bota
Recordings template family and small supporting SDK/API recipes. It orders work
by the customer developer's path to a useful end-user app, not by example count.
It does not move code, upgrade the published beta.13 pin or claim missing runtime
features are complete.

## 1. Curate the current general examples

Lead the README and AI guidance with Bota Recordings and a short set of useful
API/device recipes. Keep the full catalog as a reference inventory. State the
current web/mobile gaps and move historical verification detail out of the
starting path into the existing reviews.

**Acceptance:** the docs agree on the two layers, the one template family,
current versus planned behavior and where a developer starts. Catalog paths,
links, independent installation and required security instructions remain valid.
This documentation reset supplies the direction; it does not finish the app.
The [plan reset review](docs/design-reviews/2026-10-12-plan-reset.md) records
the decisions, source evidence and remaining verification.

## 2. Define the shared backend and playable-media contract

Before moving runtime code, settle a small common contract for all three clients:

- Recording pages/details, transcript and general-notes source links, scoped
  Ask answers/citations and safe error/operation projections.
- A replaceable customer identity adapter and server-derived project/end-user
  mapping. Web cookie and mobile Bearer transport can differ while enforcing
  the same ownership rules.
- Durable intent identity, bounded progress/status reads and GET-only recovery
  for known resources. Unknown write outcomes stay retained and blocked until
  reconciled; migration must not create replacement writes.
- Ordinary audio import: supported MIME types, nonempty/size limits, upload
  verification and the point at which processing becomes available.
- Authorized playable media: supported codecs/containers, URL lifetime and
  storage credential isolation, exact owner/source checks and safe expiry/error
  behavior. Distinguish playable audio from original download and encrypted
  device bytes; do not promise unimplemented decryption or conversion.
- The public calls and helper files a developer copies for each feature, with
  the application-owned pieces they replace.

**Acceptance:** document representative success, pending, unauthorized,
unsupported-media and uncertain-write responses; trace them to current public
API contracts. Resolve incompatible web/mobile DTOs before consolidation.

## 3. Complete the existing recording clients and consolidate conservatively

Use the agreed contract to create one canonical customer feature backend and
complete the existing React web, RN Android and Flutter Android clients. Finish
ordinary import and supported playback/source review so device hardware is an
optional input, then refine the already-present Transcript/Summary/Ask flow.

Start from the existing implementations. Preserve scope, journals, unresolved
intent, source guards and recovery behavior; migrate state only through an
explicit compatible plan. Keep links and install roots stable until a move has
a concrete benefit. A proposed `templates/recordings/` layout is **planned**;
no such runtime move is part of the documentation reset. Keep legacy `apps/`
separate from the new family.

**Acceptance:** each client completes import → library → supported playback and
source review → transcript → general notes → recording-scoped Ask. Sample mode
requires no credentials/device/external calls. Targeted tests cover ownership,
media access/expiry, source links, account changes and uncertain actions.
Appropriate client/backend CI passes. Record authorized live API evidence
separately; optional device acceptance does not gate the API-only baseline.

## 4. Add mobile iOS hosts

Add RN and Flutter iOS hosts for the completed common API journey. Reuse the
feature contract and UI rather than creating a separate consumer app. Gate any
Device entry by the published facade and the actual host implementation.
Android encrypted-transfer module support is not iOS parity evidence.

**Acceptance:** documented Apple toolchain/deployment requirements, clean
public-package installs, simulator/native builds and sample/live API behavior.
Bluetooth/pairing/transfer claims require their own supported host and physical
evidence; a simulator build alone proves none of those capabilities.

## 5. Extend bounded native device workflows where useful

Improve the existing Kotlin/Android and Swift/Apple SDK samples with small
supported workflows such as connection, status, recording metadata and
authorized transfer/lifecycle steps. Keep each public SDK call easy to locate.
Do not duplicate the whole consumer UI without a demonstrated customer need.

Optionally connect the common web app to the Web SDK for desktop Chromium when
the public contract and supported browser/OS behavior justify it. The API web
app already serves Windows users. Native Windows/Electron SDK work is planned
upstream and is not an implemented host in this repository.

**Acceptance:** exact public SDK pins, explicit capability gates, focused
behavioral checks and platform builds. Scope any physical results to the tested
hardware/firmware/version. Preserve separate upload-commitment, cleanup and
processing phases; no metadata-only sample gains device cleanup authority.

## 6. Add the later vertical/app-type layer

After the general baseline is coherent, select a concrete end-user workflow
such as sales visits, field service or a meeting assistant. Compose the existing
recording/backend integrations around that journey. Add only the scenario's
meaningful behavior; reuse the maintained general code rather than cloning all
platform clients and backend features for every case.

**Acceptance:** a named user and workflow, clear reuse boundary, supported public
contracts and a maintenance rationale. No vertical implementation is approved
by this roadmap alone.

## Scope discipline

Pause standalone export/configuration/observer expansion unless it solves a
documented developer need beyond the curated recipes. Preserve existing useful
examples and their evidence; do not remove catalog entries merely to reduce a
count. Do not add a new framework, speculative SDK version, duplicate full
native consumer app or account/deployment product to complete this plan.

Use the [technical architecture](ARCHITECTURE.md) and the selected README for
the acceptance gates. Keep source checks, builds, live API validation and
physical-device testing distinct in the [review](docs/independent-examples-review.md).
