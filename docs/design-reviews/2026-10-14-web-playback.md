# Ordinary-import Web playback — October 14, 2026

## Scope and basis

Continue the approved general-capability Recordings sample, adding ordinary audio
playback to its existing Web client. No new example/install root, dependency,
SDK version, journal, native identity, backend launch path or device operation
is introduced. All ten device SDK roots retain public beta.18.

Basis: [DESIGN](../../DESIGN.md), [roadmap §4](../../ROADMAP.md#4-complete-the-ordinary-recording-flow-and-migrate-the-layout),
[architecture](../../ARCHITECTURE.md) and
[download/playback rules](../example-contracts.md#downloads-playback-and-exports).
The public [download contract](https://docs.bota.dev/api-reference/uploads/download-url)
supports fixed `format=wav&use_enhanced=false`. Local read-only API inspection
confirmed conversion does not decrypt device originals and can cache a derived
object. This is public export usage, not a backend API change or a read-only
storage guarantee.

## Implementation and review

| Requirement | Implementation and verification | Status |
| --- | --- | --- |
| Normal recording-user controls | Compact Audio section with explicit Load/Reload and native controls; technical recipes stay in README/source | matched in source/UI tests; actual decoding unverified |
| Authorized ordinary source | [playback feature](../../end-to-end/web-reference/server/features/playback.mjs) checks exact owner, nondeleted ordinary `api_upload`/`import`, explicit null device ID, null/0 encryption audit, allowed contract/MIME/status and verified upload metadata | matched; unsupported/missing evidence refused |
| Owner/source at release | Source tuple compared before export and after storage; current cookie session checked immediately before bytes are sent | matched by source-change, cross-user, logout and expiry tests; observations remain non-atomic |
| Private bounded storage access | [client](../../end-to-end/web-reference/server/client.mjs) restricts exact trusted HTTPS/443 hosts, omits credentials, refuses redirects/partial/encoded/invalid responses and bounds bytes/deadline | matched by failure/limit/credential/cancellation tests and actual stalled loopback-fetch test |
| Actual media bytes | Descriptor and body lengths within 25 MiB; exact RIFF/WAVE bytes, bounded size or FFmpeg unseekable sentinel; no original-digest assertion for converted WAV | matched as byte/signature checks; not decoder or decryption proof |
| No durable media credential | Same-origin binary endpoint returns no signed URL; no journal changes; private no-store response; only `media-src 'self' blob:` widens CSP | matched by route/source tests |
| Source/session lifecycle | [player](../../end-to-end/web-reference/web/features/playback/AudioPlayer.tsx) aborts stale reads, pauses/removes/loads media and revokes its one Blob URL on selection, refresh, Back/sign-out/unmount | matched in UI tests; no autoplay or persistent media store |
| Honest synthetic behavior | Demo generates a finite quiet two-second WAV tone, explicitly unrelated to transcript; seed hashes match fixture bytes | matched by fixture/route/UI tests; no live provider/audio claim |
| Existing consumers/state | Existing cookie/Bearer/combined contracts, uncertain writes and all three journal anchors unchanged; Web, core and mobile backend regressions pass | matched within local tests; no physical/deployment acceptance |
| Public copyability | Root feature map, AI guide and Web recipe/copy graph identify feature, HTTP/auth/ownership/UI helpers and limits; existing catalog ID retained | matched by catalog and changed-document link checks |

An independent source review reproduced a high-bit WAV magic bug caused by
`Buffer.toString('ascii')`. Exact byte comparisons replaced it, and a negative
regression first failed against the earlier implementation, then passed with the
fix. The reviewer found no remaining blocking source/UI issue. No speculative
browser workaround or security relaxation was added.

## Local qualification

Node 22.23.2 / npm 10.9.8 on Windows:

- Frozen Web install: 250 packages, existing versions/lock retained; audit reports
  zero known vulnerabilities at this observation. License gate passes.
- Web format, lint, strict types and production Vite build pass.
- **158 backend tests and 52 UI/client tests pass**, including 15 dedicated
  backend playback cases and 19 audio UI/client cases. Existing security suites
  remain in the unchanged test chain.
- Integrated core: syntax/lint/format/license pass; **109 tests pass, two POSIX
  permission cases skip on Windows**.
- Mobile backend: syntax passes; **76 tests pass, one POSIX privacy case skips**.
  No mobile SDK/client source changes or new native-build claim.
- Catalog: 77 existing identities and nine regression cases pass. Changed docs'
  local file links are checked separately before delivery.
- Public download-reference addition compiles with MDX 3.1.1; source publication
  and Mintlify production delivery remain separate.

## Browser and remaining acceptance

The synthetic combined host was exercised through the visible Chrome browser in
development and again with fresh static production assets/CSP. Sign-in, library
and recording selection rendered. After Load audio, automation showed Loading
audio, then browser read/input commands timed out. A separate direct audio-route
navigation was refused with `ERR_BLOCKED_BY_CLIENT`; screenshots also timed out.
This does not establish the cause or a confirmed application defect. Independent
source review found no synchronous UI/stream loop, and route tests return the
complete finite WAV, but **actual browser decoding/playback remains unverified**.
No screenshot or successful playback is claimed.

Next acceptance: run the built synthetic sample in a browser with working media
inspection, load/play the tone, then confirm selection/sign-out teardown. Follow
with consented ordinary audio in an authorized live project to qualify the
deployed export/storage/decoder path. Device/encrypted originals, mobile playback,
missing iOS hosts, Web/auth/store relocation and vertical apps remain separate
roadmap work. Delivered bytes cannot be remotely revoked after authorization.

Documentation impact search covered changed endpoint/source/encryption/playback
tokens across this repository, public docs, internal docs and workspace
README/AGENTS/CLAUDE/ARCHITECTURE files. Existing device/encryption designs remain
unchanged; the public download page adds the bounded Web example. No physical,
production API, storage, SDK-publication or deployment operation was performed.

## October 15 live HTTP acceptance

The owner requested actual testing. At functional source
`13f789a6792098dd9af61e447dfcfb47ac1a97b3`, the real sample configuration,
cookie-authenticated app factory, durable store and routes were exercised against
the public API, independently allowed storage host and processing API jobs.
The isolated loopback host used a new owner-private account/journal directory;
existing application journals and physical devices were untouched. The existing
authorized test-key/end-user profile was checked through fresh read-only requests.
Its project was observed from the API, and all four automatic processing flags
were false; no policy was changed. This does not establish an assignment-generation
fence or atomic ownership observations.

The run completed at **2026-10-15 16:53:13 UTC**. Only the existing synthetic
speech fixture was uploaded: 333,326 bytes, SHA-256
`6fa4c4bcacb552480a25741c7b9ba425d02bb79370ec81fb969bfba34427effc`.
Resource IDs, private state, fetched audio and a sanitized request/status report
are retained outside Git. Credentials, signed URLs and generated content are
excluded from this public review.

| Requirement | Runtime evidence | Status |
| --- | --- | --- |
| Ordinary import and verified commitment | One recording create, one upload-URL request, one storage PUT and one upload-complete request. Completion initially returned 425; known-operation GET reconciliation observed verified completion without replaying a write | matched for this run |
| Authenticated exported audio | Sample audio endpoint returned 200, `audio/wav`, `no-store`, 333,326 bytes. Returned SHA-256 equaled the known fixture | matched for WAV input/output; other format conversion unverified |
| Transcription and general notes | One transcription completed with nonempty text; one `tmpl_general_notes` summary completed with all five expected fields | matched for HTTP/content availability; semantic accuracy is a separate check |
| Recording-scoped Ask | One session and message completed with a nonempty answer and three citations, all referencing the selected recording | matched for HTTP/content availability |
| Durable outcomes and bounded writes | Exactly four intent records, one per operation kind, all complete. Independent report audit found seven distinct API POSTs each executed once and one storage PUT | matched for this observed run; no global exactly-once or restart claim |
| Sign-out access denial | Logout returned 200; the original retained cookie then received 401 from the audio endpoint | matched for server access; already delivered bytes cannot be revoked |
| Browser decoding and media teardown | Demo response finished at 200 with all 32,044 tone bytes; the actual browser API reader produced a 32,044-byte Blob on a minimal page. Explicit Play on a separate plain native audio page also stalled browser commands before media completion could be observed | unverified; cause unresolved |

Additional known-resource GET checks found that the normalized transcript
matched a prior result for the same synthetic fixture. Notes and Ask contained
expected fixture terms/concepts, and all three citations matched the selected
recording. This is a bounded consistency check against a prior fixture result,
not an independent audio transcription assessment or a general model-quality
benchmark. A separate audit mapped all eight upstream writes to their correct
previously durable operation kind/state/resource ID and found no credentials or
signed URL material in the retained reports.

All twelve build/test jobs pass at the exact functional source:
[Web](https://github.com/bota-dev/examples/actions/runs/38672067971),
[shared core](https://github.com/bota-dev/examples/actions/runs/38672067963),
[mobile](https://github.com/bota-dev/examples/actions/runs/38672067928),
[catalog](https://github.com/bota-dev/examples/actions/runs/38672067930) and
[legacy/native](https://github.com/bota-dev/examples/actions/runs/38672067913).
Both CodeQL checks also pass. These qualify the recorded source, not a new native
installation, physical-device acceptance or deployment.

Independent review compared the clean functional source, request/status report
and actual script against the approved playback contract. It confirmed the
GET-only 425 recovery, distinct writes, complete journals and logout denial.
The script's nonempty/content-shape checks do not assess provider accuracy; its
declared source and citation/write-count observations were independently checked
against HEAD and the completed report. Browser playback, selection/sign-out
media teardown and screenshots could not be verified because media activation
stalled browser inspection. No application fix or browser-security change is
justified by this evidence alone. A browser with working native media remains
the next acceptance gate; customer audio, device/encrypted originals and mobile
playback are outside this test.
