# Android recording material adapter

This local Expo module implements application HTTP and journal responsibilities
using the public beta.13 Kotlin material constructor and React Native material
registry. It contains no Bluetooth protocol or encryption implementation.

JavaScript passes SDK provider metadata and receives only an opaque registration,
session identity, policy and cloud recording ID. Authorization, independent
context nonces/documents, staging URLs/headers, manifests and receipts remain
native. The SDK owns ciphertext files, transfer checkpoints, BLE transfer and
receipt-gated device confirmation.

The app configures a separately authenticated local backend and its verified
device/binding/end-user context. The backend independently authorizes that scope.
Secret Bota API keys stay on the backend; the app token is held only in memory.
HTTP redirects are rejected. HTTP is allowed only for local development origins.

The native journal stores scoped immutable recording/session IDs in Android's
no-backup directory. It commits session selection before returning material and
records a pending PUT before handing its template to the SDK. Accepted manifest
states skip PUT. A retained uncertain PUT with a backend still reporting staging
fails closed instead of repeating the upload. There is no public post-PUT SDK
callback to settle that particular crash boundary in this example.

Expired sessions, lost session creation responses, checkpoint owner conflicts,
and terminal failures retain evidence and stop. The backend journals creation
and rejects uncertain creation instead of using private reconciliation APIs.
This bounded example does not perform automatic session replacement or claim
all crash/reconnect cases recover automatically. SDK capabilities and backend
policy must admit v2; selection never falls back to plaintext.

`cancel(operationId)` cancels local HTTP and unused material preparation only;
it does not cancel the remote session or remove recordings. The app calls it
after the SDK operation settles. `dispose()` also drops the in-memory host.

Run Android module JVM tests from the generated application's `android/`
directory with `./gradlew :recording-sync:testDebugUnitTest`. Tests cover journal
restart/scope separation, completion identity, non-reupload policy, authorization
headers, sanitized failures, redirect rejection and cancellation. A native build
and physical device upload are separate acceptance gates.

## Implementation review

Current beta.13 package/build checks are recorded in the
[adoption review](../../../../../docs/independent-examples-review.md#beta13-adoption).
The following beta.10 results are historical and do not prove beta.13 hardware acceptance.

The public beta.10 native material/registry interfaces compile in this Expo
application against the published Maven AAR, without local SDK substitutions.
The ten JVM tests passed locally on October 2, 2026. They also exercise a
cancelled preparation with a retained journal and cancellation during response
body reading after headers arrive.

| Requirement | Evidence | Status |
| --- | --- | --- |
| SDK owns Bluetooth, ciphertext files and receipt-gated confirmation | Public material constructor and registry only; successful native compilation | Matched in source/build |
| Native-only opaque documents and scoped application HTTP | Bridge exports safe metadata/registration only; HTTP authorization, redirect and error tests | Matched in source/tests |
| Preserve exact session and prevent unsafe retry | Durable journal scope/restart tests; owner/hash/channel checks; uncertain PUT rejection | Partial: uncertainty stops; automatic expired-session replacement is not implemented |
| Exact cancellation and bounded context exchange | Atomic operation ownership, preparation join, registered-material cleanup, shared 25-second context budget; preparation/HTTP cancellation tests | Matched in source and host tests; consumed SDK registry lifetime remains unverified |
| Live encrypted upload, publication, receipt and device cleanup | Requires compatible firmware/backend and consented recording | Unverified by these module tests |
