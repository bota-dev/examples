"""Inspect one existing summary's selected metadata with exact source checks."""

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
STATUSES = {"pending", "processing", "completed", "failed"}


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
    require(len(raw) <= 2048 and "?" not in raw and "#" not in raw
            and base.scheme == "https" and base.hostname and base.path in {"/v1", "/v1/"}
            and base.username is None and base.password is None and not base.query and not base.fragment
            and (port is None or 1 <= port <= 65535) and not re.search(r"[\x00-\x20\x7f\\]", raw),
            "Use trusted HTTPS and /v1 without URL credentials, query, fragment or controls.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(),
            "Configure a server-held key with recordings:read, transcriptions:read and summaries:read.")
    project = os.environ.get("BOTA_PROJECT_ID", "")
    require(identifier(project, "proj") and "replace_me" not in project.lower(),
            "Configure the exact expected project ID.")
    config = {"host": base.hostname, "port": port, "key": key, "project": project}
    for field, name, prefix in (("owner", "BOTA_END_USER_ID", "eu"),
                                ("recording", "BOTA_RECORDING_ID", "rec"),
                                ("transcription", "BOTA_TRANSCRIPTION_ID", "txn"),
                                ("summary", "BOTA_SUMMARY_ID", "sum")):
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
    raise ValueError("Nonstandard JSON constant")


def finite_float(value):
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Nonfinite JSON number")
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
    require(remaining > 0, "Summary inspection exceeded its elapsed-time budget.")
    connection = http.client.HTTPSConnection(config["host"], config["port"], timeout=remaining)
    timer = None
    try:
        connection.connect()
        remaining = request_deadline - time.monotonic()
        require(remaining > 0, "API request deadline expired.")
        transport = connection.sock
        transport.settimeout(remaining)

        def expire():
            # Interrupt trickling headers/body bytes at the connected request deadline.
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
                raise SafeError("Invalid UTF-8 JSON, duplicate keys or nonfinite numbers in API response.") from None
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()


def check_scope(row, config):
    require(isinstance(row, dict) and row.get("deleted_at") is None
            and ("project_id" not in row or row["project_id"] == config["project"]),
            "API project identity or deletion marker does not match.")
    return ("project_id" in row, row.get("project_id"), "deleted_at" in row, row.get("deleted_at"))


def check_recording(config, deadline):
    row = read_json(config, "/recordings/" + config["recording"], deadline)
    scope = check_scope(row, config)
    require(row.get("id") == config["recording"] and row.get("end_user_id") == config["owner"],
            "Recording identity or configured end-user ownership does not match.")
    require(row.get("status") != "deleted", "Recording is marked deleted; no report emitted.")
    return (row["id"], row["end_user_id"], scope)


def check_transcription(config, deadline):
    row = read_json(config, "/transcriptions/" + config["transcription"], deadline)
    scope = check_scope(row, config)
    require(row.get("id") == config["transcription"] and row.get("recording_id") == config["recording"]
            and isinstance(row.get("status"), str) and row["status"] in STATUSES,
            "Transcription identity, exact recording source or public status does not match.")
    return (row["id"], row["recording_id"], scope)


def timestamp(value):
    require(isinstance(value, str) and len(value) <= 40 and re.fullmatch(
        r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,9})?"
        r"(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])", value)
        and not value.endswith("-00:00"), "Invalid reported summary timestamp.")
    try:
        dt.datetime.fromisoformat(value)
    except ValueError:
        raise SafeError("Invalid reported summary timestamp.") from None
    return value


def summary_metadata(row, config):
    check_scope(row, config)
    require(row.get("id") == config["summary"] and row.get("project_id") == config["project"]
            and row.get("transcription_id") == config["transcription"]
            and isinstance(row.get("status"), str) and row["status"] in STATUSES,
            "Summary identity, mandatory project, exact transcription source or public status does not match.")
    result = {"id": row["id"], "project_id": row["project_id"], "status": row["status"]}
    for field in ("created_at", "updated_at", "started_at", "completed_at"):
        require(field in row, "Summary response is missing a documented timestamp field.")
        value = row[field]
        if value is None:
            require(field in {"started_at", "completed_at"}, "Summary creation/update timestamp must be present.")
        else:
            value = timestamp(value)
        result[field] = value
    result["source"] = {"transcription_id": config["transcription"], "recording_id": config["recording"],
                        "end_user_id": config["owner"]}
    result["atomic_snapshot"] = False
    return result


def main():
    require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
    config = configuration()
    deadline = time.monotonic() + 60
    recording_identity = check_recording(config, deadline)
    transcription_identity = check_transcription(config, deadline)
    result = summary_metadata(read_json(config, "/summaries/" + config["summary"], deadline), config)
    require(check_transcription(config, deadline) == transcription_identity,
            "Transcription source identity or available scope markers changed; no report emitted.")
    require(check_recording(config, deadline) == recording_identity,
            "Recording ownership or available scope markers changed; no report emitted.")
    output = json.dumps(result, ensure_ascii=True, allow_nan=False, indent=2)
    require(len(output.encode("utf-8")) <= MAX_RESPONSE_BYTES, "Selected metadata exceeds the 1 MiB output limit.")
    require(time.monotonic() < deadline, "Summary inspection exceeded its elapsed-time budget.")
    print(output)


if __name__ == "__main__":
    try:
        main()
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Summary inspection failed or timed out. No raw response data or credentials were emitted; no retry was made.",
              file=sys.stderr)
        sys.exit(1)
