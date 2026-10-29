# Bota Recordings with Kotlin

A small native Android application for browsing recordings and reading existing
transcripts and general notes. It is the first read-only Kotlin client of the
[shared Recordings sample](../../README.md), using the same customer backend as
the Web, React Native and Flutter clients.

**Sample** uses clearly labeled synthetic content in memory, without a token,
network request or SDK initialization. **Live** reads your application's backend
with a separate app token. This slice does not import/play audio, start processing,
Ask, connect to devices, transfer recordings or authorize device cleanup.

## Run

Use JDK **17**, Android SDK **36** and an Android **10/API 29+** emulator or phone.
The checksummed Gradle **8.13** wrapper installs the build tool. Android Studio can
open this directory directly; it does not need npm or a sibling repository.

Kotlin **2.4.21** uses the typed `compilerOptions.jvmTarget` setting with
`JVM_17`, preserving the Java/Kotlin target. Its matching standard library is
locked and included in the reviewed public Maven provenance inventory. Gradle
8.13 and AGP 8.13.2 remain within Kotlin 2.4.21's
[supported range](https://kotlinlang.org/docs/gradle-configure-project.html).

Serialization **1.12.0** uses Kotlin 2.4 metadata. Its exact public POMs and
consumed binary hashes are included in the reviewed provenance inventory.

```sh
./gradlew :app:checkDependencyLicenses :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleDebugAndroidTest
```

On Windows use `gradlew.bat`. The APK is
`app/build/outputs/apk/debug/app-debug.apk`; the app ID is
`dev.bota.examples.recordings.kotlin`. Install it yourself or run it from Android
Studio, then choose **Try Sample**. No backend is needed for Sample.

For Live, follow the [combined backend setup](../../README.md#run-a-client) or
[retained mobile backend setup](../../../react-native-recording-sync/backend/README.md).
Keep the Bota key on that backend. Preserve its existing scope, origin and journals;
adding this reader does not need a new journal or fresh initialization. The
combined synthetic backend has no mobile Bearer authority.

For the combined host's explicit `5173` development origin:

```sh
adb reverse tcp:5173 tcp:5173
```

Enter `http://127.0.0.1:5173` and the separate server-configured `APP_ACCESS_TOKEN`.
For a retained backend on `8787`, forward that port and enter its original origin
instead. Neither forwarding nor the token is built into the application. The
Debug origin validator and manifest permit cleartext only for exact `127.0.0.1`, `localhost` and `::1`;
release hosts require HTTPS. LAN HTTP, credentials in a URL, URL paths, queries
and fragments are refused. No real credential belongs in source or a build setting.

The app trims the origin and accepts an exact separate 32–256-character visible-ASCII
app token, with no whitespace, including at either end. Bota `sk_`, `rk_`, `dtok_`, `up_` and `rct_`
prefixes are refused. This local fixed-principal sample backend is not a complete
customer sign-in system; replace its auth with your app's principal mapping.

## Use

Select a recording to read its existing transcripts and notes. The app picks the
first completed transcript in the returned snapshot, or the first pending/failed
item if none is complete. With several transcripts you can choose one explicitly.
Notes show the first completed general-notes result for that exact transcript;
no ordering guarantee or “latest” claim is implied. Text is inert native text.

The library shows only its first page of at most 20 rows. If the server reports
more, the UI says the list is incomplete. It does not follow cursors or imply
an exhaustive snapshot. Refresh performs another explicit GET.

Tokens and content exist only in process memory. Sign-out, leaving the foreground
or a 401 clears the session; returning requires an explicit Sample/Live choice.
Rotation can retire the foreground session too. A process-owned controller joins
the old reader before a replacement Activity can connect; a late callback from
the destroyed Activity cannot clear or observe the replacement session. Failed
cleanup remains blocked across Activity recreation until process restart.
No app content or token is saved to Android view state, disk, backups, logs or
analytics. Screenshot capture is
disabled. The app does not automatically reconnect or retry a failed read.

## Copy and adapt

| Source | Copyable responsibility |
| --- | --- |
| [LibraryApi.kt](app/src/main/java/dev/bota/examples/recordings/LibraryApi.kt) | Fixed customer-backend GET routes, separate Bearer token, per-client no-cookie/no-cache transport, deadline and streaming byte cap |
| [Models.kt](app/src/main/java/dev/bota/examples/recordings/Models.kt) | Exact allowlisted DTOs, source relationships, UTF-16 content caps and bounded JSON depth |
| [LibraryController.kt](app/src/main/java/dev/bota/examples/recordings/LibraryController.kt) | Session/selection fences and joined reader cancellation before replacement |
| [LibrarySessions.kt](app/src/main/java/dev/bota/examples/recordings/LibrarySessions.kt) | Process-owned admission/retirement and per-Activity leases that fence old callbacks and content |
| [MainActivity.kt](app/src/main/java/dev/bota/examples/recordings/MainActivity.kt) | Ordinary library/detail/Transcript/Notes UI and foreground-only lifecycle |
| [SampleLibrary.kt](app/src/main/java/dev/bota/examples/recordings/SampleLibrary.kt) | Synthetic local source without transport initialization |

Copy the complete Gradle root to run it independently. Start by adapting the UI
and your app sign-in, while preserving the [native read contract](../../contracts/native-library-read.md)
and source/lifecycle checks. The API implementation calls **customer-backend**
`/api/library/*` routes. The backend's canonical
[recordings](../../backend/features/recordings.mjs) and
[processing](../../backend/features/processing.mjs) modules contain public Bota
API integration. The Android app embeds no Bota project key or SDK wrapper.

For device connection and metadata, use the independent public-SDK
[Kotlin connection](../../../../app-sdk/android-device-connect/README.md) and
[Kotlin catalog](../../../../app-sdk/android-recording-catalog/README.md) starters.
For ordinary upload/playback or processing actions, consult
[Flutter](../flutter/README.md), [React Native](../react-native/README.md) or
[Web](../../../web-reference/README.md). Keep their capabilities and evidence distinct.

## Transport and verification

Live uses exact HTTP 200 GET responses, a 30-second cancellation deadline and a
2 MiB streamed JSON byte cap, including chunked responses. Apache HttpCore
**5.3.6** provides the ordinary HTTP/1.1 requester and unchanged system TLS trust
and HTTPS endpoint verification. This root requires API 29 because its default
TLS path uses `SSLEngine.getApplicationProtocol`. The independent device SDK
starters still support API 26; they have different runtime requirements.

The 5.3.6 pin avoids 5.4.4's unconditional JDK-specific socket setup,
which calls `jdk.net.Sockets.supportedOptions`, unavailable on Android 29. Keep the 5.3.6 default
extended-keepalive tunables unchanged. Upgrades need actual Android runtime checks
as well as JVM tests and an APK build.

HttpCore5.3.6 remains within the affected artifact range for
[CVE-2026-54399](https://github.com/advisories/GHSA-hf6x-8p5f-cgmf).
This requester supplies explicit `Http1Config` limits of 100 headers and 8192
bytes per line, matching [Apache's finite-defaults fix](https://github.com/apache/httpcomponents-core/commit/d96a00f).
The same configuration bounds response headers, folded-line accumulation and
chunked trailers, including unfinished lines. Preserve it when copying the code.
This mitigates that issue on this configured HTTP/1 path; the upstream artifact
is not patched, and no advisory suppression or scanner-closure claim is made.

There are no redirect, HTTP-auth follow-up, automatic retry, content-decoding,
cookie or cache layers. A host-global `CookieHandler` is not consulted. Content
must be JSON and valid UTF-8, with depth at most 64 and exact DTO/source
relationships. Invalid or foreign results leave content unavailable. Raw backend
errors do not enter the UI or logs. Large otherwise-valid content can exceed this
intentional cap. Normal system certificate/hostname validation is never bypassed.

Each explicit GET owns a one-thread requester. Cancellation immediately seals
transport admission and cancels its result; the owning blocking reader then
closes sockets and joins the actual reactor worker and deadline executor. The
controller clears content/token immediately and joins that reader before admitting
another selection/session. The 30-second deadline requests cancellation; an
uninterruptible platform DNS lookup or final cleanup can delay error reporting
and retirement beyond it. Replacement stays blocked until actual work finishes.
Cleanup failure refuses new sessions until process restart. Never replace this
join with a cancelled-Future or `SHUT_DOWN` status check. The zero-wait single-worker
join relies on the reviewed exact 5.3.6 public implementation; re-review it on
upgrade. Public test keys in `app/src/sharedTest/resources/tls` are synthetic and
are excluded from application APKs.

[Dependency provenance](dependency-provenance.json) records exact public app/test
artifacts, POM identities, publication dates and permissive licenses. The
`checkDependencyLicenses` task compares the full debug/release runtime, JVM-test and Android instrumentation
graphs with that inventory and verifies consumed binary and bundled license/notice hashes. Unknown, changed,
young or forbidden dependencies fail. AGP/Kotlin, Android SDK/JDK and Gradle are
separately pinned toolchain inputs; the app gate does not claim a recursive license
audit of those build tools.
The vendored wrapper and retained Gradle distribution licenses/notices are
documented in [third-party notices](THIRD_PARTY_NOTICES.md).

Run the same frozen checks shown above; CI never refreshes locks. To deliberately
review a dependency change, resolve/build with `--write-locks`, inspect every
changed module's public POM/license/age and binary, refresh provenance, then repeat
the checks without that flag. Never refresh locks to hide an unexplained change.

The [owning workflow](../../../../.github/workflows/android-recordings.yml) runs
JVM tests with local synthetic HTTP/TLS, Android lint, license verification and a
Debug APK/test-host build. Before Gradle, `bash scripts/test-runtime-result.sh`
checks the runtime receipt gate with success/failure fixtures. The emulator gate
requires the five-case success summary and exactly one raw final `-1` record;
failure markers, wrong/missing or duplicate final records refuse success.
Its separate API 29 emulator job runs five actual
HTTP/TLS/cancellation checks, including invalid DNS/IP peers and an untrusted
chain, oversized headers/trailers and a gated real reactor callback proving
cancellation joins work.
JVM tests also qualify cookie/redirect refusal, response/deadline bounds, DTO/source
validation, late results, sign-out, Sample isolation and process admission across
two Activity leases, including blocked readers and failed cleanup. Run the hosted emulator
lane with `bash scripts/test-emulator.sh` only in a prepared temporary SDK/AVD
workspace (see the workflow). Local Windows checks build both APKs; hosted runtime
success remains a separate acceptance gate. These tests establish no live API,
installed UI walkthrough, audio, device, cloud write or encrypted-upload-v2
acceptance.

See the [platform review](../../../../docs/design-reviews/2026-10-20-native-cloud-web-device.md)
for hosted test/build results and the remaining live and physical checks.
