# October 7 new build-dependency alerts

The six records created at 22:11 UTC are a new population, separate from the
original 40-High review: Critical shell-quote #119, High source-map-js
#114/#115/#116/#118, and Medium postcss-selector-parser #117. They do not alter
the historical Forge/braces mitigation identities or release/physical evidence.

## Published fixes and exact scope

The root lock selects shell-quote **1.11.0** within React DevTools' `^1.6.1`.
The root, independent RN connection, standalone Web connection and independent
recording-sync app each select source-map-js **1.2.2** within actual PostCSS'
`^1.2.1`. Each has its own four-case source-map suite; the Web suite resolves
PostCSS from Vite's importer. The independent RN locks already used shell-quote
1.11.0. Only six package entries change: three in the root and one in each
independent install. Version, resolved tarball and integrity are the only changed
entry fields. Public SDK pins, app/backend/device code and native configuration
are unchanged. The existing query-string adapter and mandatory Forge/braces
postinstall chains stay enabled.

Root selector-parser **7.1.6** is an explicit cross-major override scoped to
`tailwindcss@3.4.19` and `postcss-nested@6.2.0`, whose declared ranges remain
`^6.1.2`/`^6.1.1`. A Tailwind 4 or postcss-nested 8 parent upgrade would expand
the styling migration; this qualified override changes only their shared parser.
Both versions expose the CommonJS entry and `dist/util/unesc` subpath used by
Tailwind, the same cssesc/util-deprecate dependencies and Node >=4 engine.
Major 7 makes insertion during AST iteration safe; 7.1 adds multi-node insertion
and later safety/namespace/whitespace/error corrections. This is not a claim
that every 6.x/7.x AST mutation or malformed-selector behavior is identical.
Remove the override only when supported parent ranges admit a fixed parser,
then repeat actual nesting, variant, `@apply`, exports and frozen installation.

The unchanged published Tailwind `peers/index.js` includes embedded parser code.
The scoped override covers external resolution in the exercised installed
Tailwind/PostCSS paths, not that embedded fallback or every bundled copy. No
embedded source is rewritten and no graph-only closure establishes its safety.

Public npm tarballs were downloaded and matched their SHA-512 integrity.
Source-map-js 1.2.2 (BSD-3-Clause) was published September 30 at 14:08 UTC;
shell-quote 1.11.0 (MIT) September 29; selector-parser 7.1.6 (MIT) September 3.
All exceed seven days at this October 7 evening check. Exact metadata is in
[the registry receipt](build-dependency-registry.json).
Advisories: [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q),
[shell-quote](https://github.com/advisories/GHSA-pqg4-j6r4-53mv),
[selector-parser](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).

## Qualification and CI contract

Tests use public installed dependencies and original local fixtures. They import
no sibling repository/runtime helper or private business code. Source-map tests
reject an oversized indexed offset at construction, without expanding the
vulnerable mapping, and preserve normal offsets/source content/actual PostCSS
maps. Shell-quote checks four line terminators after comments and a parsed URL
fragment, plus ordinary argument round trips; no shell command is executed.
Selector-parser counts native numeric-array membership comparisons on three
small flat selectors instead of measuring wall time: pristine class/ID cases
require 66,048 comparisons and Sass interpolation 25,665, exceeding a 4,096
budget. All three pass after the fix. This budget is representative of this
advisory's membership scans, not a general parser resource bound.

Before changes, 18 focused root checks had 12 failures and six positive passes;
each other root's four source-map checks had two failures and two positive
passes. The failing counts include version/lock gates as well as twelve behavioral
regressions across the four source-map, five shell-quote and three parser cases.
Process-local pristine/candidate comparisons preserve seven AST round-trip,
compact and clone selectors, four actual postcss-nested outputs and real
Tailwind group/peer/arbitrary/important/`@apply` CSS byte-for-byte. That CSS
SHA-256 is `63ad9afd6d97e24344abbed4228caf8ed17de93c17721db05c2b7a7642279393`.

On Node 22.23.3/npm 10.9.9, fresh frozen installs pass in all four roots:
758 legacy, 471 RN connection, 16 Web and 471 recording-sync packages.
The complete wired suites pass: 70 root, 30 RN connection, four Web, and
44 recording-sync tests (148 observed tests across independent runs).
Workspace and all independent typechecks, backend build, Vite/WASM build,
legacy all-platform Expo export and both required Android exports pass.
Local license-policy scans pass for 696/445/16/445 packages respectively;
these are per-root counts, not unique packages across the repository.
The legacy export exercises the changed CSS tooling. The RN connection's
previous extra all-platform Web attempt remains an unsupported configuration;
its required Android export passes, and recording-sync remains Android-only.

Root `npm test` discovers all suites. Each independent app runs its own
`npm run test:source-map-security` in `npm test`; Web CI now requires this test
before typecheck/build. Existing path filters include the changed install roots;
existing RN native build and upload-adapter gates are preserved.

## Post-implementation review

| Requirement | Evidence | Status |
| --- | --- | --- |
| Published aged fixes, truthful package identities and minimal graph changes | Verified public tarballs; six lock entries; exact scoped 6-to-7 review | matched |
| Independent examples use published public SDK/API and their own install roots | Standalone local tests, unchanged SDK/native/app code and lifecycle hooks | matched |
| Bounded regressions and ordinary actual-consumer compatibility | Pristine failing controls, fresh 148 tests, equal AST/nesting/CSS, supported exports/builds/typechecks/licenses | matched |
| Mandatory source CI | Existing root/native test chains plus Web test step | matched; hosted outcome read separately |
| Scanner closure, exact-source hosted native/artifact outcome | Separate post-push endpoint receipt | unverified here |
| Embedded fallback, deployed/installed binary and physical effectiveness | No rewrite, publication, deployment or device action | unverified |

This source qualification does not establish scanner closure, native installation,
browser Bluetooth behavior, live upload recovery or production acceptance. Keep
those receipts separate from the dated source and local compatibility results.
