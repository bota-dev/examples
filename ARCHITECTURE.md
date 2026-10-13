# Bota examples architecture

[DESIGN.md](DESIGN.md) defines the developer audience and product direction.
This document defines a flexible structure for finding, running and adapting
public API/SDK integrations across platforms. Customer developers should need
only the selected example and public packages, not Bota's internal repositories.
The [architecture decision](docs/design-decisions/2026-10-12-example-architecture.md)
records the chosen balance between independent recipes and optional references.

## Product scope

There are exactly two product layers:

1. **General platform examples — current work.** Independent API workflow
   recipes and small platform SDK starters are the primary learning paths.
   Optional end-to-end references show how an app and backend compose them.
2. **Vertical and consumer-app examples — later.** Compose the general
   integrations into a specific use case or app type in a later phase.

The current `api/`, `app-sdk/` and `end-to-end/` paths represent three formats
inside the first layer, not additional product layers. Select by the public call,
workflow, language and actual host a customer needs. Stop growing the catalog by
case count; improve existing code or fill a real platform/capability gap.

## Primary examples and optional references

- **API recipes:** one bounded public workflow with its own setup, inputs,
  expected output and recovery limits. Keep calls and required helper files easy
  to find and copy; do not promise that an entry file works without its imports.
- **App SDK starters:** aim for one small maintained starter per published facade,
  with its supported native/browser hosts and plain feature files for direct SDK
  calls. A minimal runnable harness supplies permissions, selection, result
  presentation and teardown. Add a feature where the public facade supports it;
  do not invent a protocol or require an unrelated backend/app journey.
- **End-to-end references:** optional Bota Recordings apps demonstrate an ordinary
  user experience plus customer backend integration. Share concrete feature code
  where that reduces real maintenance within the reference, while retaining the
  focused examples for customers who need only one integration.

This is a logical maintenance direction, not a directory move, empty starter or
catalog addition. Independent SDK recipes need neither identical UI/DTOs nor a
recording player. Qualified iOS, Swift and Kotlin starters can progress without
waiting for every reference client to finish import/playback or share a backend.

Short HTTP/configuration helpers may intentionally repeat between independent
copyable roots. Prefer that small visible cost over a mandatory global example
framework. Substantial device protocol logic stays in the published SDK; shared
reference business logic must not become a new unofficial API SDK.

The optional recording reference's end-user flow is **add/import audio → library → playback/source →
transcript → notes → recording-scoped Ask**. Everyday screens show recordings
and content; API recipes and source explanations belong in README/source.
Playback is **not implemented** in the current references. Qualify the public audio
retrieval, format, encryption and authorization contract before adding it:
an encrypted original or URL issuance does not prove playable/decrypted audio, and
synthetic output must not imply successful live playback or device transfer.

## Current implementation

Current paths and independent installation remain unchanged:

