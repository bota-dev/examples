# Agent instructions

## Purpose and current work

- Build public demo/sample/template code for customer developers building apps for their own end users. Read [DESIGN.md](DESIGN.md), [ROADMAP.md](ROADMAP.md) and [ARCHITECTURE.md](ARCHITECTURE.md) first.
- Exactly two product layers: general capabilities now; vertical use cases and consumer app types later. API, SDK and combined examples are formats within the first layer.
- Owner-approved architecture: one integrated Bota Recordings sample with one shared backend and platform-specific web, React Native, Flutter, Kotlin and Swift clients. Keep public calls in copyable feature modules. SDK-only connection/status works without the backend; each client declares its actual capabilities and host evidence.
- Ordinary app UI serves recording users. Public-call explanations and technical details belong in README/source. Do not create another API Explorer or expand toward a catalog count.
- Web ordinary-import playback uses a bounded public WAV export with explicit source/encryption evidence, fresh owner/session checks and transient browser media. See the [playback contract](end-to-end/web-reference/README.md#playback-contract) and [synthetic live HTTP acceptance](docs/design-reviews/2026-10-14-web-playback.md#october-15-live-http-acceptance); browser decoding remains unverified and device/encrypted playback is unavailable.
- Preserve backend launch bases, journals, locks and SDK pins. The combined backend provides one listener with retained cookie/Bearer adapters and three journals. [Flutter](end-to-end/recordings/clients/flutter/README.md) and [RN](end-to-end/recordings/clients/react-native/README.md) have relocated; Web/backend paths stay. Preserve original native recovery origin/defaults; configure the combined host to that origin rather than reset journals or rewrite captures. Use the [combined setup](end-to-end/recordings/README.md).

## Select and inspect

- Start from the [README](README.md), [AI guide](docs/using-examples-with-ai.md), selected README and local DESIGN/AGENTS. Use [examples.json](examples.json) for the extended inventory.
- Install only inside the selected documented install root. Root npm commands apply to the legacy `apps/` workspace.
- Use published Bota SDK packages and public API contracts. All ten device SDK install roots, including the legacy workspace, pin beta.18. npm's `latest` tag remains beta.0; use exact versions. See [current adoption](docs/design-reviews/2026-10-14-beta18-sdk-adoption.md). Manifest/lockfile evidence takes precedence over historical prose.
- Demo/Bota One are read-only behavioral references. No private helpers, unpublished facade methods, custom GATT/crypto or sibling-repo runtime/install dependencies.
- Consolidate the integrated sample's backend feature implementation at `end-to-end/recordings/backend/`. Existing web/mobile paths may import that shared core as compatibility adapters. Preserve their auth, DTOs, launch CWD and journal anchors until tested migration. Independent API/SDK quickstarts stay self-contained; no private dependencies, wrapper SDK or universal UI framework.
- Combined startup requires the Web install plus mobile/backend/core source. Stop old listeners; default startup validates original explicit paths/schema/scope. `--initialize` permits only an all-missing fresh set. Preserve peer-intent refusal, own GET recovery and exact native/library known-ID paths; no Web peer-ID adoption or external-writer/atomic-file guarantee.
- Windows/Electron native device SDKs are upstream roadmap targets. Do not invent a native facade or infer full app parity from a connection example.

## Preserve integration contracts

- Read [example contracts](docs/example-contracts.md) before changing API, content, download, webhook, device or recovery behavior. Each selected README defines its exact contract and limits.
- Keep Bota secret/restricted keys server-side. Authenticate app callers and derive project/end-user authorization on the server; client IDs are not access grants.
- Persist intent before uncertain writes. Preserve scope, resource IDs, lock and journal paths; use known-resource GET reconciliation instead of repeating an uncertain POST/PUT/command.
- Keep cloud processing intents separate from native capture journals. API job status or legacy `uploaded` cannot authorize device cleanup; preserve SDK receipt and exact-generation gates.
- Fence asynchronous UI results to the current source/selection/session. Drain native work before replacement admission; failed final cleanup blocks replacement.
- Configure device IDs/serials. Do not hardcode a test wearable or commit real customer content, credentials, signed URLs or grants.
- Before an authorized physical-device mutation, read the relevant runbook/design and compare its gates with the command. Unbind/deprovision are not factory reset.

## Preserve dependency guards

- Chokidar public-boundary `disableGlobbing` controls must use filesystem-valid literal components. Its depth-200 fixture is split into 100/203/100-character components; parser-budget controls retain the original unsplit input. Never suppress filesystem errors to make the control pass. Exact hosted and scanner results remain separate in `DEPENDENCY_SECURITY.md`.

- Keep lifecycle scripts enabled and every existing postinstall/test chain. Read [dependency security](DEPENDENCY_SECURITY.md), [Forge parser mitigation](docs/node-forge-parser-mitigation.md), [braces migration](docs/braces-depth-mitigation.md) and [build-dependency remediation](docs/build-dependency-remediation.md) before changing manifests, locks, overrides or guards.
- Preserve the LF checkout rule for hashed `vendor/expo-native-signing/public-provenance.json` metadata; Windows CRLF conversion fails the original integrity guard. Never change its declared hash to match converted bytes.
- Three RN install roots require their own 803-asset native Expo signing guard and 32 public-contract/caller cases; Forge is removed by the reviewed self-contained development-tool replacement. Read [scope and evidence](docs/native-expo-signing-replacement.md). The legacy root uses the maintained owning public-parent matching/expansion replacement, a mandatory read-only asset/absence guard and 20 actual-parent cases. Read [current legacy source and limits](docs/legacy-public-parent-matching-removal.md); the earlier six-asset parser guard and 22 cases remain historical. The two independent RN roots use reviewed public Metro `.some` parents with unchanged picomatch 2.3.2, mandatory zero-braces/218-parent-asset verification and 21 removal/integrity cases. Read [qualification and delivery limits](docs/metro-public-matching-removal.md); unknown signing/source drift refuses.
- Keep four source-map-js suites in the respective root/app `npm test` chains, including Web CI. Root selector-parser overrides remain scoped to the two reviewed parents; no claim covers Tailwind's embedded fallback.
- Package/scanner identities, native builds and physical acceptance are separate evidence. Do not suppress alerts or claim closure from a downstream source patch.

## Verify, document and deliver

- State scope, assumptions and observable acceptance before implementation. Follow [CONTRIBUTING.md](CONTRIBUTING.md); run the selected example's meaningful tests/build checks, including required security suites.
- For docs/catalog changes: `node scripts/check-catalog.mjs` and `node --test scripts/test-catalog.mjs` on Node 22.23.2+. Check new docs' file links separately; the catalog checker has a fixed document set. No install or hardware run is needed for a docs-only change.
- Legacy checks: `npm ci`, `npm test`, `npm run typecheck`, `npm run build` from root. No root lint command. Native/export checks are defined by its README/workflow.
- After an SDK upgrade, verify the package resolved from the app, its manifest and its physical lock entry agree. `scripts/test-sdk-resolution.mjs` checks this in root `npm test`; a successful install alone can retain the previous nested workspace SDK.
- Search changed symbols/paths/tokens across affected docs. In a full workspace, include `internal-docs/`, public `docs/` and every repo's README/AGENTS/CLAUDE/ARCHITECTURE; consult the internal downstream matrix. Public contributors need no private workspace access; record unavailable cross-repo checks.
- Update affected README/design/architecture/agent guidance. Keep proposed directories out of the catalog. Preserve existing index IDs and file links unless an explicit migration includes compatibility and CI path changes.
- Before completion, use `bota-skills:compound-engineering` 1.2.5+ if available, otherwise review directly. Record requirement → evidence → verification → status and remaining gaps in a dated review.
- Distinguish source/syntax, unit, native build, live API and physical evidence. See [implementation evidence](docs/independent-examples-review.md); historical phone results qualify only the recorded source/packages/hardware.
- Owner delivery preference: commit and push completed, verified changes directly to the intended integration branch; no PR, force push or deployment-only branch update.

## Commit attribution

- Include the actual model's `Co-Authored-By` attribution on AI-authored commits.

The [previous instructions](docs/design-history/2026-10-12-agent-instructions-before-reset.md) are historical context, not current rules.


October 13 Chokidar public-boundary correction: the original maintained parent
nomination remains historical and held. The corrected 3.6.0 archive preflights
selected normalized brace selectors before public watch/add state or async work,
with prospective full-array ignore ordering and unchanged literal/non-glob paths.
Run the required public-boundary cases through `npm run test:braces-security`;
independent shared component clearance does not replace current-owner source,
normal/frozen, hosted/native/scanner or production gates. See [the bounded review](docs/legacy-public-parent-matching-removal.md#october-13-public-chokidar-boundary-correction).
