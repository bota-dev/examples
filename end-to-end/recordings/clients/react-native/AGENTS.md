# React Native recordings client

## Read first

- Follow [root instructions](../../../../AGENTS.md), [design](../../../../DESIGN.md) and this [README](README.md). Use the [combined backend setup](../../README.md); backend package commands do not apply to this client.
- This is the complete Android install root. Copy its local native module, scripts, vendor archives and lock together; regenerate ignored build/install state.

## Package manager

- Node 22.23.2+, npm; keep lifecycle scripts enabled: `npm ci`, `npm run license-check`, `npm run typecheck`, `npm test`, `npm run export`.
- Android uses JDK 17 and the documented Expo toolchain. Generated `android/`: `./gradlew :recording-sync:testDebugUnitTest :app:assembleDebug`. No qualified iOS encrypted-upload host here.

## Key conventions

- Preserve beta.13, Expo/native pins, app ID, mandatory 803-asset signing and zero-braces Metro guards, and every existing postinstall/test chain. Follow [dependency security](../../../../DEPENDENCY_SECURITY.md).
- Preserve the `8787` origin defaults and native journal identity. Client relocation does not move server journals or authorize rekeying, deleting or replacing retained captures.
- Sample mode is local fixtures only; SDK/native loading and permissions require the explicit live Device action. Keep caller tokens in memory and Bota keys on the server.
- Keep source/session fences, uncertain write locks and GET-only recovery. Cloud job success never authorizes device cleanup; SDK receipts and exact-generation checks remain authoritative.
- Drain setup/actions/finalizers before replacement device admission; failed final disposal blocks replacement. Add no private SDK, GATT or crypto workarounds.
- Keep API explanations in docs/source and request metadata secondary to recording results. Record tests, native builds, live API and physical evidence separately.

## Commit attribution

- Include the actual agent model's `Co-Authored-By` attribution.