| Location | Implemented role and limits |
| --- | --- |
| [Web](end-to-end/web-reference/README.md) | React + Node recording app; audio import, library, Transcript/Summary/Ask and webhook metadata. API-only; no device SDK, capture or playback. |
| [Mobile](end-to-end/react-native-recording-sync/README.md) | React Native and Flutter clients share this example's customer backend. Both common app hosts are Android only. |
| [React Native](end-to-end/react-native-recording-sync/app/README.md) | Common cloud-content flow plus optional public-SDK encrypted-v2 sync for an already-provisioned device. Broader binding/recovery and physical acceptance remain separate. |
| [Flutter](end-to-end/react-native-recording-sync/flutter/README.md) | Common cloud-content flow and secondary connection/status. Published beta.13 lacks the fresh pairing and verified encrypted-upload host surfaces required for device sync. |
| [Focused catalog](README.md#example-catalog) | Independent API and platform SDK recipes, with their own scope and evidence. Connection/catalog samples do not establish complete app parity. |
| [Legacy workspace](docs/app-sdk-migration.md) | Existing `apps/` and root npm commands remain until replacement gates pass. Its beta.6 compatibility path and dependency guards are retained; its unauthenticated backend is local-only and raw-token provisioning does not meet the target binding contract. |

The web and mobile backends currently duplicate recording ownership, processing,
Ask and journal integration code. Their authentication and persisted scope models
also differ. Sharing these concrete features is planned where a compatible
contract reduces duplication; **one canonical reference backend does not exist
yet**. This consolidation is not a prerequisite for independent API/SDK recipes.
Independent device examples retain exact public beta.13 pins. Native iOS common
apps, Flutter iOS and native Windows samples are not supplied here; Windows
native SDK availability is planned upstream and requires public-contract
qualification before an example can depend on it. Current local, hosted, live
and hardware evidence remains in each README and the
[implementation review](docs/independent-examples-review.md).

## Optional reference reuse: planned

```text
Web client ────────── browser cookie adapter ─┐
React Native client ─ mobile bearer adapter ─┼─ derived principal
Flutter client ────── mobile bearer adapter ─┘       │
                                           canonical API feature backend
                                           ├─ recordings / audio import
                                           ├─ transcripts / notes / scoped Ask
                                           ├─ webhook observation
                                           └─ cloud intent journal
Platform device module ─ published App SDK ─ native host callbacks
                                           └─ native capture/session journal
```

The diagram describes possible reuse among recording references, not a required
backend for platform starters. Share concrete public API integration functions,
narrow DTOs and synthetic contract fixtures within an optional reference when
the benefit is clear. Keep normal UI, package managers, permissions and SDK
lifecycle code native to each client. Independent SDK examples need no common
UI or DTO contract. This is not a new Bota API SDK, shared UI framework, generic
proxy or reusable example engine.
Standalone recipes still copy/install independently; root automation is not a
runtime prerequisite. No private package, sibling-source import, submodule or
local dependency on an internal Bota repository may be required.

Browser-cookie and mobile-bearer adapters must each authenticate the caller and
derive the backend principal. Consolidating feature code must not turn a client
end-user/device/workspace selector into authorization or silently replace web
account isolation with the mobile sample's fixed test identity.

Keep ordinary cloud intent and native capture/session journals distinct.
Preserve their paths, scope hashes, account/resource identities, anchors,
known IDs and uncertainty states. Cloud completion, device confirmation and AI
processing are separate phases. Do not merge databases or discard an uncertain
operation to make a new POST possible. Compatibility routes and store adapters
come before any storage or folder migration; current URLs and setup links remain
valid. Move folders only when that improves clarity, with catalog, CI and link
migration in the same reviewed change.

## Integration rules

Apply these rules to the features actually in scope. Keep existing compatibility
gaps and deferred checks explicit; this reset does not establish conformance for
every existing recipe or require a connection-only sample to implement upload.

- **Public contracts and ownership:** secret/restricted Bota keys stay on the
  backend. Authenticate app callers, derive project/end-user scope server-side,
  and verify each recording/job/session/citation source chain before releasing
  content or performing a write. Constrain routes and fields; never expose a
  privileged arbitrary forwarder. Local fixed-identity mode requires a separate
  configured app token and a loopback listener; hosted/multi-user use requires
  real user authentication, per-user authorization and HTTPS.
- **Uncertain writes:** persist scoped intent before non-idempotent work and
  preserve returned IDs. Unknown outcomes keep their journal and use GET-only
  reconciliation; no blind create, replacement or upload replay. A local lock
  does not coordinate other apps, instances or automatic processing. Bounded
  observations are not atomic snapshots, and timeout is not proof of failure.
- **Audio and storage:** isolate API authorization from signed storage requests;
  retain exact trusted-host, redirect, size/time and integrity checks. Ordinary
  downloads return original bytes without implicit conversion/decryption.
  Issued URLs, a successful PUT and legacy `uploaded` are not verified
  commitment, playback or device cleanup evidence. Private exports retain
  owner/source checks, escaped content and no-overwrite publication.
- **Webhooks:** verify timestamp-bound signatures against original input bytes,
  deduplicate durably and acknowledge only after the stated durable acceptance
  step. Events prompt authorized current-resource reads, not new processing or
  exactly-once delivery claims.
- **Device identity and lifecycle:** SDK identity reads verify the exact serial;
  advertised names are hints. Where binding is implemented, require prepare →
  physical provisioning → exact-attempt confirm, abort failed attempts without
  deleting stable identity, and retain binding-generation fences. Device-bound
  opaque provisioning is the target; legacy raw-token paths remain explicit
  compatibility gaps. Protected control/reset uses backend authorization and
  public SDK methods, never custom GATT or cryptography. Unbind is not factory
  reset; reset requires its exact-command durable completion and generation
  contract before any example may claim support.
- **Upload and cleanup:** choose the supported public upload profile explicitly.
  SDK-owned encrypted material, transport and signed-receipt confirmation remain
  separate from app HTTP callbacks and backend scope. Fresh pairing/capability
  and backend generation checks cannot be weakened. Direct WiFi/4G ownership
  must be freshly inactive before BLE fallback; disconnection/timeout alone
  cannot establish inactivity. Device deletion needs the selected protocol's
  durable confirmation/receipt; processing or cloud metadata grants no cleanup
  authority. Unsupported public surfaces stay blocked instead of gaining a
  hidden transport, legacy fallback or fabricated receipt.
- **Lifecycle and dependencies:** late account, selection, question, connection
  and read results cannot restore retired content. Drain native configuration,
  actions/finalizers and SDK destruction before another device owner enters;
  failed cleanup blocks admission. Keep exact published SDK pins, native
  identities, lockfiles, mandatory postinstall guards and test chains. No
  incidental package upgrade or legacy-workspace retirement accompanies this
  architecture reset.

The current owning detail documents remain
[web architecture](end-to-end/web-reference/ARCHITECTURE.md),
[web setup/contracts](end-to-end/web-reference/README.md),
[mobile architecture](end-to-end/react-native-recording-sync/ARCHITECTURE.md),
[mobile native sync/recovery](end-to-end/react-native-recording-sync/README.md),
[backend routes/journal contract](end-to-end/react-native-recording-sync/backend/README.md)
and the [operation-specific example contracts](docs/example-contracts.md),
plus each selected recipe's README linked from the catalog. These documents own
feature-specific pagination, config-merge, command/OTA observation, Ask membership,
export and public-surface restrictions; this reset does not relax them. Applicable
[AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md) remain operative.
Dependency mitigation requirements are maintained in
[DEPENDENCY_SECURITY.md](DEPENDENCY_SECURITY.md),
[Forge guard policy](docs/node-forge-parser-mitigation.md),
[braces guard policy](docs/braces-depth-mitigation.md) and
[build dependency policy](docs/build-dependency-remediation.md).

## Delivery and qualification

Prioritize customer discovery/copyability, qualified platform SDK starters and
useful API workflows. Missing supported iOS/native hosts and bounded feature
modules can be filled independently of the recording references. Complete
reference intake/playback and consolidate duplicated backend features when their
public contracts and maintenance benefit justify that work. Vertical apps remain
the later product layer. Reuse, playback and new hosts are planned work, not
achievements of this documentation change.

Each client/recipe retains its manifest, lock, setup and meaningful CI. Changes
to shared code must exercise every affected client/backend contract. Preserve
existing security/native tests and the legacy CI until its documented retirement
gates pass. The [catalog checker](.github/workflows/catalog.yml) checks discovery
and file links without installing/running examples; it is not API acceptance.

READMEs must identify the learning objective, exact public package/toolchain,
configured inputs and credential owners, run/check commands, expected behavior,
uncertainty/cleanup limits, adaptation points and actual dated evidence. Source
presence, mock tests, native assembly, live APIs/providers and physical devices
are different evidence levels. Claim only demonstrated combinations. Default CI
uses no live credentials, device mutation or deployment; explicit live checks
use disposable/consented data and hardware reports record SDK, OS, device,
firmware, scenario, date and outcome. Review each change against this design and
its current detail owners before reporting completion.

The [pre-reset architecture archive](docs/design-history/2026-10-12-architecture-before-reset.md)
preserves history and old evidence. It is superseded and is **not** a normative
specification for current work.

## Native development-signing dependency boundary — October 12

The three RN install roots carry independent copies of the reviewed public Expo
CLI 57.0.27 adaptation and an independently authored Node/OpenSSL signing adapter.
These repository-contained development tools require no sibling repository,
private app helper, unpublished Bota facade or shared example runtime. Standard
crypto operations use Node; maintained public ASN.1 packages provide models.
SDK, application authentication, upload journals and device cryptography remain
outside this change. The [qualification review](docs/native-expo-signing-replacement.md)
distinguishes local guards/exports from hosted/native/scanner acceptance.

The October 12 architecture decision remains authoritative: focused workflows
and platform starters are first-class; Bota Recordings is an optional reference.
This dependency replacement preserves those choices and all current install roots.
Its runtime qualification was frozen on 985; the later 934 owner delta changes
documentation only and is joined separately before delivery.
