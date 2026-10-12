# Mobile recording samples

## Read first

- Follow [root guidance](../../AGENTS.md), [DESIGN.md](DESIGN.md) and [README.md](README.md).
- One example owns `backend/`, React Native `app/` and Flutter `flutter/`; installs stay separate.
- Use common recording library/detail with Transcript/Summary/Ask. Keep API explanations in docs/source.
- Sample mode performs no network/SDK/device operations. Live actions require explicit user choices.

## Checks and boundaries

- Backend: `npm ci`, `npm run check`, `npm test`.
- React Native: `npm ci`, `npm test`, `npm run typecheck`, `npm run export`, `npm run license-check`; native Android tests/build per README.
- Flutter: locked pub install, analyzer/tests/Android build and dependency license check per its README.
- Preserve beta.13 pins, mandatory security installer/test chains and native upload journals.
- Cloud library ownership grants no device cleanup authority; retain original sync generation/pairing/completion gates.
- Uncertain writes stay durable and locked. Known-operation recovery uses GET only. No credentials/content in logs.
- Record requirement/evidence/status in the existing review before claiming completion; keep build, live API and hardware evidence separate.

## Commit attribution

- Attribute AI changes with `Co-Authored-By: Codex <noreply@openai.com>`.
