# Export general notes as Markdown

Read one existing completed `tmpl_general_notes` summary, verify its source transcription/recording and configured owner, then publish a new private Markdown file. This example performs three public API GETs and a local export. It creates no processing job, replaces no summary, polls no pending result, and retrieves no audio.

**Status:** implemented; frozen installation, syntax checks and source review only, on Node 22.23.2 / Windows, October 8, 2026. API behavior, Markdown rendering, ownership rejection and filesystem failure recovery remain unverified. No functional tests or live calls were run in this creation-only pass.

## Prepare and run

Use Node **22.23.2 or newer** and an API key in the intended project with `recordings:read`, `transcriptions:read` and `summaries:read`. Select an existing completed transcription and completed summary using exactly `tmpl_general_notes` with `custom_prompt: null`. Configure their exact source recording, owner and project. Secret/restricted keys stay in this server-side process; never distribute them in a browser or mobile app.

From this directory:

```sh
npm ci
cp .env.example .env
# Fill all blank values with your own authorized project resources.
npm run check
npm start
```

On PowerShell use `Copy-Item .env.example .env`. No third-party npm dependency, SDK package, sibling runtime or hardware is needed. Install and syntax commands require no API credentials; `npm start` makes cloud reads and writes the output file.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Required trusted API origin ending in `/v1`, normally `https://api.bota.dev/v1`; HTTPS required except explicit loopback HTTP. No URL credentials/query/fragment. |
| `BOTA_API_KEY` | Required server-held project secret/restricted key with all three read scopes. |
| `BOTA_PROJECT_ID` | Required exact expected project. |
| `BOTA_END_USER_ID` | Required fixed authorized owner (`eu_...`). |
| `BOTA_RECORDING_ID` | Required expected source recording (`rec_...`). |
| `BOTA_TRANSCRIPTION_ID` | Required existing completed transcription (`txn_...`). |
| `BOTA_SUMMARY_ID` | Required existing completed general-notes summary (`sum_...`). |
| `OUTPUT_PATH` | Required new destination in an existing private directory; `.env.example` suggests `general-notes.md`. |

Expected success message: `Exported completed general notes to OUTPUT_PATH.` The literal label avoids logging your local path or result content. The UTF-8 file has fixed sections: **Overview**, **Key points**, **Action items**, **Participants**, and **Decisions**. Empty lists display `None reported.`

Summary text may contain personal or regulated information and model errors. Use synthetic or consented content, review it before sharing, and apply the underlying content's access/retention policy. `.env`, the default output filename and `.partial` files are ignored; if you choose another destination, keep it outside Git or add its own ignore rule. On Windows use restrictive directory ACLs; POSIX file modes do not establish Windows privacy.

## Contract and scope

The script reads the recording first and requires exact ID, configured owner and no deletion marker. It then reads the transcription, requiring exact ID, configured recording and `completed` status. Finally it reads the summary, requiring exact ID, configured project and transcription, `completed` status, `tmpl_general_notes` and null custom prompt.

The summary's documented `project_id` must match. The recording/transcription GET contracts do not promise a `project_id` response field; project scope comes from the authenticated API key, and any returned `project_id` is also checked. Separate GETs do not form an atomic snapshot. A multi-user service must derive allowed IDs and owner from authenticated caller context rather than arbitrary input configuration.

Only the five documented general-notes fields are rendered: `overview` is a string and `key_points`, `action_items`, `participants`, `decisions` are arrays of strings. Other output fields, metadata, provider internals, custom prompts and upstream error bodies are excluded. Sales, clinical, legal and custom-prompt schemas are intentionally unsupported. A completed summary using another schema is rejected rather than reformatted speculatively.

Each content string is flattened to one trimmed line; C0/C1 controls, Unicode directional-format controls and whitespace collapse to spaces. This removes directional overrides that could visually reorder the exported text. ASCII punctuation becomes numeric character references so untrusted text cannot introduce Markdown headings, HTML, images, links, list boundaries, emphasis or autolinks. An ordinary CommonMark renderer displays those references as literal punctuation. This is a plain-content export: upstream Markdown formatting is not preserved. Validate the file with your intended renderer; later transformations or renderer plugins can introduce their own behavior.

## Bounds, publication and cleanup

One **30-second abort deadline** spans requests, response reads and checks before local output/publication. Filesystem operations themselves may not be interruptible. Every API body must be HTTP 200, JSON and valid UTF-8, bounded to **1 MiB**. Redirects are rejected and no automatic retry or processing request occurs. A pending/failed resource stops immediately; this example never attempts replacement.

Local limits are 10,000 characters per nonblank content string, 200 entries per list and 2 MiB of rendered Markdown. These are teaching bounds, not API limits. Oversized or malformed output fails without truncation or a destination write. All identity/owner/schema checks complete before creating a partial file.

The script exclusively creates a random `.partial` file in the output directory with mode `0600`, writes and flushes it, then publishes using a same-directory hard link. The filesystem must support hard links. An existing file or symlink is never overwritten, including a destination created by another process during the reads. Cleanup removes only a partial file this invocation successfully created.

Exit status is 0 after publication and cleanup, otherwise 1 with a controlled description. Raw exceptions, URLs, keys and upstream content are omitted from console errors. Publication can already have succeeded when cleanup fails; inspect the destination before retrying. A process crash can leave a partial file. Preserve existing output and remove only files you identify as belonging to this run under your retention policy. File flush and hard-link publication are not a guarantee of directory-entry durability through every system crash.

There is no cloud cleanup: this example changes no cloud resources. Delete/retain the local Markdown and partial files deliberately according to content policy.

## Evidence and design review

```sh
npm ci
npm run check
```

| Requirement | Evidence on October 8, 2026 |
| --- | --- |
| Independent public setup | Built-ins only, own manifest/lock; frozen install and syntax passed on Node 22.23.2. |
| Exact source and ownership | Three GETs, exact IDs/linkage/project/owner and completion checks present in source; live enforcement unverified. |
| Documented schema only | Five general-notes fields and fixed section renderer; other schema/custom prompt rejected. Rendering behavior unverified. |
| Bounded private file publication | Response/content bounds, exclusive partial creation, flush, no-overwrite hard link and own-file cleanup present in source; filesystem failure behavior unverified. |
| Functional/live tests | Not run, following the owner's creation-only instruction. |
| Hosted workflow | Install/syntax-only workflow configured; local results do not establish hosted success. |

Public contracts: [Get Summary and general-notes output](https://docs.bota.dev/api-reference/ai/summaries/get#tmpl_general_notes), [Get Transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get) and [Get Recording](https://docs.bota.dev/api-reference/recordings/get). No internal application code is required to run this example.
