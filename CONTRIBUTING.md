# Contributing to Bota examples

Help a developer find a specific public call, run it with minimal setup and copy
the complete integration into their application. Read [AGENTS.md](AGENTS.md)
and the current [design](DESIGN.md), [roadmap](ROADMAP.md) and selected README
before changing this repository.

There are exactly two product layers: general platform capabilities now, then
vertical use cases and app types later. The general layer has three formats:
independent API workflow recipes under `api/`, small platform SDK starters under
`app-sdk/`, and optional coherent app/backend references under `end-to-end/`.
These formats are not extra layers. Catalog count is not a delivery goal.

## Choose the smallest useful example

- For server integrations, start with an existing API workflow recipe.
- For device capabilities, start with the published facade's SDK starter.
  Kotlin, Swift, RN, Flutter and Web are first-class choices. Extend a useful
  supported workflow with plain feature modules and a small runnable UI/harness;
  do not create an install root for every SDK method.
- For frontend/backend composition, use an optional Bota Recordings reference.
  Its UI should serve a recognizable end-user task. A reference can share
  concrete backend features within its family when compatibility is verified.

Use the [workflow/platform tables](README.md#choose-your-starting-point) or
[examples.json](examples.json). Follow the selected README and install in its
documented directory. Root npm commands belong to the retained legacy `apps/`
workspace. Keep source, manifest and lockfile versions aligned with the public
package being demonstrated.

A useful API recipe or SDK feature does not depend on all platforms having the
same UI, a complete import/playback journey or a shared backend DTO. Missing
public capability, missing example host and missing verification are distinct
gaps. State the actual supported subset; never use private helpers, custom
transports/crypto or unpublished methods to hide a gap.

The web and mobile references currently have separate backends; RN/Flutter share
the mobile one. Preserve current paths, authentication, journals and unresolved
intent. Backend reuse is a scoped improvement, not a prerequisite for platform
examples. Do not create a repository-wide framework or unofficial wrapper SDK.

## Code that is easy to adapt

- Put the public endpoint/SDK method and source link near the top of the README.
  Explain inputs, expected result, prerequisites and the exact run command.
- Use focused functions and plain feature files. Keep runnable setup/UI separate
  from integration logic when that makes the public call easier to copy. Avoid
  abstraction that hides a short call sequence or only anticipates future reuse.
- Name the files/helpers a developer must copy and the customer-owned pieces
  they replace. A short entry file may still require HTTP, authentication,
  ownership and durable-state helpers; explain the complete import graph.
- Keep independent recipes self-contained in their install roots. Reuse inside
  a coherent reference is allowed, but avoid hidden cross-example imports and
  sibling-repository installation/runtime dependencies.
- Keep app-reference controls about the end-user's recording task. Put API
  explanations and copy instructions in source/README. A platform starter needs
  only controls that exercise its supported workflow, not a duplicate consumer app.

## Preserve integration boundaries

- Keep Bota secret/restricted keys server-side. Derive project/end-user access
  from the customer's authenticated identity; client-supplied IDs are not grants.
  Verify exact ownership/source relationships before exposing content or citations.
- Validate API/file/UI boundaries and bound requests, responses and traversal.
  Supply identities through configuration; use synthetic fixtures and never
  commit credentials, real customer audio, signed URLs or provisioning material.
- Retain durable intent before uncertain writes. Use the supported known-resource
  GET reconciliation path; do not resend a create/upload/command or delete its
  journal to force apparent success.
- Keep cloud upload commitment, device cleanup and processing separate. Legacy
  `uploaded` or cloud job metadata cannot authorize cleanup; preserve SDK receipt,
  exact-generation and host authorization gates.
- Fence late results after account/selection changes and drain native work before
  admitting a replacement session. Preserve the selected example's recovery limits.
- Keep exact public SDK pins. Independent device examples currently pin beta.13;
  a version bump supplies neither a missing host nor physical acceptance.
- Keep lifecycle scripts enabled and preserve required postinstall/security-test
  chains. See [dependency security](DEPENDENCY_SECURITY.md) before changing locks,
  overrides or source guards; passing a patch test is not scanner closure.

Read [example contracts](docs/example-contracts.md) for operation-specific rules.
Windows/Electron native SDK support is an upstream plan, distinct from adding a
host for an already-supported facade. Do not invent a public platform contract.

## Verify and document

Run the selected README's meaningful checks for the change: syntax/typechecking,
behavioral regressions and platform builds where applicable. Add a regression
for a reproducible bug or significant ownership/uncertainty/state behavior.
Keep mocked, live API and physical-device evidence separate.

Node 22.23.2+ can validate discovery from the repository root without installing
the legacy workspace:

```sh
node scripts/check-catalog.mjs
node --test scripts/test-catalog.mjs
```

For the optional web reference, its checks run from `end-to-end/web-reference`:

```sh
npm ci
npm run format:check
npm run lint
npm test
npm run build
npm run license-check
```

Update the selected README and affected design/agent guidance in the same change.
Keep the existing catalog/index schema; adding a feature needs no new entry.
Add/move an install root only with a concrete developer need and matching
catalog/index/workflow changes. Record checks and remaining acceptance in the
[implementation review](docs/independent-examples-review.md). CI does not prove
live service, provider or physical-device acceptance.

Contribution reviews should identify the demonstrated capability, behavior,
adaptation boundary and relevant public-contract limits. Follow the current
maintainer's delivery instructions for commits and branches.
