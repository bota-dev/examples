# Bota Recordings: integrated sample backend core

The first implementation step toward one integrated Recordings sample with a
shared backend and platform clients. Recording reads, transcription, general
notes and recording-scoped Ask now have **one maintained feature implementation**.
Both existing web and mobile backends call these modules through compatibility
adapters.

**Current scope:** one shared feature implementation, two existing HTTP
listeners. Authentication, persistence and native capture coordination remain
in their original adapters. A unified listener, shared write arbitration,
upload/webhook consolidation and relocated clients are not implemented here.
There are no runtime dependencies or SDK calls in this core; pinned dev tools
provide its checks. No key, account, backend, audio or device is needed to run
the local contract tests.

## Find the public calls

| Feature                         | Public API integration                                                        | Source                                            |
| ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| Recording library               | Owner-filtered recording pages and exact recording reads                      | [recordings.mjs](backend/features/recordings.mjs) |
| Transcriptions and notes        | Source-filtered job reads, explicit creation, known-resource reconciliation   | [processing.mjs](backend/features/processing.mjs) |
| Recording-scoped Ask            | Session membership, one question, answer/citation validation and GET recovery | [ask.mjs](backend/features/ask.mjs)               |
| Safe error/operation projection | Shared error identity and narrow metadata for authorized operations           | [errors.mjs](backend/errors.mjs)                  |

This is first-party sample application code, not a new Bota API SDK. It teaches
ordinary public HTTP integrations. Read the [root design](../../DESIGN.md) and
[approved decision](../../docs/design-decisions/2026-10-12-integrated-recordings.md)
for the integrated architecture and remaining phases.

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

Check out the repository so the compatibility adapters can resolve this shared
core. Continue to install/run from their existing directories:

- [Web app](../web-reference/README.md): `npm ci`, `npm run demo` in
  `end-to-end/web-reference`; synthetic mode needs no credentials.
- [React Native and Flutter](../react-native-recording-sync/README.md): follow
  their independent install instructions. The existing authenticated backend
  launcher remains in `end-to-end/react-native-recording-sync/backend`.

Keep the old launch working directory and explicit existing state paths. No
new launcher opens a replacement journal. Web cookie accounts, mobile Bearer
identity and the distinct web/cloud/native stores retain their original contracts.
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
adapters from the corresponding web/mobile backend. Replace the application's
identity mapping without weakening ownership. These adapters are temporary
compatibility boundaries; the next migration must coordinate retained intent
across all stores before serving web/mobile/native writes from one listener.

## Current delivery boundary

The integrated sample's future clients and remaining feature folders are not
empty scaffolds in this directory. Existing SDK pins, native material/receipt
handling, source-cleanup authority, app identifiers and compatibility launchers
remain unchanged. Cloud job success or legacy `uploaded` grants no device cleanup.

See [verification and migration review](../../docs/design-reviews/2026-10-12-integrated-recordings.md)
for exact checks, source and remaining acceptance. Hosted CI, live API and physical
results are separate from local contract evidence.
