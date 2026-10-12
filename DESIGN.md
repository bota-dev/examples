# Bota developer examples: repository design

## Purpose

This repository provides demo applications and sample code that showcase the
public Bota API and App SDK. Developers should be able to find a capability,
understand its public integration, run an example and adapt that code into their
own application. Evaluate additions by developer usefulness and maintenance cost.

## What we demonstrate

| Example type | What the developer learns | Location |
| --- | --- | --- |
| API sample | Server-side public API calls: recordings, uploads, transcription, summaries, Ask, webhooks and device metadata | [api/](api/) |
| App SDK sample | Published platform SDK calls for discovery, connection, status, recording and supported transfer/lifecycle operations | [app-sdk/](app-sdk/) |
| Combined demo | How application UI, device SDK and customer backend fit together, within explicitly supported public contracts | [end-to-end/](end-to-end/) |

A demo may cover several related capabilities with small feature modules and
shared helpers inside that app. A focused sample may teach just one operation.
Keep both in this repository, with independent installation where the platform
or language requires it. Choose the smallest maintained structure that makes
the public API/SDK integration clear.

## Developer experience

- Lead each README with the capability demonstrated and the relevant public
  API endpoint or SDK method; link the file containing that call.
- Provide short setup/run instructions, required tooling and any device needs.
  Use `.env.example` and caller configuration for credentials and identities.
- Keep feature code easy to locate and adapt. Explain required helpers beside
  the recipe so developers know what to copy into their application.
- Use published SDKs and public APIs. Keep secret keys on the backend and derive
  resource authorization from the application's authenticated identity.
- Label synthetic/demo results clearly. A real integration path uses an
  authorized project or supported device; fixtures do not demonstrate live success.
- Give each install root minimal appropriate CI. Add targeted behavioral tests
  where authorization, uncertainty or state handling makes them necessary.
- Document supported behavior, public-contract gaps and actual verification
  beside the example. Preserve required ownership and completion boundaries.

## Current examples and limits

- The [catalog](README.md#example-catalog) and [JSON index](examples.json) contain
  76 implemented entries. That count is an inventory, not a completeness target.
- The [web reference](end-to-end/web-reference/README.md) showcases backend APIs
  through a React UI. It has small recipes, shared server helpers, a synthetic
  demo and a configured live API path. It does **not** use the device App SDK.
- The [platform samples](README.md#example-catalog) demonstrate published App
  SDKs. Their exact capabilities and hardware evidence are in their READMEs.
- The [Android recording-sync demo](end-to-end/react-native-recording-sync/README.md)
  combines SDK and backend for an already-provisioned encrypted-upload path.
  Its supported scope is narrower than the complete target device lifecycle.
- The [review](docs/independent-examples-review.md) records implementation and
  verification. Many existing entries have source/syntax evidence only; a
  curated, consistently presented SDK/API showcase remains partial.

## How we choose further work

Start with a concrete developer use case. Select an existing sample or feature
module, identify the public call it must teach and improve that path before
creating another install root for overlapping behavior. A combined demo can
reuse its own integration code when that improves clarity and reduces upkeep.
Keep the README, catalog and agent guidance aligned with the actual capability.

[ARCHITECTURE.md](ARCHITECTURE.md) defines technical boundaries and acceptance
gates. [AGENTS.md](AGENTS.md) governs changes; this document defines the
customer-facing purpose and selection criteria.
