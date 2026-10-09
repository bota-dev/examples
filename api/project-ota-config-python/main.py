"""Read selected OTA intent at the authenticated project's hierarchy level."""

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
SOURCES = {"default", "organization", "project"}
OTA_SOURCES = {"legacy", "service"}


class SafeError(Exception):
    """An error safe to display without response content or credentials."""


def require(condition, message):
    if not condition:
        raise SafeError(message)


def read_config():
    base = os.environ.get("BOTA_API_BASE_URL", "")
    require(len(base) <= 2048 and not re.search(r"[\x00-\x20\x7f\\?#]", base),
            "Set a bounded trusted API URL without controls, backslashes, query or fragment.")
    try:
        url = urllib.parse.urlsplit(base)
        port = url.port
    except ValueError:
        raise SafeError("Set an explicit valid HTTPS API URL ending in /v1.") from None
    require(url.scheme == "https" and url.hostname and url.username is None and url.password is None
            and url.path in {"/v1", "/v1/"} and (port is None or 1 <= port <= 65535),
            "API URL must use trusted HTTPS, end in /v1 and have no URL credentials.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(),
            "Set a server-held project key with config:read.")
    project = os.environ.get("BOTA_PROJECT_ID", "")
    require(re.fullmatch(r"proj_[A-Za-z0-9]{1,64}", project) and "replace_me" not in project.lower(),
            "Set the independently verified expected BOTA_PROJECT_ID.")
    return base.rstrip("/"), key, project


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


def read_ota(base, key, deadline):
    request_deadline = min(deadline, time.monotonic() + 10)
    remaining = request_deadline - time.monotonic()
    require(remaining > 0, "Configuration read exceeded its elapsed-time budget.")
    url = urllib.parse.urlsplit(base)
    connection = http.client.HTTPSConnection(url.hostname, url.port, timeout=remaining)
    timer = None
    try:
        connection.connect()
        remaining = request_deadline - time.monotonic()
        require(remaining > 0, "Configuration read exceeded its request budget.")
        transport = connection.sock
        transport.settimeout(remaining)

        def interrupt_transport():
            try:
                transport.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

        timer = threading.Timer(remaining, interrupt_transport)
        timer.daemon = True
        timer.start()
        connection.request("GET", url.path.rstrip("/") + "/config/ota", headers={
            "Authorization": "Bearer " + key,
            "Accept": "application/json",
            "Accept-Encoding": "identity",
        })
        with connection.getresponse() as response:
            require(response.status == 200,
                    f"Configuration read returned HTTP {response.status}; no redirect or retry was accepted.")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower() == "application/json",
                    "The API must return application/json.")
            require(response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Encoded API responses are unsupported.")
            chunks = []
            total = 0
            while True:
                require(time.monotonic() < request_deadline, "Configuration request exceeded its time budget.")
                chunk = response.read1(min(64 * 1024, MAX_RESPONSE_BYTES + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                require(total <= MAX_RESPONSE_BYTES, "API response exceeds this example's 1 MiB limit.")
                chunks.append(chunk)
            require(time.monotonic() < request_deadline, "Configuration request exceeded its time budget.")
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()
    try:
        result = json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                            parse_constant=reject_constant, parse_float=finite_float)
    except (UnicodeError, ValueError):
        raise SafeError("The API returned invalid finite UTF-8 JSON.") from None
    require(time.monotonic() < deadline, "Configuration read exceeded its elapsed-time budget.")
    return result


def select_ota(section, project):
    require(isinstance(section, dict) and isinstance(section.get("value"), dict)
            and isinstance(section.get("definition"), dict),
            "Expected the direct OTA section with value, source and definition.")
    source = section.get("source")
    require(isinstance(source, str) and source in SOURCES,
            "The project OTA section source is missing or unsupported.")
    require(section["definition"].get("merge_strategy") == "merge_deep",
            "The OTA merge strategy is missing or unsupported.")
    require("project_id" not in section or section["project_id"] == project,
            "Returned project marker does not match the expected project.")
    require("deleted_at" not in section or section["deleted_at"] is None,
            "An unexpected deletion marker was returned.")
    require(("section" not in section or section["section"] == "ota")
            and ("section" not in section["definition"] or section["definition"]["section"] == "ota"),
            "An unexpected section identity marker was returned.")
    value = section["value"]
    settings = value.get("auto_update")
    require(isinstance(settings, dict) and type(settings.get("enabled")) is bool,
            "Resolved auto_update.enabled is missing or is not a boolean.")
    selector = value.get("source")
    require(isinstance(selector, str) and selector in OTA_SOURCES,
            "Resolved OTA source is missing or unsupported; no fallback is selected.")
    return {"selected_ota": {"auto_update": {"enabled": settings["enabled"]}, "source": selector},
            "source": source}


def main():
    require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
    base, key, project = read_config()
    deadline = time.monotonic() + 30
    selected = select_ota(read_ota(base, key, deadline), project)
    require(time.monotonic() < deadline, "Configuration read exceeded its elapsed-time budget.")
    print(json.dumps(selected, indent=2, ensure_ascii=True, allow_nan=False))


if __name__ == "__main__":
    try:
        main()
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Project OTA read failed. Check trusted configuration, API access and network; no automatic retry was made.",
              file=sys.stderr)
        sys.exit(1)
