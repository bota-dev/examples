# Bota Recordings: integrated sample

One Node listener composes the existing Web and mobile service factories for the
integrated Recordings sample. Recording reads, transcription, general notes and
recording-scoped Ask have **one maintained feature implementation**. The existing
cookie/Bearer adapters, response projections and all three journals are retained.

**Current scope:** one combined listener with in-process processing/Ask
coordination and peer-intent refusal. Auth, persistence, webhook and native
service code retains its existing public-family paths. Older launchers remain
available for compatibility. Complete [Flutter](clients/flutter/README.md) and
[RN](clients/react-native/README.md) Android install roots are now relocated;
Web and backend service paths remain. The backend makes no SDK calls and adds no
duplicated runtime dependencies: Express/Vite resolve from the installed
Web root. Pinned development tools provide local checks. Fixtures need no live
key, account, audio or device.

## Find the public calls

| Feature                         | Public API integration                                                        | Source                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Recording library               | Owner-filtered recording pages and exact recording reads                      | [recordings.mjs](backend/features/recordings.mjs)                                                                      |
| Ordinary audio import/playback  | Durable import, verified completion and bounded authenticated WAV retrieval   | [upload.mjs](backend/features/upload.mjs), [playback.mjs](backend/features/playback.mjs), [http.mjs](backend/http.mjs) |
| Transcriptions and notes        | Source-filtered job reads, explicit creation, known-resource reconciliation   | [processing.mjs](backend/features/processing.mjs)                                                                      |
| Recording-scoped Ask            | Session membership, one question, answer/citation validation and GET recovery | [ask.mjs](backend/features/ask.mjs)                                                                                    |
| Safe error/operation projection | Shared error identity and narrow metadata for authorized operations           | [errors.mjs](backend/errors.mjs)                                                                                       |

This is first-party sample application code, not a new Bota API SDK. It teaches
ordinary public HTTP integrations. Read the [root design](../../DESIGN.md) and
[approved decision](../../docs/design-decisions/2026-10-12-integrated-recordings.md)
for the integrated architecture and remaining phases.

## Run a client

| Client                   | Current setup                               | Scope                                                                                               |
| ------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Flutter Android/iOS      | [Flutter README](clients/flutter/README.md) | Ordinary import/WAV playback, local sample or live library and AI views; optional connection/status |
| React web                | [Web README](../web-reference/README.md)    | Existing compatibility root; audio import, ordinary-import WAV playback and cloud recording views   |
| React Native Android/iOS | [RN README](clients/react-native/README.md) | Ordinary import/WAV playback and cloud recording views; encrypted device sync stays Android-only    |

Each client retains its own manifest, lock and native identity. Old
[Flutter](../react-native-recording-sync/flutter/README.md) and
[RN](../react-native-recording-sync/app/README.md) READMEs forward to their new setup.
Both clients retain `8787` input defaults, and RN native recovery retains its
original host-origin identity. For retained native captures, keep that original
origin: the combined host can use `PORT=8787` and
`APP_ORIGIN=http://127.0.0.1:8787`, with `adb reverse tcp:8787 tcp:8787`.
Do not reset journals or rewrite capture identity to use another port.

For fresh cloud setup on the combined default port, run
`adb reverse tcp:5173 tcp:5173` and explicitly enter `http://127.0.0.1:5173` with
the separate `APP_ACCESS_TOKEN`. Match the configured port and app origin.
Both clients' sample modes use local memory and need no backend.

RN's [App.tsx](clients/react-native/App.tsx) admits sample/live sessions;
[Recordings.tsx](clients/react-native/Recordings.tsx) renders library/detail;
[library-api.ts](clients/react-native/library-api.ts) and
[recordings-controller.ts](clients/react-native/recordings-controller.ts) own
bounded requests, source/session fences and retained uncertain locks.
[DeviceSync.tsx](clients/react-native/DeviceSync.tsx) uses its complete native
host/guard graph; copy it through the client setup rather than as a standalone file.

## Check the core

Use Node **22.23.2+** and npm from this directory:

```sh
npm ci
npm run license-check
npm run check
npm run lint
npm run format:check
npm test
```

