# Bota Example Mobile App

Expo 57 app demonstrating `@bota.dev/react-native-app-sdk@2.0.0-beta.19`
(beta) with the existing local example backend. App/native runtime: 0.5.0.

This update retains the public native-workflow compatibility entry, local-only
backend and legacy provisioning/recovery limits. It does not adopt the
generated-JavaScript `/runtime` entry. Current package and build evidence is in
the [SDK adoption review](../../docs/design-reviews/2026-10-20-sdk19-catalog-ios.md).
The `appVersion` OTA policy now selects runtime 0.5.0: rebuild the native app
before using this SDK update. Older native runtimes must not receive its JavaScript.

## Run

```bash
EXPO_PUBLIC_EXAMPLE_API_URL=http://localhost:4000 npm start
```

Use a development build rather than Expo Go because BLE requires native modules.
Install from the repository root using Node 22.23.2+ and `npm ci`. Build with
`npm run android` or, on macOS, `npm run ios` from this directory. Android requires
API 26+ and the requested Bluetooth/location permissions. Set the API URL to a
LAN-reachable address for a physical phone.
The web route displays native-build instructions; it does not import the native
Bluetooth module or claim browser Bluetooth support.

The backend completion callback must succeed before the SDK confirms deletion.
See the [migration review](../../docs/app-sdk-migration.md) for verification and
the retained local-only authentication, provisioning and recovery limitations.

## Node signing-tool dependency gate

Keep installation scripts enabled. This install root carries its own
`vendor/expo-native-signing` public-upstream sources, reproducible archives and
provenance. Its mandatory `verify-native-expo-signing.mjs` checks all 803 installed
CLI/provider assets and rejects Forge in the lock or physical tree; 32 native
contract/caller cases replace the previous Forge-only suite. Existing braces,
source-map, query-string and native checks remain required where applicable.
See [the exact scope and local/hosted limits](../../docs/native-expo-signing-replacement.md).
No public SDK/Expo version or application/device behavior is upgraded by this
development-tool replacement.

The legacy root also carries the [maintained public-parent matching replacement](../../docs/legacy-public-parent-matching-removal.md)
for Braces #113. Keep its mandatory read-only asset/absence attestation and
20-case suite active. The dated remediation preserved SDK beta.6/runtime 0.2.0;
this separate SDK beta.19 update retains the native/signing workflows and
requires a new native runtime.
Local exports/prebuilds do not establish hosted assembly,
installed Bluetooth behavior or scanner closure.


October 13 Chokidar public-boundary correction: the original maintained parent
nomination remains historical and held. The corrected 3.6.0 archive preflights
selected normalized brace selectors before public watch/add state or async work,
with prospective full-array ignore ordering and unchanged literal/non-glob paths.
Run the required public-boundary cases through `npm run test:braces-security`;
independent shared component clearance does not replace current-owner source,
normal/frozen, hosted/native/scanner or production gates. See [the bounded review](../../docs/legacy-public-parent-matching-removal.md#october-13-public-chokidar-boundary-correction).
