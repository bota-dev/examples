# Web reference architecture

This install root retains its Express listener, React frontend and local
HTTP/auth/intent, upload and webhook modules. Recording/processing/Ask shims import
the [canonical integrated core](../recordings/README.md). Use a full checkout or
copy these compatibility roots together; the web folder alone is no longer a
complete runtime copy. No private Bota package is required. See [README](README.md) for recipe paths,
configuration, operations and acceptance limits, and [DESIGN](DESIGN.md) for UI rules.
Bota Recordings is a common app sample/template for developers building for
their own end users, inspired by Demo/Bota One. Its compact recording library
opens a selected detail with Transcript/Summary/Ask tabs. Technical public-call
and source recipes live in README, not the everyday UI. This is an API-only
implementation with audio import; it adds no device SDK, capture or playback.
Other platforms can follow the same journey through their supported public
surfaces; existing connection/catalog samples are not complete app equivalents.

```text
React feature → same-origin /api route → authenticated web principal
                                      → web policy/DTO shim → shared recordings core
                                      → public Bota /v1 + web SQLite intent store
Public Bota webhook → raw signature check → durable metadata → owner-filtered UI
```

The shared [recordings](../recordings/backend/features/recordings.mjs),
[processing](../recordings/backend/features/processing.mjs) and
[Ask](../recordings/backend/features/ask.mjs) modules also serve the mobile HTTP
adapter. Shared [error identity](../recordings/backend/errors.mjs) preserves each
adapter's existing exception checks. Web explicitly allows omitted `project_id`
for compatibility while rejecting a supplied foreign project and retaining exact
recording-owner/source-chain/session/citation gates. It projects the core result
to its existing DTOs; mobile uses strict default recording/job project checks.

There remain two listeners/auth adapters and three journal models: web operation
store, mobile library intents and native capture/session state. No state/path or
account/key anchor moves. Shared code is not cross-store arbitration. A future
single listener must coordinate those stores and preserve compatible cookie/bearer,
Origin and body gates before it can replace either listener.

Live identity comes from private operator-managed account mappings and random app
tokens. Sessions are in memory; Bota project keys stay server-side. Each write
retains its scoped claim. Explicit recovery observes a known operation with GETs;
unknown outcomes never trigger another create or upload. Cloud upload commitment
grants no physical-device cleanup authority.
Syntactically valid returned job/session IDs are retained before further response
validation, and awaited known-resource GET failures preserve uncertainty/recovery
identity. Such IDs do not grant content access or replacement-write authority.
Web 401/403/404 errors withhold operation metadata. SDK receipt/exact-generation
cleanup remains outside this API-only client's authority.
Activity is a secondary, initially collapsed panel. It can GET-reconcile
persisted operations after reopening, retaining only narrow metadata. UI
sign-out removes content before awaiting cookie expiration
and serializes the next login behind that response.

Demo mode uses synthetic in-process upstream responses and an in-memory store,
with no external calls. Feature, HTTP and UI tests exercise scope, durable intent,
uncertain outcomes, signature validation and stale-result fences. They do not
prove deployed API/provider/storage acceptance. Production IdP/session management,
multi-instance operation, account operations and hosting remain customer-owned.
