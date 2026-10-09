"""Search a fixed end user's indexed transcripts, then verify result ownership."""

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
MAX_OFFSET = 2**53 - 1


class ExampleError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ExampleError(message)


def identifier(value, prefix):
    return isinstance(value, str) and bool(re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value))


def configuration():
    raw_base = os.environ.get("BOTA_API_BASE_URL", "")
    require(not re.search(r"[\x00-\x20\x7f]", raw_base), "Invalid API URL.")
    try:
        base = urlsplit(raw_base)
        port = base.port
    except ValueError:
        raise ExampleError("Invalid API URL.") from None
    require(base.hostname and base.username is None and base.password is None and
            (port is None or 1 <= port <= 65535) and
            not base.query and not base.fragment and base.path in ("/v1", "/v1/") and
            (base.scheme == "https" or (base.scheme == "http" and
             base.hostname in ("localhost", "127.0.0.1", "::1"))),
            "Use an explicit HTTPS API origin ending in /v1; HTTP is loopback-only.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and bool(re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)) and
            "replace_me" not in key.lower(), "Configure a server-held key with recordings:read.")
    owner = os.environ.get("BOTA_END_USER_ID", "")
    require(identifier(owner, "eu") and "replace_me" not in owner.lower(),
            "Configure the fixed authorized end-user ID.")
    query = os.environ.get("BOTA_QUERY", "").strip()
    # Match the public API's JavaScript string-length bound for astral characters.
    require(1 <= len(query.encode("utf-16-le")) // 2 <= 1000,
            "BOTA_QUERY must contain 1–1000 UTF-16 code units after trimming.")
    limit = os.environ.get("BOTA_LIMIT", "8")
    require(bool(re.fullmatch(r"[1-9][0-9]?", limit)) and int(limit) <= 50,
            "BOTA_LIMIT must be an integer from 1 to 50.")
    allowlist = os.environ.get("BOTA_RECORDING_IDS", "").strip()
    recording_ids = [value.strip() for value in allowlist.split(",")] if allowlist else None
    if recording_ids is not None:
        require(1 <= len(recording_ids) <= 500 and len(set(recording_ids)) == len(recording_ids) and
                all(identifier(value, "rec") and "replace_me" not in value.lower()
                    for value in recording_ids),
                "Use 1–500 distinct authorized recording IDs or leave the allowlist blank.")
    return {"scheme": base.scheme, "host": base.hostname, "port": port,
            "key": key, "owner": owner, "query": query,
            "limit": int(limit), "recording_ids": recording_ids}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def invalid_constant(_value):
    raise ValueError("Non-JSON number")


def request(config, deadline, method, path, payload=None):
    remaining = deadline - time.monotonic()
    require(remaining > 0, "Search deadline expired; no automatic retry was made.")
    connection_type = http.client.HTTPSConnection if config["scheme"] == "https" else http.client.HTTPConnection
    connection = connection_type(config["host"], config["port"], timeout=remaining)
    timer = None
    try:
        connection.connect()
        remaining = deadline - time.monotonic()
        require(remaining > 0, "Search deadline expired; no automatic retry was made.")
        transport = connection.sock
        transport.settimeout(remaining)

        def expire():
            # Absolute read/header deadline, including servers that trickle bytes.
            try:
                transport.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

        timer = threading.Timer(remaining, expire)
        timer.daemon = True
        timer.start()
        headers = {"Authorization": "Bearer " + config["key"], "Accept": "application/json"}
        body = None
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=True, allow_nan=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        connection.request(method, "/v1" + path, body=body, headers=headers)
        with connection.getresponse() as response:
            require(response.status == 200,
                    f"API request returned HTTP {response.status}; no automatic retry was made.")
            content_type = response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
            require(content_type == "application/json", "Expected a JSON API response.")
            require(response.getheader("Content-Encoding", "identity").lower() == "identity",
                    "Encoded API responses are unsupported.")
            chunks, size = [], 0
            while True:
                require(time.monotonic() < deadline, "Search deadline expired; no automatic retry was made.")
                chunk = response.read1(min(65536, MAX_RESPONSE_BYTES + 1 - size))
                if not chunk:
                    break
                size += len(chunk)
                require(size <= MAX_RESPONSE_BYTES, "API response exceeds this example's 1 MiB limit.")
                chunks.append(chunk)
            require(time.monotonic() < deadline, "Search deadline expired; no automatic retry was made.")
            try:
                return json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                                  parse_constant=invalid_constant)
            except (ValueError, UnicodeError, RecursionError):
                raise ExampleError("Invalid JSON API response.") from None
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()


