"""Inspect one existing recording-scoped Ask session using GET metadata only."""

import datetime as dt
import http.client
import json
import math
import os
import re
import socket
import sys
import threading
import time
from urllib.parse import urlencode, urlsplit

MAX_RESPONSE_BYTES = 1024 * 1024
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
    require(base.scheme == "https" and base.hostname and base.path in {"/v1", "/v1/"}
            and not base.query and not base.fragment and base.username is None
            and base.password is None and (port is None or 1 <= port <= 65535)
            and not re.search(r"[\x00-\x20\x7f\\]", raw),
            "Use trusted HTTPS and /v1 without URL credentials, query, fragment or controls.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(), "Configure a server-held project API key.")
    project = os.environ.get("BOTA_PROJECT_ID", "")
    require(re.fullmatch(r"[A-Za-z0-9_-]{3,128}", project)
            and "replace_me" not in project.lower(), "Configure the exact expected project ID.")
    config = {"host": base.hostname, "port": port, "key": key, "project": project,
              "limit": setting("BOTA_LIMIT", 20, 100),
              "max_pages": setting("BOTA_MAX_PAGES", 5, 10)}
    for field, name, prefix in (("owner", "BOTA_END_USER_ID", "eu"),
                                ("recording", "BOTA_RECORDING_ID", "rec"),
                                ("session", "BOTA_SESSION_ID", "as")):
        value = os.environ.get(name, "")
        require(identifier(value, prefix) and "replace_me" not in value.lower(),
                f"Configure the exact authorized {name}.")
        config[field] = value
    return config


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def reject_constant(_value):
    raise ValueError("Invalid JSON constant")


def finite_float(value):
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Non-finite JSON number")
    return number


def check_unicode(value):
    if isinstance(value, str):
        value.encode("utf-8", errors="strict")
    elif isinstance(value, dict):
        for key, item in value.items():
            check_unicode(key)
            check_unicode(item)
    elif isinstance(value, list):
        for item in value:
            check_unicode(item)


def read_json(config, path, deadline):
    request_deadline = min(deadline, time.monotonic() + 10)
    remaining = request_deadline - time.monotonic()
    require(remaining > 0, "Session inspection exceeded its elapsed budget.")
    connection = http.client.HTTPSConnection(config["host"], config["port"], timeout=remaining)
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
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
                    == "application/json", "Expected an application/json API response.")
            require(response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Encoded API responses are unsupported.")
            chunks, size = [], 0
            while True:
                require(time.monotonic() < request_deadline, "API request deadline expired.")
                chunk = response.read1(min(65536, MAX_RESPONSE_BYTES + 1 - size))
                if not chunk:
                    break
                size += len(chunk)
                require(size <= MAX_RESPONSE_BYTES, "API response exceeds the 1 MiB example limit.")
                chunks.append(chunk)
            require(time.monotonic() < request_deadline, "API request deadline expired.")
            try:
                result = json.loads(b"".join(chunks).decode("utf-8", errors="strict"),
                                    object_pairs_hook=unique_object, parse_constant=reject_constant,
                                    parse_float=finite_float)
                check_unicode(result)
                require(time.monotonic() < request_deadline, "API request deadline expired.")
                return result
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


def check_recording(config, deadline):
    row = read_json(config, "/recordings/" + config["recording"], deadline)
    check_identity(row, config)
    require(row.get("id") == config["recording"] and row.get("end_user_id") == config["owner"],
            "Configured recording ownership mismatch.")


def check_session(row, config, exact=False):
    check_identity(row, config)
    require(identifier(row.get("id"), "as") and (not exact or row["id"] == config["session"]),
            "Invalid or mismatching session ID.")
    scope = row.get("scope")
    require(isinstance(scope, dict) and scope.get("type") == "recording"
            and scope.get("recording_ids") == [config["recording"]],
            "Session does not have the exact configured recording scope.")


def observe_membership(config, deadline):
    cursor, seen_ids, seen_cursors = None, set(), set()
    for pages in range(1, config["max_pages"] + 1):
        limit = min(config["limit"], MAX_SESSIONS - len(seen_ids))
        params = {"end_user_id": config["owner"], "scope_type": "recording",
                  "recording_id": config["recording"], "limit": str(limit)}
        if cursor is not None:
            params["cursor"] = cursor
        page = read_json(config, "/ask/sessions?" + urlencode(params), deadline)
        check_identity(page, config)
        require(isinstance(page.get("data"), list) and len(page["data"]) <= limit
                and type(page.get("has_more")) is bool, "Invalid sessions pagination envelope.")
        found = False
        for row in page["data"]:
            check_session(row, config)
            require(row["id"] not in seen_ids, "Repeated session ID; no metadata emitted.")
            seen_ids.add(row["id"])
            found = found or row["id"] == config["session"]
        if page["has_more"]:
            next_cursor = page.get("next_cursor")
            require(page["data"] and isinstance(next_cursor, str) and 1 <= len(next_cursor) <= 2048
                    and not re.search(r"[\x00-\x20\x7f]", next_cursor)
                    and next_cursor not in seen_cursors,
                    "Missing, repeated or non-progressing pagination cursor; no metadata emitted.")
            seen_cursors.add(next_cursor)
            cursor = next_cursor
        else:
            require(page.get("next_cursor") is None, "Unexpected cursor on a terminal page.")
        require(time.monotonic() < deadline, "Session inspection exceeded its elapsed budget.")
        if found:
            return pages
        require(page["has_more"], "Configured session was not observed in the authorized collection.")
        require(len(seen_ids) < MAX_SESSIONS and pages < config["max_pages"],
                "Membership traversal reached its cap without observing the configured session.")
    raise SafeError("Configured session membership was not established.")


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
    check_session(row, config, exact=True)
    count = row.get("message_count")
    require(type(count) is int and 0 <= count <= 2**31 - 1, "Invalid session message count.")
    return {"id": row["id"], "scope": {"type": "recording", "recording_ids": [config["recording"]]},
            "message_count": count, "last_message_at": timestamp(row.get("last_message_at")),
            "created_at": timestamp(row.get("created_at")), "updated_at": timestamp(row.get("updated_at"))}


if __name__ == "__main__":
    try:
        require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
        config = configuration()
        deadline = time.monotonic() + 60
        check_recording(config, deadline)
        before_pages = observe_membership(config, deadline)
        selected = metadata(read_json(config, "/ask/sessions/" + config["session"], deadline), config)
        after_pages = observe_membership(config, deadline)
        check_recording(config, deadline)
        result = {"session": selected, "membership_observation_pages": {"before": before_pages,
                  "after": after_pages}, "atomic_snapshot": False, "historical_authorization_proof": False}
        output = json.dumps(result, ensure_ascii=True, allow_nan=False, indent=2)
        require(len(output.encode("utf-8")) <= MAX_RESPONSE_BYTES, "Selected metadata exceeds the output limit.")
        require(time.monotonic() < deadline, "Session inspection exceeded its elapsed budget.")
        print(output)
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Session inspection failed or timed out. No response data, cursors or credentials were emitted; no retry was made.",
              file=sys.stderr)
        sys.exit(1)
