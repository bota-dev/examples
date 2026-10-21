# Agent instructions

## Build

- Use JDK 17, Android SDK 36 and the checksummed Gradle wrapper from this directory.
- Run `./gradlew :app:checkDependencyLicenses :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleDebugAndroidTest` with frozen locks. API 29 is the runtime minimum; CI also runs the synthetic emulator checks.
- Preserve the complete app/test graph and reviewed public provenance; dependency changes need deliberate lock regeneration, license/hash/age review and another frozen check.

## Boundaries

- Follow the root [AGENTS](../../../../AGENTS.md), [design](../../../../DESIGN.md) and [native read contract](../../contracts/native-library-read.md).
- Sample stays synthetic, credential-free and network-free. Live is GET-only through the existing authenticated customer backend; keep tokens only in memory.
- Preserve exact DTO/source checks, joined worker/body cancellation, background sign-out and failed-cleanup refusal. Do not add SDK/device/audio/writes to this read slice.
- HttpCore5.4.4's one-worker zero-wait shutdown joins the real reactor worker. Re-review that source on upgrade; keep system TLS defaults and cancellation off the UI dispatcher.
- Update README and architecture when their actual contracts change; keep source/native/live evidence separate.

## Commit attribution

- AI-authored commits include the actual model's `Co-Authored-By` attribution.
