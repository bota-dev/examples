import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { receiver, verify } from "./server.mjs";
const secret = "test-signing-secret";
const timestamp = "1801200000";
const event = {
  id: "evt_test",
  type: "transcription.completed",
  created_at: "2026-09-29T00:00:00Z",
  data: { transcription: { id: "txn_test" } },
};
const sign = (body, time = timestamp) =>
  "v1=" +
  createHmac("sha256", secret)
    .update(time + ".")
    .update(body)
    .digest("hex");
test("signature covers exact bytes and timestamp; stale/future/malformed values fail", () => {
  const body = Buffer.from(JSON.stringify(event));
  const sig = sign(body);
  const now = Number(timestamp) * 1000;
  assert.ok(verify(body, sig, timestamp, secret, now));
  assert.equal(
    verify(
      Buffer.concat([body, Buffer.from(" ")]),
      sig,
      timestamp,
      secret,
      now,
    ),
    false,
  );
  for (const time of [now - 301000, now + 301000])
    assert.equal(verify(body, sig, timestamp, secret, time), false);
  for (const signature of ["", "v1=aa", "v2=" + "0".repeat(64)])
    assert.equal(verify(body, signature, timestamp, secret, now), false);
});
test("HTTP receiver persists before ACK, deduplicates concurrently and across restarts, rejects conflicts", async (t) => {
  const prefix = join(tmpdir(), "bota-webhooks-");
  const directory = await mkdtemp(prefix);
  t.after(async () => {
    assert.ok(directory.startsWith(prefix));
    await rm(directory, { recursive: true, force: true });
  });
  const path = join(directory, "inbox.sqlite");
  let server;
  const open = async () => {
    server = receiver({
      secret,
      databasePath: path,
      now: () => Number(timestamp) * 1000,
      maxBytes: 2048,
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  };
  const close = () =>
    new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  await open();
  t.after(async () => {
    if (server.listening) await close();
  });
  const send = async (value = event, headers = {}) => {
    const body = JSON.stringify(value);
    const r = await fetch(
      `http://127.0.0.1:${server.address().port}/webhooks/bota`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bota-Signature": sign(body),
          "X-Bota-Timestamp": timestamp,
          ...headers,
        },
        body,
      },
    );
    await r.text();
    return r.status;
  };
  assert.deepEqual(
    await Promise.all([send(), send(), send()]),
    [200, 200, 200],
  );
  await close();
  await open();
  assert.equal(await send(), 200);
  assert.equal(await send({ ...event, type: "recording.deleted" }), 409);
  assert.equal(
    await send(event, { "X-Bota-Signature": "v1=" + "0".repeat(64) }),
    401,
  );
  assert.equal(await send(event, { "X-Bota-Event-Id": "evt_other" }), 400);
  assert.equal(await send({ ...event, id: "../bad" }), 400);
  assert.equal(await send({ ...event, data: { text: "x".repeat(3000) } }), 413);
  await close();
  const database = new DatabaseSync(path);
  assert.equal(
    database.prepare("SELECT count(*) AS count FROM inbox").get().count,
    1,
  );
  database.close();
});
