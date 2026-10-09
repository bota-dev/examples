"""List existing summary IDs and statuses for one owned completed transcription."""

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
PAGE_SIZE = 20
MAX_SUMMARIES = 200
STATUSES = {"pending", "processing", "completed", "failed"}


class SafeError(Exception):
    """An error safe to print without upstream content or credentials."""


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
        raise SafeError("Configure a valid explicit HTTPS BOTA_API_BASE_URL.") from None
    require(base.scheme == "https" and base.hostname and base.path in {"/v1", "/v1/"}
            and base.username is None and base.password is None and not base.query and not base.fragment
            and (port is None or 1 <= port <= 65535) and not re.search(r"[\x00-\x20\x7f]", raw),
            "Use a trusted HTTPS API base ending in /v1 without credentials, query or fragment.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(),
            "Configure a server-held key with recordings:read, transcriptions:read and summaries:read.")
    project = os.environ.get("BOTA_PROJECT_ID", "")
    require(re.fullmatch(r"[A-Za-z0-9_-]{3,128}", project) and "replace_me" not in project.lower(),
            "Configure the exact expected project ID.")
    ids = {}
    for name, prefix in (("BOTA_END_USER_ID", "eu"), ("BOTA_RECORDING_ID", "rec"),
                         ("BOTA_TRANSCRIPTION_ID", "txn")):
        value = os.environ.get(name, "")
        require(identifier(value, prefix) and "replace_me" not in value.lower(),
                f"Configure {name} to the fixed authorized resource ID.")
        ids[name] = value
    pages = os.environ.get("BOTA_MAX_PAGES", "10")
    require(re.fullmatch(r"(?:[1-9]|10)", pages), "BOTA_MAX_PAGES must be an integer from 1 to 10.")
    return {"host": base.hostname, "port": port, "key": key, "project": project,
            "max_pages": int(pages), **ids}


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


def read_json(config, path, deadline):
    request_deadline = min(deadline, time.monotonic() + 10)
    remaining = request_deadline - time.monotonic()
    require(remaining > 0, "Summary selection exceeded its elapsed-time budget.")
    connection = http.client.HTTPSConnection(config["host"], config["port"], timeout=remaining)
    timer = None
    try:
        connection.connect()
        remaining = request_deadline - time.monotonic()
        require(remaining > 0, "API request deadline expired.")
        transport = connection.sock
        transport.settimeout(remaining)

        def expire():
            # Interrupt trickling headers/body bytes at the request deadline.
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
            return json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                              parse_constant=reject_constant, parse_float=finite_float)
        except (ValueError, UnicodeError, RecursionError):
            raise SafeError("Invalid UTF-8 JSON, duplicate keys or nonfinite numbers in API response.") from None
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()


def check_identity(row, config):
    require(isinstance(row, dict) and row.get("deleted_at") is None
            and ("project_id" not in row or row["project_id"] == config["project"]),
            "API project identity or deletion marker does not match.")


def check_transcription(config, deadline):
    transcription = read_json(config, "/transcriptions/" + config["BOTA_TRANSCRIPTION_ID"], deadline)
    check_identity(transcription, config)
    require(transcription.get("id") == config["BOTA_TRANSCRIPTION_ID"]
            and transcription.get("recording_id") == config["BOTA_RECORDING_ID"]
            and transcription.get("status") == "completed",
            "Transcription identity, exact recording source or completed status does not match.")


def check_recording(config, deadline):
    recording = read_json(config, "/recordings/" + config["BOTA_RECORDING_ID"], deadline)
    check_identity(recording, config)
    require(recording.get("id") == config["BOTA_RECORDING_ID"]
            and recording.get("end_user_id") == config["BOTA_END_USER_ID"],
            "Recording identity or configured end-user ownership does not match.")


def metadata(row, config):
    check_identity(row, config)
    require(identifier(row.get("id"), "sum") and row.get("project_id") == config["project"]
            and row.get("transcription_id") == config["BOTA_TRANSCRIPTION_ID"]
            and isinstance(row.get("status"), str) and row["status"] in STATUSES,
            "Summary ID, mandatory project, exact transcription source or status does not match.")
    # Arbitrary provider/template strings and all content are deliberately excluded.
    return {"id": row["id"], "status": row["status"]}


def list_summaries(config, deadline):
    summaries, seen_ids, seen_cursors = [], set(), set()
    cursor = None
    for pages in range(1, config["max_pages"] + 1):
        limit = min(PAGE_SIZE, MAX_SUMMARIES - len(summaries))
        params = {"transcription_id": config["BOTA_TRANSCRIPTION_ID"], "limit": str(limit)}
        if cursor is not None:
            params["cursor"] = cursor
        page = read_json(config, "/summaries?" + urlencode(params), deadline)
        check_identity(page, config)
        require(isinstance(page.get("data"), list) and len(page["data"]) <= limit
                and type(page.get("has_more")) is bool, "Invalid summaries pagination envelope.")
        selected = [metadata(row, config) for row in page["data"]]
        for row in selected:
            require(row["id"] not in seen_ids, "Repeated summary ID; no selection emitted.")
            seen_ids.add(row["id"])
        summaries.extend(selected)
        require(time.monotonic() < deadline, "Summary selection exceeded its elapsed-time budget.")
        if not page["has_more"]:
            require(page.get("next_cursor") is None, "Unexpected cursor on a terminal page.")
            exhausted, reason = True, "observed_end_of_list"
            break
        next_cursor = page.get("next_cursor")
        require(selected and isinstance(next_cursor, str) and 1 <= len(next_cursor) <= 2048
                and not re.search(r"[\x00-\x20\x7f]", next_cursor) and next_cursor not in seen_cursors,
                "Missing, repeated or non-progressing pagination cursor; no selection emitted.")
        seen_cursors.add(next_cursor)
        cursor = next_cursor
        if len(summaries) == MAX_SUMMARIES or pages == config["max_pages"]:
            exhausted, reason = False, "item_limit" if len(summaries) == MAX_SUMMARIES else "page_limit"
            break
    return {"summaries": summaries, "pages": pages, "observed_exhaustion": exhausted,
            "capped": not exhausted, "stopped_reason": reason, "atomic_snapshot": False}


def main():
    require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
    config = configuration()
    deadline = time.monotonic() + 60
    check_recording(config, deadline)
    check_transcription(config, deadline)
    result = list_summaries(config, deadline)
    check_transcription(config, deadline)
    check_recording(config, deadline)
    output = json.dumps(result, ensure_ascii=True, allow_nan=False, indent=2)
    require(len(output.encode("utf-8")) <= MAX_RESPONSE_BYTES, "Selected metadata exceeds the 1 MiB output limit.")
    require(time.monotonic() < deadline, "Summary selection exceeded its elapsed-time budget.")
    print(output)
    return 0 if result["observed_exhaustion"] else 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Summary selection failed or timed out. No response content, cursors or credentials were emitted; no retry was made.",
              file=sys.stderr)
        sys.exit(1)
