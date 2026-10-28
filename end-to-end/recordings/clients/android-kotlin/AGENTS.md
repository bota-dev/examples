# Agent instructions

## Build

- Use JDK 17, Android SDK 36 and the checksummed Gradle wrapper from this directory.
- Run `./gradlew :app:checkDependencyLicenses :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleDebugAndroidTest` with frozen locks. API 29 is the runtime minimum; CI also runs the synthetic emulator checks.
- Preserve the complete app/test graph and reviewed public provenance; dependency changes need deliberate lock regeneration, license/hash/age review and another frozen check.

## Boundaries

- Follow the root [AGENTS](../../../../AGENTS.md), [design](../../../../DESIGN.md) and [native read contract](../../contracts/native-library-read.md).
- Sample stays synthetic, credential-free and network-free. Live is GET-only through the existing authenticated customer backend; keep tokens only in memory.
- Preserve exact DTO/source checks, joined worker/body cancellation, background sign-out and failed-cleanup refusal. Do not add SDK/device/audio/writes to this read slice.
- Keep session admission/retirement process-owned across Activity recreation; old Activity leases must neither act on nor observe replacement sessions. View-scope disposal cannot cancel reader cleanup or erase failed-cleanup refusal.
- HttpCore5.3.6's one-worker zero-wait shutdown joins the real reactor worker. Re-review that source on upgrade; keep system TLS defaults and cancellation off the UI dispatcher.
- Preserve explicit HTTP/1 limits of 100 headers and 8192 bytes per line for response heads/trailers; this supported configuration mitigates CVE-2026-54399 on the app path while the 5.3.6 artifact identity remains affected.
- Update README and architecture when their actual contracts change; keep source/native/live evidence separate.

## Commit attribution

- AI-authored commits include the actual model's `Co-Authored-By` attribution.
