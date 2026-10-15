# Web reference

## Read first

- Follow [root AGENTS.md](../../AGENTS.md), [README.md](README.md) and [DESIGN.md](DESIGN.md).
- Bota Recordings is a common sample app/template inspired by Demo/Bota One. Use compact library/detail and Transcript/Summary/Ask tabs; keep Activity secondary and initially collapsed.
- Put endpoint/docs/source recipes in README/code, outside everyday recording controls. Preserve synthetic/live labels and clear user actions.
- This app is API-only: audio import and ordinary-import WAV playback; no device SDK, capture or device/encrypted playback. See [playback contract](README.md#playback-contract).

## Package manager and checks

- Run `npm ci`, format:check, lint, typecheck, tests, build and license-check here.
- Use `npm run format`; keep LF checkout attributes for Windows/Linux formatter agreement. Legacy install roots are separate.
- Tests/demo are synthetic; keep live Bota/provider/device acceptance separate.

## Integration rules

- Share client/auth/store/UI helpers within this app only; never import other examples or private Bota packages.
- Preserve server-derived ownership, durable intent before writes, GET-only recovery, raw-byte webhook verification and safe text rendering. No browser keys.
- Playback requires explicit import/encryption evidence, bounded credential-free storage GET, owner/source recheck and current session at release. Keep signed URLs server-side; abort, pause/reset and revoke browser media on source/session changes.
- Keep feature files small; update recipe links, root catalog/index and review when moving them. Production identity/session/operations remain customer-owned.
