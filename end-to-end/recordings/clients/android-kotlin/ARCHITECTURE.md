# Kotlin recording reader

`MainActivity` renders ordinary library/detail/Transcript/Notes views and passes
foreground user actions to `LibraryController`. The controller owns one in-memory
source and publishes immutable UI snapshots on the UI dispatcher.

`SampleLibrary` constructs local synthetic values. It has no transport or SDK
dependency. `LiveLibrary` owns a separate app token and an isolated Apache HttpCore5 requester per explicit GET,
and performs the four fixed GETs defined by the
[shared read contract](../../contracts/native-library-read.md). Bota credentials,
project/end-user authorization and public API integration remain in the existing
customer backend. IDs are source checks, never authorization grants.

The app validates streamed JSON before exposing an allowlisted model. Detail,
transcript and notes reads must match the selected recording/transcription.
Completed content has explicit UTF-16 caps; pending/failed snapshots contain no
completed text. The first bounded recording page is deliberately incomplete when
`has_more` is true. There is no pagination loop, processing mutation, journal,
audio source, signed URL, Bota SDK, custom GATT or device-cleanup path.

Every selection/session transition increments its generation and clears old
content before awaiting anything. Cancellation revokes the active HTTP call;
the controller joins the old blocking worker and response-body close before
starting a replacement. Sign-out, background retirement and 401 clear the token
immediately, then finish cleanup. Cleanup failure permanently blocks replacement.
Activity recreation starts empty; Android saved state and backups do not retain
app credentials/content. Native reads, worker cleanup and UI state remain separate
ownership boundaries.

This cloud reader requires Android10/API29+ for its default TLS API. The only cleartext network exception is exact loopback in Debug, for explicit
`adb reverse` development. Live requires an origin without credentials/path/query/
fragment; transport has no cookie jar, redirects, HTTP-auth follow-ups, automatic
retry or cache. Every response is bounded in bytes and time. Errors expose only
controlled application messages.

TLS uses the unchanged system trust and HTTPS endpoint-identification defaults.
The thirty-second deadline seals admission and requests cancellation. Platform
DNS and final retirement can take longer; source replacement joins the actual
reader, sole reactor worker and deadline executor. Credential revocation remains
immediate and channel disposal/join happen off the UI dispatcher. HttpCore5.4.4's
zero-wait single-worker join behavior is pinned and covered by a gated real-reactor
regression; changing this dependency requires reviewing that implementation again.
