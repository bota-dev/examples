# Bota examples architecture

[DESIGN.md](DESIGN.md) defines the developer audience and product direction.
This document defines the approved integrated Bota Recordings sample foundation
for finding, running and adapting public API/SDK integrations across platforms.
Customer developers need only this public repository, their chosen sample
modules and public packages, not Bota's internal repositories.
The [approved architecture decision](docs/design-decisions/2026-10-12-integrated-recordings.md)
supersedes the earlier focused-workflow/optional-reference structure.

## Product scope

There are exactly two product layers:

1. **General platform examples — current work.** One integrated sample
   foundation provides a shared customer backend, platform clients and copyable
   feature modules. Useful standalone quickstarts remain available.
2. **Vertical and consumer-app examples — later.** Compose the general
   integrations into a specific use case or app type in a later phase.

The current `api/`, `app-sdk/` and `end-to-end/` paths remain formats inside the
first layer, not additional product layers. Select by the public call, workflow,
language and actual host a customer needs. Stop growing the catalog by case
count; improve maintained feature code or fill a real platform/capability gap.

## Integrated foundation: approved target, partially implemented

```text
end-to-end/recordings/
  backend/
    features/
      recordings/ uploads/ transcriptions/ summaries/ ask/ webhooks/
    auth/                       # Browser-cookie and mobile-bearer adapters
    persistence/                # Scoped stores and separate durable journals
  clients/
    web/ react-native/ flutter/ android-kotlin/ apple-swift/
  contracts/                    # Narrow DTOs and synthetic contract fixtures
```

The single Node backend owns concrete public API feature integration, caller
authorization and durable stores. Platform clients expose plain feature files
with normal UI, native permissions and published SDK lifecycle code. Each client
keeps its own manifest, lock and build; SDK-only connection/status modules can
run without the backend. The target names declare logical ownership, not current
directories, equivalent capabilities or verified hosts.

Copyable feature modules and compact source snippets link to maintained
integration code where beneficial. Include the minimal runnable harness and
required helper graph, rather than an install root per method. Retain standalone
Node/Python quickstarts where a different language or independent workflow adds
distinct value. Their current paths and catalog entries remain valid until a
compatible migration includes links, setup, CI and state handling.

Share backend features and narrow DTO/fixture contracts, not a universal UI or
cross-language controller framework. Short local configuration/HTTP/UI glue can
repeat to keep modules understandable. Substantial device protocol logic stays
in the published SDK; the sample is not a new API SDK or privileged generic
proxy. Native Kotlin/Swift clients begin with supported SDK workflows; missing
iOS/native hosts do not wait for full app import/playback or identical UI.

The common app's end-user flow is **add/import audio → library → playback/source →
transcript → notes → recording-scoped Ask**. Everyday screens show recordings
and content; public-call explanations and adaptation instructions belong in
README/source. Technical request/recovery metadata remains secondary.
Playback is **not implemented** in the current references. Qualify the public audio
retrieval, format, encryption and authorization contract before adding it:
an encrypted original or URL issuance does not prove playable/decrypted audio, and
synthetic output must not imply successful live playback or device transfer.

## Current implementation

Existing launch/install paths remain available. The web/mobile compatibility
family now requires the shared core from this checkout; standalone API/SDK
quickstarts still install independently:

