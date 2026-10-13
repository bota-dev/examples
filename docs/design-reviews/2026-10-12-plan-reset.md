# October 12 repository plan and design review

> Historical review: the owner-approved [integrated Recordings decision](../design-decisions/2026-10-12-integrated-recordings.md)
> supersedes this earlier work ordering. Preserve the dated source findings;
> follow the [current consolidation review](2026-10-12-integrated-recordings.md)
> and root roadmap for implementation status and next steps.

## Scope and review basis

The owner requested a review of the entire plan/design after clarifying the
audience: customer developers building apps for their own end users. General
platform examples come first; vertical use cases and consumer app types come
later. A common demo/sample/template inspired by Demo/Bota One should span
mobile and web. Example count is not an acceptance criterion.

Three independent read-only audits examined product usefulness, architecture/
maintenance and public platform capabilities at examples source
`da2347777a9890dd4996e2e4e0c2d237409e5e8e`. They inspected the current app sources,
manifests, setup docs and published SDK surfaces. Internal apps were behavioral
references only. This review does not qualify runtime code, hardware or an SDK
release migration.

## Findings that changed the plan

| Finding | Concrete source evidence | Plan correction |
| --- | --- | --- |
| The entry path favored inventory and rollout history over a useful starter | Previous root README offered 76 equal catalog entries and a long status/history section; sixty recent API cases had source/syntax evidence only | Lead with the recording family and a small core cookbook; retain the extended catalog without expanding toward a count |
| The everyday app journey is incomplete | Web has audio import but no player; RN/Flutter common Android apps have neither ordinary import nor playback | Define a complete import → library → supported playback → transcript → notes → Ask baseline, then finish existing clients before new hosts |
| The same integration is maintained twice | [Web processing](../../end-to-end/web-reference/server/features/processing.mjs) and [mobile processing](../../end-to-end/react-native-recording-sync/backend/library/processing.mjs), plus their Ask/ownership/store helpers, overlap with differences in identity checks | Define common DTO/auth/operation/media contracts and consolidate concrete backend features conservatively |
| A feature is not always a single-file copy | [Web Ask](../../end-to-end/web-reference/server/features/ask.mjs) and [mobile Ask](../../end-to-end/react-native-recording-sync/backend/library/ask.mjs) each require HTTP/auth/ownership/durable-state helpers | Document the full import graph and replaceable customer-owned adapters; keep focused recipes for one-call learning |
| Platform claims need three separate dimensions | RN/Flutter common apps supply Android hosts; RN connection has an iOS host; Swift snippets target macOS; Flutter encrypted-v2 support is missing from the selected public facade; native Windows device SDK is planned upstream | Separate SDK capability, implemented example host and verification; do not promise native parity or use private facades |
| Current guidance mixed rules and history | Previous architecture and agent instructions carried extensive dated migrations/security checkpoints | Keep concise current entry docs, operation-specific contracts and linked dated evidence; preserve pre-reset snapshots as historical |

## Revised design and dependencies

[DESIGN.md](../../DESIGN.md) is the current product direction:
one Bota Recordings family, platform-native React web/RN/Flutter clients and a
planned canonical customer feature backend. Independent API/SDK recipes support
smaller integration tasks. These remain formats within the general layer;
vertical/app-type demos are the second, later layer.

[ROADMAP.md](../../ROADMAP.md) orders implementation by dependency: curate docs,
define shared backend and playable-media contracts, complete the existing
clients and consolidate, add iOS hosts, then extend bounded native/Web SDK
workflows where supported. Native Windows device work depends on upstream
SDK availability. A future physical layout is optional; cosmetic folder moves
are not the next step.

