# Use Bota examples with an AI coding tool

Give your coding tool this repository URL and the task you want to implement.
The same entry points work with Claude Code, Codex, Cursor and other tools that
can read repository files. No tool-specific integration or root install is required.

## Select an example

Read [DESIGN.md](../DESIGN.md) and [ROADMAP.md](../ROADMAP.md) first. The repository
has exactly two layers: general platform examples now, then vertical use cases
and consumer app types later. Current work centers on one **Bota Recordings**
app family. API, SDK and combined samples are formats within the general layer.
Choose an existing client as a whole-app starting point; choose a focused recipe for one
public call or bounded workflow. Do not grow overlapping install roots or the
catalog just to increase coverage counts.

For a common web recording app template, prefer [Bota Recordings](../end-to-end/web-reference/README.md).
Use the [platform coverage table](../README.md#current-platform-coverage) for
mobile/native hosts and their current gaps. Keep each app's UI focused on the
recording user; put public-call explanations in README/source. Connection and
catalog snippets do not implement a complete recording app.
For Android, use [mobile recording samples](../end-to-end/react-native-recording-sync/README.md):
React Native and Flutter clients install independently and share one customer
backend. Select `app/` or `flutter/` and follow its README. Synthetic mode needs
no backend or device; live API content uses a separate app token and server-held
Bota key. RN's optional device page retains encrypted-v2 sync; Flutter's page
supports connection/status only. No mobile iOS or Windows host is supplied there.

The target family uses one canonical customer backend. Currently the web root
has its own backend and the mobile root has another, shared by its two clients.
The [roadmap](../ROADMAP.md) tracks consolidation; it has not happened yet. Keep
current install paths and runtime boundaries intact. Do not add a third backend
or import one independent example into another as a shortcut.

The web README's recipe table maps recordings, upload, transcription, notes, Ask
and notifications to the relevant modules. Copy the complete feature/import
graph, including HTTP, authentication, ownership and durable-state helpers, or
run the whole app. Some integrations span substantial source; the Ask entry
point is not a self-contained tiny recipe. Replace the app auth adapter with
your verified identity mapping and keep Bota keys server-side. The standalone
API and native samples remain secondary choices for a narrower task.

1. For a whole app, choose the web, React Native or Flutter template and read its
   actual feature/platform limits. For one operation, match `purpose`, `category`,
   `language` and `physical_device_required` in [examples.json](../examples.json).
2. Read [AGENTS.md](../AGENTS.md), [ARCHITECTURE.md](../ARCHITECTURE.md), then the selected README.
3. Inspect the source, imports, manifest and lockfile before adapting it.

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
Run `node --test scripts/test-catalog.mjs` when changing discovery validation;
the same fixture-based failure checks run in Linux/Windows catalog CI.

## Adapt the selected directory

- Follow [CONTRIBUTING.md](../CONTRIBUTING.md) for clear public calls, focused
  feature modules and meaningful regression checks. Preserve third-party notices
  alongside the [MIT license](../LICENSE) for Bota-authored sample code.
- Use the example directory as the install unit. Do not run a root workspace
  install for independent API or App SDK cases. Follow each end-to-end README's
  documented install layout; an app may use one root or separate app/backend roots.
- Keep exact public SDK pins and their release channel. Check the manifest and
  lockfile rather than assuming a version mentioned in historical prose is current.
- Independent device examples currently select beta.13. Its [Flutter manager contract](https://github.com/bota-dev/app-sdk/blob/v2.0.0-beta.13/frameworks/flutter/bota_app_sdk/lib/src/managers.dart)
  lacks the fresh-pairing and encrypted-v2 interfaces needed by this
  sample's device-sync policy. Treat a missing public capability, a missing host
  and missing verification as different gaps. [Native Windows SDK support](https://github.com/bota-dev/app-sdk#supported-platforms)
  is planned upstream; it is not merely an omitted example host.
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

Read DESIGN.md and ROADMAP.md. For a recording-app starting point, select an existing
web, React Native or Flutter client. For one public operation, select a focused
recipe using examples.json. Read AGENTS.md, ARCHITECTURE.md and the selected
README, then inspect its source, complete imports, manifest and lockfile.
Install only within documented roots. Do not add an overlapping app/backend
root or a new catalog schema. One canonical backend is a planned consolidation;
preserve today's separate web/mobile implementations until that work is verified.
Preserve public SDK pins, authorization, privacy and uncertainty recovery.
Do not use private helpers or repeat uncertain writes. Report contract gaps.

Before implementation, report the selected path, exact SDK pin if any,
documented setup commands, required API scopes and requested check boundaries.
Afterward, report what changed, exact checks and source/version evidence,
plus deferred runtime, live API or physical acceptance. Keep secrets out of
code, output and commits; all device identities must remain configurable.
```
