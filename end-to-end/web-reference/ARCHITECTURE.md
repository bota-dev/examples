# Web reference architecture

One install root owns one Express server and React frontend. Features share
ordinary HTTP/auth/intent helpers locally; no runtime import from another example
or private Bota package is required. See [README](README.md) for recipe paths,
configuration, operations and acceptance limits, and [DESIGN](DESIGN.md) for UI rules.
Bota Recordings is a common app sample/template for developers building for
their own end users, inspired by Demo/Bota One. Its compact recording library
opens a selected detail with Transcript/Summary/Ask tabs. Technical public-call
and source recipes live in README, not the everyday UI. This is an API-only
implementation with audio import; it adds no device SDK, capture or playback.
Other platforms can follow the same journey through their supported public
surfaces; existing connection/catalog samples are not complete app equivalents.

```text
React feature → same-origin /api route → authenticated server principal
                                      → exact owner/source checks → public Bota /v1
                                      → SQLite intent before uncertain writes
Public Bota webhook → raw signature check → durable metadata → owner-filtered UI
```

Live identity comes from private operator-managed account mappings and random app
tokens. Sessions are in memory; Bota project keys stay server-side. Each write
retains its scoped claim. Explicit recovery observes a known operation with GETs;
unknown outcomes never trigger another create or upload. Cloud upload commitment
grants no physical-device cleanup authority.
Activity is a secondary, initially collapsed panel. It can GET-reconcile
persisted operations after reopening, retaining only narrow metadata. UI
sign-out removes content before awaiting cookie expiration
and serializes the next login behind that response.

Demo mode uses synthetic in-process upstream responses and an in-memory store,
with no external calls. Feature, HTTP and UI tests exercise scope, durable intent,
uncertain outcomes, signature validation and stale-result fences. They do not
prove deployed API/provider/storage acceptance. Production IdP/session management,
multi-instance operation, account operations and hosting remain customer-owned.
