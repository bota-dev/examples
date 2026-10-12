# Claude Code entry point

- Read [DESIGN.md](DESIGN.md): developer demos/sample code showcase public APIs and SDKs; catalog count is not a delivery goal.
- Create general platform examples now (Layer 1); vertical use-case and consumer app demos belong to the later Layer 2.
- For a customer web integration, start with [web-reference](end-to-end/web-reference/README.md); its recipe table maps each feature to backend/frontend sample files.
- Read and follow [AGENTS.md](AGENTS.md), the canonical editing instructions.
- Select an example by task, language and hardware in [examples.json](examples.json).
- Follow the [AI quick-start guide](docs/using-examples-with-ai.md) and read the selected example's README before adapting it.
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for public integration boundaries and acceptance gates.
- Read [README.md](README.md) for the catalog, legacy sample and current availability.
- Read [DEPENDENCY_SECURITY.md](DEPENDENCY_SECURITY.md) before touching legacy dependencies or install scripts.
- Use per-example commands and published pins; keep server secrets, durable uncertainty and hardware identity checks intact. The health sample requires no API key.
- Run `node scripts/check-catalog.mjs` after index/catalog/docs changes; no root install is required.
- Read the [implementation review](docs/independent-examples-review.md) for current evidence and integration boundaries.
- Report the exact checks performed and remaining runtime/hardware gaps; index entries and syntax CI are not live verification.
