# Two React Native roots: public Metro matching without braces

This prospective source change targets Examples alert #111 in
`app-sdk/react-native-device-connect` and #112 in
`end-to-end/react-native-recording-sync/app`. Legacy root alert #113 retains
its separate Tailwind/Chokidar and other callers. Local source qualification
does not establish scanner closure or an upstream patched braces release.

Each independent app carries its own public artifacts and mandatory guards.
Existing `@expo/metro-file-map` 57.0.3 and `metro-file-map` 0.84.5 retain names,
versions, exports, engines and unrelated source. Their only micromatch calls
are the internal common watcher's `.some` calls. Those imports now resolve the
literal MIT-licensed `micromatch` 4.0.8 `.some` implementation and exactly the
already locked `picomatch` 2.3.2. Parent manifests replace `micromatch ^4.0.4`
with `picomatch 2.3.2`, removing the unused braces closure. No general
micromatch/braces API is supplied.

Original parent licenses and modes are conserved. Each derived archive adds
only the literal helper and original micromatch MIT notice. Metro's Flow import
changes alongside its JavaScript import. Provenance records every member and
original/derived digest. These are reviewed downstream artifacts, not official
new publications. All selected public inputs meet the governing seven-day
floor: September 15, 2026, 13:49:11.983 UTC. Rebuild with each root's optional
`vendor/metro-public-matching/rebuild.py --output-dir <tmp>`; Python is not an
install or application dependency.

Both archives are explicit development-tool dependencies with ordinary `$name`
self-reference overrides, following the existing native-signing pattern. A
direct transitive `file:` override is not used: npm 10 resolves it relative to
each declaring parent and refuses the absent archive. The normal npm 10
resolver produces each owning lock: raw Git to baseline has zero changes;
baseline to candidate changes eight rows, removes five packages and adds no
package path. Only the root and two derived parents otherwise change. No
unrelated public tuple, SDK, Expo, React Native, device or app source changes.

Keep install scripts enabled. The existing native signing guard still attests
803 assets and absence of Forge. The existing braces script name now performs
read-only zero-braces lock/declaration/physical checks, verifies all 218 Metro
parent assets and the nine actual matcher assets. Its 21 cases refuse aliases,
unknown archives/source, missing parents, asset-population drift and escaping
physical links. Prior six-asset parser guards and 22-case suites remain dated
evidence for the old graph; legacy root still requires them.

## Local qualification and limits

The dated source base is Examples
`5f33070dd84be8e7bd5e88690b84ee9c1b4352a5`. Ordinary Node 22.23.2/npm 10 baseline
installs and normal candidate resolver/frozen installs pass with guards active.
Each lock has 491 to 486 rows; installed lock slots are 480 to 475 with the same
ten omitted foreign optional entries. Complete filesystem census has 524 to
519 package.json files, additionally including 44 conserved public source
fixture manifests. These count definitions are distinct. Whole actual npm
graphs have zero findings before and after.

Connection tests pass 58 cases; recording tests pass 100. Both include 32
signing, 21 removal/asset and four source-map cases without omissions. Typechecks
and Android exports pass. Unchanged repository license policy scans 448 distinct
identities in each root. Actual parent/common comparisons pass 2,153 comparisons
per Node 22 and Node 20 dependency profile. Node 20 results do not qualify apps
below their declared Node 22.23.2 minimum. Six paired Windows public fallback
watcher profiles preserve create/change/delete, dot, ignored-subtree and mixed
negation behavior. Negated patterns retain existing `.some` union semantics,
including observed hidden-file behavior; this is not a glob-policy correction.

Both Android exports retain module counts (608 and 619), names and metadata.
Original Hermes bytecode files differ: the compiler embeds a random/time
temporary source filename. Complete comparison confines every difference to
that one filename, two matching length words, total file length and recomputed
footer checksum; all remaining bytes match exactly. Distinct original binaries
remain retained. This is local export evidence, not native assembly, runtime
execution or installed-device acceptance.

Independent exact-source review, fresh owner admission, required first-push
Linux/macOS/native workflow logs and exact #111/#112 scanner readback remain
required before claiming delivered remediation. Native watching, Watchman,
actual native builds, EAS/service chains, live APIs, physical Bluetooth,
recording/upload/deletion and production are separately unverified. Local
qualification performs no source adoption, commit/push, dispatch, auth change,
certificate installation or physical operation. Public SDK beta.13, legacy
beta.6 and current authentication/journal/upload contracts remain conserved.
