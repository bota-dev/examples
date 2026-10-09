"""Receive authenticated Bota events into a durable, private SQLite inbox."""

import datetime as dt
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
import stat
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

MAX_BODY_BYTES = 1024 * 1024
BODY_TIMEOUT_SECONDS = 15
EVENT_ID = re.compile(r"evt_[A-Za-z0-9_-]{1,200}\Z")


class InvalidRequest(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def invalid_constant(_value):
    raise ValueError("Non-JSON number")


def parse_event(body, header_id):
    try:
        event = json.loads(body.decode("utf-8"), object_pairs_hook=unique_object,
                           parse_constant=invalid_constant)
        if not isinstance(event, dict):
            raise ValueError("Expected object")
        event_id, event_type = event.get("id"), event.get("type")
        if not isinstance(event_id, str) or not EVENT_ID.fullmatch(event_id):
            raise ValueError("Invalid event ID")
        if (not isinstance(event_type, str) or len(event_type) > 100 or
                not re.fullmatch(r"[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*", event_type)):
            raise ValueError("Invalid event type")
        created_at = event.get("created_at")
        if not isinstance(created_at, str) or len(created_at) > 64:
            raise ValueError("Invalid creation date")
        created = dt.datetime.fromisoformat(created_at)
        if created.tzinfo is None:
            raise ValueError("Creation date needs timezone")
        if not isinstance(event.get("data"), dict):
            raise ValueError("Invalid event data")
        if header_id is not None and header_id != event_id:
            raise ValueError("Event ID mismatch")
        return event
    except (ValueError, UnicodeError, RecursionError, OverflowError):
        raise InvalidRequest(400, "Invalid event") from None


def open_inbox(path):
    # A dedicated directory also protects SQLite journal/WAL sidecar files.
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.parent.is_symlink() or path.is_symlink():
        raise ValueError("Use a private inbox directory without symlinks")
    if os.name != "nt" and stat.S_IMODE(path.parent.stat().st_mode) & 0o077:
        raise ValueError("Inbox directory must have owner-only permissions")
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        pass
    else:
        os.close(descriptor)
    if not path.is_file():
        raise ValueError("Inbox path must be a regular file")
    if os.name != "nt" and stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise ValueError("Inbox file must have owner-only permissions")
    database = sqlite3.connect(path, timeout=3, isolation_level=None)
    try:
        database.execute("PRAGMA journal_mode=WAL")
        database.execute("PRAGMA synchronous=FULL")
        database.execute("""CREATE TABLE IF NOT EXISTS inbox (
            id TEXT PRIMARY KEY, type TEXT NOT NULL, received_at TEXT NOT NULL,
            sha256 TEXT NOT NULL, payload BLOB NOT NULL)""")
    except BaseException:
        database.close()
        raise
    return database


def persist(database, event, body):
    # Serialize the ID comparison and insert. The response follows COMMIT.
    database.execute("BEGIN IMMEDIATE")
    try:
        row = database.execute("SELECT payload FROM inbox WHERE id = ?",
                               (event["id"],)).fetchone()
        if row is not None and bytes(row[0]) != body:
            raise InvalidRequest(409, "Conflicting event ID")
        if row is None:
            database.execute("INSERT INTO inbox VALUES (?, ?, ?, ?, ?)", (
                event["id"], event["type"], dt.datetime.now(dt.UTC).isoformat(),
                hashlib.sha256(body).hexdigest(), body))
        database.execute("COMMIT")
    except BaseException:
        if database.in_transaction:
            database.execute("ROLLBACK")
        raise


class Receiver(BaseHTTPRequestHandler):
    server_version = "BotaExample"
    sys_version = ""

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, _format, *_args):
        # Base logging includes attacker-controlled paths and request lines.
        pass

    def reply(self, status, message):
        body = (message + "\n").encode("ascii")
        self.close_connection = True
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        if status == 503:
            self.send_header("Retry-After", "5")
        self.end_headers()
        self.wfile.write(body)

    def header(self, name, required=True):
        values = self.headers.get_all(name, [])
        if (required and len(values) != 1) or len(values) > 1:
            raise InvalidRequest(400, "Missing or repeated required header")
        return values[0] if values else None

    def do_POST(self):
        try:
            if self.path != "/webhooks/bota":
                raise InvalidRequest(404, "Not found")
            if self.headers.get_all("Transfer-Encoding"):
                raise InvalidRequest(400, "Transfer encoding is unsupported")
            if self.headers.get_all("Content-Encoding"):
                raise InvalidRequest(415, "Content encoding is unsupported")
            content_type = self.header("Content-Type")
            if content_type.split(";", 1)[0].strip().lower() != "application/json":
                raise InvalidRequest(415, "Expected JSON")
            length = self.header("Content-Length")
            if not re.fullmatch(r"[0-9]{1,10}", length):
                raise InvalidRequest(400, "Invalid body length")
            length = int(length)
            if length > MAX_BODY_BYTES:
                raise InvalidRequest(413, "Payload too large")
            signature = self.header("X-Bota-Signature")
            timestamp = self.header("X-Bota-Timestamp")
            header_id = self.header("X-Bota-Event-Id", required=False)
            if (not re.fullmatch(r"[0-9]{10}", timestamp) or
                    not re.fullmatch(r"v1=[a-fA-F0-9]{64}", signature) or
                    abs(time.time() - int(timestamp)) > 300):
                raise InvalidRequest(401, "Invalid signature")
            parts, remaining = [], length
            deadline = time.monotonic() + BODY_TIMEOUT_SECONDS
            while remaining:
                seconds = deadline - time.monotonic()
                if seconds <= 0:
                    raise InvalidRequest(408, "Request timed out")
                self.connection.settimeout(seconds)
                part = self.rfile.read1(min(65536, remaining))
                if not part:
                    raise InvalidRequest(400, "Incomplete body")
                parts.append(part)
                remaining -= len(part)
            body = b"".join(parts)
            expected = hmac.new(self.server.signing_secret,
                                timestamp.encode("ascii") + b"." + body,
                                hashlib.sha256).digest()
            if (abs(time.time() - int(timestamp)) > 300 or
                    not hmac.compare_digest(expected, bytes.fromhex(signature[3:]))):
                raise InvalidRequest(401, "Invalid signature")
            event = parse_event(body, header_id)
            persist(self.server.inbox, event, body)
            self.reply(200, "Accepted")
        except InvalidRequest as error:
            self.reply(error.status, error.message)
        except (TimeoutError, socket.timeout):
            self.reply(408, "Request timed out")
        except sqlite3.Error:
            self.reply(503, "Receipt not accepted; retry later")

    def do_GET(self):
        self.reply(404, "Not found")


class InboxServer(HTTPServer):
    def handle_error(self, _request, _client_address):
        # Do not print tracebacks, customer data, or attacker-supplied headers.
        print("Request ended without acknowledgment", file=sys.stderr)


def main():
    secret = os.environ.get("WEBHOOK_SECRET", "")
    if not secret or secret in ("replace_me", "replace_with_endpoint_signing_secret"):
        raise ValueError("Set WEBHOOK_SECRET from the endpoint creation dialog")
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "4002"))
    if not 1 <= port <= 65535:
        raise ValueError("PORT must be between 1 and 65535")
    os.umask(0o077)
    inbox = open_inbox(Path(os.environ.get("INBOX_PATH", "private/inbox.sqlite")))
    try:
        with InboxServer((host, port), Receiver) as server:
            server.signing_secret = secret.encode("utf-8")
            server.inbox = inbox
            print("Listening for POST /webhooks/bota", flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass
    finally:
        inbox.close()


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, sqlite3.Error):
        print("Receiver could not start; check configuration and private storage",
              file=sys.stderr)
        sys.exit(1)
