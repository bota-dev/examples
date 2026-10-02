# AGENTS.md - Bota Examples

## Post-Implementation Design Review

- Before reporting completion, use `bota-skills:compound-engineering` (1.2.5+) to compare results with the current authoritative design and acceptance criteria. See the [shared review workflow](../claude-code-plugins/plugins/bota-skills/skills/compound-engineering/SKILL.md).
- If the skill/source is unavailable, perform the review directly: record each relevant requirement, evidence, conformance status, and remaining verification; update affected docs and report deviations or unavailable checks without claiming full conformance.

## Read first

Read [README.md](README.md) for current availability, [ARCHITECTURE.md](ARCHITECTURE.md) for target structure and acceptance gates, and the README of the example being changed. This file is the canonical contributor/agent instruction source; `CLAUDE.md` refers here.

The repository contains an existing npm workspace under `apps/`, migrated to `@bota.dev/react-native-app-sdk@2.0.0-beta.6` while retaining compatibility lifecycle flows. Read [migration evidence](docs/app-sdk-migration.md) before changing it. The independent `api/upload-and-transcribe-node/` example is implemented, locally tested, and live-verified with a test key and synthetic speech. Seven additional examples are implemented under `api/` and `app-sdk/`; Python is also live-verified, and five connection samples consume exact public packages. All five App SDK connection examples pin public beta.10 after completed protected publication. Exact build and physical results are recorded in the review. Read [current evidence and blockers](docs/independent-examples-review.md). The full recording-sync replacement is not implemented. Do not confuse a proposed directory or workflow with implemented code. Documentation-only work must not silently upgrade packages, move examples, or run device operations.

## Implementation rules

The ninth example is `end-to-end/react-native-recording-sync`: Android with an
already-provisioned device and encrypted-v2 recordings only, using public beta.10.
Its native module owns authenticated HTTP callbacks and scope/session metadata;
SDK code owns recording bytes, transport and receipt confirmation. Keep the backend's
fixed project/end-user/device checks, explicit app authentication, exact binding
generation and durable uncertainty journal. Run backend tests, app tests/typecheck/
export, `:recording-sync:testDebugUnitTest` and Android assembly. Never weaken the
fresh idle/no-active-upload check or repeat uncertain writes to make the example
look recoverable. Physical and full-replacement acceptance are separate gates.

1. One example teaches one bounded workflow. Use the simplest structure that exposes the public integration clearly.
2. New examples install independently, with their own manifest/lockfile and README. An end-to-end example may have a local app/backend workspace. Do not extend the legacy root workspace to all examples.
3. Consume published Bota SDK packages and public `/v1/*` APIs. Pin direct SDK dependencies exactly and record the release channel. Verify availability and methods before choosing a version. Never assume private source HEAD is published.
4. Bota One is the primary internal integration reference. Read it to understand behavior and boundaries, then reimplement from public contracts. Do not import or copy private app helpers, native modules, comments, transforms, auth wrappers, account configuration, or infrastructure. No dependency on sibling repositories is allowed at runtime or install time.
5. No new GATT protocol implementation, custom crypto, generic SDK wrapper framework, or private `/dashboard/*` calls. If public SDK support is missing, document the blocker rather than building a hidden alternative SDK.
6. Do not share runtime code between independent examples. Avoid speculative examples, empty scaffolds, and a global package manager requirement for non-JavaScript examples.
7. Preserve unrelated source and dependency security fixes. Read [DEPENDENCY_SECURITY.md](DEPENDENCY_SECURITY.md) before changing the legacy workspace lockfile, overrides, or postinstall adapter.

## Trust and lifecycle boundaries

- Bota secret/restricted API keys remain in server environments. Never put them in mobile/browser configuration, committed fixtures, screenshots, or logs.
- New app-facing backends authenticate callers and authorize every resource against server-derived identity/project/end-user context. Do not treat IDs or workspace headers supplied by a client as authorization.
- If using the architecture's local single-user mode, require its separately configured app token and clearly document the fixed test identity and deployment limits. Do not copy the existing unauthenticated backend into a new example.
- Apps may relay scoped grants/opaque provisioning envelopes and use scoped upload URLs. Avoid logging those values.
- Use SDK identity reads to verify devices. Follow prepare/provision/confirm binding and exact-attempt abort/recovery; do not describe raw-token compatibility paths as target conformance.
- Preserve the selected upload protocol's durability and deletion requirements. Unknown outcomes require reconciliation; disconnection alone must not trigger concurrent BLE fallback while direct upload may remain active.
- Unbind is not factory reset. If device mutation is in scope, read the relevant runbook/design first and compare its gates with the command before execution.
- Use synthetic or consented audio. Do not commit real customer data or build automatic cleanup that can delete unrelated recordings/devices.

## Workflow

Before editing, state scope and assumptions, inspect the relevant public API/SDK contract, and define observable acceptance criteria. Check the example's actual manifest and source rather than copying stale version statements from prose.

Implement only the requested example/change. Keep pending target requirements and compatibility limitations explicit. A source implementation, mock test, native build, live API test, and physical-device test are different evidence levels.

For new examples, run their own documented install/check commands. Add meaningful checks for the changed behavior, especially authorization rejection, webhook verification, or retry/durability logic. Do not add tests that merely assert document text or mirror implementation details.

For `api/upload-and-transcribe-node/`, run `npm ci`, `npm run check`, and `npm test` from that directory. It uses Node built-ins and its own lockfile; no root install is needed. Its path-filtered workflow uses no live credentials. Follow its README before live verification; the test end user's auto-transcription must be disabled because this example creates the job explicitly.