This source-only JavaScript core needs no transpilation/build. `check` validates
syntax; contract tests exercise ownership, DTOs and recovery against local
fixtures. Those fixtures prove no live Bota API, provider, storage or device
result. Real SQLite/HTTP adapter regressions run in the web/mobile suites.

The license gate checks installed package metadata, including scoped/nested
packages and packages marked private. Its conservative SPDX subset permits
`MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC` and `BlueOak-1.0.0`.
`AND` requires every term to pass; `OR` permits a recognized permissive alternative,
with parentheses and normal `AND` precedence. Known blocked terms such as
`GPL-3.0-only` may occur in an `OR` alternative. Unknown identifiers, `WITH`,
malformed expressions and missing/unreadable/invalid metadata fail closed.
There are no package-name exceptions. Linked package trees require separate
qualification. This is a metadata gate, not an audit of bundled source or license
texts. CLI fixture regressions run in the normal `npm test` chain.

## Run an application

Use the full public repository checkout: the combined launcher imports this
backend, the [Web family](../web-reference/README.md) and the
[mobile backend](../react-native-recording-sync/backend/README.md). Copying only
one of these folders is insufficient. Install the Web runtime and this package's
development tools, without installing the legacy root workspace:

```sh
cd end-to-end/web-reference
npm ci
cd ../recordings
npm ci
npm run demo
```

Open `http://127.0.0.1:5173` and select **Open demo**. Combined demo serves only
the Web app with in-memory synthetic state. It supplies no mobile Bearer/device
authority; RN/Flutter **Try sample recordings** modes remain independently local.
The demo proves no live API/provider/storage or physical result.

For configured use, prepare a private `.env` from the package's environment
template, then use `npm run dev` for development or `npm start` after building
the Web assets in their existing root. `npm run account -- <username> <eu_id>`
uses the existing account helper at the explicit Web account location. Application
sign-in and mobile Bearer tokens are separate from the server-held Bota key.

