# Mobile recording samples architecture

The [design](DESIGN.md) defines one common recording app with React Native and
Flutter clients. Both now live under `../recordings/clients/`, while this
compatibility root retains `backend/` and setup. Each client has its own
manifest/lock and Android/iOS hosts; native identities remain stable and touched
SDK consumers pin public beta.19. One
combined HTTP backend can serve Web and both mobile clients, through shims importing the
[canonical recording/processing/Ask core](../recordings/README.md) also used by web.
Use the full checkout with the Web installation, mobile backend source and
`end-to-end/recordings/backend/`; this backend folder alone is incomplete.
Platform UI stays idiomatic and integration files stay easy to locate.

```text
React Native ../recordings/clients/react-native/ ─┐
                  ├─ application bearer ─ backend/library ─ shared recordings core
Flutter ../recordings/clients/flutter/ ─┘ └─ mobile library intent journal

Combined listener ─ cookie/auth + policy/DTO shim ─ same core ─ public Bota /v1
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
Folder relocation preserves UI/native-host `8787` defaults and native recovery
scope, which includes the original backend origin. Configure the combined host
at that origin for retained work; fresh cloud setup may explicitly use `5173`.
Never reset journals or rewrite capture identity to fit a port change.

Core public calls/error types have one implementation. Mobile keeps default
strict recording/job project checks and its source-linked DTOs; web's explicit
legacy policy tolerates omitted `project_id`, but supplied projects and exact
owner/source chains still match. Ordinary upload/playback and their bounded HTTP
client now live in the shared core; webhook/native service modules remain local.
Mobile exposes raw `POST /api/library/uploads` and authenticated
`GET /api/library/recordings/:id/audio`; native media sees private local files,
never signed URLs or credentials. One combined listener preserves both auth adapters and all three
journals; older launchers remain compatibility entries. Stop them before using
the combined host. Existing routes and journal scope/anchors stay unchanged.
New import intents deduplicate by name/type/size/hash; fresh cross-adapter claims
refuse retained matching uploads without adopting peer IDs. Default startup preflights original absolute paths, columns/indexes,
scope and configured account mapping; fresh `--initialize` requires all journals
absent and never merges or rekeys state.

The library journal is separate from the original native capture/session
journal. Both retain immutable scope and known IDs before returning results;
unknown outcomes stop for reconciliation. Readiness checks and journals do not
establish an atomic snapshot against external writers or administrators.
Shared processing/Ask retain syntactically valid returned IDs before later reply
validation; awaited known-ID GET failures preserve the operation's identity and
uncertainty. Saved IDs are recovery metadata rather than authorization or cleanup
proof. Combined processing/Ask arbitration refuses fresh claims against any
matching peer intent, even known/complete; Web does not adopt a peer ID. Existing
own GET recovery and native/library exact-known-ID paths remain. Other listeners,
external writers and file replacement races are not coordinated. Header presence
selects one credential adapter, mixed/duplicate headers refuse and body parsing
remains adapter-specific. Input header/body limits are 10/30 seconds rather than
standalone Web's 15/180, with upstream deadlines unchanged.

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
