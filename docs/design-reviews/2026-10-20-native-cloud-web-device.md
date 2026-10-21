# Native cloud readers and optional Web device status

This pass follows [DESIGN.md](../../DESIGN.md), the
[integrated sample decision](../design-decisions/2026-10-12-integrated-recordings.md)
and the owner's request to continue the remaining platform examples, update
README, test where needed and push directly without a PR. Three parallel agents
implemented Kotlin, Swift and Web features; the parent reviewed their boundaries
and maintained shared contracts/discovery.

## Scope and conformance

| Requirement | Implementation and evidence | Status |
| --- | --- | --- |
| Small customer-copyable native examples | [Kotlin Android](../../end-to-end/recordings/clients/android-kotlin/README.md) and [Swift iOS/macOS](../../end-to-end/recordings/clients/apple-swift/README.md) provide normal recording library, transcript and notes views, Sample/Live setup and explicit feature copy guides. Each has its own native build. | Matched in source; native build results below |
| Reuse one customer backend | Both clients use the existing mobile Bearer adapter and [four-GET contract](../../end-to-end/recordings/contracts/native-library-read.md). Server DTOs, origins, journals and authorization remain unchanged. No new backend or cross-language controller is added. | Matched |
| Deliberately bounded native capability | First page of at most 20 recordings, explicit notice when more exist, first completed existing transcript/general notes without a latest-result claim. No upload, audio, processing writes, Ask or device SDK dependency. | Matched; full native app parity remains outside this pass |
| Safe native reads and retirement | Separate in-memory app token; HTTPS or exact development loopback; no cookies/cache/redirects; 30-second cancellation deadline, streamed 2 MiB limit, strict UTF-8/DTO/source validation; selection/session/background fences and joined reader cleanup. Android can wait for platform DNS/worker shutdown; Swift quarantines an owner after a five-second finalization failure. Uncertain cleanup refuses replacement. | Source and synthetic/loopback evidence; live backend and native interaction unverified |
| Optional Web SDK in common recording app | [DeviceSession](../../end-to-end/web-reference/web/features/devices/device-session.ts) lazily prepares the public SDK, then connects directly from a separate user gesture with exact printed serial. Snapshot reads verify connection identity. Auth/page/loss retires work; recording navigation does not change the Bluetooth owner. Demo is inert; library remains independent. | Source and synthetic lifecycle evidence; physical acceptance unverified |
| Published packages and dependency integrity | New Web feature pins public `@bota.dev/web-app-sdk` beta.20, verified against its registry archive and public declarations. Ten existing SDK roots retain beta.19. Kotlin uses pinned permissive dependencies and resolved-module/bundled-license checks; Swift has no third-party packages and checks the actual package/native dependency graph. | Package/build evidence below; no license exception or SDK publication by this task |
| Android transport compatibility and parser bounds | Public HttpCore 5.3.6 avoids the confirmed 5.4.4 Android linkage failure. Its sole requester installs explicit `Http1Config` limits of 100 headers and 8192 bytes per line, matching the upstream header-parser fix. Actual-client malformed-header/trailer tests are mandatory. | Configuration mitigation under qualification; the affected upstream version identity and scanner advisory remain open |
| Public discovery and AI-tool entry | README platform tables, integrated README, design/architecture/roadmap, agent/AI guide and public documentation describe actual read-only native and optional Web capabilities. Existing 77 catalog identities stay; Kotlin/Swift are clients of `recordings`. | Checks below |
| Minimal useful CI | Native workflows run dependency/license checks, tests and native builds, including isolated Android emulator transport checks. Existing Web and combined-core CI retains its complete checks; no credential, physical-device or publication job is introduced. | Hosted results below |
| Preserve device authority and retained data | No physical/device operation, API write, journal adoption, app install or firmware change is part of this pass. Connection/status gives no pairing, project ownership, upload receipt or cleanup authority. | Matched scope; fresh encrypted-v2 physical acceptance remains unverified |

## Verification

Local environment: Windows, Node 22.23.2. Swift native compilation requires
macOS/Xcode and is not inferred from structural checks.

- Shared core: license/check/lint/format pass; 109 tests pass, with two POSIX
  permission tests skipped on Windows. Hosted Linux covers those tests.
- Web: frozen install/audit zero, license/format/lint/types, 165 server and
  67 UI tests pass; 17 device tests exercise lazy loading, explicit chooser,
  identity/loss/session fences and joined teardown/admission failures. Production
  build emits the lazy SDK chunk and WASM without an eager SDK preload.
- The production CSP regression fails without the narrow `wasm-unsafe-eval`
  addition and passes with it. General script `unsafe-eval`/inline allowance is
  absent. Real local static serving returns the installed public WASM unchanged
  with `application/wasm`, no-store and the same CSP; `WebAssembly.validate`
  accepts those bytes. This is asset evidence, not browser initialization or GATT.
- New Web public beta.20 was published October 21, 2026 00:34:50 UTC (October 20
  Pacific). The archive integrity and dependency provenance are retained with
  the feature; all non-SDK lock entries are unchanged.
- Cross-agent source review caught and repaired Swift absolute ID anchoring,
  immediate token revocation, same-session late 401 and retirement-time sticky
  cleanup failures. Kotlin likewise retains observed 401 expiry beyond selection
  cancellation, revokes the token and refuses another outbound read. Both reject
  whitespace in the exact supplied application token.
- Public documentation's two affected MDX pages compile. An additional run of
  its unchanged release-tool suite passes 65 of 73 tests on Windows; eight fail
  on Windows symlink permission and native absolute-path ESM fixture handling.
  No release-tool source is changed and no production documentation release is
  attempted. Those failures are outside the examples feature qualification.
