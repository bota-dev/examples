"""Read selected firmware metadata for one owned device using the standard library."""

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
MAX_RELEASES = 100


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
    return base.rstrip("/"), key, device_id, end_user_id


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
    require(remaining > 0, "Firmware catalog read exceeded its elapsed-time budget.")
    url = urllib.parse.urlsplit(base)
    connection_class = http.client.HTTPSConnection if url.scheme == "https" else http.client.HTTPConnection
    connection = connection_class(url.hostname, url.port, timeout=min(10, remaining))
    timer = None
    try:
        connection.connect()
        remaining = deadline - time.monotonic()
        require(remaining > 0, "Firmware catalog read exceeded its elapsed-time budget.")
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
                require(time.monotonic() < deadline, "Firmware catalog read exceeded its elapsed-time budget.")
                chunk = response.read1(min(64 * 1024, MAX_RESPONSE_BYTES + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                require(total <= MAX_RESPONSE_BYTES, "API response exceeds this example's 1 MiB limit.")
                chunks.append(chunk)
            require(time.monotonic() < deadline, "Firmware catalog read exceeded its elapsed-time budget.")
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


def check_device(device, device_id, end_user_id):
    require(isinstance(device, dict) and device.get("id") == device_id
            and device.get("end_user_id") == end_user_id and device.get("status") == "bound"
            and device.get("deleted_at") is None, "Device identity, binding or configured ownership does not match.")


def timestamp(value):
    require(isinstance(value, str) and len(value) <= 40 and re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})", value),
        "A release contains an invalid timestamp.")
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise SafeError("A release contains an invalid timestamp.") from None
    return value


def select_release(row):
    require(isinstance(row, dict) and valid_id("fw", row.get("id")), "A firmware release ID is invalid.")
    version = row.get("version")
    require(isinstance(version, str) and 1 <= len(version) <= 128
            and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._+-]*", version), "A firmware version is invalid.")
    require(row.get("is_released") is True, "The catalog contains an unreleased firmware row.")
    selected = {
        "id": row["id"], "version": version, "is_released": True,
        "created_at": timestamp(row.get("created_at")),
        "updated_at": timestamp(row.get("updated_at")),
    }
    if "release_sequence" in row:
        sequence = row["release_sequence"]
        require(type(sequence) is int and sequence > 0 and isinstance(row.get("allow_downgrade"), bool),
                "A release sequence or downgrade metadata is invalid.")
        selected["release_sequence"] = sequence
        selected["allow_downgrade"] = row["allow_downgrade"]
    else:
        require("allow_downgrade" not in row, "Downgrade metadata has no release sequence.")
    return selected


def main():
    require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
    base, key, device_id, end_user_id = read_config()
    deadline = time.monotonic() + 30
    device_path = f"/devices/{device_id}"
    check_device(read_json(base, key, device_path, deadline), device_id, end_user_id)
    query = urllib.parse.urlencode({"device_id": device_id})
    catalog = read_json(base, key, "/firmware-releases?" + query, deadline)
    require(isinstance(catalog, dict) and isinstance(catalog.get("data"), list)
            and len(catalog["data"]) <= MAX_RELEASES, "The API returned an invalid or oversized release list.")
    selected = [select_release(row) for row in catalog["data"]]
    require(len({row["id"] for row in selected}) == len(selected), "The release list contains duplicate IDs.")
    check_device(read_json(base, key, device_path, deadline), device_id, end_user_id)
    require(time.monotonic() < deadline, "Firmware catalog read exceeded its elapsed-time budget.")
    print(json.dumps({
        "data": selected, "metadata_only": True,
        "pagination_supported": False, "list_complete": False,
    }, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Firmware catalog read failed. Check API access, network and configuration; no automatic retry was made.",
              file=sys.stderr)
        sys.exit(1)
