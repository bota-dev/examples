# Export transcription subtitles (Node.js)

Retrieve an existing completed transcription and export its timed segments as
an SRT subtitle file. The script first checks the source recording's configured
end-user ownership. It performs two public API reads and one local file export;
it creates no transcription job, fetches no audio, and changes no cloud resource.

**Status:** implemented; independent install and syntax checked on Node 22.23.2
on Windows, October 8, 2026. Runtime, live API and subtitle-player compatibility
are unverified. This implementation pass intentionally includes no test suite
or live execution. No hardware or SDK package is needed.

## Prepare and run

Use an API key in the intended project with both **`recordings:read`** and
**`transcriptions:read`**, and choose an existing completed transcription with
timed segments. Configure a fixed authorized end user and the expected source
recording. The project key stays in this server-side process; never distribute
it in a browser or mobile application. Transcript text and exported subtitles
may contain sensitive data; use synthetic or consented content.

From this directory with Node **22.23.2 or newer**:

```sh
npm ci
cp .env.example .env
# Fill the blank values with your own authorized resources.
npm run check
npm start
```

On PowerShell, use `Copy-Item .env.example .env`. There are no third-party npm
dependencies or sibling repository imports. Install and syntax checks need no
API access. `npm start` reads the selected cloud resources.

| Variable | Meaning |
| --- | --- |
| `BOTA_API_BASE_URL` | Explicit API origin ending in `/v1`; HTTPS required except HTTP on `localhost`, `127.0.0.1` or `[::1]` |
| `BOTA_API_KEY` | Server-held project key with both read scopes |
| `BOTA_END_USER_ID` | Required fixed authorized end user, matching the source recording |
| `BOTA_RECORDING_ID` | Required expected source recording ID |
| `BOTA_TRANSCRIPTION_ID` | Required existing completed transcription ID |
| `OUTPUT_PATH` | New destination in an existing directory; default placeholder is `transcription.srt` |

Success prints `Exported N subtitle cues to OUTPUT_PATH.` and writes UTF-8 SRT:

```text
1
00:00:00,000 --> 00:00:02,500
Hello, thanks for joining us today.

```

`.env`, `.srt` and `.partial` files are ignored locally. If you choose another
output extension, keep that output outside Git or add its own ignore entry.

## Scope and export behavior

The script calls `GET /v1/recordings/{id}` and requires the exact recording ID,
matching `end_user_id`, and no deletion marker before requesting
`GET /v1/transcriptions/{id}`. The transcription must match both configured IDs
and have `status: completed` with 1–5000 timed segments. API authorization supplies
project scope; these separate reads are not an atomic ownership snapshot. In a
multi-user service, derive the permitted IDs and owner from authenticated caller
context rather than accepting arbitrary client configuration.

Segment timestamps must be finite nonnegative numbers in **seconds**, with end
at least start. Each timestamp rounds to the nearest millisecond. Original
segment order, overlaps and zero-duration cues are retained; the example does
not retime segments, verify alignment against audio, or rerun ASR. Speaker values
are validated when present but are not added to subtitle text. Exporting labels
does not perform diarization or establish speaker identity.

Each cue contains one text line. Controls, line breaks and whitespace collapse
to spaces; `&`, `<` and `>` are escaped to prevent transcript content introducing
subtitle formatting or cue boundaries. Blank text and strings over 10,000
characters are rejected. Player support for escaped entities, overlaps, very
long durations and zero-duration cues varies; validate the generated file in
your intended player before delivery.

One 30-second abort deadline covers API requests and body reads, and is checked
through local file publication; filesystem operations themselves may not be
interruptible. Each API JSON response is limited to 1 MiB. These are teaching
limits, not Bota service quotas. Redirects are rejected and no request retries
or polling occur. API keys, signed audio URLs, upstream error bodies, transcript
content and raw exception details are omitted from console errors.

The entire transcript is validated before local output begins. The script
creates a private, exclusive `.partial` file in the destination directory,
flushes it, and publishes completed bytes using a hard link that refuses an
existing destination. Existing files and symlinks are never overwritten. The
filesystem must support same-directory hard links. Partial-file cleanup applies
only to a file this invocation successfully created. If cleanup fails, inspect
the directory; output may already have been published. A process crash may leave
a partial file. Never delete an existing destination just to retry blindly.

Exit status is 0 after export and partial-file cleanup, or 1 on failure. After a
failure, inspect whether the output exists and reconcile before choosing a new
destination. There is no cloud cleanup because this example performs no cloud
writes; remove local files according to your content-retention policy.

## Evidence and public contracts

| Check | Evidence on October 8, 2026 |
| --- | --- |
| Independent `npm ci` | Passed, Node 22.23.2 / Windows |
| `npm run check` | Passed; syntax only |
| API/runtime/failure-path execution | Not run |
| Subtitle-player rendering | Not run |
| Hosted workflow | Configured for install and syntax checks only |

Public contracts:
[get recording](https://docs.bota.dev/api-reference/recordings/get) and
[get transcription](https://docs.bota.dev/api-reference/ai/transcriptions/get).
The example uses their public `/v1` resources and documented second-based segment
fields. No SDK runtime, internal application helper or private dashboard API is
required. Adapt the existing read boundary to your authenticated service and
enforce an appropriate subtitle-retention policy before integrating it.