- Browser smoke reached the built local demo entry screen; browser input/helper
  failure prevented verified library/device interaction. The temporary in-memory
  demo listener was stopped. Browser interaction remains unverified.
- Integration source `5441a861a77473fb6b1bf03f1aaa84166f693c5b` passes complete
  Linux/Windows [Web](https://github.com/bota-dev/examples/actions/runs/39529008691),
  [shared-core](https://github.com/bota-dev/examples/actions/runs/39529008688) and
  [catalog](https://github.com/bota-dev/examples/actions/runs/39529008699) workflows,
  plus [CodeQL](https://github.com/bota-dev/examples/actions/runs/39529008403).
  Linux covers the two permission cases skipped locally. Local catalog validation
  covers 77 identities, 84 documents and 535 local links; its nine regression tests
  pass. Separate changed-document checks cover the new clients and review.
- Swift source `5d015b69bac90121d9b1b220230418a24db5caf9` passes the
  [complete native workflow](https://github.com/bota-dev/examples/actions/runs/39528772293):
  22 Swift tests, two dependency/import-gate tests, actual package dependency
  validation, macOS app and unsigned iOS Simulator/device builds. Real loopback
  HTTP verifies GET headers/cookie isolation, all five redirect statuses, rejected
  status/MIME/encoding/JSON, declared/streamed limits, exact content sources,
  cancellation and the production deadline (30.095 seconds). Earlier CI exposed
  a redirect/error-lifecycle stall; the repair uses a known streaming data task
  and serial delegate, explicitly cancels redirects, and waits for both task
  completion and session invalidation. Failed finalization quarantines the owner.
  Cancellation before the read continuation installs and the callback-order 401
  race are source-reviewed; the failure-precedence policy and model retirement
  have deterministic regressions, without claiming every native callback order
  was injected.
- Kotlin's replacement 5.3.6 frozen offline build passes 26 JVM checks, lint with zero errors,
  debug app and instrumentation APK builds. Its dependency gate verifies 16
  modules and 11 actual JARs, including bundled license/notice hashes. Five shared
  real-transport checks cover GET/no retry, strict trusted-hostname/system-trust
  failure cases, bounded headers/trailers, body cancellation and joined reactor callback retirement.
  The same checks run on the hosted API 29 emulator. This new cloud reader
  requires Android 10/API 29 because the selected default TLS path uses that
  platform's ALPN API; existing API 26 SDK starters are unchanged.
- The first hosted Kotlin build stops before app compilation because Gradle
  cannot resolve standard Maven Central build-tool modules. Local anonymous GETs
  return the expected public POMs. Source
  `3060b24dd4c4ba50fff364719c2817ff901fd132` adds runner GET/HEAD response evidence
  and retained Gradle resolution logs; all 16 probes return HTTP 200 and its
  [frozen build job](https://github.com/bota-dev/examples/actions/runs/39529371578/job/118991484853)
  passes in 1 minute 51 seconds, including the full license/test/lint/APK gate and
  unchanged lock. No dependency, mirror, lock or retry policy changed. The initial
  failure's underlying HTTP/runner cause remains unproven; success on a later
  runner is not a retrospective diagnosis.
- API 29 crash capture at source `98c36073689be1659f2da5fd7b1ce7c0ada15c1d`
  ([job](https://github.com/bota-dev/examples/actions/runs/39531093561/job/118998779067))
  establishes HttpCore 5.4.4's `NoSuchMethodError` in
  `jdk.net.Sockets.supportedOptions`, called by `ReflectionUtils` during default
  `SingleCoreIOReactor.prepareSocket`. The public 5.3.6 archive avoids that default
  path, preserves system TLS/HTTPS endpoint checks and the reviewed real worker
  join, and changes no other resolved module. This is sample-specific compatibility
  qualification, not a claim of general Android support by Apache.
- The 5.3.6 coordinate remains affected by
  [CVE-2026-54399](https://github.com/advisories/GHSA-hf6x-8p5f-cgmf). The sole
  requester configures 100 headers and 8192 bytes per line, exactly the finite
  defaults in [Apache's fix](https://github.com/apache/httpcomponents-core/commit/d96a00f).
  Source review verifies propagation to response parsing, incomplete/folded lines
  and chunked trailers. Seven actual-client rejection fixtures pass on the JVM,
  including closure before EOF for an unfinished line; a socket timeout cannot
  satisfy that assertion. Eleven independent component parser probes also pass.
  These configured-path checks do not patch the upstream artifact, close a
  scanner finding or authorize suppression. API 29 application/runtime validation
  of this replacement and its fifth parser-limit case is still pending.
- Public docs source is pushed directly at
  [`f69984c`](https://github.com/bota-dev/docs/commit/f69984c2b514bdf7d01bef9a1af1f5a71d0cbdf4),
  preserving the concurrent owner's WiFi contract edits. Both changed MDX pages
  compile after that rebase. This source update is not a Mintlify production release.

Native tests/builds, browser smoke, catalog/link checks and exact-source hosted
receipts are being qualified. This review will record their final results before
completion. No live cloud read, native UI/decoding, physical Bluetooth/capture,
signed delivery, SDK/firmware publication or Mintlify production acceptance is
claimed.

## Remaining work

Native media, processing writes/Ask and device-to-cloud composition should be
added only as useful customer features with their own supported public contract
and lifecycle evidence. Retain the larger RN/Flutter/Web apps for the fuller
flow and the independent native SDK starters for device-only workflows.
Native Windows/Electron support and full encrypted-v2 physical acceptance remain
separate upstream/qualification gates. Public docs `main` is source, not Mintlify
production delivery.
