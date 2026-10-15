# React Native beta.18 consumer review — October 14, 2026

This records fresh local adoption of public SDK `2.0.0-beta.18` in the
[connection example](../../app-sdk/react-native-device-connect/README.md) and
[Recordings client](../../end-to-end/recordings/clients/react-native/README.md).
The [global beta.18 review](2026-10-14-beta18-sdk-adoption.md) owns the public
package inventory, other platforms and the legacy workspace. The successful beta.17
source `a7b34175eff07b6ab55af66991ae8a60043930f1` and its hosted results remain
[historical evidence](2026-10-14-published-sdk-adoption.md), separate from these checks.

## Inputs and preserved boundaries

Both independent npm manifests and locks select the public beta.18 package;
the recording material host selects matching Maven
`dev.bota:bota-app-sdk:2.0.0-beta.18`. Each normally resolved lock changes only
its root SDK pin and the SDK version, public tarball URL and integrity tuple.
The npm SRI matches the public registry:

```text
sha512-wFV2Ut71Fp2sCebHNBVq7SKliAgQKc1u4E0mmXi7It+ChbEbL1Mg0c5VorAdBI8LGwjXK0COAXXhMM/sSEAPsA==
```

Both clients retain the public `BotaClient` / `BotaDeviceSDK` native-workflow
compatibility entry. This is package adoption, not a generated-JS `/runtime`
OS-port migration or verification of beta.18's generated BLE adapter fix.
Screen, identity, lifecycle, backend, controller and native host implementations
are unchanged. SDK material and receipt authority, configured principals,
`8787` origin defaults, native capture journals and cleanup gates remain intact.
There is no private SDK/helper, custom GATT or new cryptographic implementation.

Expo 57.0.4, React Native 0.86.3, platform minimums, app IDs and app versions
remain unchanged. Neither independent app has an OTA runtime/Updates policy;
the separate legacy app's runtime change is reviewed in the global report.
Every existing install hook, test chain, vendor archive and integrity guard stays.

## Fresh local qualification

Windows, Node 22.23.2/npm 10.9.8, JDK 17 and the documented Android toolchain:

| Check | Connection | Recordings |
| --- | --- | --- |
| Ordinary frozen `npm ci` | Pass; 475 installed packages, zero reported audit findings | Pass; same |
| Mandatory guards | All 803 signing and 218 Metro assets; Forge/braces absent | Pass; same |
| Installed license policy | 448 identities, no forbidden licenses | Pass; same |
| TypeScript | Pass | Pass |
| Existing `npm test` | 58 pass: 1 identity + 32 signing + 21 Metro + 4 source-map | 100 pass: 43 app/controller + 32 signing + 21 Metro + 4 source-map |
| Complete installed npm graph | No problems; SDK beta.18 | No problems; SDK beta.18 |
| Normal Android Metro export | Pass; 633 modules, 212.7 seconds | Pass; 644 modules, 231.4 seconds |
| Fresh arm64 debug native build | Pass; 183 executed tasks, 5m15s | Pass; 209 executed tasks, 5m8s |
| Native material-host JVM tests | Not applicable | 10 pass, zero failures/errors/skips |

Exports used the normal existing scripts and default Node heap, sequentially.
Native builds used the existing required tasks with `--max-workers=2` and
`-PreactNativeArchitectures=arm64-v8a`; no gate, archive or guard was bypassed.

Actual `createRequire` lookups from `App.tsx`, `DeviceSync.tsx` and the recording
module's `index.ts` resolve the owning public package version **beta.18**.
The same lookups pass in both short native build copies: six actual caller
checks, not merely manifest or root-lock inspection.

The fresh short build roots contain only the complete tracked public client
sources: 46 connection and 74 recording files. Every copied file's SHA-256
was checked and recorded before installation; after normal Expo prebuild and
Gradle execution all source hashes still match. Expo reports no package changes.
No ignored installation, native output, private configuration or user state was
copied. The fresh native test XML is timestamped `2026-10-15T00:06:54.373Z`
(October 14 in the review's Pacific date).

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Connection Android Hermes export | 8,184,612 | `05462032df8debed431b81b765ab723c73928a7f4e0aec4808450a21c117ff6a` |
| Recordings Android Hermes export | 8,285,429 | `f6a0fd40189cbca616b6052262d7b66d5b9080ec2ee1128cfd13d832e6f445af` |
| Connection arm64 debug APK | 48,830,067 | `3ef814ed48cd9a5bdfd95ea616cfcb0d6dd14f0c87b94bfd3d904549b7336c56` |
| Recordings arm64 debug APK | 48,862,806 | `6ba347365d15ff73255db55b01af011a8bfbb4e05e7c1d3223768b22637bd33b` |

Local logs, full copy SHA inventories, installed graphs and actual-resolution
receipts are retained under
`C:/Users/zhang/ws/.artifacts/sdk-latest-20261014/beta18/`. Short native trees
are `C:/Users/zhang/ws/.artifacts/r18c` and `r18r`. These local artifacts are
not committed or represented as publicly downloadable CI artifacts.
The four changed local README/AGENTS files have 35 valid local file links;
source and staged whitespace checks pass.

## Design conformance and remaining checks

| Requirement | Evidence | Status |
| --- | --- | --- |
| Exact public SDK and matching native version | Frozen SRI, six true caller resolutions, clean graphs and native linking | Matched locally |
| Independent, copyable public roots and dependency controls | Complete source copies; existing guards, license checks, tests and exports | Matched locally |
| Preserve identity, journals, lifecycle and receipt/cleanup ownership | Unchanged application/host implementations; existing 43 app/controller and 10 native tests | Conserved source and bounded local tests; no new physical claim |
| Use supported compatibility entry without claiming runtime migration | Public package APIs compile; current setup states the retained entry | Matched for this version-update scope |
| Exact-source hosted Android and connection iOS builds | Existing workflows retained | Unverified for beta.18 at this local-review checkpoint |
| Installed app, Bluetooth/MTU behavior, cloud transfer and cleanup | No device installation, live Bota API, recording upload or physical operation performed | Unverified |

Native debug assembly is not installed-app or Bluetooth acceptance. The
connection sample's iOS host requires its own exact-source macOS build;
the Recordings client remains Android-only. No new production, unattended
background, source deletion or generated-JS host acceptance is claimed.
