# Legacy workspace public-parent matching replacement

This October 13 prospective source starts from Examples main
`4e05c2f57124cd7168081f2f4ae129e22253c442`. It addresses the legacy
`package-lock.json` route for [Braces #113](https://github.com/bota-dev/examples/security/dependabot/113),
GHSA-vfj7-8cjw-p6xm, by replacing the owning development-tool implementations.
Independent source admission, normal main delivery, exact hosted Android/CI
results and the scanner readback remain required. This document claims no
published fix, native installation or production/certificate approval.

## Selected implementations and current owner preservation

The six affected matching profiles retain their actual public names and versions:
`@expo/metro-file-map` 57.0.3, `metro-file-map` 0.84.5 and 0.84.6,
Tailwind 3.4.19, Chokidar 3.6.0 and Fast-glob 3.3.3. Their local archives contain
deliberate maintained implementations and have separate recorded archive/SRI
identities. They are not represented as unmodified registry distributions or
new official patched releases. Five immutable component archives reuse reviewed
public-source bytes with provenance; all Examples install, resolver, physical,
consumer and output checks are independently collected on this current owner.
Older Examples 18f/b20 and sibling application qualifications do not transfer.

Metro's existing 0.84.6 route is owned by Metro-config 0.84.6. The seventh local
parent archive physically bundles its original Metro 0.84.6 and the adapted
Metro-file-map 0.84.6. The actual Node importer resolves that nested installed
child; a standalone child tarball is not the bundle proof. Metro/config executable,
declaration and license bytes remain unchanged, with explicit manifest bundle
flags. Root Metro-file-map remains 0.84.5. Direct owning development-tool
declarations and the existing Tailwind `$tailwindcss` reference avoid relative
nested file overrides and preserve the selector-parser 7.1.6 rule. No alias,
vulnerable child override or public package identity concealment is used.

Metro's literal `.some` calls use the reviewed Picomatch 2.3.2 algorithm;
Tailwind's callable matching interface retains its declared public behavior and
Micromatch's MIT notice. `.some` is any-pattern matching: a positive match plus
a negative pattern can still return true. It is not a generalized ordered
exclusion filter. Fast-glob/Chokidar use the aged public brace-expansion 2.1.7
implementation with fixed input/depth/result/decoded-character budgets before
expansion. Callers cannot disable these limits. This is a bounded owning API
replacement, not a universal Micromatch/Braces AST or object ABI.

SDK beta.6/runtime 0.2.0, application/device/HTTP code, native signing tools,
decoder/source-map/security chains and every workflow remain conserved. All
42 current npm locks were audited; the other 41 locks and all independent
installation roots remain unchanged. The current independent beta.13 clients
and integrated sample are outside this dependency change.

## Mandatory source and installation gates

`scripts/apply-braces-security.mjs` is a read-only mandatory postinstall
attestation. It requires Braces and Micromatch absence from owning manifests,
lock edges and the complete physical module tree. It verifies all seven local
archives and actual parent payloads. The 1,252 parent file attestations overlap
by 131 bundled child files: they represent 1,121 unique adapted installed paths.
Three separate current owner scopes—Tailwind 4.3.3 and two Metro-config 0.84.5
copies—retain 138 paired physical assets. Their unchanged versions are not
credited as adapted parents. Pacote's actual Tailwind `.gitignore` → `.npmignore`
filename projection retains exact bytes.

The former six-file parser guard and 22-case suite remain byte-identical under
`vendor/braces-security/historical/`. They describe the earlier retained
Braces 3.0.3 mitigation and provide no current package-removal credit. The
mandatory test entry now exercises 20 actual parent/asset/allocation cases.
Do not skip lifecycle scripts or source guards.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run test:braces-security
```

Both ordinary and frozen current-owner installs keep every mandatory hook active.
Untouched ordinary baseline resolution is a byte-identical lock no-op. The final
candidate lock is stable in a fresh clean ordinary install and frozen install.
All 70 structural lock rows are retained: 10 added, seven removed and 53 changed,
including real bundled/hoisting/development bookkeeping. No lock entries are
hand-grafted. Initial nested-file ENOENT and first-pass stale obsolete-branch
refusals remain retained; the final clean installation result does not erase them.

## Actual checks and limits

Node 22.23.2 is the supported repository host. Actual complete tests pass
108 baseline and 106 final candidate cases: 86 unchanged cases plus the new
20-case parent suite replace the historical 22. Both workspace typechecks,
backend builds and the unchanged same-repository license policy pass.
The physical census contains 765/768 manifests; npm reports 765/766 newly
installed packages. These are different populations. Complete catalogs bind
49,717/49,755 payload files at their recorded snapshot, with the workspace
backend build timing difference separately reconciled. Both full npm graphs
contain no recursive problems/invalid/missing/extraneous markers.

Each runtime's actual comparisons cover 2,352 selectors across the three real
Metro callers and 15 filesystem cases through Fast-glob sync/async/stream APIs.
Tailwind CSS is byte-equal. NativeWind's complete property descriptors, values
and per-instance symbol/object alias graph match; identities across separate
module instances and installed native behavior remain unqualified. Node 20.20.2
also passes these bounded component checks and the 20 security cases; it does
not establish support for running the Examples application below Node 22.23.2.

Six actual watcher profiles are paired on each runtime with all raw traces retained
after awaited closure. Positive profiles produce mutations. Negative/duplicate-empty
Windows controls do not establish positive readiness, exclusion or delayed-discovery
capabilities. Empty ready snapshots are not whole-observation no-event evidence.
Original ready-deadline, out-of-fixture CWD and path-normalization observer refusals
remain retained; corrected fixture-bounded observations do not alter library code.

Both normal optimized Android/iOS/web exports succeed with 57 files each. Original
Android/web cold bundle bytes and hash filenames differ and remain retained;
there is no whole cold binary or module-order parity claim. A separately collected
source-map export covers 1,577 Android, 1,485 iOS and 1,144 web source modules,
with exact ordered source keys and bounded source-content joins. That profile
does not retroactively explain or qualify the original cold differences.
Both actual Android prebuilds produce 36 byte-identical generated files;
backend build output is byte-identical. Local Android assembly is unverified
because this host has no Java/Android SDK toolchain. Hosted assembly, native
installation, physical SDK/device behavior and release acceptance remain separate.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Replace the actual vulnerable owning implementation | Complete official/local archives, real bundled importer and zero Braces/Micromatch graph/physical identities | Matched locally; independent source admission pending |
| Preserve current owner and normal installation | Full current Git conservation, untouched locks/workflows, ordinary/frozen hooks and stable generated lock | Matched locally |
| Preserve declared caller/output contracts | Paired selectors, FS/compiler/watcher traces, types/build/license and actual exports/prebuilds | Matched within the recorded finite profiles |
| Refuse excessive expansion before allocation | Ten inert-expander controls on each runtime, including decoded quoted/literal 5K prefixes | Matched locally |
| Establish native/hosted/scanner effectiveness | Exact future main/CI/scanner and installed evidence | Unverified; no closure or approval transfer |

Supplier metadata, public SRIs, full raw inputs/commands, all failed attempts and
compressed reconstruction routes remain in the frozen qualification packet.
Keep this source/tree and its explicit limitations together on future changes.

## October 13 public Chokidar boundary correction

The original local nomination and its independent review remain historical.
Actual public `watch()` and `add()` calls subsequently demonstrated that an
excessive positive brace selector returned a watcher before an unhandled
`ERR_CHOKIDAR_GLOB_COMPLEXITY`; a mixed batch also started its ordinary member.
Publication of that Examples nomination was held. Earlier helper allocation
checks did not establish this public error-delivery boundary.

The independently cleared shared V3 component supplies a new explicit Chokidar
3.6.0 archive. It preserves all nine members, seven unchanged, and changes only
`index.js` and the downstream lineage marker in `package.json`. After upstream
path/cwd normalization, `add()` computes the prospective final ignore set for
the complete array and validates selected positive brace globs before changing
watcher state or scheduling handlers. A rejected mixed batch leaves new, active
and closed watcher state unchanged. Ignored, negative and disabled-globbing
selectors remain exempt. Non-glob literal brace directory names remain usable.
Ignore callbacks are evaluated with the existing initial path/undefined-stats
predicate; initially ignored brace selectors keep that admission decision when
handlers would otherwise reconsider a changing callback.

The required public-boundary security tests run real child processes with default
unhandled-error behavior, plus actual finite file events and full state/closed
traces. These tests supplement the original 20 parent/allocation cases. Exact
owner ordinary/frozen installation, physical graph, type/build/license, caller,
watcher and output reconciliation remain required for the corrected source.
Shared component clearance is not whole Examples admission, native FSEvents,
hosted/scanner completion or production approval. Cold iOS HBC differences are
retained explicitly alongside Android/web renamed bundles; whole binary and
module-order parity remain unqualified.

The corrected Examples owner now passes fresh ordinary and frozen installs with
all mandatory hooks; the frozen worker's subsequent ordinary install preserves
the exact lock. The complete suite passes 110 tests. Both Node 22 and Node 20
pass 24 parent/security test groups, including the four public-boundary groups
with 15 real child calls per runtime. Own strict 13-case public traces and six
closed watcher pairs per runtime retain the full raw observations. The initial
new test's Windows path-separator assertion and a graph read taken during an
intentional guard-test fixture are retained as refused observations; final
checks run after those tests close and remove their fixtures.

Typecheck, backend build and the 700-identity license gate pass. Fresh actual
caller comparisons cover 2,352 selectors and 15 filesystem cases through all
three Fast-glob APIs on each runtime, with bounded Tailwind/NativeWind compiler
comparison. The current catalog validates 77 examples and its fixed 84-document
set; this engineering guide's links are reviewed separately.

Fresh corrected cold exports contain 57 files. Against the exact current 4e05
baseline, `index.html` and `metadata.json` differ and all three Android, iOS and
web bundle filenames change. Full binary/HBC and module-array order parity are
unqualified. Separate source-map exports retain 60 files and ordered source
keys (1,577 Android, 1,485 iOS, 1,144 web); keyed source content matches only
after one exact JSON-escaped isolated Router context-root substitution per
platform. Backend output and the 36 Android prebuild files match that baseline.
Local Android assembly and installed/native FSEvents behavior remain unverified.
The original baseline and historical failed/held packets are retained in full;
independent corrected source admission and Root's fresh-main delivery remain
separate requirements.
