# Integrated Recordings sample

## Read first

- Follow [root instructions](../../AGENTS.md), [design](../../DESIGN.md) and [README](README.md).
- This is the canonical cloud feature core. Existing web/mobile paths are compatibility auth/store/DTO adapters; one HTTP listener is pending.
- Keep direct public calls in feature files, server-derived scope and durable GET-only recovery. Preserve exact SDK receipt/native cleanup boundaries.

## Package manager and checks

- Node 22.23.2+, npm; `npm ci`, `npm run license-check`, `npm run check`, `npm run lint`, `npm run format:check`, `npm test`.
- Shared changes also require both web and mobile backend suites. Their workflows include this directory in path filters.
- Keep published SDK pins, native Expo/braces guards, original launch CWD and all journal paths/hashes/anchors untouched.
- Default project-field policy is strict. Web's explicit omission policy is compatibility-only; supplied project mismatches and exact owner/source mismatches always deny.

## Commit attribution

- Include the actual agent model's `Co-Authored-By` attribution.
