# Web reference architecture

One install root owns one Express server and React frontend. Features share
ordinary HTTP/auth/intent helpers locally; no runtime import from another example
or private Bota package is required. See [README](README.md) for recipe paths,
configuration, operations and acceptance limits, and [DESIGN](DESIGN.md) for UI rules.

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

Demo mode uses synthetic in-process upstream responses and an in-memory store,
with no external calls. Feature, HTTP and UI tests exercise scope, durable intent,
uncertain outcomes, signature validation and stale-result fences. They do not
prove deployed API/provider/storage acceptance. Production IdP/session management,
multi-instance operation, account operations and hosting remain customer-owned.
