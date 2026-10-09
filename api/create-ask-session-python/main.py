"""Create one empty recording-scoped Ask session; retained intent never repeats POST."""

import hashlib
import http.client
import json
import math
import os
import re
import socket
import sqlite3
import stat
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlencode, urlsplit

MAX_BYTES = 1024 * 1024
SCHEMA = "CREATE TABLE operation (singleton INTEGER PRIMARY KEY CHECK(singleton=1), fingerprint TEXT NOT NULL, phase TEXT NOT NULL, session_id TEXT)"


class SafeError(Exception):
    """Only controlled messages may reach stderr."""


def require(condition, message):
    if not condition:
        raise SafeError(message)


def identifier(value, prefix):
    return isinstance(value, str) and re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value) is not None


def configuration():
    raw = os.environ.get("BOTA_API_BASE_URL", "")
    try:
        base = urlsplit(raw)
        port = base.port
    except ValueError:
        raise SafeError("Invalid explicit API base.") from None
    require(base.scheme == "https" and base.hostname and base.path in {"/v1", "/v1/"}
            and base.username is None and base.password is None and not base.query and not base.fragment
            and (port is None or 1 <= port <= 65535) and not re.search(r"[\x00-\x20\x7f\\]", raw),
            "Configure a trusted HTTPS /v1 base without URL credentials, query or fragment.")
    key = os.environ.get("BOTA_API_KEY", "")
    project = os.environ.get("BOTA_PROJECT_ID", "")
    owner = os.environ.get("BOTA_END_USER_ID", "")
    recording = os.environ.get("BOTA_RECORDING_ID", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(), "Configure a server-held project key.")
    require(identifier(project, "proj") and "replace_me" not in project.lower(),
            "Configure the exact trusted project ID.")
    require(identifier(owner, "eu") and identifier(recording, "rec")
            and all("replace_me" not in value.lower() for value in (owner, recording)),
            "Configure fixed authorized end-user and recording IDs.")
    pages = os.environ.get("BOTA_MAX_PAGES", "5")
    require(re.fullmatch(r"[1-9][0-9]?", pages) and int(pages) <= 20,
            "BOTA_MAX_PAGES must be from 1 to 20.")
    authority = base.hostname.lower() + ":" + str(port or 443)
    fingerprint = hashlib.sha256(json.dumps(["https://" + authority + "/v1", project, owner, recording],
                                           separators=(",", ":")).encode("utf-8")).hexdigest()
    return {"host": base.hostname, "port": port, "key": key, "project": project,
            "owner": owner, "recording": recording, "fingerprint": fingerprint,
            "pages": int(pages), "journal": Path(os.path.abspath(os.environ.get(
                "BOTA_JOURNAL_PATH", ".state/ask.sqlite")))}


def private_path(info, directory=False):
    require((stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)),
            "Journal and parent must be real local files/directories, without symlinks.")
    if os.name != "nt":
        require(info.st_uid == os.getuid() and info.st_mode & 0o077 == 0,
                "Journal parent/files must be owned by this user and private (0700/0600).")


def open_journal(config):
    path = config["journal"]
    private_path(path.parent.lstat(), directory=True)
    flags = os.O_RDWR | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(path, flags | os.O_CREAT | os.O_EXCL, 0o600)
        fresh = True
    except FileExistsError:
        private_path(path.lstat())
        fd = os.open(path, flags)
        fresh = False
    try:
        private_path(os.fstat(fd))
    finally:
        os.close(fd)
    for suffix in ("-journal", "-wal", "-shm"):
        sidecar = Path(str(path) + suffix)
        if sidecar.exists() or sidecar.is_symlink():
            private_path(sidecar.lstat())
    db = sqlite3.connect(path, timeout=5, isolation_level=None)
    try:
        db.execute("PRAGMA synchronous=FULL")
        db.execute("BEGIN IMMEDIATE")
        if fresh:
            require(db.execute("PRAGMA journal_mode").fetchone()[0] == "delete",
                    "Unsupported journal mode; preserve the journal.")
            db.execute(SCHEMA)
            db.execute("PRAGMA user_version=1")
            db.execute("INSERT INTO operation VALUES (1, ?, 'creating', NULL)", (config["fingerprint"],))
        row = retained_row(db, config)
        db.execute("COMMIT")
        # Persist a new directory entry before any network request on POSIX.
        if fresh and os.name != "nt":
            parent_fd = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
            try:
                os.fsync(parent_fd)
            finally:
                os.close(parent_fd)
        return db, fresh, row[3]
    except Exception:
        db.close()
        raise


