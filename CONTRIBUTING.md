# Contributing to Bota examples

Help a developer find a specific public call, run it with minimal setup and copy
the complete integration into their application. Read [AGENTS.md](AGENTS.md)
and the current [design](DESIGN.md), [roadmap](ROADMAP.md) and selected README
before changing this repository.

There are exactly two product layers: general platform capabilities now, then
vertical use cases and app types later. The general layer's foundation is one
integrated **Bota Recordings** sample: a shared customer backend, platform clients
and copyable features. Web, RN, Flutter, native Android/Kotlin and Apple/Swift
are client targets with normal platform UI and public SDK calls. Focused guides
link maintained feature code; a few standalone quickstarts serve distinct
languages/runtimes. Existing `api/`, `app-sdk/` and `end-to-end/` paths are source
formats, not additional product layers. Catalog count is not a delivery goal.

## Work within the integrated foundation

Start with the existing web/mobile recording clients and the selected platform's
public-call files. Complete [Flutter](end-to-end/recordings/clients/flutter/README.md)
and [RN](end-to-end/recordings/clients/react-native/README.md) install roots now
live under `recordings/clients/`; Web and mobile backend launch bases/journals
retain their existing paths. Preserve the original backend origin for native
recovery; do not reset journals or rewrite capture scope to fit a new port.
Put a feature in its maintained module and document how to run
and copy it. Keep API explanation/source links in guides and use familiar
end-user recording controls in each client. Native Kotlin and Swift are
first-class client targets, not a reason to reproduce a universal UI framework.

Use the [sample entry](README.md#start-with-bota-recordings),
[feature map](README.md#focused-recipes) and
[platform sources](README.md#current-platform-coverage). Existing standalone
quickstarts and advanced examples remain in [examples.json](examples.json).
Follow the selected README and install in its
documented directory. Root npm commands belong to the retained legacy `apps/`
workspace. Keep source, manifest and lockfile versions aligned with the public
package being demonstrated.

Device connection/status can run without a backend; cloud features and authorized
upload require the customer backend. Different published facades do not imply
identical UI or full device-feature parity. Missing public capability, missing
host and missing verification are distinct gaps. State the supported subset;
never use private helpers, custom transports/crypto or unpublished methods to
hide a gap. A useful SDK feature need not wait for every client to be complete.

**The [shared feature core](end-to-end/recordings/README.md) is implemented.**
Web/mobile recording, processing and Ask files are now compatibility shims over
one implementation. The combined launcher now composes both credential-specific
adapters and their public service factories on one listener, retaining all three
journals and old launchers. Default startup validates original absolute paths,
schemas and scopes; explicit initialization accepts only an all-missing fresh
set. Stop old listeners. Fresh processing/Ask claims refuse matching peer intent,
even known/complete; existing own GET recovery and native/library known-ID paths
remain, with no Web peer-ID adoption. Preserve routes/DTOs, journal scope/anchors,
known IDs, unresolved writes and native receipt/cleanup gates. No external-writer
or atomic file-race guarantee is added. Use the full repository checkout or copy
the Web installation, mobile backend and `end-to-end/recordings/backend/`; the old
web/mobile folders alone are no longer complete runtime copies. Standalone
API/App SDK quickstarts remain self-contained. No mass move/deletion is needed. See the
[approved decision](docs/design-decisions/2026-10-12-integrated-recordings.md).

## Code that is easy to adapt

- Put the public endpoint/SDK method and source link near the top of the README.
  Explain inputs, expected result, prerequisites and the exact run command.
- Use focused functions and plain feature files. Keep runnable setup/UI separate
  from integration logic when that makes the public call easier to copy. Avoid
  abstraction that hides a short call sequence or only anticipates future reuse.
- Name the files/helpers a developer must copy and the customer-owned pieces
  they replace. A short entry file may still require HTTP, authentication,
  ownership and durable-state helpers; explain the complete import graph.
- Change recording/processing/Ask public-call logic in the canonical core;
  consumer shims own explicit policy/projections, not duplicate implementations.
  Preserve the web omitted-project compatibility policy and mobile default strict
  recording/job checks. Include core/errors plus HTTP/auth/store adapters in the
  documented copy graph; do not introduce hidden/private sibling dependencies.
  Do not create a general wrapper SDK or example-only framework to conceal calls.
- Keep client controls about the end-user's recording task, with normal native
  UI. A device-only flow may have just connection/status controls. Public-call
  explanations and complete copy instructions belong in README/source.

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
  Retain a syntactically valid returned job/session ID before later response
  validation, and await known-resource GETs inside the guarded failure path.
  Recovery metadata does not authorize content; web 401/403/404 responses omit it.
- Keep cloud upload commitment, device cleanup and processing separate. Legacy
  `uploaded` or cloud job metadata cannot authorize cleanup; preserve SDK receipt,
  exact-generation and host authorization gates.
- Fence late results after account/selection changes and drain native work before
  admitting a replacement session. Preserve the selected example's recovery limits.
- Keep exact public SDK pins: RN/Web/Android/Swift beta.18, Flutter beta.17;
  a version bump supplies neither a missing host nor physical acceptance.
- Keep lifecycle scripts enabled and preserve required postinstall/security-test
  chains. See [dependency security](DEPENDENCY_SECURITY.md) before changing locks,
  overrides or source guards; passing a patch test is not scanner closure.
  The three RN roots retain the mandatory native Expo signing integrity guard,
  braces guards and existing test chains; the reviewed signing-tool replacement
  removes Forge without changing public SDK/Expo pins. See
  [current signing-tool scope](docs/native-expo-signing-replacement.md).

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

For the current web client, checks run from `end-to-end/web-reference`:

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
