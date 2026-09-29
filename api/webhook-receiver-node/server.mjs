import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function verify(body, signature, timestamp, secret, now = Date.now()) {
  if (
    typeof timestamp !== "string" ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    typeof signature !== "string" ||
    !/^v1=[a-f0-9]{64}$/i.test(signature)
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(body)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(3), "hex"));
}

export function receiver({
  secret,
  databasePath,
  now = Date.now,
  maxBytes = 1024 * 1024,
}) {
  if (!secret || secret === "replace_me")
    throw new Error("Set WEBHOOK_SECRET from the endpoint creation dialog.");
  const database = new DatabaseSync(databasePath);
  database.exec(
    "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;",
  );
  database.exec(
    "CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, type TEXT NOT NULL, received_at TEXT NOT NULL, sha256 TEXT NOT NULL, payload TEXT NOT NULL)",
  );
  const find = database.prepare("SELECT sha256 FROM inbox WHERE id = ?");
  const insert = database.prepare(
    "INSERT OR IGNORE INTO inbox VALUES (?, ?, ?, ?, ?)",
  );
  const server = createServer(async (req, res) => {
    const reply = (code, message) => {
      res.writeHead(code, { "Content-Type": "text/plain" });
      res.end(message);
    };
    if (req.method !== "POST" || req.url !== "/webhooks/bota")
      return reply(404, "Not found");
    if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] ?? ""))
      return reply(415, "Expected JSON");
    const parts = [];
    let size = 0;
    try {
      for await (const part of req) {
        size += part.length;
        if (size > maxBytes) {
          reply(413, "Payload too large");
          req.resume();
          return;
        }
        parts.push(part);
      }
      const body = Buffer.concat(parts);
      if (
        !verify(
          body,
          req.headers["x-bota-signature"],
          req.headers["x-bota-timestamp"],
          secret,
          now(),
        )
      )
        return reply(401, "Invalid signature");
      let event;
      try {
        event = JSON.parse(body.toString("utf8"));
      } catch {
        return reply(400, "Invalid JSON");
      }
      if (
        !event ||
        typeof event.id !== "string" ||
        !/^evt_[A-Za-z0-9_-]+$/.test(event.id) ||
        typeof event.type !== "string" ||
        event.type.length > 100 ||
        !event.type ||
        typeof event.created_at !== "string" ||
        !Number.isFinite(Date.parse(event.created_at)) ||
        !event.data ||
        typeof event.data !== "object" ||
        Array.isArray(event.data)
      )
        return reply(400, "Invalid event");
      const headerId = req.headers["x-bota-event-id"];
      if (headerId !== undefined && headerId !== event.id)
        return reply(400, "Event ID mismatch");
      const hash = createHash("sha256").update(body).digest("hex");
      // SQLite commits before acknowledgment. Workers must reconcile resource state separately.
      insert.run(
        event.id,
        event.type,
        new Date(now()).toISOString(),
        hash,
        body.toString("utf8"),
      );
      if (find.get(event.id).sha256 !== hash)
        return reply(409, "Conflicting event ID");
      reply(200, "Accepted");
    } catch {
      if (!res.headersSent) reply(503, "Receipt not accepted; retry later");
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on("close", () => database.close());
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const port = Number(process.env.PORT ?? 4001);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("Invalid PORT");
    const server = receiver({
      secret: process.env.WEBHOOK_SECRET,
      databasePath: process.env.INBOX_PATH ?? "./inbox.sqlite",
    });
    server.on("error", () => {
      console.error("Receiver could not listen.");
      process.exitCode = 1;
      server.close();
    });
    server.listen(port, process.env.HOST ?? "127.0.0.1", () =>
      console.log("Listening for POST /webhooks/bota"),
    );
    for (const signal of ["SIGINT", "SIGTERM"])
      process.on(signal, () => {
        server.close();
        server.closeIdleConnections();
      });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