| Location | Implemented role and limits |
| --- | --- |
| [Integrated core](end-to-end/recordings/README.md) | One recording/processing/Ask implementation, shared errors and contract tests; no standalone listener or runtime dependencies. |
| [Web](end-to-end/web-reference/README.md) | React + Node recording app; audio import, library, Transcript/Summary/Ask and webhook metadata. API-only; no device SDK, capture or playback. |
| [Mobile](end-to-end/react-native-recording-sync/README.md) | React Native and Flutter clients share this example's customer backend. Both common app hosts are Android only. |
| [React Native](end-to-end/react-native-recording-sync/app/README.md) | Common cloud-content flow plus optional public-SDK encrypted-v2 sync for an already-provisioned device. Broader binding/recovery and physical acceptance remain separate. |
| [Flutter](end-to-end/react-native-recording-sync/flutter/README.md) | Common cloud-content flow and secondary connection/status. Published beta.13 lacks the fresh pairing and verified encrypted-upload host surfaces required for device sync. |
| [Focused catalog](README.md#example-catalog) | Independent API and platform SDK recipes, with their own scope and evidence. Connection/catalog samples do not establish complete app parity. |
| [Legacy workspace](docs/app-sdk-migration.md) | Existing `apps/` and root npm commands remain until replacement gates pass. Its beta.6 compatibility path and dependency guards are retained; its unauthenticated backend is local-only and raw-token provisioning does not meet the target binding contract. |

The web and mobile backends now import the integrated core through compatible
feature paths and DTO projections. Authentication, bounded HTTP clients, upload,
webhook and persisted scope models remain in their existing hosts. **One feature
implementation is delivered; one executable backend is not.** Combining the
listeners requires retained-intent checks and same-owner arbitration across the
web, mobile-library and native journals before routing writes through one host.
SDK-only modules remain usable without that service.
Independent device examples retain exact public beta.13 pins. Native iOS common
apps, Flutter iOS and native Windows samples are not supplied here; Windows
native SDK availability is planned upstream and requires public-contract
qualification before an example can depend on it. Current local, hosted, live
and hardware evidence remains in each README and the
[implementation review](docs/independent-examples-review.md).

## Shared backend boundaries and migration

```text
Web client ────────── browser cookie adapter ─┐
React Native client ─ mobile bearer adapter ─┼─ derived principal
Flutter client ────── mobile bearer adapter ─┘       │
                                           shared Node API feature backend
                                           ├─ recordings / audio import
                                           ├─ transcripts / notes / scoped Ask
                                           ├─ webhook observation
                                           └─ cloud intent journal
Platform device module ─ published App SDK ─ native host callbacks
                                           └─ native capture/session journal
```

The diagram is the approved target for API-backed platform clients. Each backend
feature exposes its actual public API calls and application-owned authorization,
scope and persistence boundaries. Share only the DTOs/fixtures required by those
routes; SDK-only modules have no obligation to use this contract or backend.
Keep UI, package managers, permissions and SDK lifecycle implementation native
to each platform. This is not a new Bota API SDK, shared UI framework, generic
proxy or reusable example engine.
The foundation and retained standalone quickstarts are self-contained public
code; root automation is not a runtime prerequisite. Imports within the public
web/mobile/core family are required during compatibility migration. No private
package, sibling-repository source import, submodule or local dependency on an
internal Bota repository may be required.

Browser-cookie and mobile-bearer adapters must each authenticate the caller and
derive the backend principal. Consolidating feature code must not turn a client
end-user/device/workspace selector into authorization or silently replace web
account isolation with the mobile sample's fixed test identity.

Consolidate feature implementations behind compatible routes and auth/store
adapters before moving current install roots. Keep ordinary cloud intent and
native capture/session journals distinct.
Preserve their paths, scope hashes, account/resource identities, anchors,
known IDs and uncertainty states. Cloud completion, device confirmation and AI
processing are separate phases. Do not merge databases or discard an uncertain
operation to make a new POST possible. Compatibility routes and store adapters
come before any storage or folder migration; current URLs and setup links remain
valid. Only after compatibility is demonstrated should files move to the target
layout, with catalog, CI and link migration in the same reviewed change. SDK
upgrades and physical-device operations are outside this architecture migration.

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
[native Expo signing replacement](docs/native-expo-signing-replacement.md),
[braces guard policy](docs/braces-depth-mitigation.md) and
[build dependency policy](docs/build-dependency-remediation.md).

## Delivery and qualification

The first compatible consolidation of recording/processing/Ask features is
delivered. Existing clients use the core through their original adapters, with
direct feature-source entry points in README. Next qualify shared write
arbitration and auth/path compatibility before combining the listeners.
Fill qualified iOS/native hosts and useful SDK modules without waiting for every
client's full recording UI. Complete ordinary intake/playback only after its
public contract is qualified. Vertical apps remain the later product layer.
One executable backend, playback and new hosts remain planned work. The
[consolidation review](docs/design-reviews/2026-10-12-integrated-recordings.md)
records the current implementation and its bounded verification.

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

The approved integrated Recordings decision supersedes the earlier architecture
choice. This dependency replacement preserves all current install roots and its
independently qualified signing guards; it does not implement the new foundation.
Its runtime qualification was frozen on 985; the later 934 owner delta changes
documentation only and is joined separately before delivery.

## October 13 prospective independent Metro matching removal

The two independent RN roots locally qualify public Metro parent adaptations
for alerts #111/#112. Each preserves its exact public SDK/Expo/runtime and all
current native-signing guards; only the internal literal `.some` matcher uses
the same picomatch without the unused braces closure. Ordinary owning checks,
matching/watcher and exports are recorded in [the current scope](docs/metro-public-matching-removal.md).
Legacy root #113 and its six-asset parser guard remain unchanged. Source
admission, first-push/native results, scanner closure and physical acceptance
are separate; this prospective local evidence claims no published fix.