Public [download documentation](https://docs.bota.dev/api-reference/uploads/download-url)
describes original bytes and optional formats; URL issuance on the raw path
does not check object existence. Source inspection of the public backend route
and recording download service found no blanket promise that encrypted source
bytes become playable. Media format, encryption, ownership and expiry therefore
remain explicit contract work before adding playback. No new endpoint or
decryption implementation is assumed by this design.

## Conformance and remaining work

| Requirement | Evidence in this change | Status |
| --- | --- | --- |
| Developer samples for customer end-user apps | DESIGN and curated README start with Bota Recordings and explain template versus recipe | Matched in design/docs |
| Exactly two layers | DESIGN/ARCHITECTURE/ROADMAP/AGENTS and local designs use general now, vertical/app types later | Matched in design/docs |
| Mobile-to-web scope without duplicate product implementations | One family and shared backend target; focused native SDK workflows; capability/host/evidence distinction | Matched in design; runtime remains partial |
| Complete ordinary recording journey | Baseline and missing input/playback explicitly recorded | Planned; not implemented by this change |
| Maintainable public integration | Planned shared concrete features with cookie/Bearer adapters, full import graphs and independent recipes | Partial; backend consolidation pending |
| Preserve authorization, uncertainty and device cleanup contracts | Current ARCHITECTURE, AGENTS and [example contracts](../example-contracts.md), plus unchanged owning source/docs | Matched for this docs-only scope; broader runtime conformance not asserted |
| Preserve package pins, native journals/IDs and dependency guards | No runtime, lockfile, manifest, workflow, catalog/schema or native file edits | Unchanged |
| Keep historical evidence available | [Architecture snapshot](../design-history/2026-10-12-architecture-before-reset.md), [agent snapshot](../design-history/2026-10-12-agent-instructions-before-reset.md) and existing implementation reviews | Preserved; snapshots explicitly non-normative |
| Align downstream developer guidance | Public client-SDK example guidance describes current two backends and future consolidation; changed-token search consulted the internal downstream matrix | Matched in source docs; site publication is separate |

This change executes the Plan → Work → Review → Compound review workflow.
The design is not silently adjusted to label current apps complete. No app
build, live API/provider/storage call, device operation, package publication or
deployment is part of this pass. Runtime acceptance evidence stays tied to
the earlier exact sources in [implementation evidence](../independent-examples-review.md).

## Verification of this documentation change

- `node scripts/check-catalog.mjs`: passed, 76 entries, 83 checked documents and
  309 local file links. All 76 existing catalog rows and their ordering are unchanged.
- `node --test scripts/test-catalog.mjs`: all nine fixture regressions passed,
  including broken links, outside paths, malformed metadata and missing entries.
- Additional file-link validation covered all 14 changed/new Markdown documents,
  including ROADMAP, operation contracts, the review and historical snapshots:
  279 local targets passed. The unchanged catalog checker has a fixed document
  set; this additional check covers the new documents in this delivery.
- Public client-SDK guidance and changelog compiled as MDX; 57 local page targets
  passed. Existing workflow/dependabot YAML also parsed without duplicate keys.
- The first push's web CI found Markdown table formatting in the changed web
  DESIGN. Applied that install root's pinned Prettier 3.8.5 to the document;
  `npm run format:check` now passes across the complete web install root.
  This correction changes formatting only; replacement hosted status is checked
  separately from the local result.
- Independent final product/architecture and contract-preservation reviews found
  no material conformance gap. Corrected two misleading phrases about complete
  app availability and download-URL playback evidence.
- Diff whitespace checks passed. Examples changes are Markdown only; public
  docs changes are limited to the two affected MDX pages. Manifests, locks,
  workflow files, catalog/schema and runtime/native files remain unchanged.
- Changed-token searches found affected public sample guidance and historical
  dependency reports. Updated the guidance; retained the dated reports because
  dependency coordinates, sample paths and security behavior did not change.
  The internal downstream matrix requires no device/API design update for this
  repository-only plan change.

These checks establish documentation consistency, not application or hardware
acceptance. Pushes update source on `main`; public docs deployment uses `prod`
and is outside this pass.
