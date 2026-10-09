# Claude Code entry point

- Read and follow [AGENTS.md](AGENTS.md), the canonical editing instructions.
- Select an example by task, language and hardware in [examples.json](examples.json).
- Follow the [AI quick-start guide](docs/using-examples-with-ai.md) and read the selected example's README before adapting it.
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for public integration boundaries and acceptance gates.
- Read [README.md](README.md) for the catalog, legacy sample and current availability.
- Read [DEPENDENCY_SECURITY.md](DEPENDENCY_SECURITY.md) before touching legacy dependencies or install scripts.
- Use per-example commands and published pins; keep server secrets, durable uncertainty and hardware identity checks intact.
- Run `node scripts/check-catalog.mjs` after index/catalog/docs changes; no root install is required.
- Read the [implementation review](docs/independent-examples-review.md) for current evidence and integration boundaries.
- Report the exact checks performed and remaining runtime/hardware gaps; index entries and syntax CI are not live verification.
