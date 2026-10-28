# Web reference architecture

This install root retains its Express listener, React frontend and local
HTTP/auth/intent, upload and webhook modules. Recording/processing/Ask shims import
the [canonical integrated core](../recordings/README.md). Use a full checkout or
copy the full Web installation, mobile backend source and core for the combined
launcher; the web folder alone is no longer a
complete runtime copy. No private Bota package is required. See [README](README.md) for recipe paths,
configuration, operations and acceptance limits, and [DESIGN](DESIGN.md) for UI rules.
Bota Recordings is a common app sample/template for developers building for
their own end users, inspired by Demo/Bota One. Its compact recording library
opens a selected detail with Transcript/Summary/Ask tabs. Technical public-call
and source recipes live in README, not the everyday UI. Cloud features use the
API, including audio import and ordinary-import WAV playback. An optional
desktop Chromium panel uses the public Web SDK for connection/status only.
It adds no capture, device recording transfer or cloud/device binding.
Other platforms can follow the same journey through their supported public
surfaces; existing connection/catalog samples are not complete app equivalents.

Playback is a Web feature composed by both existing listeners. It requests the
public WAV export with enhanced substitution disabled, then downloads a bounded
buffer from an independently configured exact storage host without API credentials.
Explicit ordinary-import/unencrypted metadata, verified upload evidence and fresh
owner/source checks gate release; session expiry/logout during retrieval denies
the response. No signed URL reaches React or a journal. The player owns one
temporary Blob URL and aborts/pauses/resets/revokes it on refresh, selection change
or sign-out. Only the media CSP directive permits `blob:`. WAV signature checks
are not decoding proof; device/encrypted playback remains unavailable. RN/Flutter
players use the shared backend through their own native media hosts.
See [playback contract](README.md#playback-contract).

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

The [combined launcher](../recordings/README.md) now composes both auth adapters
on one listener, retaining web operations, mobile library intents and native
capture/session journals at their original paths. Fresh processing/Ask claims
refuse matching peer intent even when known/complete, without Web peer-ID
adoption. Existing own GET recovery and native/library exact-known-ID paths
remain. Stop older listeners first; this is in-process coordination, not an
external-writer or atomic file-race guarantee.

Configured combined startup preflights original absolute paths, schemas/indexes,
scopes and server-owned account mapping. Fresh `--initialize` requires all three
journals absent; ordinary restart never creates replacements. Common input
header/body budgets are 10/30 seconds rather than standalone Web's 15/180;
upstream processing deadlines stay unchanged. Combined Vite development serving
denies configured account/journal paths and sidecars with default denials intact.
Static publication checks a bounded tree and rejects nested links/nonregular
entries and hardlinks to configured private state; copied private content and
other filesystem writers/races remain outside that check. Pending route work
drains before journal close even when the requesting socket disconnects.
The Web install and both backend source roots are required; no runtime dependency
graph, SDK/client/native identity or lockfile is duplicated or upgraded.

Live identity comes from private operator-managed account mappings and random app
tokens. Sessions are in memory; Bota project keys stay server-side. Each write
retains its scoped claim. Explicit recovery observes a known operation with GETs;
unknown outcomes never trigger another create or upload. Cloud upload commitment
grants no physical-device cleanup authority.
Syntactically valid returned job/session IDs are retained before further response
validation, and awaited known-resource GET failures preserve uncertainty/recovery
identity. Such IDs do not grant content access or replacement-write authority.
Web 401/403/404 errors withhold operation metadata. SDK receipt/exact-generation
cleanup remains outside this client's authority.
Activity is a secondary, initially collapsed panel. It can GET-reconcile
persisted operations after reopening, retaining only narrow metadata. UI
sign-out removes content before awaiting cookie expiration
and serializes the next login behind that response.

The page owns one Bluetooth session across recording navigation. Explicit
preparation lazily loads the published SDK/WASM with no storage namespace;
a separate Connect click invokes the chooser without awaiting an import.
Exact printed serial and current connection identity gate status publication.
Cached public connection observation detects facade-reported loss without GATT
polling. Auth/page/source retirement clears the UI immediately, joins pending
preparation/chooser/read and public destruction, and refuses replacement after
an exposed cleanup failure. Supported browser callback delivery and physical
disconnect remain separate acceptance gates. Production CSP permits same-origin
WASM with `wasm-unsafe-eval` and grants no general script evaluation.

Demo mode uses synthetic in-process upstream responses and an in-memory store,
with no external calls. Feature, HTTP and UI tests exercise scope, durable intent,
uncertain outcomes, signature validation and stale-result fences. They do not
prove deployed API/provider/storage acceptance. Production IdP/session management,
multi-instance operation, account operations and hosting remain customer-owned.