def retained_row(db, config):
    require(db.execute("PRAGMA quick_check").fetchall() == [("ok",)]
            and db.execute("PRAGMA user_version").fetchone() == (1,)
            and db.execute("SELECT name, sql FROM sqlite_master").fetchall()
            == [("operation", SCHEMA)] and db.execute("PRAGMA journal_mode").fetchone() == ("delete",),
            "Invalid retained journal schema/version; preserve it for operator reconciliation.")
    rows = db.execute("SELECT singleton, fingerprint, phase, session_id FROM operation").fetchall()
    require(len(rows) == 1, "Invalid retained intent; preserve the journal.")
    row = rows[0]
    require(row[0] == 1 and row[1] == config["fingerprint"]
            and ((row[2] == "creating" and row[3] is None)
                 or (row[2] == "created" and identifier(row[3], "as"))),
            "Journal scope/state mismatch; preserve it and restore its exact configuration.")
    return row


def save_session(db, config, session_id):
    db.execute("BEGIN IMMEDIATE")
    row = retained_row(db, config)
    require(row[2] == "creating" and row[3] is None, "Journal changed; preserve it.")
    db.execute("UPDATE operation SET phase='created', session_id=? WHERE singleton=1", (session_id,))
    db.execute("COMMIT")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def reject_constant(_value):
    raise ValueError("Non-finite JSON")


def finite_float(value):
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Non-finite JSON number")
    return number


def request(config, method, path, deadline, body=None):
    request_deadline = min(deadline, time.monotonic() + 10)
    remaining = request_deadline - time.monotonic()
    require(remaining > 0, "Operation deadline expired; preserve the journal.")
    connection = http.client.HTTPSConnection(config["host"], config["port"], timeout=remaining)
    timer = None
    try:
        connection.connect()
        remaining = request_deadline - time.monotonic()
        require(remaining > 0, "API request deadline expired; preserve the journal.")
        transport = connection.sock
        transport.settimeout(remaining)

        def expire():
            try:
                transport.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

        timer = threading.Timer(remaining, expire)
        timer.daemon = True
        timer.start()
        headers = {"Authorization": "Bearer " + config["key"], "Accept": "application/json",
                   "Accept-Encoding": "identity"}
        if body is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(body, allow_nan=False, separators=(",", ":")).encode("utf-8")
        connection.request(method, "/v1" + path, body=body, headers=headers)
        with connection.getresponse() as response:
            require(response.status == (201 if method == "POST" else 200),
                    f"API returned HTTP {response.status}; preserve the journal. No redirect or retry is made.")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
                    == "application/json" and response.getheader("Content-Encoding", "identity").strip().lower()
                    == "identity", "Expected uncompressed JSON; preserve the journal.")
            chunks, size = [], 0
            while True:
                require(time.monotonic() < request_deadline, "API request deadline expired.")
                chunk = response.read1(min(65536, MAX_BYTES + 1 - size))
                if not chunk:
                    break
                size += len(chunk)
                require(size <= MAX_BYTES, "API response exceeds 1 MiB; preserve the journal.")
                chunks.append(chunk)
            require(time.monotonic() < request_deadline, "API request deadline expired.")
            try:
                return json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                                  parse_constant=reject_constant, parse_float=finite_float)
            except (ValueError, UnicodeError, RecursionError):
                raise SafeError("Invalid UTF-8 JSON response; preserve the journal.") from None
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()


def check_identity(row, config):
    require(isinstance(row, dict) and row.get("deleted_at") is None
            and ("project_id" not in row or row["project_id"] == config["project"])
            and ("end_user_id" not in row or row["end_user_id"] == config["owner"]),
            "Deleted resource or identity/scope mismatch; preserve the journal.")


