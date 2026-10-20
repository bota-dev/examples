# React Native recordings client

## Read first

- Follow [root instructions](../../../../AGENTS.md), [design](../../../../DESIGN.md) and this [README](README.md). Use the [combined backend setup](../../README.md); backend package commands do not apply to this client.
- This is the complete Android/iOS cloud-client install root; encrypted-v2 Device sync remains Android only. Copy its local native module, scripts, vendor archives and lock together; regenerate ignored build/install state.

## Package manager

- Node 22.23.2+, npm; keep lifecycle scripts enabled: `npm ci`, `npm run license-check`, `npm run typecheck`, `npm test`, `npm run export`.
- Android uses JDK 17 and the documented Expo toolchain. Generated `android/`: `./gradlew :recording-sync:testDebugUnitTest :app:assembleDebug`. iOS: `npm run export:ios`, `npm run prebuild:ios`, then macOS `npm run ios`. No iOS encrypted-upload host here.

## Key conventions

- Preserve exact beta.19 npm/Maven compatibility pins, Expo/native pins, app ID, mandatory 803-asset signing and zero-braces Metro guards, and every existing postinstall/test chain. This client retains the public native-workflow entry; package adoption does not qualify generated-JS `/runtime` ports. Follow [dependency security](../../../../DEPENDENCY_SECURITY.md); the earlier [SDK adoption review](../../../../docs/design-reviews/2026-10-14-beta18-sdk-adoption.md) is historical beta.18 evidence.
- Preserve the `8787` origin defaults and native journal identity. Client relocation does not move server journals or authorize rekeying, deleting or replacing retained captures.
- Sample mode is local fixtures only; device SDK/transport loading and Bluetooth permissions require the explicit live Android Device action. Expo OS media is separate. Keep caller tokens in memory and Bota keys on the server.
- Keep source/session fences, uncertain write locks and GET-only recovery. Cloud job success never authorizes device cleanup; SDK receipts and exact-generation checks remain authoritative.
- Ordinary import/playback uses official Expo picker/File/audio and `expo/fetch`. Keep binary bounds, server-only signed URLs, per-account selection fences, no autoplay, private-cache removal and blocked replacement after failed release. Another import requires exact complete upload operation plus a fresh verified matching recording. Sample text has no fake audio.
- `audio-player.ts` waits public Expo loaded/error events (ten-second local decoder deadline), surfaces sanitized asynchronous failure and removes the status listener, registry entry and native shared object before cache disposal. Constructor/play return values alone do not qualify a decoder.
- Drain setup/actions/finalizers before replacement device admission; failed final disposal blocks replacement. Add no private SDK, GATT or crypto workarounds.
- Keep API explanations in docs/source and request metadata secondary to recording results. Record tests, native builds, live API and physical evidence separately.

## Commit attribution

- Include the actual agent model's `Co-Authored-By` attribution.
