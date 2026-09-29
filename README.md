# Bota Examples

Examples for integrating the Bota backend API and Bota App SDK into your own applications. API examples demonstrate server-side workflows; App SDK examples demonstrate communication with physical Bota devices; end-to-end examples connect the two.

Each new example will have its own setup, dependencies, verification steps, and compatibility notes. You do not need Bota's internal application repositories to run an example.

## Current status

The first independent API example is implemented and locally tested. The remaining catalog entries are planned. The existing React Native/backend pair remains at its original paths while it is evaluated for migration.

| Existing source | Purpose | Status |
| --- | --- | --- |
| [React Native app](apps/react-native/README.md) | Device discovery, connection, status, recording control, provisioning, and sync | App SDK beta.6 compatibility sample; Android native build verified by prior migration CI; physical-device acceptance remains open |
| [Express backend](apps/backend/README.md) | Server-side Bota API calls supporting the app | Local development sample; no caller authentication or per-user resource authorization |

The existing app pins `@bota.dev/react-native-app-sdk@2.0.0-beta.6` (beta), app version 0.2.0. Rebuild native apps after installing. Its immediate binding/raw-token provisioning flow remains a compatibility gap, not the current target lifecycle. The existing backend uses one configured end user. Use it only in an isolated local test environment; it is not a multi-user backend template.

See [Architecture](ARCHITECTURE.md) for the target design and migration gates. [SDK migration and verification](docs/app-sdk-migration.md) records successful all-platform exports and an Android native build, superseding the historical Hermes export failure. [Dependency security](DEPENDENCY_SECURITY.md) records required installation patches and regression checks. iOS native linking and physical-device acceptance remain unverified.

## Example catalog

Linked entries are implemented; unlinked paths are planned. Each example documents its own verification limits.

| Order | Planned path | What it teaches | Physical device |
| --- | --- | --- | --- |
| 1 | [Upload and transcribe (Node.js)](api/upload-and-transcribe-node/README.md) | Upload local audio, verify completion, request transcription, retrieve text; locally tested, live API verification pending | No |
| 2 | `api/webhook-receiver-node/` | Verify webhook authenticity using the public contract and handle duplicate delivery | No |
| 3 | `app-sdk/react-native-device-connect/` | Initialize the published SDK, select and verify a device, connect, read status, disconnect | Yes |
| 4 | `end-to-end/react-native-recording-sync/` | App + customer backend: binding, device recording upload, transcription, summary | Yes |
| Later | Python API example; Apple, Android, Flutter, and Web SDK examples | Equivalent focused workflows for additional platforms with published support | Depends on workflow |

Native SDK smoke samples used to develop the SDK itself belong in the SDK source repository. These customer-facing examples consume published artifacts.

## Run the existing sample

These commands apply only to the current `apps/` workspace, not the planned examples.

Prerequisites: Node 22.23.2 or newer, npm, a Bota API key and test end user in the intended project, and native Android/iOS development tooling for the mobile app. Android requires API 26 or newer; iOS builds require macOS and Xcode. BLE requires a native development build; Expo Go is insufficient.

From the repository root:

```sh
npm ci
```

Copy `apps/backend/.env.example` to `apps/backend/.env`. Set `BOTA_API_KEY`, `BOTA_END_USER_ID`, and the intended `BOTA_API_BASE_URL` (the current code expects the `/v1` suffix). The current default reaches the production API; explicitly select your intended environment and disposable test resources.

In one terminal:

```sh
npm run dev:backend
```

Set `EXPO_PUBLIC_EXAMPLE_API_URL` to the backend URL in the mobile terminal. On a physical phone, use a reachable development-machine address, such as `http://192.168.1.20:4000`, not the phone's `localhost`.

```sh
npm run android -w @bota-dev/example-react-native
# Or, on macOS:
npm run ios -w @bota-dev/example-react-native
```

For an already installed compatible development build, `npm run dev:react-native` starts Metro. Existing native build limitations still apply; these commands were checked against manifests, not executed as part of the architecture work.

Lifecycle scripts must be enabled for `npm ci`. If installation scripts were disabled, run `npm run postinstall` before using the sample; see [dependency security](DEPENDENCY_SECURITY.md).

## Verification

The current root CI runs:

```sh
npm test
npm run typecheck
npm run build
```

These commands cover dependency and upload-completion regression checks, workspace typechecks, and the backend build. CI also runs all-platform Expo exports and a separate Android native build. See [migration evidence](docs/app-sdk-migration.md) for prior results; pairing, iOS native linking, and live API/device workflows remain separate gates. Each new example will document its own checks and last verified SDK/platform combination.

## Integration boundary

- Keep Bota secret and restricted API keys on your server, never in mobile/browser code or public environment variables.
- A customer backend authenticates app users and authorizes their resources before calling Bota's public API. It is not an unrestricted API proxy.
- Apps may upload bytes directly to scoped storage URLs issued through the backend. That does not grant access to the Bota secret API key.
- Use synthetic or explicitly consented test audio. Do not commit recordings, credentials, signed URLs, or device provisioning material.

## Documentation

- [Architecture](ARCHITECTURE.md): repository structure, integration contracts, migration, and acceptance gates.
- [Contributor and agent instructions](AGENTS.md): how to add and verify examples.
- [Claude Code entry point](CLAUDE.md): shared instructions for Claude Code.
- [Bota public documentation](https://docs.bota.dev): API and SDK integration contracts.

Start with [upload and transcribe](api/upload-and-transcribe-node/README.md) for a standalone API integration. Complete each example's acceptance gates before expanding its support claims.
