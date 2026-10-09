"""Inspect an existing recording's reported integrity metadata using GET only."""

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
from urllib.parse import urlsplit

MAX_RESPONSE_BYTES = 1024 * 1024
STATUSES = {"pending", "streaming", "uploaded", "processing", "completed", "failed", "integrity_failure"}


class SafeError(Exception):
    """A fixed error safe to print without upstream data or credentials."""


def require(condition, message):
    if not condition:
        raise SafeError(message)


def identifier(value, prefix):
    return isinstance(value, str) and re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value) is not None


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
    config = {"host": base.hostname, "port": port, "key": key}
    for field, name, prefix in (("project", "BOTA_PROJECT_ID", "proj"),
                                ("owner", "BOTA_END_USER_ID", "eu"),
                                ("recording", "BOTA_RECORDING_ID", "rec")):
        value = os.environ.get(name, "")
        require(identifier(value, prefix) and "replace_me" not in value.lower(),
                f"Configure the exact authorized {name}.")
        config[field] = value
    mode = os.environ.get("BOTA_RECORDING_SOURCE", "")
    require(mode in {"api", "device"}, "Set BOTA_RECORDING_SOURCE to api or device.")
    config["source"] = "api_upload" if mode == "api" else "device"
    device = os.environ.get("BOTA_DEVICE_ID", "")
    if mode == "device":
        require(identifier(device, "dev") and "replace_me" not in device.lower(),
                "Configure the exact authorized BOTA_DEVICE_ID for a device recording.")
        config["device"] = device
    else:
        require(device == "", "Leave BOTA_DEVICE_ID unset or empty for an API upload.")
        config["device"] = None
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
    require(remaining > 0, "Integrity inspection exceeded its elapsed budget.")
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


def check_project(row, config):
    require(isinstance(row, dict) and row.get("deleted_at") is None
            and ("project_id" not in row or row["project_id"] == config["project"]),
            "API project identity or deletion marker mismatch.")


def check_device(config, deadline):
    row = read_json(config, "/devices/" + config["device"], deadline)
    check_project(row, config)
    require(row.get("id") == config["device"] and row.get("end_user_id") == config["owner"]
            and row.get("status") == "bound", "Configured device identity, binding or ownership mismatch.")
    if "binding_generation" not in row:
        return None
    generation = row["binding_generation"]
    require(type(generation) is int and 0 <= generation <= 2**53 - 1,
            "Invalid device binding generation.")
    return generation


def timestamp(value):
    require(isinstance(value, str) and len(value) <= 40 and re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)", value),
        "Invalid reported verification timestamp.")
    try:
        dt.datetime.fromisoformat(value)
    except ValueError:
        raise SafeError("Invalid reported verification timestamp.") from None
    return value


def select_recording(row, config):
    check_project(row, config)
    require(row.get("id") == config["recording"] and row.get("end_user_id") == config["owner"]
            and row.get("source") == config["source"] and "device_id" in row
            and row["device_id"] == config["device"],
            "Configured recording identity, source or ownership mismatch.")
    require(row.get("status") in STATUSES, "Unsupported or missing recording status.")
    require("content_sha256" in row and "content_sha256_verified_at" in row,
            "Missing reported integrity fields; no fallback was made.")
    digest = row["content_sha256"]
    require(digest is None or (isinstance(digest, str) and re.fullmatch(r"[0-9a-f]{64}", digest)),
            "Invalid declared recording SHA-256.")
    verified_at = row["content_sha256_verified_at"]
    if verified_at is not None:
        verified_at = timestamp(verified_at)
        require(digest is not None, "Verification timestamp lacks its associated digest.")
    # Retain the digest only for comparison; it never enters the output projection.
    return {"id": row["id"], "end_user_id": row["end_user_id"], "device_id": row["device_id"],
            "source": row["source"], "status": row["status"], "digest": digest,
            "reported_hash_verification_at": verified_at}


if __name__ == "__main__":
    try:
        require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
        config = configuration()
        deadline = time.monotonic() + 45
        generation = check_device(config, deadline) if config["device"] is not None else None
        path = "/recordings/" + config["recording"]
        selected = select_recording(read_json(config, path, deadline), config)
        final = select_recording(read_json(config, path, deadline), config)
        require(selected == final, "Recording relationships, status or integrity evidence changed; no report emitted.")
        if config["device"] is not None:
            require(check_device(config, deadline) == generation,
                    "Device binding generation changed or became unavailable; no report emitted.")
        result = {field: selected[field] for field in ("id", "end_user_id", "device_id", "source", "status",
                                                     "reported_hash_verification_at")}
        result.update({"hash_present": selected["digest"] is not None,
                       "evidence": "backend_recording_metadata_report",
                       "atomic_snapshot": False, "historical_owner_verified": False,
                       "independent_bytes_verified": False, "media_validation_verified": False,
                       "completion_acknowledgment_observed": False, "signed_receipt_verified": False,
                       "device_cleanup_authorized": False, "device_cleanup_verified": False})
        output = json.dumps(result, ensure_ascii=True, allow_nan=False, indent=2)
        require(len(output.encode("utf-8")) <= MAX_RESPONSE_BYTES, "Selected metadata exceeds the output limit.")
        require(time.monotonic() < deadline, "Integrity inspection exceeded its elapsed budget.")
        print(output)
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Integrity inspection failed or timed out. No raw response data or credentials were emitted; no retry was made.",
              file=sys.stderr)
        sys.exit(1)
