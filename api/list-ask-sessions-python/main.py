"""Select existing Ask session metadata for one fixed end user; GET requests only."""

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

MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_SESSIONS = 500


class SafeError(Exception):
    """A fixed error safe to print without upstream data or credentials."""


def require(condition, message):
    if not condition:
        raise SafeError(message)


def identifier(value, prefix):
    return isinstance(value, str) and re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value) is not None


def setting(name, default, maximum):
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
            and "replace_me" not in key.lower(), "Configure a server-held project API key.")
    project = os.environ.get("BOTA_PROJECT_ID", "")
    owner = os.environ.get("BOTA_END_USER_ID", "")
    require(re.fullmatch(r"[A-Za-z0-9_-]{3,128}", project) and "replace_me" not in project.lower(),
            "Configure the exact expected project ID.")
    require(identifier(owner, "eu") and "replace_me" not in owner.lower(),
            "Configure the fixed authorized end-user ID.")
    return {"scheme": base.scheme, "host": base.hostname, "port": port, "key": key,
            "project": project, "owner": owner, "limit": setting("BOTA_LIMIT", 20, 100),
            "max_pages": setting("BOTA_MAX_PAGES", 5, 20)}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def reject_constant(_value):
    raise ValueError("Invalid JSON constant")


def read_json(config, path, deadline):
    request_deadline = min(deadline, time.monotonic() + 10)
    remaining = request_deadline - time.monotonic()
    require(remaining > 0, "Session selection exceeded its elapsed budget.")
    kind = http.client.HTTPSConnection if config["scheme"] == "https" else http.client.HTTPConnection
    connection = kind(config["host"], config["port"], timeout=remaining)
    timer = None
    try:
        connection.connect()
        remaining = request_deadline - time.monotonic()
        require(remaining > 0, "API request deadline expired.")
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
        connection.request("GET", "/v1" + path, headers={
            "Authorization": "Bearer " + config["key"], "Accept": "application/json",
            "Accept-Encoding": "identity",
        })
        with connection.getresponse() as response:
            require(response.status == 200,
                    f"API returned HTTP {response.status}; redirects and automatic retries are not accepted.")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower() == "application/json",
                    "Expected an application/json API response.")
            require(response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Encoded API responses are unsupported.")
            chunks, size = [], 0
            while True:
                require(time.monotonic() < request_deadline, "API request deadline expired.")
                chunk = response.read1(min(65536, MAX_RESPONSE_BYTES + 1 - size))
                if not chunk:
                    break
                size += len(chunk)
                require(size <= MAX_RESPONSE_BYTES, "API response exceeds the 2 MiB example limit.")
                chunks.append(chunk)
            require(time.monotonic() < request_deadline, "API request deadline expired.")
            try:
                return json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                                  parse_constant=reject_constant)
            except (ValueError, UnicodeError, RecursionError):
                raise SafeError("Invalid UTF-8 JSON API response.") from None
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()


def check_identity(row, config):
    require(isinstance(row, dict) and row.get("deleted_at") is None
            and ("project_id" not in row or row["project_id"] == config["project"])
            and ("end_user_id" not in row or row["end_user_id"] == config["owner"]),
            "API identity or configured scope mismatch.")


def check_end_user(config, deadline):
    row = read_json(config, "/end-users/" + config["owner"], deadline)
    check_identity(row, config)
    require(row.get("id") == config["owner"], "Configured end-user identity mismatch.")


def timestamp(value):
    require(isinstance(value, str) and len(value) <= 40 and re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)", value),
        "Invalid session timestamp.")
    try:
        dt.datetime.fromisoformat(value)
    except ValueError:
        raise SafeError("Invalid session timestamp.") from None
    return value


def metadata(row, config):
    check_identity(row, config)
    require(identifier(row.get("id"), "as"), "Invalid session ID.")
    scope = row.get("scope")
    require(isinstance(scope, dict), "Invalid session scope.")
    kind, ids = scope.get("type"), scope.get("recording_ids")
    require(kind in {"recording", "library", "selected"},
            "Unsupported session scope; folder remains reserved in the current implementation.")
    require(isinstance(ids, list) and len(ids) <= 500 and all(identifier(value, "rec") for value in ids)
            and len(set(ids)) == len(ids), "Invalid session recording ID selection.")
    require((kind == "recording" and len(ids) == 1) or (kind == "library" and not ids)
            or (kind == "selected" and 1 <= len(ids) <= 500), "Session scope and recording IDs disagree.")
    count = row.get("message_count")
    require(type(count) is int and 0 <= count <= 2**31 - 1, "Invalid session message count.")
    return {"id": row["id"], "scope": {"type": kind, "recording_ids": ids},
            "message_count": count, "last_message_at": timestamp(row.get("last_message_at")),
            "created_at": timestamp(row.get("created_at")), "updated_at": timestamp(row.get("updated_at"))}


def list_sessions(config, deadline):
    sessions, seen_ids, seen_cursors = [], set(), set()
    cursor = None
    for pages in range(1, config["max_pages"] + 1):
        limit = min(config["limit"], MAX_SESSIONS - len(sessions))
        params = {"end_user_id": config["owner"], "limit": str(limit)}
        if cursor is not None:
            params["cursor"] = cursor
        page = read_json(config, "/ask/sessions?" + urlencode(params), deadline)
        require(isinstance(page, dict) and isinstance(page.get("data"), list)
                and len(page["data"]) <= limit and type(page.get("has_more")) is bool,
                "Invalid sessions pagination envelope.")
        check_identity(page, config)
        selected = [metadata(row, config) for row in page["data"]]
        for row in selected:
            require(row["id"] not in seen_ids, "Repeated session ID; no output emitted.")
            seen_ids.add(row["id"])
        sessions.extend(selected)
        require(time.monotonic() < deadline, "Session selection exceeded its elapsed budget.")
        if not page["has_more"]:
            require(page.get("next_cursor") is None, "Unexpected cursor on a terminal page.")
            complete, reason = True, "end_of_list"
            break
        next_cursor = page.get("next_cursor")
        require(selected and isinstance(next_cursor, str) and 1 <= len(next_cursor) <= 2048
                and not re.search(r"[\x00-\x20\x7f]", next_cursor) and next_cursor not in seen_cursors,
                "Missing, repeated or non-progressing pagination cursor; no output emitted.")
        seen_cursors.add(next_cursor)
        cursor = next_cursor
        if len(sessions) == MAX_SESSIONS or pages == config["max_pages"]:
            complete, reason = False, "session_limit" if len(sessions) == MAX_SESSIONS else "page_limit"
            break
    return {"sessions": sessions, "pages": pages, "complete": complete,
            "stopped_reason": reason, "atomic_snapshot": False}


if __name__ == "__main__":
    try:
        require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
        config = configuration()
        deadline = time.monotonic() + 60
        check_end_user(config, deadline)
        result = list_sessions(config, deadline)
        check_end_user(config, deadline)
        output = json.dumps(result, ensure_ascii=True, allow_nan=False, indent=2)
        require(len(output.encode("utf-8")) <= MAX_RESPONSE_BYTES, "Selected metadata exceeds the 2 MiB output limit.")
        require(time.monotonic() < deadline, "Session selection exceeded its elapsed budget.")
        print(output)
        sys.exit(0 if result["complete"] else 2)
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Session selection failed or timed out. No response data, cursors or credentials were emitted; no retry was made.",
              file=sys.stderr)
        sys.exit(1)
