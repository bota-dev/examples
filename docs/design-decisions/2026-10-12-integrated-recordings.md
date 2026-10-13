# Approved architecture: integrated Recordings sample

## Owner requirement and decision

Developers need code they can easily refer to, run and adapt when building
applications across supported platforms with the public Bota SDK/API. The owner
approved the presented architecture with “ok”: one integrated sample system,
one shared Node backend, platform-specific clients and copyable feature modules.

The target layout is:

```text
end-to-end/recordings/
  backend/
    features/recordings, uploads, transcriptions, summaries, ask, webhooks
    auth/
    persistence/
  clients/web, react-native, flutter, android-kotlin, apple-swift
  contracts/
```

Maintain substantial backend integration once. Keep platform UI, permissions,
SDK calls and native lifecycle idiomatic and independently buildable. A client
demonstrates its supported capabilities; identical UI/full device parity is
not required. SDK-only connection/status can run without the backend. API-backed
recording flows use it, with Bota keys kept server-side.

Make each public call easy to find. Feature guides and snippets point into the
maintained modules and identify their required imports/adapters. Retain a small
set of independent Node/Python quickstarts when their language/runtime or
standalone execution provides distinct value. Existing advanced examples remain
available during compatible migration; no catalog-count goal or blanket deletion
follows from this decision.

There remain exactly two product layers: general platform capabilities now,
vertical use cases and consumer app types later. The larger sample is the
maintained foundation of the general layer. This decision supersedes the earlier
[workflow/starter-first decision](2026-10-12-example-architecture.md) and
[initial plan reset ordering](../design-reviews/2026-10-12-plan-reset.md).
Their dated source and verification findings remain history.

## Sharing boundaries

- Backend features own public API integration and exact source/owner checks.
  Auth adapters derive application principals; they do not trust client scope IDs.
- Contract fixtures document common behavior and exercise clients. They do not
  establish live API/provider/storage or device acceptance.
- Native SDKs own transport, encrypted material, receipt verification and
  cleanup. Client host callbacks own scoped HTTP authorization.
- Keep cloud processing intent separate from native capture/session journals.
  Sharing functions does not merge store scope, operation identity or durability.
- Use one concrete sample backend, not a new API SDK, generic forwarding service,
  universal UI framework or copied private Bota application code.

## Current migration status

The [combined backend](../../end-to-end/recordings/README.md) now composes the
original Web/mobile factories on one listener. It retains separate cookie/Bearer
adapters and three journals, coordinates processing/Ask in this process, refuses
matching retained peer intent, and preflights original paths/schemas/scopes before
writable startup. Explicit initialization accepts only an all-missing fresh set.
Clients have not moved. The [combined qualification review](../design-reviews/2026-10-12-unified-recordings.md)
records actual checks, the conservative input-timeout difference and limits.
The sections below record the preceding extraction and its migration gate.

## Earlier first implementation step

The [canonical core](../../end-to-end/recordings/README.md) now implements
recording reads, processing/general notes, recording-scoped Ask and error
projection. Both original web/mobile feature paths call that core through thin
compatibility adapters. The Node source has no runtime dependencies; dev tools
check it. Existing web/mobile routes, auth, request clients, launch CWD and
state paths/schemas/hashes/anchors remain.

This is **one feature implementation with two compatibility listeners**. A
single executable backend and the target client layout are not implemented yet.
Upload/webhook HTTP features and native upload coordination remain in their
original owning adapters. No speculative client directories are created.

Mobile retains strict project-field checks and native transcription arbitration.
Web's explicit compatibility policy permits omitted project fields in its
existing response contract, with exact owner/source verification. Every supplied
foreign project is denied. Web keeps operation-only processing mutations/recovery
and its existing summary DTO; mobile keeps source-linked results.

Both adopt durable ID retention before later validation and awaited reconciliation
inside uncertainty handling. Web 401/403/404 responses omit operation metadata;
the private journal remains available for safe recovery. No new write is sent to
replace a retained uncertain operation.

## Earlier migration gate: one listener

Before combining listeners:

1. Coordinate same-owner writes and retained uncertainty across web, mobile
   library and native capture stores. A common process/lock alone is insufficient
   if unresolved operations in another store permit a replacement POST.
2. Keep cookie/CSRF and Bearer authorization boundaries explicit. Reject mixed
   credentials, preserve mobile Origin rejection and each route's body/query/
   binding-header limits; never make the sample an arbitrary API proxy.
3. Resolve existing account/journal paths explicitly or through tested compatible
   launch bases. Moving the CWD must not silently create fresh databases and
   bypass retained intent.
4. Preserve account/key scope hashes, operation/resource IDs, anchors and native
   generation/receipt gates. Store migrations need restart and conflict evidence.
5. Only then relocate client files, retaining setup/source/catalog links and
   cross-consumer CI. SDK updates, firmware/device changes and publication are
   separate work.

The [current design](../../DESIGN.md), [architecture](../../ARCHITECTURE.md) and
[roadmap](../../ROADMAP.md) govern future work. The
[delivery review](../design-reviews/2026-10-12-integrated-recordings.md) records
actual implementation, verification and remaining acceptance.
