"""Read selected resolved OTA settings for one configured end user by GET only."""

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
SOURCES = {"default", "organization", "project", "end_user"}
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
    require(len(base) <= 2048 and not re.search(r"[\x00-\x20\x7f\\?#]", base),
            "API URL must be bounded and contain no whitespace, controls, backslashes or query/fragment delimiters.")
    try:
        url = urllib.parse.urlsplit(base)
        port = url.port
    except ValueError:
        raise SafeError("Set an explicit valid HTTPS API URL ending in /v1.") from None
    require(url.scheme == "https" and url.hostname and url.username is None and url.password is None
            and not url.query and not url.fragment and url.path in {"/v1", "/v1/"}
            and (port is None or 1 <= port <= 65535),
            "API URL must use HTTPS, end in /v1, and have no credentials, query or fragment.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(),
            "Set a server-side project key with end_users:read and config:read.")
    project = os.environ.get("BOTA_PROJECT_ID", "")
    end_user = os.environ.get("BOTA_END_USER_ID", "")
    require(valid_id("proj", project), "Set the exact expected BOTA_PROJECT_ID.")
    require(valid_id("eu", end_user), "Set the fixed authorized BOTA_END_USER_ID.")
    return base.rstrip("/"), key, project, end_user


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
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("Non-finite JSON number")
    return result


def read_json(base, key, path, deadline):
    request_deadline = min(deadline, time.monotonic() + 10)
    remaining = request_deadline - time.monotonic()
    require(remaining > 0, "OTA configuration read exceeded its elapsed-time budget.")
    url = urllib.parse.urlsplit(base)
    connection = http.client.HTTPSConnection(url.hostname, url.port, timeout=remaining)
    timer = None
    try:
        connection.connect()
        remaining = request_deadline - time.monotonic()
        require(remaining > 0, "OTA configuration read exceeded its elapsed-time budget.")
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
        connection.request("GET", url.path.rstrip("/") + path, headers={
            "Authorization": "Bearer " + key,
            "Accept": "application/json",
            "Accept-Encoding": "identity",
        })
        with connection.getresponse() as response:
            require(response.status == 200,
                    f"API read failed (HTTP {response.status}); no redirect or retry was accepted.")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower() == "application/json",
                    "API response must be application/json.")
            require(response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Encoded API responses are unsupported.")
            chunks = []
            total = 0
            while True:
                require(time.monotonic() < request_deadline, "OTA configuration request exceeded its time budget.")
                chunk = response.read1(min(64 * 1024, MAX_RESPONSE_BYTES + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                require(total <= MAX_RESPONSE_BYTES, "API response exceeds this example's 1 MiB limit.")
                chunks.append(chunk)
            require(time.monotonic() < request_deadline, "OTA configuration request exceeded its time budget.")
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()
    try:
        return json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                          parse_constant=reject_constant, parse_float=finite_float)
    except (UnicodeError, ValueError):
        raise SafeError("API response is not valid strict UTF-8 JSON.") from None


def check_project(row, project):
    require("project_id" not in row or row["project_id"] == project,
            "Returned project does not match the configured project.")


def check_end_user(row, project, end_user):
    require(isinstance(row, dict) and row.get("id") == end_user
            and ("deleted_at" not in row or row["deleted_at"] is None),
            "End-user identity or deletion check failed.")
    check_project(row, project)
    if "project_assignment_generation" not in row:
        return None
    generation = row["project_assignment_generation"]
    require(type(generation) is int and 0 <= generation <= 9007199254740991,
            "End-user project assignment generation is invalid.")
    return generation


def select_ota(section, project, end_user):
    require(isinstance(section, dict) and isinstance(section.get("value"), dict)
            and isinstance(section.get("definition"), dict), "OTA section response is invalid.")
    check_project(section, project)
    require("deleted_at" not in section or section["deleted_at"] is None,
            "OTA section has a deletion marker.")
    require(("section" not in section or section["section"] == "ota")
            and ("section" not in section["definition"] or section["definition"]["section"] == "ota")
            and ("end_user_id" not in section or section["end_user_id"] == end_user),
            "Returned OTA section or end-user identity does not match.")
    source = section.get("source")
    require(isinstance(source, str) and source in SOURCES,
            "OTA section source is unsupported for an end-user resolution.")
    require(section["definition"].get("merge_strategy") == "merge_deep",
            "OTA section merge strategy is unsupported.")
    value = section["value"]
    settings = value.get("auto_update")
    require(isinstance(settings, dict) and type(settings.get("enabled")) is bool,
            "Resolved OTA enabled flag is missing or invalid; no local default is selected.")
    selector = value.get("source")
    require(isinstance(selector, str) and selector in OTA_SOURCES,
            "Resolved OTA selector is missing or unsupported; no local fallback is selected.")
    return {"auto_update": {"enabled": settings["enabled"]}, "source": selector}, source


def main():
    require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
    base, key, project, end_user = read_config()
    deadline = time.monotonic() + 30
    path = f"/end-users/{end_user}"
    before = check_end_user(read_json(base, key, path, deadline), project, end_user)
    selected, source = select_ota(read_json(base, key, path + "/config/ota", deadline), project, end_user)
    after = check_end_user(read_json(base, key, path, deadline), project, end_user)
    require(before == after, "End-user project assignment generation changed or appeared/disappeared between reads.")
    require(time.monotonic() < deadline, "OTA configuration read exceeded its elapsed-time budget.")
    print(json.dumps({
        "selected_ota": selected,
        "source": source,
        "source_meaning": "last_section_override_level; not per-field provenance",
        "evidence": "resolved_cloud_end_user_configuration",
        "includes_device_overrides": False,
        "assignment_generation_observed": before is not None,
        "atomic_snapshot": False,
        "release_promotion_verified": False,
        "release_eligibility_verified": False,
        "ota_assignment_verified": False,
        "ota_delivery_verified": False,
        "firmware_installation_verified": False,
        "device_applied_state_verified": False,
    }, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("End-user OTA read failed. Check trusted configuration, access or network; no automatic retry was made.",
              file=sys.stderr)
        sys.exit(1)
