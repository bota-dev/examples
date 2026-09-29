# CLAUDE.md - Bota Examples

Read and follow [AGENTS.md](AGENTS.md), the canonical contributor and agent instructions for this repository.

Then read:

1. [README.md](README.md) for the available legacy sample, planned catalog, and entry points.
2. [ARCHITECTURE.md](ARCHITECTURE.md) for example boundaries, public API/SDK integration, migration, and acceptance gates.
3. The README of the example being changed and [DEPENDENCY_SECURITY.md](DEPENDENCY_SECURITY.md) when touching legacy dependencies or install scripts.

Bota One is an internal reference application built on the SDK and public backend API. Reimplement teaching examples from public contracts; do not copy private helpers or require access to Bota One to run an example.

The first independent [Node API example](api/upload-and-transcribe-node/README.md) is implemented and locally tested; live API verification remains pending. Other target catalog entries are planned. The existing `apps/backend` and `apps/react-native` workspace uses `@bota.dev/react-native-app-sdk@2.0.0-beta.6` and Node 22.23.2 or newer. Read [migration evidence](docs/app-sdk-migration.md): prior all-platform exports and Android native build passed, while authentication/provisioning compatibility gaps, iOS native linking, and physical-device acceptance remain. Keep design intent, source behavior, and verified results distinct.
