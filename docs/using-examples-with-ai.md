# Use Bota examples with an AI coding tool

Give your coding tool this repository URL and the task you want to implement.
The same entry points work with Claude Code, Codex, Cursor and other tools that
can read repository files. No tool-specific integration or root install is required.

## Select an example

1. Read [examples.json](../examples.json) or the [README catalog](../README.md#example-catalog).
2. Match `purpose`, `category`, `language` and `physical_device_required` to the task.
3. Read [AGENTS.md](../AGENTS.md), [ARCHITECTURE.md](../ARCHITECTURE.md), then the selected example's README.
4. Inspect that directory's source, manifest and lockfile before adapting it.

API examples run on a server or development machine. App SDK examples communicate
with physical devices. End-to-end examples include both an app and a backend.
The legacy `apps/` workspace is separate and is excluded from the JSON index.
For a cloud device-status or policy read, a physical device is not required to run
the example: its output remains backend metadata, not a physical observation.
The `api-health-python` probe requires no key and uses the root `/health` path.
Choose NDJSON or HTML export only when transcript content is authorized for a
private local file; a metadata reader omits that content.

## Read the index

`schema_version: 1` identifies the index format. `examples` contains implemented
independent directories, with unique `id` values. `path`, `readme`,
`setup_reference`, `verification_reference` and optional `workflow` are relative
to the repository root. `platform` is present for device-facing examples.

`setup_reference` and `verification_reference` point to the complete README so
the tool can read prerequisites, commands, limits and dated evidence together.
The index does not embed commands, API permissions or package versions: obtain
those from the selected source and README. `physical_device_required` describes
running the intended workflow, not whether syntax checks require hardware.

When adding an implemented example, update the README catalog and JSON index in
the same change. Include its actual README/workflow paths; keep proposed or
blocked examples out of the index. Recheck unique IDs and every referenced path.
From the repository root, run `node scripts/check-catalog.mjs` with Node.js
22.23.2 or newer; no install is required. The same command runs on every push/PR
in [catalog CI](../.github/workflows/catalog.yml). It checks metadata types,
unique IDs, all independent directories, ordered catalog/index correspondence
and local inline file targets in entry/indexed docs. Fenced examples, remote
URLs, heading anchors, reference-style and HTML links are excluded. This check
reads repository metadata; it never executes an example or verifies API behavior.

## Adapt the selected directory

- Use the example directory as the install unit. Do not run a root workspace
  install for independent API or App SDK cases. End-to-end READMEs identify their
  separate app/backend install roots.
- Keep exact public SDK pins and their release channel. Check the manifest and
  lockfile rather than assuming a version mentioned in historical prose is current.
- Use the linked public API/SDK contracts. Never import private Bota One helpers,
  sibling repositories or unpublished SDK interfaces to fill a missing feature.
- Keep secret/restricted API keys on the server. Supply project, end-user,
  recording and device identity through the documented configuration; do not
  embed credentials, recordings or a particular device serial in application code.
- Preserve ownership checks, output privacy and durable intent/reconciliation.
  After an uncertain write, use only the documented GET reconciliation path;
  do not resend a create, upload or command to make it appear successful.
- If the public contract cannot support the task, report the blocker and the
  closest supported example. Do not silently add a private API or a fallback.

## Report evidence accurately

Presence in the catalog means source exists. Source review, syntax compilation,
unit tests, native builds, live API checks and physical-device acceptance are
different evidence levels. A passing CI workflow does not establish a successful
live upload, encryption, firmware application or device cleanup.

Read the selected README and [implementation review](independent-examples-review.md)
for the exact source/package versions and remaining gates. Run only the checks
requested by the user; if runtime or hardware verification is deferred, say so.
Never use another example's historical device result as proof for this workflow.

## Copy this prompt

```text
Use the Bota examples repository to implement <task> in <language/platform>.
Hardware available: <none or device/platform details; no credentials>.
Requested verification: <source/syntax, build, unit, live API, or physical>.

Read examples.json and select the smallest implemented workflow that fits.
Read AGENTS.md, ARCHITECTURE.md and its README, then inspect its source,
manifest and lockfile. Install only within its documented install root(s).
Preserve public SDK pins, authorization, privacy and uncertainty recovery.
Do not use private helpers or repeat uncertain writes. Report contract gaps.

Before implementation, report the selected path, exact SDK pin if any,
documented setup commands, required API scopes and requested check boundaries.
Afterward, report what changed, exact checks and source/version evidence,
plus deferred runtime, live API or physical acceptance. Keep secrets out of
code, output and commits; all device identities must remain configurable.
```
