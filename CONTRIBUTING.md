# Contributing to Bota examples

Read [DESIGN.md](DESIGN.md), [ROADMAP.md](ROADMAP.md) and [AGENTS.md](AGENTS.md)
first. There are exactly two layers: general platform examples now, then
vertical use cases and consumer app types later. The current priority is one
**Bota Recordings** app family with web, React Native and Flutter clients.
Focused API/SDK recipes support that family and developers needing one public
operation; they are not another product layer.

The target family uses one canonical customer backend. Today the web sample has
its own backend, and the React Native/Flutter clients share a separate backend.
Consolidation is planned, not implemented. Preserve their current install paths,
authentication and journals until that migration is implemented and verified.
Extend an existing client or feature before adding an overlapping install root.
Catalog count is not a delivery goal.

## Work in the selected example

For an app starting point, use the [web](end-to-end/web-reference/README.md) or
[mobile](end-to-end/react-native-recording-sync/README.md) template. For one API
call or SDK workflow, use the secondary [catalog](README.md#example-catalog) or
[examples.json](examples.json). Follow the selected README and install in its
documented directory; the root
npm workspace belongs to the retained legacy app. Each sample names its public
API/SDK prerequisites and evidence. Keep published SDK versions exact and never
substitute private helpers or unpublished methods. Keep the existing index
schema and discovery checks; an app feature does not need a new catalog entry,
metadata format or standalone backend.

## Code quality

- Make the public API endpoint or SDK method easy to find in source and README.
  Explain the feature's inputs, result and complete import graph. A feature may
  span UI, HTTP, authentication, ownership checks and durable state; a short entry
  file does not make the integration safe to copy alone.
- Keep functions and feature modules focused. Use clear names and straightforward
  control flow; add abstractions when they reduce actual repeated work.
- Validate data at API, file and UI boundaries. Preserve server-derived identity,
  ownership/source checks and durable intent before uncertain writes.
- Keep secrets in server configuration and sample identities configurable. Use
  synthetic fixtures; never commit credentials, real audio or signed URLs.
- After uncertain writes, use the supported reconciliation path. Do not make
  retries, replacement jobs or device cleanup appear safe by weakening gates.
- Add a regression for a reproducible bug. Check important behavior through the
  public boundary, including failure paths; distinguish mocked/live/hardware results.
- Retain unrelated dependency source guards and their required test chains.

Keep app controls about the recording user's task. Put public-call recipes,
setup and adaptation instructions in README/source. The target journey is audio
input → library → supported playback → transcript → general notes → Ask. Mark
each client's implemented subset and gaps; do not imply that a connection snippet
or synthetic screen implements the whole journey.

Version migrations are separate work. Independent device examples currently pin beta.13.
Verify the selected public facade before expanding a device workflow;
a version bump alone does not supply a missing host or qualify encrypted sync.
[Native Windows SDK support](https://github.com/bota-dev/app-sdk#supported-platforms)
is an upstream plan, distinct from adding an iOS host for an already-supported
SDK. Use the [roadmap](ROADMAP.md) and primary
platform contracts before expanding a client's device path.

## Verify and document

Run the selected README's lint, typecheck, tests and build where applicable.
From the repository root, Node 22.23.2 or newer can validate discovery without
installing the legacy workspace:

```sh
node scripts/check-catalog.mjs
node --test scripts/test-catalog.mjs
```

For the general web reference, run from `end-to-end/web-reference`:

```sh
npm ci
npm run format:check
npm run lint
npm test
npm run build
npm run license-check
```

Update the example README and affected design/agent guidance in the same change.
Add or move a sample only with matching catalog/index/workflow entries. Record
what was actually checked and remaining acceptance in the
[implementation review](docs/independent-examples-review.md). A successful CI
build does not establish live service, provider or physical-device acceptance.

Contribution reviews should identify the demonstrated capability, the change
in behavior, its regression/check evidence and relevant public-contract limits.
Follow the current maintainer's delivery instructions for commits and branches.
