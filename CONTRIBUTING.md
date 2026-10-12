# Contributing to Bota examples

Read [DESIGN.md](DESIGN.md) and [AGENTS.md](AGENTS.md) first. Current work improves
general platform capability examples. Vertical and consumer app demos belong to
the later layer. Prefer an existing feature or sample when it already covers
the public integration you want to improve.

## Work in the selected example

Use the [catalog](README.md#example-catalog) or [examples.json](examples.json),
then follow that example's README. Install in its documented directory; the root
npm workspace belongs to the retained legacy app. Each sample names its public
API/SDK prerequisites and evidence. Keep published SDK versions exact and never
substitute private helpers or unpublished methods.

## Code quality

- Make the public API endpoint or SDK method easy to find in source and README.
  Explain the feature's inputs, result and required helpers.
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
