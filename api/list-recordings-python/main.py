"""List one fixed owner's cloud recording metadata using bounded cursor pagination."""

import datetime as dt
import http.client
import json
import os
import re
import socket
import sys
import threading
import time
from urllib.parse import urlencode, urlsplit

MAX_PAGE_BYTES = 2 * 1024 * 1024
STATUSES = {"pending", "streaming", "uploaded", "processing", "completed", "failed", "integrity_failure"}


class SafeError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise SafeError(message)


def identifier(value, prefix):
    return isinstance(value, str) and re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value) is not None


def positive_setting(name, default, maximum):
    value = os.environ.get(name, str(default))
    require(re.fullmatch(r"[1-9][0-9]{0,2}", value) is not None and int(value) <= maximum,
            f"{name} must be an integer from 1 to {maximum}.")
    return int(value)


def configuration():
    raw = os.environ.get("BOTA_API_BASE_URL", "")
    try:
        base = urlsplit(raw)
        port = base.port
    except ValueError:
        raise SafeError("Invalid explicit BOTA_API_BASE_URL.") from None
    require(base.hostname and base.path in {"/v1", "/v1/"} and not base.query and not base.fragment
            and base.username is None and base.password is None and (port is None or 1 <= port <= 65535)
            and not re.search(r"[\x00-\x20\x7f]", raw)
            and (base.scheme == "https" or (base.scheme == "http" and
                 base.hostname in {"localhost", "127.0.0.1", "::1"})),
            "Use HTTPS and /v1 without URL credentials/query/fragment; HTTP is loopback-only.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(), "Configure a server-held key with recordings:read.")
    owner = os.environ.get("BOTA_END_USER_ID", "")
    require(identifier(owner, "eu"), "Configure the fixed authorized end-user ID.")
    return {"scheme": base.scheme, "host": base.hostname, "port": port, "key": key, "owner": owner,
            "limit": positive_setting("BOTA_LIMIT", 20, 100),
            "max_pages": positive_setting("BOTA_MAX_PAGES", 5, 50)}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def invalid_constant(_value):
    raise ValueError("Invalid JSON constant")


def read_page(config, cursor, deadline):
    request_deadline = min(deadline, time.monotonic() + 10)
    remaining = request_deadline - time.monotonic()
    require(remaining > 0, "Listing exceeded its elapsed budget; no partial output was emitted.")
    parameters = {"end_user_id": config["owner"], "limit": str(config["limit"])}
    if cursor is not None:
        parameters["cursor"] = cursor
    kind = http.client.HTTPSConnection if config["scheme"] == "https" else http.client.HTTPConnection
    connection = kind(config["host"], config["port"], timeout=remaining)
    timer = None
    try:
        connection.connect()
        remaining = request_deadline - time.monotonic()
        require(remaining > 0, "Listing request deadline expired; no partial output was emitted.")
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
        connection.request("GET", "/v1/recordings?" + urlencode(parameters), headers={
            "Authorization": "Bearer " + config["key"], "Accept": "application/json",
            "Accept-Encoding": "identity",
        })
        with connection.getresponse() as response:
            require(response.status == 200,
                    f"Listing returned HTTP {response.status}; no redirects or automatic retries were made.")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower() == "application/json",
                    "Expected a JSON recordings page.")
            require(response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Encoded API responses are unsupported.")
            chunks, size = [], 0
            while True:
                require(time.monotonic() < request_deadline, "Listing request deadline expired.")
                chunk = response.read1(min(65536, MAX_PAGE_BYTES + 1 - size))
                if not chunk:
                    break
                size += len(chunk)
                require(size <= MAX_PAGE_BYTES, "Recordings page exceeds the 2 MiB example limit.")
                chunks.append(chunk)
            require(time.monotonic() < request_deadline, "Listing request deadline expired.")
            try:
                return json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                                  parse_constant=invalid_constant)
            except (ValueError, UnicodeError, RecursionError):
                raise SafeError("Invalid UTF-8 JSON recordings page.") from None
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()


def timestamp(value, nullable=False):
    if nullable and value is None:
        return None
    require(isinstance(value, str) and len(value) <= 40 and re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})", value),
        "Invalid recording lifecycle timestamp.")
    try:
        dt.datetime.fromisoformat(value)
    except ValueError:
        raise SafeError("Invalid recording lifecycle timestamp.") from None
    return value


def metadata(row, config):
    require(isinstance(row, dict) and identifier(row.get("id"), "rec") and
            row.get("end_user_id") == config["owner"] and not row.get("deleted_at"),
            "Recording identity or configured owner mismatch.")
    require(isinstance(row.get("status"), str) and row["status"] in STATUSES,
            "Unsupported recording status.")
    duration = row.get("duration_seconds")
    require("duration_seconds" in row and (duration is None or
            (type(duration) is int and 0 <= duration <= 2**53 - 1)), "Invalid recording duration.")
    require("recorded_at" in row, "Missing recording timestamp.")
    return {"id": row["id"], "status": row["status"], "duration_seconds": duration,
            "recorded_at": timestamp(row["recorded_at"], nullable=True),
            "created_at": timestamp(row.get("created_at"))}


def list_recordings(config, deadline):
    recordings, seen_ids, seen_cursors = [], set(), set()
    cursor = None
    for pages in range(1, config["max_pages"] + 1):
        page = read_page(config, cursor, deadline)
        require(isinstance(page, dict) and isinstance(page.get("data"), list) and
                len(page["data"]) <= config["limit"] and type(page.get("has_more")) is bool,
                "Invalid recordings pagination envelope.")
        selected = [metadata(row, config) for row in page["data"]]
        for row in selected:
            require(row["id"] not in seen_ids, "Duplicate recording ID across listing pages; no output emitted.")
            seen_ids.add(row["id"])
        recordings.extend(selected)
        require(time.monotonic() < deadline, "Listing exceeded its elapsed budget; no output emitted.")
        if not page["has_more"]:
            return {"recordings": recordings, "pages": pages, "complete": True,
                    "stopped_reason": "end_of_list", "atomic_snapshot": False}
        next_cursor = page.get("next_cursor")
        require(selected and isinstance(next_cursor, str) and 1 <= len(next_cursor) <= 2048 and
                not re.search(r"[\x00-\x20\x7f]", next_cursor) and next_cursor not in seen_cursors,
                "Missing, repeated or non-progressing pagination cursor; no output emitted.")
        seen_cursors.add(next_cursor)
        cursor = next_cursor
        if pages == config["max_pages"]:
            return {"recordings": recordings, "pages": pages, "complete": False,
                    "stopped_reason": "page_limit", "atomic_snapshot": False}


if __name__ == "__main__":
    try:
        require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
        config = configuration()
        deadline = time.monotonic() + 60
        result = list_recordings(config, deadline)
        output = json.dumps(result, ensure_ascii=True, allow_nan=False, indent=2)
        require(time.monotonic() < deadline, "Listing exceeded its elapsed budget; no output emitted.")
        print(output)
        sys.exit(0 if result["complete"] else 2)
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Listing failed or timed out. No response data, cursor or credentials were emitted; no retry was made.",
              file=sys.stderr)
        sys.exit(1)
