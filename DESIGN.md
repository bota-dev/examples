# Bota developer examples: repository design

## Purpose

This repository provides demo applications, templates and sample code that
showcase the public Bota API and App SDK. Customer developers build applications
for their own end users. Our common sample app should resemble a familiar
recordings app, inspired by Demo and Bota One: add audio, find a recording, read
its transcript and summary, and ask about its content. Developers run that app
and adapt its small integration modules. Evaluate additions by developer
usefulness and maintenance cost.

## Two layers

| Layer | Purpose | Scope |
| --- | --- | --- |
| 1. General platform examples | Show what Bota can do and how developers call the public API/SDK | Current work: individual capabilities and general workflows such as device connection, recording upload, transcription, summaries, Ask and webhooks |
| 2. Use-case and app-driven demos | Show how those capabilities fit a particular vertical workflow or type of consumer application | Later work: scenarios such as sales visit notes or field-service reports, and app types such as a meeting assistant or personal voice notebook |

Layer 1 is the current creation scope. A common recording app can combine
capabilities through small feature modules and still belong to this layer.
API samples, SDK samples and combined demos are formats within Layer 1.

Layer 2 will compose those demonstrated integrations around a specific user
journey, with the scenario's application flow and UI. It is planned here; its
sample implementation starts in a later phase.

## Common app journey across platforms

Use the same recognizable recording journey in platform-specific runnable
implementations from mobile to web, where their public API/SDK surfaces support
it. Use each platform's normal controls and navigation rather than sharing a
new UI framework. Mobile device integration can supply recordings through the
App SDK; an API-only web sample can import audio through its customer backend.
Describe unsupported steps and each implementation's actual evidence explicitly.

The everyday UI serves someone managing recordings and reading results. It
shows recording titles, dates, durations, processing state and clear actions.
API endpoints, source recipes and operator details belong in README/source,
not in the main recording experience. A small sample/demo label identifies the
app's purpose. This is a learning template, not a production product or an
attempt to reproduce every feature of Bota One.

## General sample formats

| Example type | What the developer learns | Location |
| --- | --- | --- |
| API sample | Server-side public API calls: recordings, uploads, transcription, summaries, Ask, webhooks and device metadata | [api/](api/) |
| App SDK sample | Published platform SDK calls for discovery, connection, status, recording and supported transfer/lifecycle operations | [app-sdk/](app-sdk/) |
| Combined demo | How application UI and customer backend fit together, with device SDK integration where supported by public contracts | [end-to-end/](end-to-end/) |

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
- [Bota Recordings](end-to-end/web-reference/README.md) is the current web sample:
  a React UI and Node backend for importing audio, transcription, summaries and
  recording-scoped Ask. It has small recipes, shared server helpers, a synthetic
  demo and a configured live API path. It does **not** use the device App SDK or
  implement audio playback.
- The [platform samples](README.md#example-catalog) demonstrate published App
  SDKs. Connection/catalog snippets are independently useful, but they do not
  yet implement the full common recording-app journey. Their exact capabilities
  and hardware evidence are in their READMEs.
- The [mobile recording samples](end-to-end/react-native-recording-sync/README.md)
  provide React Native and Flutter Android clients with a shared customer backend,
  local sample recordings and the common library/Transcript/Summary/Ask journey.
  React Native retains an optional already-provisioned encrypted-upload path;
  Flutter exposes connection/status only. Native iOS, Flutter iOS and Windows
  hosts remain gaps; no complete target device lifecycle or physical acceptance
  is inferred from the clients' source/build evidence.
- The [review](docs/independent-examples-review.md) records implementation and
  verification. Many existing entries have source/syntax evidence only; a
  curated, consistently presented SDK/API showcase remains partial.

## How we choose further work

For the current layer, start with a platform capability or general integration
workflow. Select an existing sample or feature module, identify the public call
it must teach and improve that path before
creating another install root for overlapping behavior. A combined demo can
reuse its own integration code when that improves clarity and reduces upkeep.
Keep the README, catalog and agent guidance aligned with the actual capability.
For app templates, extend the common recording journey on the selected platform
only when the necessary public contracts and acceptance gates are available.

In the later layer, start with a vertical use case or consumer app type and
compose the relevant general integrations into that application's user journey.

[ARCHITECTURE.md](ARCHITECTURE.md) defines technical boundaries and acceptance
gates. [AGENTS.md](AGENTS.md) governs changes; this document defines the
customer-facing purpose and selection criteria.
