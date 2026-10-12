# Web reference

Follow [root AGENTS.md](../../AGENTS.md), [README.md](README.md) and
[DESIGN.md](DESIGN.md). This one example may share client/auth/store/UI helpers;
never import other examples or private Bota packages.

Run `npm ci`, format:check, lint, typecheck, tests, build and license-check here.
Use `npm run format` for consistent sample source; legacy install roots are separate.
Tests/demo are synthetic; keep live Bota/provider/device acceptance separate.
Preserve server-derived ownership, durable intent before writes, GET-only
recovery, raw-byte webhook verification and safe text rendering. No browser keys.

Keep feature files small and update recipe links, root catalog/index and review
when moving them. Production identity/session/operations remain customer-owned.
