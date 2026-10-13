# Decision: workflow recipes, platform starters and optional references

## Requirement and decision

The owner clarified that small separate examples and larger combined samples
are both acceptable. The requirement is code developers can easily refer to
and adapt when building across platforms with Bota SDKs/APIs. Structure is an
engineering choice, not a customer requirement to reproduce one app everywhere.
General capabilities come first; vertical/app-type demos come later.

Choose a hybrid in one repository: independent API workflow recipes, small
idiomatic SDK starters per published facade, and optional end-to-end references.
Keep `api/`, `app-sdk/` and `end-to-end/` as formats within the general layer.
The current paths/IDs remain. No new install roots, runtime framework or SDK
version migration is implemented by this decision.

## Alternatives and tradeoffs

| Option | Finding/adaptation | Setup and maintenance | Decision |
| --- | --- | --- | --- |
| One full recording-app family as the mandatory entry | Shows app composition but makes a one-call or native SDK task navigate unrelated UI/auth/DTOs | Encourages a shared backend, but forces broad app parity and delays independent platform work | Retain as optional reference, remove its role as a prerequisite |
| One install root per API/SDK method | Direct method lookup, but fragmented workflows and repeated prerequisites | Many locks, hosts, READMEs and guard/test copies for closely related calls | Avoid method-count expansion; group a meaningful workflow or platform host |
| Focused workflows + platform starters + optional reference | Developer chooses task/platform and reaches direct public-call code | Independent recipes remain copyable; one host can teach several bounded SDK features; substantial reference backend logic can share | Selected |

All three approaches can produce useful code. The selected tradeoff balances
finding/adapting a small feature with reducing repeated setup. A little local
configuration/UI/HTTP glue may repeat across copyable roots; a universal shared
package or mandatory sample service would make those roots harder to extract.
Share substantial concrete reference-app logic when its compatibility plan
shows a maintenance benefit.

## Repository evidence

Three independent audits reviewed the owner clarification and current source:

- The [Node upload/transcription workflow](../../api/upload-and-transcribe-node/index.mjs)
  is independently runnable; a developer needs no recording-app UI or mobile
  backend to learn it.
- [Kotlin connection](../../app-sdk/android-device-connect/app/src/main/java/dev/bota/examples/connect/MainActivity.kt)
  and [Swift connection](../../app-sdk/apple-device-connect/Sources/BotaConnect/App.swift)
  already expose SDK calls through compact native hosts. They are first-class
  customer learning paths, not subordinate to RN/Flutter app completion.
- [Web Ask](../../end-to-end/web-reference/server/features/ask.mjs) and
  [mobile Ask](../../end-to-end/react-native-recording-sync/backend/library/ask.mjs)
  overlap substantially. This supports targeted backend consolidation within
  references, not forcing every independent example onto that backend contract.
- The 76-entry inventory includes useful advanced recipes and different evidence
  levels. Curation improves entry paths; deletion or growth toward a count does
  not establish developer usefulness.
- Existing SDKs, host availability and physical verification differ. Swift's
  current example host is macOS, Flutter's is Android, and native Windows device
  SDK support is upstream work. Missing iOS hosts can be improved independently
  of reference-app playback.

## Consequences for the plan

The [current design](../../DESIGN.md) and [roadmap](../../ROADMAP.md) supersede
the app-family-first ordering in the earlier
[plan reset review](../design-reviews/2026-10-12-plan-reset.md). That review remains
dated evidence. Its runtime findings and preserved security boundaries remain
valid; its mandatory full-journey/shared-backend-first priorities do not govern
new platform or recipe work.

- Entry path: workflow → language/platform → public-call source → minimal setup
  → copy/replace instructions.
- Core SDK/API coverage is independently valuable. Full end-user flows are the
  acceptance scope of references that claim them, not every snippet.
- Swift/Kotlin/RN/Flutter/Web starters receive platform-appropriate attention.
  Their exact supported hosts and capability limits remain explicit.
- Bota Recordings keeps familiar end-user UI. Device-focused starters may show
  only the supported device picker/status/recording controls needed by their
  learning objective. Endpoint panels do not replace an ordinary app experience.
- Keep secret keys server-side, exact owner/source checks, documented uncertain
  write recovery, SDK receipt/cleanup authority, lifecycle fences, private output
  and mandatory dependency guards. These requirements are unaffected.
- Preserve independent installation, published pins, current journals/IDs and
  compatibility links. Any later consolidation has its own migration checks.
- Existing one-shot upload/transcription code has no durable restart journal.
  Document that limitation honestly; it does not waive pre-write intent/recovery
  requirements for new or extended write workflows or permit blind reinvocation.

## Review and validation

| Requirement | Evidence | Status |
| --- | --- | --- |
| Easy developer reference across platforms | Workflow/platform entry paths, direct source and copy/replace contract in DESIGN/README/guidance | Matched in design; source usability work remains per recipe |
| Small and combined examples both acceptable | First-class recipes/starters with optional end-to-end references | Matched in design |
| Exactly two product layers | General formats now; vertical/app types later | Matched in design |
| Select architecture by maintenance and usability | Alternatives above and concrete independent/source-duplication findings | Decision recorded |
| Keep public support and verification honest | Platform/host/capability distinction, no forced parity or private facade | Matched in design; missing hosts remain planned |
| Preserve operative integration/state/dependency rules | Unchanged runtime plus current architecture/AGENTS/example-contracts owners | Unchanged for this documentation scope |

- Catalog validation passed: 76 entries, 83 checked documents and 340 local links.
  All 76 catalog rows/order, index/schema and install roots are unchanged.
- All nine catalog fixture regressions passed. Additional validation covered
  all 11 changed/new Markdown documents and 238 local file targets, including
  this decision and ROADMAP outside the catalog checker's fixed document set.
- The complete web install root passed its required `npm run format:check` using
  pinned Prettier 3.8.5. No application build/functional run was repeated for
  this documentation-only change.
- Public client-SDK guidance and changelog compiled as MDX; 57 local page targets
  and the existing workflow/dependabot YAML parsed successfully. Source guidance
  now matches this decision; publication from `prod` is a separate gate.
- An independent conformance review found the architecture aligned with the
  owner requirement. Clarified the existing one-shot journal limitation above
  without relaxing current uncertainty or state-preservation rules.
- Diff whitespace checks passed. Changed-token searches reviewed public sample
  guidance, example docs and historical dependency reports; the internal downstream
  matrix requires no upstream API/device design change for this repo-only decision.
- No runtime, native, manifest, lock, workflow, catalog/schema, journal or device
  change is part of this delivery. These checks establish documentation consistency,
  not new platform support, live API acceptance or physical-device evidence.
