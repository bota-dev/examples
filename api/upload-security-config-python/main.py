"""Observe resolved upload-security policy for one configured owned device."""

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
SOURCES = {"default", "organization", "project", "device"}
POLICIES = {"legacy_allowed", "v2_preferred", "v2_required"}


class SafeError(Exception):
    """An error safe to display without response content or credentials."""


def require(condition, message):
    if not condition:
        raise SafeError(message)


def valid_id(prefix, value):
    return isinstance(value, str) and re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value) is not None


def read_config():
    base = os.environ.get("BOTA_API_BASE_URL", "")
    require(not re.search(r"[\x00-\x20\x7f\\]", base),
            "API URL must not contain whitespace, controls or backslashes.")
    try:
        url = urllib.parse.urlsplit(base)
        port = url.port
    except ValueError:
        raise SafeError("Set an explicit valid HTTPS API URL ending in /v1.") from None
    require(url.scheme == "https" and url.hostname and not url.username and not url.password
            and not url.query and not url.fragment and url.path in {"/v1", "/v1/"}
            and (port is None or 1 <= port <= 65535),
            "API URL must use HTTPS, end in /v1, and have no credentials, query or fragment.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(),
            "Set a server-side project key with devices:read and config:read.")
    project = os.environ.get("BOTA_PROJECT_ID", "")
    owner = os.environ.get("BOTA_END_USER_ID", "")
    device = os.environ.get("BOTA_DEVICE_ID", "")
    require(valid_id("proj", project), "Set the exact expected BOTA_PROJECT_ID.")
    require(valid_id("eu", owner), "Set the fixed authorized BOTA_END_USER_ID.")
    require(valid_id("dev", device), "Set the exact owned BOTA_DEVICE_ID.")
    return base.rstrip("/"), key, project, owner, device


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
    require(remaining > 0, "Configuration read exceeded its elapsed-time budget.")
    url = urllib.parse.urlsplit(base)
    connection = http.client.HTTPSConnection(url.hostname, url.port, timeout=remaining)
    timer = None
    try:
        connection.connect()
        remaining = request_deadline - time.monotonic()
        require(remaining > 0, "Configuration read exceeded its elapsed-time budget.")
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
        return json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                          parse_constant=reject_constant, parse_float=finite_float)
    except (UnicodeError, ValueError):
        raise SafeError("API response is not valid strict UTF-8 JSON.") from None


def check_project(row, project):
    require("project_id" not in row or row["project_id"] == project,
            "Returned project does not match the configured project.")


def check_device(row, project, owner, device):
    require(isinstance(row, dict) and row.get("id") == device and row.get("end_user_id") == owner
            and row.get("status") == "bound" and ("deleted_at" not in row or row["deleted_at"] is None),
            "Device identity, current ownership, binding or deletion check failed.")
    check_project(row, project)
    if "binding_generation" not in row:
        return None
    generation = row["binding_generation"]
    require(type(generation) is int and 0 <= generation <= 9007199254740991,
            "Device binding generation is invalid.")
    return generation


def select_policy(section, project):
    require(isinstance(section, dict) and isinstance(section.get("value"), dict)
            and isinstance(section.get("definition"), dict), "Upload-security section response is invalid.")
    check_project(section, project)
    require("deleted_at" not in section or section["deleted_at"] is None,
            "Upload-security section has a deletion marker.")
    source = section.get("source")
    require(isinstance(source, str) and source in SOURCES, "Upload-security source level is unsupported.")
    require(section["definition"].get("merge_strategy") == "merge_deep",
            "Upload-security section merge strategy is unsupported.")
    policy = section["value"].get("encrypted_upload_policy")
    require(isinstance(policy, str) and policy in POLICIES,
            "Resolved upload policy is missing or unsupported; no client default or fallback is chosen.")
    return policy, source


def main():
    require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
    base, key, project, owner, device = read_config()
    deadline = time.monotonic() + 30
    path = f"/devices/{device}"
    before = check_device(read_json(base, key, path, deadline), project, owner, device)
    policy, source = select_policy(read_json(base, key, path + "/config/upload_security", deadline), project)
    after = check_device(read_json(base, key, path, deadline), project, owner, device)
    require(before == after, "Device binding generation changed or appeared/disappeared between reads.")
    require(time.monotonic() < deadline, "Configuration read exceeded its elapsed-time budget.")
    print(json.dumps({
        "device_id": device,
        "selected_upload_security": {"encrypted_upload_policy": policy},
        "source": source,
        "source_meaning": "last_section_override_level; not per-field provenance",
        "evidence": "resolved_cloud_configuration",
        "atomic_snapshot": False,
        "device_enforcement_verified": False,
        "recording_encryption_verified": False,
        "device_capability_verified": False,
        "upload_authorization_verified": False,
        "upload_acceptance_verified": False,
        "cloud_commitment_verified": False,
        "integrity_verified": False,
        "device_cleanup_authorized": False,
    }, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Upload-security read failed. Check trusted configuration, access or network; no automatic retry was made.",
              file=sys.stderr)
        sys.exit(1)
