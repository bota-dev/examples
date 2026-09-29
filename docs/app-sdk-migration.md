# React Native App SDK migration

The existing `apps/react-native` example moves to native app version 0.2.0 and
the exact published beta dependency `@bota.dev/react-native-app-sdk@2.0.0-beta.6`.
Its Expo 57 dependencies use the Expo native-module matrix (React 19.2.3,
React Native 0.86.3). The old standalone packages and BLE PLX are removed.
Rebuild the native application; an OTA bundle or Expo Go cannot install the SDK.

Android uses API 26 or newer and requests scan/connect permissions on Android
12+, or location permission on older versions. The app retains the public
`BotaClient` compatibility flow. Upload completion is an explicit host callback
to this example's backend, bound to the allocated recording ID; the SDK must
receive that acknowledgment before native cleanup and device confirmation.
The separate web route explains how to use a native build without importing
the native Bluetooth module. It is not a Web App SDK integration.

## Scope and acceptance review

| Requirement | Evidence | Status / remaining verification |
| --- | --- | --- |
| Consume one exact published App SDK | Manifest, npm-generated lockfile and public imports | Matched; local install and hosted frozen install pass |
| Match native platform floors | Expo matrix and build-properties API 26; runtime permission request | Matched; hosted Android debug native build passes |
| Backend acknowledgment before cleanup | Completion callback; success and HTTP 425 tests | Matched in local tests |
| Preserve dependency security fixes | Existing overrides, postinstall adapter and actual-consumer security tests | All 27 tests pass; npm audit reports zero vulnerabilities |
| App and backend compile; all-platform export | Both typechecks and backend build pass; Expo dependency check passes | Matched; local and hosted Android/iOS/web exports and Android native build pass |
| Public integration only | Public SDK types and existing example backend routes | Matched; no private app helpers copied |

This remains the existing local, single-user compatibility example. Its backend
has no caller authentication and must not be exposed as a production multi-user
service. Raw-token provisioning is a compatibility path, not target
prepare/provision/confirm binding. Restart recovery, client-presence heartbeat
integration and encrypted-v2 orchestration are not demonstrated here. No new
device or live-backend test is claimed. The planned independent example catalog
is outside this migration. There is no store-release project for this sample;
publication of its verified source is its release.

The old lock could not resolve the aligned Expo 57 peers. npm regenerated it
from the existing workspace manifests without force or legacy-peer overrides.
The scoped decoder/Xcode overrides and postinstall adapter are unchanged and
their actual-consumer regressions pass against the new graph. Local verification
uses Node 22.23.2 and npm 10.9.8. The initial unrestricted Windows Metro export
was stopped for excessive worker resource use. The two-worker rerun passed all
three platform exports. [CI 36512917625](https://github.com/bota-dev/examples/actions/runs/36512917625)
passed for source 64a9fd0, including frozen install, all 27 tests, typechecks,
backend build, all-platform exports and a fresh Android native build. That
verified source is merged to main. iOS native linking and physical-device
acceptance are not established by the JavaScript export.