| Setting                                                | Required contract                                                                                                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WEB_LAUNCH_DIR`, `MOBILE_LAUNCH_DIR`                  | Absolute existing original launch directories. No new-launcher CWD defaults.                                                                                           |
| `WEB_ACCOUNTS_FILE`, `WEB_STATE_DIR`                   | Absolute existing locations, or original-base defaults `accounts.json` and `.state`. The account file is private under trusted parents; state parents are private.     |
| `MOBILE_JOURNAL_PATH`, `MOBILE_LIBRARY_JOURNAL_PATH`   | Absolute original journals, or old defaults `data/recording-sync.sqlite` and that path plus `.library.sqlite`. Web retains `.state/reference.sqlite`.                  |
| `BOTA_API_BASE_URL`, `BOTA_API_KEY`, `BOTA_PROJECT_ID` | Shared trusted public API configuration; the key remains server-side.                                                                                                  |
| `BOTA_END_USER_ID`, `MOBILE_ACCOUNT_USERNAME`          | Fixed mobile end user must match a server-owned Web account. One match is required, or an explicit matching username when multiple accounts map to that user.          |
| `APP_ACCESS_TOKEN`, `BOTA_DEVICE_ID`                   | Separate mobile application token; device configuration remains optional under the original validator.                                                                 |
| `PORT`, `APP_ORIGIN`                                   | One listener binds `127.0.0.1`; local HTTP origin and port must match. Original HTTPS reverse-proxy origin policy remains, without a production deployment/auth claim. |

Stop the older Web/mobile listeners before starting the combined server. Default
startup requires all three original journals to exist. Read-only preflight checks
private regular files, symlink/alias/hardlink rejection, original columns/order,
primary/unique indexes and native/library scope identities before writable stores
open. Restore the original configuration on failure; do not delete or replace
journals to force startup. Windows Node stat cannot prove filesystem ACL privacy.

Only a fresh installation with **all three journals absent**, existing trusted
parents and an account file may use `npm run initialize` (`--initialize`). A
partial or existing set is refused. Initialization is not migration or rekeying;
ordinary restart never creates missing replacement journals. No path check is
atomic against a concurrent filesystem writer.
Use `npm run initialize -- --dev` when serving unbuilt Web assets through Vite;
otherwise build the Web assets in their existing root before the static launcher.

The common incoming-header/body budgets are **10/30 seconds**, stricter than the
older standalone Web **15/180 seconds**. These cover input receipt; existing
per-feature upstream processing deadlines are unchanged. Cookie/Bearer header
presence selects one adapter, with mixed/duplicate credentials rejected and no
fallback. Web Origin/body and mobile no-Origin/Bearer rules remain distinct.
Combined development serving denies configured account/journal files and sidecars
before Vite rewrites filesystem URLs or serves fallback HTML. Logical/native-real
paths and private-file identities cover Windows short names, drive differences
and file aliases; Vite retains both path variants and its default denials.
This remains a local sample host.
Static serving, including static demo, preflights `dist` within 10,000 entries
and depth 32. Nested symlinks/junctions, nonregular entries and hardlinks to
configured account/journal files or sidecars are refused; genuine assets pass.
This checks known file aliases, not arbitrary copied private content, and does
not protect against another filesystem writer or races after preflight.

Fresh processing/Ask claims refuse every matching peer intent, even if its ID is
known or its state complete. No peer resource ID is adopted into a fresh Web
intent. Existing own GET-only recovery and native/library exact-known-ID paths
remain intact. These guards coordinate only this process; separate listeners,
external writers and automatic platform processing are not synchronized.
Shutdown drains pending Web/mobile route work before closing journals, including
work whose client socket has disconnected; socket closure alone is not completion.

Older [Web](../web-reference/README.md) and
[mobile](../react-native-recording-sync/backend/README.md) launch commands remain
compatibility entry points with their original CWD/state rules. SDK/client/native
manifests, locks and app identities are unchanged. Flutter and RN complete install
roots, helper/guard graphs and CI/discovery paths have moved together to `clients/`.
Web remains at its compatibility path. These moves do not relocate the mobile
backend launch base or journals, add iOS/playback/import, or expand SDK capability.
The separate [October 20 implementation](../../docs/design-reviews/2026-10-20-ios-mobile-recording-flows.md)
adds iOS hosts and ordinary mobile import/playback; it does not alter those
relocation guarantees or add Flutter/iOS encrypted device sync.
Only SDK-only connection/status workflows are backend-free; the native encrypted
upload path retains its documented backend and completion requirements.

## Copy or adapt a feature

Copy the selected feature together with its imports. Ask and processing both
need `recordings.mjs` and `errors.mjs`. Supply a server-derived context with:

- `principal`: authorized `projectId`, `endUserId` and the store's existing
  account/scope identity.
- `request(method, path, body?)`: a bounded authenticated public API client;
  keep the Bota key on the server and preserve redirect/size/time limits.
- `store`: scoped durable `claim`, `save` and `get` methods; Ask also requires
  `find` and `findLegacyAsk` to retain canonical and earlier question intents.
  Use the existing [web store](../web-reference/server/store.mjs) or
  [mobile library store](../react-native-recording-sync/backend/library/store.mjs)
  as the concrete contract. Retain its schema, paths, hashes, anchors and known IDs.

The core's project-field policy is strict by default. Mobile retains that policy.
The web compatibility exports explicitly permit omitted `project_id` fields in
their existing public response contract while retaining owner/source checks.
Every supplied mismatched project is denied. This policy belongs to the trusted
server adapter; clients cannot select it.

Web processing adapters preserve their operation-only mutation/recovery DTOs
and summary projection. Mobile preserves source-linked processing DTOs and native
transcription arbitration. Both retain returned valid IDs before later response
checks and mark post-create reconciliation failures uncertain. Recovery never
creates a replacement resource. Authorization denials expose no operation metadata.

To adapt a complete running route, also copy its auth, bounded HTTP and persistence
adapters from the corresponding web/mobile backend and the combined host/config
when using both credential paths. Replace the application's identity mapping
without weakening ownership. Preserve the combined claim guards; sharing source
does not authorize cross-journal resource adoption or replacement writes.

## Current delivery boundary

The integrated sample's future clients and remaining feature folders are not
empty scaffolds in this directory. Existing SDK pins, native material/receipt
handling, source-cleanup authority, app identifiers and compatibility launchers
remain unchanged. Cloud job success or legacy `uploaded` grants no device cleanup.

See [combined-listener qualification](../../docs/design-reviews/2026-10-12-unified-recordings.md)
for exact checks, source and remaining acceptance. Hosted CI, live API and physical
results are separate from local contract evidence.
