# Integrated Recordings: Flutter client relocation

## Scope

Continue the [approved integrated architecture](../design-decisions/2026-10-12-integrated-recordings.md)
after the combined host's core, Web and mobile backend matrices pass on Linux
and Windows at `9de91651f531b9e1d700850d2a8f4f7af2df319e`. The unchanged mobile
Android/Flutter builds passed at the preceding `c5822fa`; replacement native
builds remain separate hosted gates. Preserve those observations by source.

Move the complete Flutter install root from
`end-to-end/react-native-recording-sync/flutter` to
`end-to-end/recordings/clients/flutter`. Move its license helpers with the client
and retain an old-location README forwarding link. Update setup, discovery, CI
and Dependabot together. This is the first relocated platform client; Web and
React Native retain their original install roots and compatibility launchers.

There is no SDK upgrade, Dart/native behavior change, backend journal move,
application install or device/API operation. The new client uses the existing
mobile Bearer routes on the combined backend; the UI's existing 8787 default
remains compatible with the old backend, while combined setup explicitly enters
5173. Device connection/status remains optional and SDK-only; encrypted Flutter
sync, playback/import and an iOS host remain unimplemented.

## Requirement review

| Requirement | Implementation/evidence | Status |
| --- | --- | --- |
| One maintained Flutter client, idiomatic independent install | Whole root under `recordings/clients/flutter`; old README forwards without another pub root | Matched locally |
| Preserve SDK/manifest/lock/native identities and behavior | 37 unchanged tracked client files byte-identical; beta.13 and `dev.bota.examples.mobile_recordings_flutter` retained | Matched source |
| Preserve runtime/backend auth and durable recovery contracts | Dart/native sources unchanged; original mobile routes and journal bases retained; 38 existing regressions pass | Matched locally |
| Preserve license qualification | Colocated helper anchor/fixtures; bounded temporary cleanup; five regressions and 44 resolved notices pass | Matched locally |
| Validate relocated host | Frozen pub install, no Dart format changes, clean analysis, 38 tests and Android debug APK build | Matched locally; hosted move gate pending |
| Keep independent tool boundaries and cross-consumer CI | Exclude complete Flutter install root from backend Prettier; Flutter own checks retained, only cwd/license/APK/pub paths changed | Matched source/local; hosted gate pending |
| Runnable setup and AI/customer discovery | Primary combined server setup, same catalog identities and old forwarding link; catalog/link regressions | Matched locally |
| Installed, live/provider/storage and physical acceptance | No such operation in this migration | Unverified; outside this change |

## Qualification

October 12 local Windows qualification with Flutter 3.47.5, JDK 17 and Android
SDK 37: frozen pub installation passes without lock changes; ten Dart files
need no formatting changes; analysis is clean; all 38 tests pass; Android debug
assembly succeeds from the relocated root. The published beta.13 plugin retains
its existing Kotlin Gradle Plugin migration warning. This build establishes no
compatibility with later Flutter releases. SDK/toolchain versions were preserved.

The moved metadata license check admits 44 resolved Dart dependencies after that
installation; all five rejection/admission fixtures pass. This is not a complete
native Maven/CocoaPods/Rust/Gradle/Flutter-binary audit. Ignored build/package state
and Android local properties remain untracked; no old cache or journal was deleted.
Original tracked-file hashes cover all 40 client files; only the three moved
README/agent/architecture documents differ. The other 37 files remain identical,
including the unchanged `CLAUDE.md`.

Catalog validation passes with the same 77 IDs, 84 indexed documents and 416
local links; all nine discovery regressions pass. Four workflow/Dependabot YAML
files parse, both changed public MDX pages compile and 58 local public-document
links resolve. Core syntax/lint/formatting pass with the independent Flutter
formatter boundary. Read-only source reviews find no remaining blockers; scoped
reviews also verify moved setup links and unchanged workflow pins/job identities.

Folder relocation establishes no additional platform or SDK capability. Existing
evidence retains its original date/source; the relocated host's exact-source
hosted build still needs its separate result after the ordinary direct push.

## Hosted relocation qualification

The complete client move is delivered at
`573abc20da9c39cc77422f1264b98421f8144e2f`. Its
[mobile workflow](https://github.com/bota-dev/examples/actions/runs/38357919016)
passes both backend matrices, the unchanged RN Android build and the relocated
Flutter Android build, including frozen install, moved license gate, format,
analysis, all tests and uploaded debug APK at the new path. The
[core](https://github.com/bota-dev/examples/actions/runs/38357918845),
[Web](https://github.com/bota-dev/examples/actions/runs/38357919040) and
[catalog](https://github.com/bota-dev/examples/actions/runs/38357918932)
Linux/Windows matrices also pass. Legacy verification passes; its separate
Android assembly is still running at this observation.

The compatible Flutter relocation gate is met. The next independent client move
is tracked in the [React Native relocation review](2026-10-12-react-native-client-move.md).
No live, installed-app, iOS or physical acceptance follows from these builds.
