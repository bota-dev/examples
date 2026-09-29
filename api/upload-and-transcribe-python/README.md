# Upload and transcribe with Python

Upload a local audio file, require server-verified SHA-256 completion, create one transcription job, and print the result. Uses Python 3.12+ standard library; no package installation or API SDK is needed.

## Run

Use a Bota test secret key and an existing test end user in the same project. **Disable effective auto-transcription and other automatic processing for that end user** in the platform before running: this script creates its transcription explicitly. Use synthetic or consented audio only.

From this directory:

```sh
cp config.example.json config.json
# Edit config.json with your server-only API key and test end-user ID.
python main.py sample.wav > transcript.json
```

On Windows, use `Copy-Item config.example.json config.json` and your Python executable (`py -3` if installed). `config.json` and `transcript.json` are ignored by Git. Keep them private; never embed the config in a phone or browser app. API base URL must be HTTPS, end in `/v1`, and have no query. The default is `https://api.bota.dev/v1`; explicitly choose the intended environment.

Supported extensions: WAV, MP3, M4A, OGG, Opus, FLAC, WebM, AAC. The script loads at most 25 MiB into memory (an example limit). Storage PUT receives only its scoped URL and content type, never the Bota API bearer. Redirects are rejected. Source audio is never removed.

## Completion and failures

The workflow is create recording → upload URL → storage PUT → hash-only completion → transcription → bounded polling. Completion retries **only HTTP 425**, with the same SHA-256 until exact HTTP 200 confirms the matching recording, `uploaded` status, hash, and verification timestamp. Size is sent when requesting the upload URL; completion omits optional size because the live platform's replay path can conflict on numeric versus stored string size.

Each polling stage has a five-minute deadline with two-to-ten-second backoff; a request already in flight may take up to its 30-second request timeout beyond that deadline. Creation and PUT requests are not automatically retried. A timeout is an unknown cloud outcome. Use the printed `rec_*` / `txn_*` IDs and generated `Python API example <timestamp>` recording name to inspect the project before retrying. Do not blindly rerun the script after an ambiguous creation response: it may create a duplicate. No restart journal is implemented.

Expected stdout: JSON with `recording_id`, `transcription_id`, and `text`; progress IDs go to stderr. A failed run exits nonzero with a sanitized error. Cloud resources are retained for inspection; remove only this run's IDs manually when finished.

## Verify

```sh
python -m unittest -v
```

2026-09-29: three local contract tests pass (425 retry and credential boundary; failed creation is never retried; unverified completion blocks processing). Live verification with the reserved test key, auto-processing disabled, and a 333,326-byte synthetic WAV passed server hash verification and returned a completed transcription: `rec_oYZSXYnJcj8Zt3poS4LrOkvC`, `txn_o60mEyL54AfOXb2etr24U2lG`. Other formats/providers and live outage recovery are unverified. See [implementation review](../../docs/independent-examples-review.md) for CI evidence.

Public contracts: [recordings](https://docs.bota.dev/api-reference/recordings/create), [Bota documentation](https://docs.bota.dev).
