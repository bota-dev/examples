# Flutter recordings template

Follow the repository [AGENTS.md](../../../../AGENTS.md), then this
[README](README.md) and [architecture](ARCHITECTURE.md). This is an Android host
inside Bota Recordings; use the [combined backend setup](../../README.md).
No cross-example runtime imports or private Bota helpers.

- SDK: retain exact public beta.18 and the frozen pub lock. Verify actual pub.dev
  identity before future upgrades; native tags alone do not prove publication.
  See the [adoption review](../../../../docs/design-reviews/2026-10-14-native-sdk-beta18-adoption.md).

Sample mode is pure local fixtures; it must not initialize SDKs, request permissions or make
HTTP/provider calls. Live mode uses a memory-only customer-backend token, never a
Bota key. Keep bounds, redirect refusal, authorization/source checks, account and
selection fences, retained uncertain write locks and GET-only request recovery.
Keep API/source explanations out of everyday recording controls.

The secondary device screen only connects and reads status. Dart beta.18 lacks
the required fresh pairing/encrypted-upload host surfaces. Add no private GATT,
catalog/transfer/cleanup/provisioning workaround. Android host/build evidence does
not establish iOS, provider or physical-device acceptance.

Run frozen pub install, local license checks, format, analysis, tests and Android
debug assembly for changes. Update this README/architecture and the combined/root documentation when
behavior changes. Record implementation -> checks -> limits before completion;
parent CI and review own hosted results. Keep signing credentials/local properties
and generated Gradle/Dart state untracked.
