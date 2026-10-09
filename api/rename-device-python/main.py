"""Rename cloud device metadata once; retained intent is always GET-only."""

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
from urllib.parse import urlsplit

SCHEMA = "CREATE TABLE operation (singleton INTEGER PRIMARY KEY CHECK(singleton=1), fingerprint TEXT NOT NULL, phase TEXT NOT NULL, generation TEXT)"
MAX_RESPONSE = 1024 * 1024


class SafeError(Exception):
    """Only fixed, controlled messages may be printed."""


def require(condition, message):
    if not condition:
        raise SafeError(message)


def identifier(value, prefix):
    return isinstance(value, str) and re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value) is not None


def private(info, directory=False):
    require(stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode),
            "Use real private local files and directories, without symlinks.")
    if not directory:
        require(info.st_nlink == 1, "Private files must not have other hard links.")
    if os.name != "nt":
        require(info.st_uid == os.getuid() and info.st_mode & 0o077 == 0,
                "Private paths must belong to this user and have private permissions.")


def read_name(path):
    private(path.parent.lstat(), directory=True)
    before = path.lstat()
    private(before)
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        opened = os.fstat(fd)
        private(opened)
        require((before.st_dev, before.st_ino) == (opened.st_dev, opened.st_ino),
                "Name input changed while opening it.")
        with os.fdopen(fd, "rb", closefd=False) as source:
            data = source.read(513)
        after = os.fstat(fd)
        current = path.lstat()
        private(after)
        private(current)
        require(len(data) <= 512 and (opened.st_dev, opened.st_ino, opened.st_size, opened.st_mtime_ns)
                == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
                == (current.st_dev, current.st_ino, current.st_size, current.st_mtime_ns),
                "Name input is too large or changed while reading it.")
        try:
            name = data.decode("utf-8")
            units = len(name.encode("utf-16-le")) // 2
        except UnicodeError:
            raise SafeError("Name input must contain valid UTF-8 scalar text.") from None
        require(units <= 128, "Name exceeds the API's 128 UTF-16 code-unit limit.")
        require("\x00" not in name, "Name must not contain NUL, which the database cannot store.")
        return name
    finally:
        os.close(fd)


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
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(), "Configure a server-held project key.")
    values = [os.environ.get(field, "") for field in
              ("BOTA_PROJECT_ID", "BOTA_END_USER_ID", "BOTA_DEVICE_ID")]
    require(all(identifier(value, prefix) and "replace_me" not in value.lower()
                for value, prefix in zip(values, ("proj", "eu", "dev"))),
            "Configure fixed trusted project, end-user and device IDs.")
    name_path = Path(os.path.abspath(os.environ.get("BOTA_NAME_FILE", "name.txt")))
    journal = Path(os.path.abspath(os.environ.get("BOTA_JOURNAL_PATH", ".state/rename.sqlite")))
    require(name_path != journal, "Name input and intent journal must be different paths.")
    name = read_name(name_path)
    # Hash canonical scope plus exact name, never the key. Never emit this hash.
    fingerprint = hashlib.sha256(json.dumps(["https", base.hostname.lower(), port or 443,
                                             "/v1", *values, {"name": name}],
                                            ensure_ascii=True, separators=(",", ":")).encode()).hexdigest()
    return {"host": base.hostname, "port": port, "key": key, "project": values[0],
            "owner": values[1], "device": values[2], "name": name, "journal": journal,
            "fingerprint": fingerprint}


def retained(db, config):
    require(db.execute("PRAGMA quick_check").fetchall() == [("ok",)]
            and db.execute("PRAGMA user_version").fetchone() == (1,)
            and db.execute("SELECT name, sql FROM sqlite_master").fetchall() == [("operation", SCHEMA)]
            and db.execute("PRAGMA journal_mode").fetchone() == ("delete",),
            "Invalid retained journal; preserve it for operator reconciliation.")
    rows = db.execute("SELECT singleton, fingerprint, phase, generation FROM operation").fetchall()
    require(len(rows) == 1, "Invalid retained intent; preserve the journal.")
    row = rows[0]
    require(row[0] == 1 and row[1] == config["fingerprint"] and row[2] in {"prepared", "uncertain", "acknowledged"}
            and ((row[2] == "prepared" and row[3] is None)
                 or (row[2] != "prepared" and isinstance(row[3], str)
                     and (row[3] == "null" or re.fullmatch(r"0|[1-9][0-9]{0,15}", row[3])
                          and int(row[3]) <= 2**53 - 1))),
            "Journal scope/state mismatch; preserve it and restore its exact configuration.")
    return row