def validate_results(document, config):
    require(isinstance(document, dict) and isinstance(document.get("results"), list) and
            len(document["results"]) <= config["limit"], "Invalid search result envelope or count.")
    results = []
    for row in document["results"]:
        require(isinstance(row, dict), "Invalid search result.")
        require(identifier(row.get("chunk_id"), "chk") and identifier(row.get("recording_id"), "rec") and
                identifier(row.get("transcription_id"), "txn"), "Invalid search result identifiers.")
        if config["recording_ids"] is not None:
            require(row["recording_id"] in config["recording_ids"], "Search result escaped the recording allowlist.")
        text = row.get("chunk_text")
        require(isinstance(text, str) and 1 <= len(text) <= 32768, "Invalid or oversized excerpt text.")
        speaker = row.get("speaker")
        require("speaker" in row and (speaker is None or (isinstance(speaker, str) and len(speaker) <= 128)),
                "Invalid speaker label.")
        start, end = row.get("start_ms"), row.get("end_ms")
        require(type(start) is int and type(end) is int and 0 <= start <= end <= MAX_OFFSET,
                "Invalid audio offsets.")
        recorded_at = row.get("recorded_at")
        require("recorded_at" in row, "Missing recording date.")
        if recorded_at is not None:
            require(isinstance(recorded_at, str) and len(recorded_at) <= 64, "Invalid recording date.")
            try:
                date = dt.datetime.fromisoformat(recorded_at)
            except ValueError:
                raise ExampleError("Invalid recording date.") from None
            require(date.tzinfo is not None, "Recording date needs a timezone.")
        score = row.get("score")
        try:
            valid_score = type(score) in (int, float) and math.isfinite(score)
        except OverflowError:
            valid_score = False
        require(valid_score, "Invalid relevance score.")
        results.append({"chunk_id": row["chunk_id"], "recording_id": row["recording_id"],
                        "transcription_id": row["transcription_id"], "chunk_text": text,
                        "speaker": speaker, "start_ms": start, "end_ms": end,
                        "recorded_at": recorded_at, "score": score})
    return results


def main():
    config = configuration()
    deadline = time.monotonic() + 30
    payload = {"query": config["query"], "end_user_id": config["owner"], "limit": config["limit"]}
    if config["recording_ids"] is not None:
        payload["recording_ids"] = config["recording_ids"]
    results = validate_results(request(config, deadline, "POST", "/recordings/search", payload), config)
    # Finish every validation/ownership read before emitting any transcript text.
    for recording_id in dict.fromkeys(row["recording_id"] for row in results):
        recording = request(config, deadline, "GET", "/recordings/" + recording_id)
        require(isinstance(recording, dict) and recording.get("id") == recording_id and
                recording.get("end_user_id") == config["owner"] and not recording.get("deleted_at"),
                "Recording identity or configured end-user ownership mismatch.")
    require(time.monotonic() < deadline, "Search deadline expired; no excerpts were emitted.")
    print(json.dumps({"results": results}, ensure_ascii=True, allow_nan=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except ExampleError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (OSError, http.client.HTTPException, ValueError, OverflowError):
        print("Search failed; no response details, query or credentials were printed. No automatic retry was made.",
              file=sys.stderr)
        sys.exit(1)
