# Web reference

## Read first

- Follow [root AGENTS.md](../../AGENTS.md), [README.md](README.md) and [DESIGN.md](DESIGN.md).
- Bota Recordings is a common sample app/template inspired by Demo/Bota One. Use compact library/detail and Transcript/Summary/Ask tabs; keep Activity secondary and initially collapsed.
- Put endpoint/docs/source recipes in README/code, outside everyday recording controls. Preserve synthetic/live labels and clear user actions.
- This app is API-only: audio import, no device SDK, capture or playback. Do not claim full journey parity with other platform snippets.

## Package manager and checks

- Run `npm ci`, format:check, lint, typecheck, tests, build and license-check here.
- Use `npm run format`; keep LF checkout attributes for Windows/Linux formatter agreement. Legacy install roots are separate.
- Tests/demo are synthetic; keep live Bota/provider/device acceptance separate.

## Integration rules

- Share client/auth/store/UI helpers within this app only; never import other examples or private Bota packages.
- Preserve server-derived ownership, durable intent before writes, GET-only recovery, raw-byte webhook verification and safe text rendering. No browser keys.
- Keep feature files small; update recipe links, root catalog/index and review when moving them. Production identity/session/operations remain customer-owned.
