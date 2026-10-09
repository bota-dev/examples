"""Read one owned device's newest command metadata using only the standard library."""

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
COMMAND_TYPES = {"start_recording", "stop_recording", "trigger_upload", "factory_reset"}
COMMAND_STATUSES = {"pending", "delivered", "executed", "failed", "expired", "cancelled"}


class SafeError(Exception):
    """An error safe to display without upstream content or credentials."""


def require(condition, message):
    if not condition:
        raise SafeError(message)


def valid_id(prefix, value):
    return isinstance(value, str) and re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value) is not None


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
    device_id = os.environ.get("BOTA_DEVICE_ID", "")
    end_user_id = os.environ.get("BOTA_END_USER_ID", "")
    require(valid_id("dev", device_id), "Set BOTA_DEVICE_ID to the expected owned device.")
    require(valid_id("eu", end_user_id), "Set BOTA_END_USER_ID to the fixed authorized end user.")
    limit_text = os.environ.get("BOTA_LIMIT", "20")
    require(re.fullmatch(r"[0-9]{1,3}", limit_text) is not None and 1 <= int(limit_text) <= 100,
            "BOTA_LIMIT must be an integer from 1 to 100.")
    return base.rstrip("/"), key, device_id, end_user_id, int(limit_text)


def read_json(base, key, path, deadline):
    remaining = deadline - time.monotonic()
    require(remaining > 0, "Command-history read exceeded its elapsed-time budget.")
    url = urllib.parse.urlsplit(base)
    connection_class = http.client.HTTPSConnection if url.scheme == "https" else http.client.HTTPConnection
    connection = connection_class(url.hostname, url.port, timeout=min(10, remaining))
    timer = None
    try:
        connection.connect()
        remaining = deadline - time.monotonic()
        require(remaining > 0, "Command-history read exceeded its elapsed-time budget.")
        transport = connection.sock
        transport.settimeout(remaining)

        def interrupt_transport():
            # A fixed elapsed deadline also interrupts headers or bodies trickling bytes.
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
                require(time.monotonic() < deadline, "Command-history read exceeded its elapsed-time budget.")
                chunk = response.read1(min(64 * 1024, MAX_RESPONSE_BYTES + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                require(total <= MAX_RESPONSE_BYTES, "API response exceeds this example's 1 MiB limit.")
                chunks.append(chunk)
            require(time.monotonic() < deadline, "Command-history read exceeded its elapsed-time budget.")
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()
    try:
        return json.loads(b"".join(chunks).decode("utf-8"))
    except (UnicodeError, ValueError):
        raise SafeError("The API returned invalid UTF-8 JSON.") from None


def timestamp(value, optional):
    if value is None and optional:
        return None
    require(isinstance(value, str) and len(value) <= 40 and re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})", value),
        "A command contains an invalid lifecycle timestamp.")
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise SafeError("A command contains an invalid lifecycle timestamp.") from None
    return value


def select_command(row, device_id):
    require(isinstance(row, dict) and valid_id("cmd", row.get("id"))
            and row.get("device_id") == device_id, "A command identity or target device does not match.")
    require(isinstance(row.get("type"), str) and row["type"] in COMMAND_TYPES,
            "A command type is not supported by the selected public contract.")
    require(isinstance(row.get("status"), str) and row["status"] in COMMAND_STATUSES,
            "A command status is not supported by the selected public contract.")
    require(row.get("result") is None or isinstance(row["result"], dict), "A command result has an invalid shape.")
    require(row.get("error") is None or isinstance(row["error"], dict), "A command error has an invalid shape.")
    return {
        "id": row["id"], "device_id": device_id, "type": row["type"], "status": row["status"],
        "created_at": timestamp(row.get("created_at"), False),
        "expires_at": timestamp(row.get("expires_at"), True),
        "delivered_at": timestamp(row.get("delivered_at"), True),
        "executed_at": timestamp(row.get("executed_at"), True),
        "has_result": row.get("result") is not None,
        "has_error": row.get("error") is not None,
    }


def main():
    require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
    base, key, device_id, end_user_id, limit = read_config()
    deadline = time.monotonic() + 30
    device = read_json(base, key, f"/devices/{device_id}", deadline)
    require(isinstance(device, dict) and device.get("id") == device_id
            and device.get("end_user_id") == end_user_id and device.get("status") == "bound"
            and not device.get("deleted_at"), "Device identity, binding or configured ownership does not match.")
    history = read_json(base, key, f"/devices/{device_id}/commands?limit={limit}", deadline)
    require(isinstance(history, dict) and isinstance(history.get("data"), list)
            and len(history["data"]) <= limit, "The API returned an invalid or oversized command list.")
    selected = [select_command(row, device_id) for row in history["data"]]
    require(len({row["id"] for row in selected}) == len(selected), "The command list contains duplicate IDs.")
    require(time.monotonic() < deadline, "Command-history read exceeded its elapsed-time budget.")
    print(json.dumps({
        "data": selected, "requested_limit": limit, "at_limit": len(selected) == limit,
        "pagination_supported": False, "history_complete": False,
    }, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Command-history read failed. Check API access, network and configuration; no automatic retry was made.",
              file=sys.stderr)
        sys.exit(1)
