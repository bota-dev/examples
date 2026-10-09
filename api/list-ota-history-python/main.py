"""Read a bounded selection of backend OTA history for an owned cloud device."""

import http.client
import json
import os
import re
import socket
import sys
import threading
import time
import urllib.parse
from datetime import datetime

MAX_RESPONSE_BYTES = 1024 * 1024
STATUSES = {"pending", "delivered", "applied", "failed", "cancelled"}


class SafeError(Exception):
    """An error safe to display without upstream content or credentials."""


def require(condition, message):
    if not condition:
        raise SafeError(message)


def valid_id(prefix, value):
    return isinstance(value, str) and re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value) is not None


def timestamp(value):
    require(isinstance(value, str) and len(value) <= 40 and re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)", value),
        "An OTA timestamp or configured cutoff is invalid.")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise SafeError("An OTA timestamp or configured cutoff is invalid.") from None


def read_config():
    base = os.environ.get("BOTA_API_BASE_URL", "")
    try:
        url = urllib.parse.urlsplit(base)
        port = url.port
    except ValueError:
        raise SafeError("Set a valid explicit BOTA_API_BASE_URL ending in /v1.") from None
    loopback = url.hostname in {"localhost", "127.0.0.1", "::1"}
    require(url.hostname and (url.scheme == "https" or (url.scheme == "http" and loopback))
            and not url.username and not url.password and not url.query and not url.fragment
            and url.path in {"/v1", "/v1/"} and (port is None or 1 <= port <= 65535)
            and not re.search(r"[\x00-\x20\x7f]", base),
            "API URL must use HTTPS (or loopback HTTP), end in /v1, and have no credentials, query or fragment.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(), "Set a server-side project key with devices:read.")
    project_id = os.environ.get("BOTA_PROJECT_ID", "")
    device_id = os.environ.get("BOTA_DEVICE_ID", "")
    end_user_id = os.environ.get("BOTA_END_USER_ID", "")
    require(valid_id("proj", project_id), "Set BOTA_PROJECT_ID to the exact expected project.")
    require(valid_id("dev", device_id), "Set BOTA_DEVICE_ID to the expected owned device.")
    require(valid_id("eu", end_user_id), "Set BOTA_END_USER_ID to the fixed authorized end user.")
    limit_text = os.environ.get("BOTA_OTA_HISTORY_LIMIT", "10")
    require(re.fullmatch(r"[1-9][0-9]{0,2}", limit_text) is not None,
            "BOTA_OTA_HISTORY_LIMIT must be an integer from 1 to 100.")
    limit = int(limit_text)
    require(limit <= 100, "BOTA_OTA_HISTORY_LIMIT must be an integer from 1 to 100.")
    cutoff_text = os.environ.get("BOTA_OTA_ASSIGNED_NOT_BEFORE", "")
    cutoff = timestamp(cutoff_text)
    return base.rstrip("/"), key, project_id, device_id, end_user_id, limit, cutoff_text, cutoff


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def reject_constant(value):
    raise ValueError("Nonstandard JSON constant")


def read_json(base, key, path, deadline):
    remaining = deadline - time.monotonic()
    require(remaining > 0, "OTA history read exceeded its elapsed-time budget.")
    url = urllib.parse.urlsplit(base)
    connection_class = http.client.HTTPSConnection if url.scheme == "https" else http.client.HTTPConnection
    connection = connection_class(url.hostname, url.port, timeout=min(10, remaining))
    timer = None
    try:
        connection.connect()
        remaining = deadline - time.monotonic()
        require(remaining > 0, "OTA history read exceeded its elapsed-time budget.")
        transport = connection.sock
        transport.settimeout(remaining)

        def interrupt_transport():
            # Interrupt headers or bodies that keep trickling bytes past the deadline.
            try:
                transport.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

        timer = threading.Timer(remaining, interrupt_transport)
        timer.daemon = True
        timer.start()
        connection.request("GET", url.path.rstrip("/") + path, headers={
            "Authorization": "Bearer " + key,
            "Accept": "application/json",
            "Accept-Encoding": "identity",
        })
        with connection.getresponse() as response:
            require(response.status == 200,
                    f"API read failed (HTTP {response.status}); redirects and automatic retries are not accepted.")
            media_type = response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
            require(media_type == "application/json", "The API must return application/json.")
            require(response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Encoded API responses are not supported by this example.")
            chunks = []
            total = 0
            while True:
                require(time.monotonic() < deadline, "OTA history read exceeded its elapsed-time budget.")
                chunk = response.read1(min(64 * 1024, MAX_RESPONSE_BYTES + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                require(total <= MAX_RESPONSE_BYTES, "API response exceeds this example's 1 MiB limit.")
                chunks.append(chunk)
            require(time.monotonic() < deadline, "OTA history read exceeded its elapsed-time budget.")
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()
    try:
        return json.loads(b"".join(chunks).decode("utf-8"),
                          object_pairs_hook=unique_object, parse_constant=reject_constant)
    except (UnicodeError, ValueError):
        raise SafeError("The API returned invalid UTF-8 JSON.") from None


def check_project(row, project_id):
    require("project_id" not in row or row["project_id"] == project_id,
            "Returned project identity does not match the configured project.")


def check_device(device, project_id, device_id, end_user_id):
    require(isinstance(device, dict) and device.get("id") == device_id
            and device.get("end_user_id") == end_user_id and device.get("status") == "bound"
            and device.get("deleted_at") is None, "Device identity, binding or configured ownership does not match.")
    check_project(device, project_id)


def select_assignment(row, project_id, device_id):
    require(isinstance(row, dict) and valid_id("ota", row.get("id")), "An OTA assignment ID is invalid.")
    require(row.get("device_id") == device_id and valid_id("fw", row.get("firmware_release_id")),
            "An OTA assignment device or release identity is invalid.")
    check_project(row, project_id)
    require(isinstance(row.get("status"), str) and row["status"] in STATUSES,
            "An OTA assignment status is invalid.")
    assigned_at = timestamp(row.get("assigned_at"))
    selected = {
        "id": row["id"], "device_id": device_id,
        "firmware_release_id": row["firmware_release_id"], "status": row["status"],
        "assigned_at": row["assigned_at"],
    }
    for field in ("delivered_at", "applied_at"):
        require(field in row, "An OTA assignment timestamp is missing.")
        if row[field] is not None:
            timestamp(row[field])
        selected[field] = row[field]
    return selected, assigned_at


def main():
    require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
    base, key, project_id, device_id, end_user_id, limit, cutoff_text, cutoff = read_config()
    deadline = time.monotonic() + 30
    device_path = f"/devices/{device_id}"
    check_device(read_json(base, key, device_path, deadline), project_id, device_id, end_user_id)
    query = urllib.parse.urlencode({"limit": limit})
    history = read_json(base, key, device_path + "/ota/history?" + query, deadline)
    require(isinstance(history, dict) and isinstance(history.get("data"), list)
            and len(history["data"]) <= limit, "The API returned an invalid or oversized OTA history list.")
    check_project(history, project_id)
    validated = [select_assignment(row, project_id, device_id) for row in history["data"]]
    require(len({row["id"] for row, _ in validated}) == len(validated),
            "The OTA history contains duplicate assignment IDs.")
    require(all(validated[i - 1][1] >= validated[i][1] for i in range(1, len(validated))),
            "The OTA history is not ordered newest first.")
    selected = [row for row, assigned_at in validated if assigned_at >= cutoff]
    check_device(read_json(base, key, device_path, deadline), project_id, device_id, end_user_id)
    require(time.monotonic() < deadline, "OTA history read exceeded its elapsed-time budget.")
    print(json.dumps({
        "data": selected, "metadata_only": True, "evidence": "backend_assignment_history",
        "assigned_not_before": cutoff_text, "requested_limit": limit,
        "pagination_supported": False, "history_complete": False,
        "historical_owner_verified": False,
    }, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("OTA history read failed. Check API access, network and configuration; no automatic retry was made.",
              file=sys.stderr)
        sys.exit(1)
