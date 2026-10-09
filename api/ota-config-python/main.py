"""Read selected resolved cloud OTA settings for one owned device."""

import http.client
import json
import math
import os
import re
import socket
import sys
import threading
import time
import urllib.parse

MAX_RESPONSE_BYTES = 1024 * 1024
SOURCES = {"default", "organization", "project", "end_user", "device"}
OTA_SOURCES = {"legacy", "service"}


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
        raise SafeError("Set a valid explicit HTTPS BOTA_API_BASE_URL ending in /v1.") from None
    require(url.hostname and url.scheme == "https"
            and not url.username and not url.password and not url.query and not url.fragment
            and url.path in {"/v1", "/v1/"} and (port is None or 1 <= port <= 65535)
            and not re.search(r"[\x00-\x20\x7f]", base),
            "API URL must use HTTPS, end in /v1, and have no credentials, query or fragment.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(),
            "Set a server-side project key with devices:read and config:read.")
    project_id = os.environ.get("BOTA_PROJECT_ID", "")
    end_user_id = os.environ.get("BOTA_END_USER_ID", "")
    device_id = os.environ.get("BOTA_DEVICE_ID", "")
    require(valid_id("proj", project_id), "Set BOTA_PROJECT_ID to the exact expected project.")
    require(valid_id("eu", end_user_id), "Set BOTA_END_USER_ID to the fixed authorized end user.")
    require(valid_id("dev", device_id), "Set BOTA_DEVICE_ID to the expected owned device.")
    return base.rstrip("/"), key, project_id, end_user_id, device_id


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def reject_constant(value):
    raise ValueError("Nonstandard JSON constant")


def finite_float(value):
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Non-finite JSON number")
    return number


def read_json(base, key, path, deadline):
    remaining = deadline - time.monotonic()
    require(remaining > 0, "OTA configuration read exceeded its elapsed-time budget.")
    url = urllib.parse.urlsplit(base)
    connection = http.client.HTTPSConnection(url.hostname, url.port, timeout=min(10, remaining))
    timer = None
    try:
        connection.connect()
        remaining = deadline - time.monotonic()
        require(remaining > 0, "OTA configuration read exceeded its elapsed-time budget.")
        transport = connection.sock
        transport.settimeout(remaining)

        def interrupt_transport():
            # Stop a header/body stream that trickles bytes past the deadline.
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
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower() == "application/json",
                    "The API must return application/json.")
            require(response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Encoded API responses are not supported by this example.")
            chunks = []
            total = 0
            while True:
                require(time.monotonic() < deadline, "OTA configuration read exceeded its elapsed-time budget.")
                chunk = response.read1(min(64 * 1024, MAX_RESPONSE_BYTES + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                require(total <= MAX_RESPONSE_BYTES, "API response exceeds this example's 1 MiB limit.")
                chunks.append(chunk)
            require(time.monotonic() < deadline, "OTA configuration read exceeded its elapsed-time budget.")
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()
    try:
        return json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                          parse_constant=reject_constant, parse_float=finite_float)
    except (UnicodeError, ValueError):
        raise SafeError("The API returned invalid UTF-8 JSON.") from None


def check_project(row, project_id):
    require("project_id" not in row or row["project_id"] == project_id,
            "Returned project identity does not match the configured project.")


def check_device(device, project_id, device_id, end_user_id):
    require(isinstance(device, dict) and device.get("id") == device_id
            and device.get("end_user_id") == end_user_id and device.get("status") == "bound"
            and ("deleted_at" not in device or device["deleted_at"] is None),
            "Device identity, binding, deletion or configured ownership does not match.")
    check_project(device, project_id)
    if "binding_generation" not in device:
        return None
    generation = device["binding_generation"]
    require(type(generation) is int and 0 <= generation <= 9007199254740991,
            "Returned binding generation is invalid.")
    return generation


def select_ota(section, project_id):
    require(isinstance(section, dict) and isinstance(section.get("value"), dict)
            and isinstance(section.get("definition"), dict), "The OTA section response is invalid.")
    check_project(section, project_id)
    source = section.get("source")
    require(isinstance(source, str) and source in SOURCES, "The OTA section source metadata is invalid.")
    require(section["definition"].get("merge_strategy") == "merge_deep",
            "The OTA merge strategy is not supported by this example.")
    value = section["value"]
    settings = value.get("auto_update")
    require(isinstance(settings, dict) and type(settings.get("enabled")) is bool,
            "The resolved OTA auto-update enabled flag is missing or invalid.")
    selector = value.get("source")
    require(isinstance(selector, str) and selector in OTA_SOURCES,
            "The resolved OTA selector is missing, unsupported or invalid; no fallback is selected.")
    return {"auto_update": {"enabled": settings["enabled"]}, "source": selector}, source


def main():
    require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
    base, key, project_id, end_user_id, device_id = read_config()
    deadline = time.monotonic() + 30
    path = f"/devices/{device_id}"
    before = check_device(read_json(base, key, path, deadline), project_id, device_id, end_user_id)
    selected, source = select_ota(read_json(base, key, path + "/config/ota", deadline), project_id)
    after = check_device(read_json(base, key, path, deadline), project_id, device_id, end_user_id)
    require(before == after, "Device binding generation changed between reads.")
    require(time.monotonic() < deadline, "OTA configuration read exceeded its elapsed-time budget.")
    print(json.dumps({
        "device_id": device_id,
        "selected_ota": selected,
        "source": source,
        "source_meaning": "last_section_override_level; not per-field provenance",
        "evidence": "resolved_cloud_configuration",
        "atomic_snapshot": False,
        "device_applied_state_verified": False,
        "ota_execution_verified": False,
        "release_authorization_verified": False,
        "firmware_compatibility_verified": False,
    }, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("OTA configuration read failed. Check API access, network and configuration; no automatic retry was made.",
              file=sys.stderr)
        sys.exit(1)
