# Mobile recording samples architecture

The [design](DESIGN.md) defines one common recording app with React Native and
Flutter clients. Each client has its own manifest/lock and Android host. One
local HTTP backend serves both, through shims importing the
[canonical recording/processing/Ask core](../recordings/README.md) also used by web.
Use the full checkout or copy the compatibility family including
`end-to-end/recordings/backend/`; this backend folder alone is incomplete.
Platform UI stays idiomatic and integration files stay easy to locate.

```text
React Native app/ ─┐
                  ├─ application bearer ─ backend/library ─ shared recordings core
Flutter flutter/ ─┘                      └─ mobile library intent journal

Web listener ─ cookie/auth + policy/DTO shim ─ same core ─ public Bota /v1
             └─ separate web operation store

React Native Device ─ public App SDK ─ native encrypted-v2 upload host
                                      └─ backend/native routes + capture journal

Client sample mode ─ local in-memory fixtures (no network/device operations)
```

Cloud content is scoped by the server's fixed project/end user and exact
recording/transcription/summary/Ask source checks. The application bearer is
separate from the Bota key. Clients retain it only in memory, render content as
text, fence retired sessions/selections and retain uncertain action locks.
GET recovery reads a saved operation and cannot replay its original action.

Core public calls/error types have one implementation. Mobile keeps default
strict recording/job project checks and its source-linked DTOs; web's explicit
legacy policy tolerates omitted `project_id`, but supplied projects and exact
owner/source chains still match. Upload/webhook/native service modules remain
local. This is two listeners/auth adapters and three journal models, not a unified
server/store. SDK/native package pins, routes, CWD and journal scopes/anchors stay
unchanged.

The library journal is separate from the original native capture/session
journal. Both retain immutable scope and known IDs before returning results;
unknown outcomes stop for reconciliation. Readiness checks and journals do not
establish an atomic snapshot against external writers or administrators.
Shared processing/Ask retain syntactically valid returned IDs before later reply
validation; awaited known-ID GET failures preserve the operation's identity and
uncertainty. Saved IDs are recovery metadata rather than authorization or cleanup
proof. A single listener still needs cross-store arbitration and compatible
auth/Origin/body gates; shared code creates no lock across the web listener/store.

Native and library transcription routes share a recording lock in this server
process and inspect both journals before creating a replacement. An unknown
intent or an unobserved known native job blocks a competing create. This is not
coordination across server instances or other applications.

The Android React Native SDK path retains fresh identity/pairing and inactive
direct-upload observations, exact binding generation and signed completion
receipt/device confirmation. Cloud library access grants no device cleanup
authority. Flutter's public SDK is used for connection/status only; it lacks
the fresh pairing and verified encrypted-upload surfaces needed for this sync.

Device screens retire their operation/connection epochs on exit. React Native's
`DeviceSessionGate` drains late native actions and finalizers, then disposes the
native host and awaits SDK destruction before another owner can enter. A failed
final cleanup blocks admission until restart. Native cancellation cancels the
preparation coroutine before its HTTP socket, then joins before releasing its
registration. Flutter likewise drains configuration and SDK cleanup before
completing Device navigation. These client guards grant no remote retry authority.

Both clients are learning templates. Production identity mapping, multi-user
authentication, shared stores, operations and deployment remain customer-owned.
Sample mode is not live API/provider/hardware qualification. Android analysis,
tests and assembly establish source/build evidence; supported hosts and remaining
acceptance are recorded in README and the repository implementation review.