def check_owners(config, deadline):
    owner = request(config, "GET", "/end-users/" + config["owner"], deadline)
    check_identity(owner, config)
    require(owner.get("id") == config["owner"], "End-user identity mismatch.")
    recording = request(config, "GET", "/recordings/" + config["recording"], deadline)
    check_identity(recording, config)
    require(recording.get("id") == config["recording"] and recording.get("end_user_id") == config["owner"],
            "Recording identity/owner mismatch; preserve the journal.")


def check_session(row, config, session_id=None, empty=False):
    check_identity(row, config)
    scope = row.get("scope")
    require(identifier(row.get("id"), "as") and (session_id is None or row["id"] == session_id)
            and isinstance(scope, dict) and scope.get("type") == "recording"
            and scope.get("recording_ids") == [config["recording"]]
            and type(row.get("message_count")) is int and 0 <= row["message_count"] <= 2**31 - 1,
            "Session identity or immutable recording scope mismatch; preserve the journal.")
    if empty:
        require(row["message_count"] == 0, "Session is no longer empty; preserve the journal. No further POST is permitted.")


def check_membership(config, session_id, deadline):
    cursor, seen_ids, seen_cursors = None, set(), set()
    for _page in range(config["pages"]):
        params = {"end_user_id": config["owner"], "scope_type": "recording",
                  "recording_id": config["recording"], "limit": "25"}
        if cursor is not None:
            params["cursor"] = cursor
        page = request(config, "GET", "/ask/sessions?" + urlencode(params), deadline)
        check_identity(page, config)
        require(isinstance(page.get("data"), list) and len(page["data"]) <= 25
                and type(page.get("has_more")) is bool, "Invalid membership page; preserve the journal.")
        found = False
        for row in page["data"]:
            check_session(row, config)
            require(row["id"] not in seen_ids, "Repeated session ID; preserve the journal.")
            seen_ids.add(row["id"])
            if row["id"] == session_id:
                check_session(row, config, session_id, empty=True)
                found = True
        if page["has_more"]:
            next_cursor = page.get("next_cursor")
            require(page["data"] and isinstance(next_cursor, str) and 1 <= len(next_cursor) <= 2048
                    and not re.search(r"[\x00-\x20\x7f]", next_cursor) and next_cursor not in seen_cursors,
                    "Missing/repeated/non-progressing cursor; preserve the journal.")
            seen_cursors.add(next_cursor)
            cursor = next_cursor
        else:
            require(page.get("next_cursor") is None, "Unexpected terminal cursor; preserve the journal.")
        if found:
            return
        if not page["has_more"]:
            break
    raise SafeError("Known session membership was not observed within the page cap. Preserve the journal; GET-only reconciliation may be rerun.")


def main():
    require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
    config = configuration()
    deadline = time.monotonic() + 60
    db, fresh, session_id = open_journal(config)
    try:
        require(fresh or session_id is not None,
                "Creation outcome is unknown. Preserve the journal for operator reconciliation; this run sends no POST.")
        check_owners(config, deadline)
        if fresh:
            session = request(config, "POST", "/ask/sessions", deadline,
                              {"scope": {"type": "recording", "recording_id": config["recording"]}})
            require(isinstance(session, dict) and identifier(session.get("id"), "as"),
                    "No valid created session ID was returned; preserve the journal for operator reconciliation.")
            session_id = session["id"]
            # Retain the exact ID even when another response field later fails validation.
            save_session(db, config, session_id)
            check_session(session, config, session_id, empty=True)
        check_session(request(config, "GET", "/ask/sessions/" + session_id, deadline),
                      config, session_id, empty=True)
        check_membership(config, session_id, deadline)
        check_session(request(config, "GET", "/ask/sessions/" + session_id, deadline),
                      config, session_id, empty=True)
        check_owners(config, deadline)
        require(time.monotonic() < deadline, "Operation deadline expired; preserve the journal.")
        print(json.dumps({"session_id": session_id, "recording_id": config["recording"],
                          "end_user_id": config["owner"], "message_count": 0,
                          "atomic_snapshot": False}, indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    try:
        main()
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Operation failed or timed out. Preserve the journal for operator reconciliation; no automatic retry is made.",
              file=sys.stderr)
        sys.exit(1)
