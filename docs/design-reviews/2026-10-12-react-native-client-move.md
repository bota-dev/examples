# Integrated Recordings: React Native client relocation

## Scope

Continue the [approved integrated architecture](../design-decisions/2026-10-12-integrated-recordings.md)
from `573abc20da9c39cc77422f1264b98421f8144e2f`. The combined host is qualified
at `9de9165`; the relocated Flutter client's local install, analysis, tests,
license gate and Android build pass. Its source-specific hosted assembly and
all four core/Web/catalog/backend matrices now pass at that source too.

Move the complete independent React Native install root from
`end-to-end/react-native-recording-sync/app` to
`end-to-end/recordings/clients/react-native`, retaining a forwarding README at
the old location. The native module, scripts, vendor archives/provenance and
relative `file:vendor` lock entries move together. Change CI, Dependabot and
customer/AI setup pointers in the same delivery.

Preserve exact source, dependencies, SDK/Maven beta.13 pins,
`dev.bota.examples.recordingsync`, minimum Android SDK 26 and all installed-tree
security/signing guards. Preserve the existing backend-origin defaults: native
recovery identity includes the backend base URL. Retained captures must keep
their original origin, not acquire a fresh journal scope during relocation.
The combined host can use that same port/origin; explicit new-install setup is
separate from migration of retained history. Backend files and all three journal
paths/scopes remain unchanged.

This is not an SDK upgrade, permission change, native receipt/cleanup change,
device test, app install or iOS delivery. Credential-free sample mode stays local.
The current Android-only host and existing first-bind/physical acceptance gaps
remain. Web still retains its existing install root.

## Requirement review

| Requirement | Implementation/evidence | Status |
| --- | --- | --- |
| One self-contained RN install root | All 72 tracked files, native module, guards, vendor and docs move together; old README forwards | Matched locally |
| Preserve code, SDK/native identities and dependency graph | 70 non-document files retain Git blobs; frozen install exercises all local vendor paths; public metadata has exact original bytes | Matched source/local |
| Preserve origin/account/native recovery scope | Existing defaults and host source unchanged; migration docs retain original origin/journals | Matched source/local |
| Preserve security and license qualification | Fresh 803-asset native Expo signing and 218-asset Metro zero-braces attestations; original suites and 448-package metadata gate pass | Matched locally |
| Validate relocated application and native adapter | TypeScript, full npm test chain, 619-module Android export, ten fresh JVM tests and debug APK from exact short-path copy | Matched locally; hosted relocation gate pending |
| Keep build/tool/discovery boundaries compatible | Per-client formatter boundary, migrated CI/artifact/Dependabot paths and unchanged 77 catalog IDs; fixed consumer test import | Matched source/local; hosted gate pending |
| Live API, provider, installed-app and physical acceptance | No such operation in this relocation | Unverified; outside this change |

## Local qualification and portability

The October 12–13 continuation uses Node 22.23.2/npm 10 and JDK 17. Fresh `npm ci`
passes with lifecycle guards enabled; license metadata admits 448 identities;
TypeScript and the complete existing npm test chain pass, including 32 native
signing, 21 zero-braces/asset and four source-map cases. Android Metro export
retains 619 modules. Expo Android prebuild reports no package changes.

The moved physical provenance initially retained the old Windows checkout's
3,071 CRLF endings, causing the mandatory signing guard to refuse it. Restoring
only that public metadata to its exact original Git blob also restores its
declared SHA256 `817ece2ac2b67999183c5d10f4b0c76b2db13d47b42d475d4f1a2724fdb734fb`.
No index, archive or guard was changed. The new root inherits `text=auto eol=lf`
from Recordings, so fresh Windows checkouts use the required bytes. This local
checkout correction is separate from the initially recorded raw move hashes.
All 70 non-document Git blobs remain identical to the original tracked source.

Native assembly from the deep managed-worktree path hits the Windows CMake
object-path limit (`build.ninja` remains dirty). An isolated short build tree
inside the workspace receives 74 exact public source files, verified individually
by SHA256, and no untracked build/cache/credential files. Its separate frozen install
and mandatory guards pass; fresh Android prebuild followed by
`:recording-sync:testDebugUnitTest :app:assembleDebug` succeeds in 3m11s. All ten
fresh native tests pass with zero skips/failures/errors (UTC timestamp
`2026-10-13T07:09:42.192Z`). The debug APK SHA256 is
`582c1f700957003d75f7d215f43c723aef5bf1a1057704fe3d9df4de9a978565`.
Windows customers need a short native build path; no source patch weakens that
toolchain constraint. No APK was installed or phone state changed.

The mobile backend's only test-source change points to the relocated public
library adapter. Its 77 tests pass: 76 locally, one POSIX check skipped on Windows.
Core formatting/syntax/lint pass; catalog validation retains 77 entries and 84
indexed docs with 430 local links. Four YAML files parse; both public MDX pages
compile and 58 local public links resolve. Independent review verifies preserved
lock/vendor/guard/autolinking/origin graphs, 385 documentation links and 23 local
imports, with no remaining source/discovery blocker.

Exact-source hosted relocation results follow the ordinary direct push. Passing
fixtures/builds establishes no new SDK or platform capability, live API/provider
result, installed-app behavior or physical receipt/cleanup acceptance.
