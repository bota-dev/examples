# Receive Bota webhooks

A small HTTP receiver that verifies the **raw bytes** of a Bota webhook, then commits the event to a SQLite inbox before returning HTTP 200. No Bota API key is needed. Uses Node 22.23.2+ built-ins; `node:sqlite` prints an experimental warning on Node 22.

## Run

From this directory:

```sh
npm ci
cp .env.example .env
# Set WEBHOOK_SECRET to the signing secret for your endpoint.
npm start
```

The receiver listens on `127.0.0.1:4001`, accepting `POST /webhooks/bota`. Configure a reachable HTTPS endpoint in the Bota platform dashboard when testing real delivery. Endpoint registration is dashboard-only; there is no public `/v1/webhooks` registration API. A local address cannot receive platform delivery. Run behind your HTTPS reverse proxy and explicitly configure `HOST` for deployment.

`WEBHOOK_SECRET` is the endpoint signing secret, not your project API key. Keep `.env`, the SQLite database, and its WAL files private. Use a persistent disk for `INBOX_PATH`; losing this database loses the inbox and deduplication history. Event payloads can contain sensitive data. Establish access controls, backups, retention, and a single-process ownership policy before production use.

## Contract and behavior

The [public webhook contract](https://docs.bota.dev/webhooks/overview) signs `<timestamp>.<raw body>` with HMAC-SHA256. This example validates `X-Bota-Signature: v1=…` and `X-Bota-Timestamp`, rejects timestamps outside a five-minute window, and compares digests in constant time. Keep the server clock synchronized. Do not parse and reserialize JSON before verification.

Only a valid signed event is stored. The signed body ID is the deduplication key; an optional `X-Bota-Event-Id` header must match it. An identical retry returns 200 without adding a row, including after restart. A reused ID with different bytes returns 409. Invalid signatures return 401, malformed events 400, oversized bodies 413, and storage failures 503. Requests are bounded to 1 MiB and 15 seconds.

This example **receives** events; it does not execute business effects. A worker should read the inbox, fetch authoritative resource state through your server-side Bota client, and commit its work idempotently. Deliveries may be duplicated, out of order, delayed, or missing. Durable receipt is not exactly-once processing; periodic API reconciliation is still needed. Do not delete inbox rows until your own retention/replay policy allows it.

## Verify

```sh
npm run check
npm test
```

2026-09-29: local Node 22.23.2 tests pass for raw-body authentication, stale/future timestamps, invalid signatures, malformed events, body limit, concurrent duplicates, restart deduplication, and conflicting IDs. These use synthetic signed requests against a real local HTTP server and SQLite database. Delivery from Bota to a public HTTPS deployment has **not** been run. See the repository [implementation review](../../docs/independent-examples-review.md) for CI evidence.