The webhook receiver uses Node built-in SQLite and commits before acknowledgment; do not replace its durable inbox with an in-memory Set. Python uses no third-party packages (`python -m unittest -v`). React Native uses Expo 57's iOS 16.4 floor and a scoped `xcode` ? `uuid@11.1.1` override. Web needs browser user activation and Bota Identity service support. Apple is a macOS app; Flutter includes an Android host only. Use each README and workflow for native checks. The current published provisioning API still returns raw `deviceToken` through the React Native provider; it is not the target opaque prepare/provision/confirm flow. Encrypted sync requires application-native material handling. Do not bypass these boundaries to mark the replacement complete.

Legacy workspace commands, from repository root:

```sh
npm ci
npm test
npm run typecheck
npm run build
```

Use Node 22.23.2 or newer. These commands are part of current CI, which also runs all-platform Expo exports and a separate Android native build. `npm ci` runs a required postinstall adapter. `npm run build` currently builds the backend. There is no root lint command. Prior migration CI evidence does not establish iOS native linking or physical-device acceptance. For documentation-only edits, inspect links, paths, commands, and status claims; dependency installation and hardware tests are unnecessary unless the documentation change depends on new runtime evidence.

## Documentation and review

The independent React Native example's iOS gate uses macOS 26, Xcode 26.6, and explicitly selected CocoaPods 1.16.2. Xcode 26.3 fails in Expo's native ownership annotations. The passing simulator build is evidence for this example only, not the legacy workspace or physical Bluetooth behavior.

Keep Android example application IDs distinct so samples can coexist on a test phone. Kotlin uses `dev.bota.examples.kotlinconnect`, React Native uses `dev.bota.examples.connect`, and Flutter uses `dev.bota.examples.bota_connect`. For Windows USB RN tests, verify Metro answers on IPv4 loopback before launching the debug APK; see its README. The review records exact-serial connection, mismatch rejection, status, and reconnect on Samsung SM-A166U1 / Bota Pin firmware 1.0.19. Historical beta.8 Kotlin radio-off/reconnect passed on this pair. RN cleared stale state but reconnect failed with GATT 133; Flutter missed one adapter-off event and later reconnect failed. The SDK handles confirmed GATT loss, but Android adapter shutdown can omit that callback. Beta.9 adds native adapter-off cleanup. Keep transport policy in the SDK; do not add private GATT or polling workarounds to the examples. Keep explicit disconnect UI cleanup in `finally`, retain failure messages, and distinguish tested manual recovery from automatic loss detection.

Keep the changed example's README and root catalog accurate. Update `ARCHITECTURE.md` when boundaries, layout, or migration status change; update this file when contributor rules change. Keep `CLAUDE.md` a short entry point instead of duplicating architecture.

In the Flutter connection sample, preserve newer connection notifications when
an older connect/status Future settles. Run `flutter test` as well as analysis
and the native build after changing this lifecycle. Widget regressions establish
UI ordering only; they do not establish a fix for native GATT reconnect failures.

The earlier SDK adapter-off fix was published across synchronized beta.9 artifacts.
At that checkpoint all five pins and hosted builds were verified. Beta.9 phone tests cleared
stale UI on all three radio losses per framework. RN passed all first reconnects;
Flutter passed two and recovered the third after GATT 8/133 with a fresh scan,
without an app restart or additional radio cycle. Preserve this reliability
limit in the [adoption review](docs/independent-examples-review.md#beta9-adoption).
Earlier candidate labs passed three radio-off/explicit-reconnect cycles per
framework, with one initial RN timeout recovered on retry. Keep those results
separate from public-package acceptance. Never copy isolated Maven overrides
into these public examples.

Beta.10 adds exact-generation cleanup when explicit disconnect times out or
is cancelled without a native callback. Its late event must not cancel queued
replacement work. All five connection examples use exact public beta.10
dependencies. Protected publication and public native/Flutter verification
completed after CocoaPods registration and CDN propagation recovered. Preserve
the six Flutter UI completion-ordering tests and the public package boundary;
example builds and physical checks remain separate from publication evidence.
See [current adoption](docs/independent-examples-review.md#beta10-adoption) for
local, hosted and phone evidence. Do not claim this fixes the distinct GATT
8/133 issue or proves physical missing-callback behavior from simulated native
regressions.

Search changed tokens (paths, package names, environment variables, endpoints, symbols) across this repository's docs. In a full Bota workspace, also search `internal-docs/`, `docs/`, and every repo's `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, and `README.md`; inspect the internal-docs downstream impact matrix. Review each affected hit. If those repos are unavailable, record the missing cross-repo check; do not make private workspace access a prerequisite for public contributors.

Before reporting completion, use `bota-skills:compound-engineering` 1.2.5+ when available (shared workspace source: `claude-code-plugins/plugins/bota-skills/skills/compound-engineering/SKILL.md`). Otherwise review directly against the user's scope, this architecture, and the selected public contracts. Record requirement -> evidence -> verification -> status in the existing review section or a concise completion checklist. Use matched, intentionally diverged, partial, not implemented, or unverified; explain deviations and outstanding checks.

Do not call an example verified until its claimed acceptance gates have evidence. Report exactly what ran and what remains unverified. New device examples must identify hardware/firmware/platform coverage; hosted CI success must not be inferred from local commands.