def open_journal(config):
    path = config["journal"]
    private(path.parent.lstat(), directory=True)
    flags = os.O_RDWR | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(path, flags | os.O_CREAT | os.O_EXCL, 0o600)
        fresh = True
    except FileExistsError:
        private(path.lstat())
        fd = os.open(path, flags)
        fresh = False
    try:
        opened = os.fstat(fd)
        private(opened)
        current = path.lstat()
        require((opened.st_dev, opened.st_ino) == (current.st_dev, current.st_ino),
                "Journal changed while opening it; preserve intent.")
    finally:
        os.close(fd)
    for suffix in ("-journal", "-wal", "-shm"):
        sidecar = Path(str(path) + suffix)
        if sidecar.exists() or sidecar.is_symlink():
            private(sidecar.lstat())
    db = sqlite3.connect(path, timeout=5, isolation_level=None)
    try:
        db.execute("PRAGMA synchronous=FULL")
        db.execute("BEGIN IMMEDIATE")
        if fresh:
            require(db.execute("PRAGMA journal_mode").fetchone() == ("delete",), "Unsupported journal mode.")
            db.execute(SCHEMA)
            db.execute("PRAGMA user_version=1")
            db.execute("INSERT INTO operation VALUES (1, ?, 'prepared', NULL)", (config["fingerprint"],))
        retained(db, config)
        db.execute("COMMIT")
        if fresh and os.name != "nt":
            parent_fd = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
            try:
                os.fsync(parent_fd)
            finally:
                os.close(parent_fd)
        return db, fresh
    except Exception:
        db.close()
        raise


def change_phase(db, config, before, after, generation):
    db.execute("BEGIN IMMEDIATE")
    row = retained(db, config)
    require(row[2] == before and (before == "prepared" or row[3] == generation),
            "Intent changed; preserve the journal.")
    db.execute("UPDATE operation SET phase=?, generation=? WHERE singleton=1", (after, generation))
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


def request(config, method, deadline):
    request_deadline = min(deadline, time.monotonic() + 10)
    remaining = request_deadline - time.monotonic()
    require(remaining > 0, "Operation deadline expired; preserve the journal.")
    connection = http.client.HTTPSConnection(config["host"], config["port"], timeout=remaining)
    timer = None
    try:
        connection.connect()
        remaining = request_deadline - time.monotonic()
        require(remaining > 0, "API deadline expired; preserve the journal.")
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
        body = None
        if method == "PATCH":
            headers["Content-Type"] = "application/json"
            body = json.dumps({"name": config["name"]}, ensure_ascii=True,
                              separators=(",", ":")).encode("ascii")
        connection.request(method, "/v1/devices/" + config["device"], body=body, headers=headers)
        with connection.getresponse() as response:
            require(response.status == 200, f"API returned HTTP {response.status}; preserve the journal. No retry or redirect is made.")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower() == "application/json"
                    and response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Expected uncompressed JSON; preserve the journal.")
            chunks, size = [], 0
            while True:
                require(time.monotonic() < request_deadline, "API request deadline expired.")
                chunk = response.read1(min(65536, MAX_RESPONSE + 1 - size))
                if not chunk:
                    break
                size += len(chunk)
                require(size <= MAX_RESPONSE, "API response exceeds 1 MiB; preserve the journal.")
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


def check_device(row, config):
    require(isinstance(row, dict) and row.get("id") == config["device"]
            and row.get("end_user_id") == config["owner"] and row.get("status") == "bound"
            and ("project_id" not in row or row["project_id"] == config["project"])
            and ("deleted_at" not in row or row["deleted_at"] is None),
            "Device identity, project, owner, deletion or binding mismatch; preserve the journal.")
    name = row.get("name")
    require(name is None or isinstance(name, str), "Invalid returned device name; preserve the journal.")
    generation = None
    if "binding_generation" in row:
        generation = row["binding_generation"]
        require(type(generation) is int and 0 <= generation <= 2**53 - 1,
                "Invalid returned binding generation; preserve the journal.")
    return json.dumps(generation), name == config["name"]


def main():
    require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
    config = configuration()
    deadline = time.monotonic() + 40
    db, fresh = open_journal(config)
    try:
        before, _match = check_device(request(config, "GET", deadline), config)
        row = retained(db, config)
        if row[3] is not None:
            require(row[3] == before, "Saved binding generation changed or appeared/disappeared; preserve intent.")
        if fresh:
            # Commit local uncertainty before the only PATCH. Retained runs never enter here.
            change_phase(db, config, "prepared", "uncertain", before)
            generation, matched = check_device(request(config, "PATCH", deadline), config)
            require(generation == before and matched, "PATCH acknowledgment did not match exact scope, generation and name; preserve intent.")
            change_phase(db, config, "uncertain", "acknowledged", before)
        after, matched = check_device(request(config, "GET", deadline), config)
        require(before == after, "Binding generation changed or appeared/disappeared between observations.")
        row = retained(db, config)
        require(row[3] is None or row[3] == after, "Saved binding generation mismatch; preserve intent.")
        require(time.monotonic() < deadline, "Operation deadline expired; preserve intent.")
        acknowledged = row[2] == "acknowledged"
        print(json.dumps({"device_id": config["device"], "validated_patch_acknowledgment": acknowledged,
                          "observed_name_matches": matched, "binding_generation_observed": after != "null",
                          "atomic_ownership_check": False, "physical_name_verified": False}, indent=2))
        return 0 if acknowledged and matched else 2
    finally:
        db.close()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Operation failed or timed out. Preserve the journal; operator reconciliation is required. No automatic retry is made.", file=sys.stderr)
        sys.exit(1)
