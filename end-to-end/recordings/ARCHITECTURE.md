# Integrated Recordings backend: current implementation

The combined Node listener is implemented. It composes the existing public-family
Web/mobile factories, one cloud feature core and three separate original journals.
Clients and underlying auth/store/service files have not moved.

```text
backend/main → config preflight → one 127.0.0.1 HTTP listener
                                    ├─ Web cookie/Origin/body adapter → web store
                                    └─ mobile Bearer/no-Origin adapter → library store
                                          └─ native capture journal / SDK callbacks
                                    └─ shared recording/processing/Ask → public Bota API
```

Canonical recording/processing/Ask functions accept the existing trusted
`principal`, bounded `request` and scoped `store` context. They do not initialize
authentication, databases, keys, SDKs or a listener. Mobile's default project-field
gate remains strict; web's thin compatibility exports retain its documented
field omission and DTO projections. The shared error class preserves both
adapters' error handling. Express/Vite resolve from the existing Web installation;
the combined runtime requires that Web family, mobile backend source and this
core in the same public checkout. No duplicated runtime dependency graph is added.

Cloud intents and native capture state remain separate durable domains. Sharing
functions does not provide exactly-once behavior or coordinate external writers.
The combined host serializes matching processing/Ask work in this process and
refuses fresh claims when any matching peer intent exists, including known or
complete work. Web never adopts a peer ID into a new intent. Existing own GET
recovery and native/library exact-known-ID paths remain. Older listeners must
stop before using this host; no external-process or atomic file-race guarantee
is made. Device commitment/receipt/cleanup authority stays in its existing owners.

Configured startup requires absolute original bases/state paths. Read-only checks
validate files/ancestors, alias/hardlink rejection, original columns/order,
primary/unique indexes and scope identities before writable initialization.
Default restart requires all three journals; `--initialize` permits only an
all-missing fresh set with existing trusted/private parents and an account file.
No DB merge, migration or rekeying occurs. Windows ACL privacy remains an operator
gate. Demo is Web-only in-memory; mobile local sample modes are unchanged.

Header presence selects the adapter; mixed/duplicate credentials refuse, without
fallback or global body parsing. Incoming header/body limits are 10/30 seconds,
stricter than standalone Web's 15/180 seconds; upstream deadlines stay unchanged.
Development Vite serving denies configured account/journal paths and sidecars
and preserves default denials. Production auth/deployment, SDK upgrades and
physical acceptance are outside this migration.
Static `dist` publication also preflights at most 10,000 entries/depth 32,
rejecting nested links/junctions, nonregular entries and hardlinks to configured
private state/sidecars. It does not detect arbitrary copied private content or
protect against another filesystem writer/races. Shutdown drains pending
Web/mobile route work independently of socket disconnection before journal close.

Follow [root architecture](../../ARCHITECTURE.md), [README](README.md) and the
[combined-listener review](../../docs/design-reviews/2026-10-12-unified-recordings.md).
