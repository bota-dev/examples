# Flutter recordings template

Follow the repository [AGENTS.md](../../../../AGENTS.md), then this
[README](README.md) and [architecture](ARCHITECTURE.md). This has Android and iOS hosts
inside Bota Recordings; use the [combined backend setup](../../README.md).
No cross-example runtime imports or private Bota helpers.

- SDK: retain exact public beta.19 and the frozen pub lock. Verify actual pub.dev
  identity before future upgrades; native tags alone do not prove publication.
  See the [adoption review](../../../../docs/design-reviews/2026-10-14-native-sdk-beta18-adoption.md).

Sample mode is pure local fixtures; it must not initialize SDKs, request permissions or make
HTTP/provider calls. Live mode uses a memory-only customer-backend token, never a
Bota key. Keep bounds, redirect refusal, authorization/source checks, account and
selection fences, retained uncertain write locks and GET-only request recovery.
Keep API/source explanations out of everyday recording controls.

Ordinary import uses a bounded native picker and one raw app-Bearer POST. Unknown
uploads retain their lock and GET recovery. Playback fetches bounded same-origin
WAV into transient private cache; the player receives no credential or remote URL.
Explicit load/play only. Source/session/navigation/background changes drain and
dispose media/delete the file. Join late picker/load work before replacement;
failed cleanup blocks media until restart. Sample mode never calls media plugins.

The secondary device screen only connects and reads status. Dart beta.19 lacks
the required fresh pairing/encrypted-upload host surfaces. Add no private GATT,
catalog/transfer/cleanup/provisioning workaround. iOS requests Bluetooth only;
Android metadata/permissions stay Android-only. A host/build does not establish
provider, physical-device or encrypted-upload-v2 acceptance.
The public client is a process singleton whose destruction is terminal. Parent
device admission stays single-session per process, including across signout;
cloud screens remain usable. Never invoke test-only constructors in production
to manufacture another client after teardown.

Run frozen pub install, local license checks, format, analysis, tests and Android
debug assembly and macOS unsigned iOS build for changes. Update this README/architecture and the combined/root documentation when
behavior changes. Record implementation -> checks -> limits before completion;
parent CI and review own hosted results. Keep signing credentials/local properties
and generated Gradle/Dart state untracked.
