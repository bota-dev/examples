# Mobile recording samples

## Read first

- Follow [root guidance](../../AGENTS.md), [DESIGN.md](DESIGN.md) and [README.md](README.md).
- This compatibility root retains `backend/`, React Native `app/` and Flutter `flutter/`; installs/CWD stay separate. Backend runtime imports the [canonical core](../recordings/README.md), so use a full checkout or include `end-to-end/recordings/backend/` when copying.
- Use common recording library/detail with Transcript/Summary/Ask. Keep API explanations in docs/source.
- Sample mode performs no network/SDK/device operations. Live actions require explicit user choices.
- Change public recording/processing/Ask logic in canonical feature files; local `backend/library/*` files are shims, not duplicate implementations. Keep strict default recording/job project checks and existing DTOs.

## Checks and boundaries

- Backend: `npm ci`, `npm run check`, `npm test`.
- Shared changes also need combined-host and web/mobile consumer checks. One listener retains both auth adapters and all three journals; source/local/hosted qualification stays separate. Use the full Web install + mobile/core family, stop old listeners and retain path/schema/scope/account preflight. Fresh initialization accepts only all-missing state; peer known/complete intent refuses fresh claims with no Web adoption. Preserve own GET recovery and exact native/library known IDs; no external-writer or atomic file-race claim.
- React Native: `npm ci`, `npm test`, `npm run typecheck`, `npm run export`, `npm run license-check`; native Android tests/build per README.
- Flutter: locked pub install, analyzer/tests/Android build and dependency license check per its README.
- Preserve beta.13 pins, mandatory security installer/test chains and native upload journals.
- Cloud library ownership grants no device cleanup authority; retain original sync generation/pairing/completion gates.
- Uncertain writes stay durable and locked. Known-operation recovery uses GET only. No credentials/content in logs.
- Preserve syntactically valid returned IDs before later validation and awaited known-GET failures. Copy core/errors plus route/HTTP/auth/store adapters; retain journal paths, account/key anchors, existing native/library arbitration and receipt/generation cleanup gates.
- Record requirement/evidence/status in the existing review before claiming completion; keep build, live API and hardware evidence separate.

## Commit attribution

- Attribute AI changes with `Co-Authored-By: Codex <noreply@openai.com>`.
