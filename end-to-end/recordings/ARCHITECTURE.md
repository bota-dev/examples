# Integrated Recordings backend: current implementation

The approved target is one sample backend with platform clients. This phase
extracts one cloud feature core and preserves two compatibility listeners.

```text
Web cookie/account + HTTP + web store ───────┐
                                          ├─ backend/features ─ public Bota API
Mobile Bearer + HTTP + library store ───────┘
    └─ existing native capture journal and SDK callback coordination
```

Canonical recording/processing/Ask functions accept the existing trusted
`principal`, bounded `request` and scoped `store` context. They do not initialize
authentication, databases, keys, SDKs or a listener. Mobile's default project-field
gate remains strict; web's thin compatibility exports retain its documented
field omission and DTO projections. The shared error class preserves both
adapters' error handling.

Cloud intents and native capture state remain separate durable domains. Sharing
functions does not provide cross-listener exactly-once behavior or coordinate
external writers. A single listener requires recording arbitration and retained
intent checks across all stores, isolated cookie/Bearer authentication, original
request limits and compatible journal/account path resolution.

Follow [root architecture](../../ARCHITECTURE.md), [README](README.md) and the
[migration review](../../docs/design-reviews/2026-10-12-integrated-recordings.md).
