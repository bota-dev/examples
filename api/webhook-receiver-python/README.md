# Receive Bota webhooks with Python

Verify Bota webhook signatures over exact request bytes and commit authenticated events to a private SQLite inbox before acknowledging them. Python 3.12+ standard library only; no package installation, Bota API key, SDK, hardware, or shared example runtime is required.

**Status:** implemented, syntax checked only. HTTP behavior, signature rejection, database recovery, and live Bota delivery have not been exercised. This example receives events; business processing and deployment are outside its scope.

## Configure and run

From this directory, set environment variables using the values described in `.env.example`. Python does **not** automatically read that file. The signing secret comes from your endpoint's creation dialog in the [Bota dashboard](https://platform.bota.dev), under the intended project's **Webhooks → Endpoints**. Webhook management is dashboard-only; there is no public `/v1/webhooks` registration endpoint.

```sh
# Bash: enter the secret without echoing it or putting it in shell history.
read -r -s -p 'Webhook signing secret: ' WEBHOOK_SECRET
echo
export WEBHOOK_SECRET
python server.py
```

```powershell
# PowerShell 7: prompt without writing the value into command history.
$env:WEBHOOK_SECRET = Read-Host 'Webhook signing secret' -MaskInput
python server.py
```

On Windows, use your Python executable (`py -3` if installed). Keep the secret server-side and remove it from the shell environment when finished.

| Variable | Purpose / default |
| --- | --- |
| `WEBHOOK_SECRET` | Required endpoint signing secret; never a Bota project API key. No default. |
| `HOST` | Listener address; defaults to `127.0.0.1`. |
| `PORT` | Listener port; defaults to `4002`. |
| `INBOX_PATH` | Persistent SQLite file; defaults to `private/inbox.sqlite`, relative to the current directory. |

Expected startup output: `Listening for POST /webhooks/bota`. Only `POST /webhooks/bota` accepts an event. There is no endpoint for reading stored payloads. Successful receipts return `200 Accepted`; request bodies, headers, resource contents and secrets are never logged.

The loopback URL cannot receive platform delivery. For an intentional deployment, put the listener behind a maintained HTTPS reverse proxy with certificate validation, header/body deadlines, size limits, rate limits and access controls. Configure that HTTPS URL in the dashboard and deliberately choose `HOST` only if your proxy requires another interface. Python's built-in HTTP server is a local teaching server; do not expose it directly to the internet. It handles one request at a time, so a slow caller can delay other requests. Its socket header timeout does not provide the proxy's absolute header deadline.

## Verification and durable receipt

The [public webhook contract](https://docs.bota.dev/webhooks/overview#signature-verification) specifies HMAC-SHA256 of `<timestamp>.<raw-request-body>`:

- Exactly one `X-Bota-Signature: v1=<64 hex characters>` and one `X-Bota-Timestamp` are required. The timestamp is decimal Unix seconds; values outside five minutes in either direction are rejected. Keep the server clock synchronized.
- The HMAC uses the original body bytes, before JSON parsing, and `hmac.compare_digest`. Parsing and reserializing JSON changes those bytes.
- The signed JSON envelope must contain `id` with the `evt_` prefix, a dotted `type`, timezone-bearing ISO `created_at`, and an object `data`. Duplicate JSON keys and invalid UTF-8 are rejected. Event-specific resource fields are retained but not interpreted. Consult the [event schemas](https://docs.bota.dev/webhooks/events) in your consumer; dashboard **Send Example** payloads can differ from live schemas.
- An optional, singular `X-Bota-Event-Id` must equal the signed body ID. The signed ID is the deduplication key.
- Requests require one decimal `Content-Length` and JSON content type. Bodies are limited to 1 MiB and a 15-second read deadline. Transfer encoding and content encoding are unsupported; configure your reverse proxy to forward uncompressed, length-delimited bytes without modifying them.

After verification, a SQLite transaction compares an existing event's **exact bytes** or inserts a new row, then commits with `synchronous=FULL` before returning 200. An authenticated identical retry returns 200 even after restart. Reusing an ID with different bytes returns 409. Unauthenticated requests cannot read or change deduplication state. Malformed requests return 400, signature/replay failures 401, oversized bodies 413, unsupported representations 415 and read timeouts 408. SQLite failures, including a busy database, return 503 with `Retry-After: 5`; a lost connection or response leaves acknowledgment uncertain and the sender may retry.

The inbox stores `id`, `type`, `received_at`, SHA-256 and the original payload bytes. The payload can contain private or regulated information. Use a dedicated persistent directory: POSIX creation uses owner-only permissions and rejects existing broadly accessible inbox files/directories. On Windows, configure owner/service-account-only directory ACLs yourself; POSIX mode bits do not establish Windows privacy. Ensure SQLite sidecars, backups and any custom `INBOX_PATH` are also excluded from version control and protected by your storage policy. This example provides no encryption at rest or disk quota.

A separate worker should consume this inbox, authorize the relevant resources under your own application's project/end-user boundary, fetch authoritative state through the public API, and make business effects idempotent. Implement a durable worker checkpoint or outbox appropriate to those effects. No worker is included. Receipt deduplication is **not exactly-once business processing**: events can be delayed, duplicated, out of order or missing, and a worker can fail between an external effect and its checkpoint. Maintain periodic API reconciliation. `recording.uploaded` alone is not proof of device cleanup or successful processing.

Bota documents up to six delivery attempts for persisted events, subject to queue scanning and the deployed implementation; its request timeout is 30 seconds. Dashboard **Send Example** instead uses an immediate request with a shorter timeout. See the [delivery policy](https://docs.bota.dev/webhooks/overview#retry-policy), including source/deployment qualifications, rather than treating the receiver's inbox as a platform-delivery guarantee.

## Check and cleanup

```sh
python -m py_compile server.py
```

| Evidence, 2026-10-08 | Result |
| --- | --- |
| Python syntax compilation | Passed locally; workflow runs the same check on Python 3.12+. |
| HTTP/authentication/duplicate/durability behavior | Not run; source implementation only. |
| Live platform/HTTPS delivery | Not run. |

Functional tests were intentionally deferred at the owner's request to keep creating examples. Syntax compilation does not establish functional or production acceptance.

Stop with Ctrl+C. Preserve the inbox through restarts so accepted events and duplicate history survive. Do not delete rows until your worker and retention policy permit it. To remove a disposable local example, stop the process and delete only its dedicated inbox directory after confirming its events are no longer needed; this example creates no cloud resources and performs no cloud cleanup.

When adapting for production, retain the raw-byte signature and durable-before-acknowledgment boundary while replacing the teaching HTTP server and defining storage capacity, privacy, backup, consumer and reconciliation policies.
