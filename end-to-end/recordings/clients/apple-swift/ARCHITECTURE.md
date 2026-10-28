# Swift recordings client architecture

This is the Apple presentation of the shared recording-library foundation. Its
ordinary user flow is library → recording → Transcript or Notes. It demonstrates
existing cloud results without adding device integration or processing controls.

## Boundaries

`App.swift` owns one `RecordingsModel` and renders inert SwiftUI text on iOS and
macOS. Its application-level `StateObject` is shared above all window/view
creation. The model owns a session and one serialized chain of reader tasks. The
checked-in iOS project compiles the same five Swift files as the macOS Swift
package; it contains no package or binary dependency. Apple system frameworks
are the complete runtime dependency set.

`LibraryAPI.swift` implements exactly the four customer-backend GETs specified
by the [shared contract](../../contracts/native-library-read.md). The backend
retains the Bota project key and enforces project/end-user ownership. The app
receives only projected DTOs and a separate application Bearer token. IDs select
resources; they never confer authority.

`Models.swift` validates resource identities, source joins, job states, bounded
collections and completed content. String caps use UTF-16 counts to match the
shared JavaScript adapter. The view never interprets HTML or Markdown from cloud
content. The first completed transcript and first completed general-notes result
are shown from the returned snapshot, without claiming an ordering guarantee.

`Sample.swift` supplies synthetic DTOs decoded through these same validators. It
does not invoke the live factory, construct a URLSession, load a device SDK or
request permissions. It supplies no fake audio or claimed live API evidence.

## Reader lifecycle

Opening a session admits a first-page read only after prior retirement has
joined. Refresh clears the list/selection before a new snapshot. Selection
changes immediately clear the previous content, cancel its task and wait for
that task to finish before the next read begins. Session epoch, selection
revision and exact selected ID fence all result publication.

Each GET creates an ephemeral URLSession with no credential/cookie store or
cache. It refuses redirects, allows only the validated backend origin and fixed
GET routes, requests identity encoding, bounds streaming bytes to 2 MiB and sets
both request and resource deadlines to 30 seconds. A streaming data-task delegate
owns the buffer and explicitly cancels any redirect while preserving its
controlled error. A separate 30-second timer also cancels a stalled task.
Task completion and final session invalidation must both arrive before a read
returns. A five-second finalizer deadline returns sticky cleanup failure and
retains native ownership if callbacks do not join; it never reports cleanup
success in that case. This also covers cancellation before headers. The API
actor retains the token only until session retirement.

Sign-out, window inactivity/disappearance and 401 retirement clear the model's
content and drop the admitted API immediately. They start transport closure to
discard its token and cancel its session while joining the reader chain. Both
reader and transport closure must finish before replacement can open. A cleanup
failure is sticky and requires an app restart. Stale content or
errors cannot restore a retired session; a same-session stale reader cleanup
failure still closes admission.
After either a reader or close cleanup failure, the model explicitly retains
the retired API in quarantine for its remaining lifetime. Completed task
captures are not ownership storage. Window recreation shares this same model,
including its refusal flag and quarantine; successful retirement releases its
ordinary API after the reader and close work join.

## Deliberate limits

The first page contains at most 20 recordings. `has_more` produces an explicit
incomplete-list notice; no cursor is followed. Transcript/summary collections
are bounded to 200 each. Sample and Live are separate sessions, with no local
persistence. There is no mutation queue, background work, automatic retry,
import/playback, Ask, device connection, audio transfer or cleanup authority.

Copy the complete directory as explained in the [README](README.md#copy-into-your-application).
Keep the backend contract and reader lifecycle together when extending it.
