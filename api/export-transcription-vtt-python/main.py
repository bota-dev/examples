"""Export supplied transcription segments as private, plain-text WebVTT."""

import http.client
import json
import os
import re
import socket
import stat
import sys
import threading
import time
import unicodedata
import uuid
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR, localcontext
from pathlib import Path
from urllib.parse import urlsplit

MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_OUTPUT_BYTES = 4 * 1024 * 1024
MAX_SECONDS = 168 * 60 * 60


class SafeError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise SafeError(message)


def remaining_time(deadline):
    remaining = deadline - time.monotonic()
    require(remaining > 0, "Export time budget expired; no automatic retry was made.")
    return remaining


def configuration():
    raw = os.environ.get("BOTA_API_BASE_URL", "")
    require(0 < len(raw) <= 2048 and not re.search(r"[\x00-\x20\x7f\\]", raw),
            "Set an explicit HTTPS API origin ending in /v1 without whitespace or backslashes.")
    try:
        base = urlsplit(raw)
        port = base.port
    except ValueError:
        raise SafeError("Set a valid HTTPS API origin ending in /v1.") from None
    require(base.scheme == "https" and base.hostname and base.path in {"/v1", "/v1/"}
            and base.username is None and base.password is None and not base.query and not base.fragment
            and (port is None or 1 <= port <= 65535), "Use an explicit HTTPS API origin ending in /v1.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(),
            "Set a server-held project key with recordings:read and transcriptions:read.")
    config = {"host": base.hostname, "port": port, "key": key}
    for name, prefix in (("BOTA_PROJECT_ID", "proj"), ("BOTA_END_USER_ID", "eu"),
                         ("BOTA_RECORDING_ID", "rec"), ("BOTA_TRANSCRIPTION_ID", "txn")):
        value = os.environ.get(name, "")
        require(re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value),
                f"Set {name} to the exact authorized resource ID.")
        config[name] = value
    output = os.environ.get("OUTPUT_PATH", "")
    require(0 < len(output) <= 2048 and not re.search(r"[\x00-\x1f\x7f]", output)
            and Path(output).suffix.lower() == ".vtt" and ".." not in Path(output).parts,
            "Set OUTPUT_PATH to a new .vtt file in an existing private directory, without parent traversal.")
    config["destination"] = Path(output).absolute()
    return config


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def reject_constant(_value):
    raise ValueError("Non-JSON number")


def decimal_number(value):
    number = Decimal(value)
    if not number.is_finite():
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
    remaining_time(deadline)
    connection = http.client.HTTPSConnection(config["host"], config["port"],
                                             timeout=min(10, remaining_time(deadline)))
    request_deadline = min(deadline, time.monotonic() + 10)
    timer = None
    try:
        connection.connect()
        timeout = remaining_time(request_deadline)
        transport = connection.sock
        transport.settimeout(timeout)

        def stop_transport():
            try:
                transport.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

        timer = threading.Timer(timeout, stop_transport)
        timer.daemon = True
        timer.start()
        connection.request("GET", "/v1" + path, headers={
            "Authorization": "Bearer " + config["key"], "Accept": "application/json",
            "Accept-Encoding": "identity",
        })
        with connection.getresponse() as response:
            require(response.status == 200,
                    f"API read failed (HTTP {response.status}); no redirect or retry was made.")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
                    == "application/json", "The API must return application/json.")
            require(response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Compressed API responses are unsupported.")
            chunks = []
            total = 0
            while True:
                remaining_time(request_deadline)
                chunk = response.read1(min(65536, MAX_RESPONSE_BYTES + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                require(total <= MAX_RESPONSE_BYTES, "API response exceeds the 2 MiB example limit.")
                chunks.append(chunk)
            remaining_time(request_deadline)
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()
    try:
        document = json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                              parse_float=decimal_number, parse_constant=reject_constant)
        check_unicode(document)
        remaining_time(deadline)
        return document
    except (UnicodeError, ValueError, RecursionError):
        raise SafeError("The API returned invalid UTF-8 JSON, duplicate keys or invalid numbers.") from None


def available_identity(document, config):
    return (isinstance(document, dict) and document.get("deleted_at") is None
            and document.get("status") != "deleted"
            and ("project_id" not in document or document["project_id"] == config["BOTA_PROJECT_ID"]))


def verify_recording(config, deadline):
    recording = read_json(config, "/recordings/" + config["BOTA_RECORDING_ID"], deadline)
    require(available_identity(recording, config) and recording.get("id") == config["BOTA_RECORDING_ID"]
            and recording.get("end_user_id") == config["BOTA_END_USER_ID"],
            "Recording identity, project, owner or deletion state does not match.")


def seconds(value):
    require(type(value) in {int, Decimal}, "Segments require numeric timestamps in seconds, excluding booleans.")
    number = Decimal(value)
    require(number.is_finite() and 0 <= number <= MAX_SECONDS,
            "Segment timestamps must be finite and within 0–168 hours.")
    # Extremely precise numbers are rejected rather than silently rounded by Decimal's context.
    require(len(number.as_tuple().digits) <= 30 and -30 <= number.as_tuple().exponent <= 30,
            "Segment timestamp precision exceeds this example's numeric limit.")
    return number


def timestamp(milliseconds):
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, fraction = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d}.{fraction:03d}"


def payload(value):
    require(isinstance(value, str) and 0 < len(value) <= 10_000,
            "Each segment requires nonempty text within the 10,000-character limit.")
    flattened = "".join(" " if char.isspace() or unicodedata.category(char) in {"Cc", "Cf"}
                        else char for char in value)
    plain = " ".join(flattened.split())
    require(bool(plain), "A segment contains no printable subtitle text.")
    # Escaping ampersands first prevents supplied entities becoming WebVTT markup.
    return plain.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_webvtt(transcription, config):
    require(available_identity(transcription, config)
            and transcription.get("id") == config["BOTA_TRANSCRIPTION_ID"]
            and transcription.get("recording_id") == config["BOTA_RECORDING_ID"]
            and transcription.get("status") == "completed",
            "Transcription identity, source, project or completed status does not match.")
    segments = transcription.get("segments")
    require(isinstance(segments, list) and 1 <= len(segments) <= 5000,
            "The completed transcription must supply 1–5000 timed segments.")
    cues = ["WEBVTT\n\n"]
    previous_start = Decimal(-1)
    with localcontext() as context:
        context.prec = 40
        for index, segment in enumerate(segments, 1):
            require(isinstance(segment, dict), "A transcription segment is invalid.")
            start, end = seconds(segment.get("start")), seconds(segment.get("end"))
            require(start >= previous_start and end > start,
                    "Segments must be ordered by nondecreasing start and end strictly after start.")
            previous_start = start
            start_ms = int((start * 1000).to_integral_value(rounding=ROUND_FLOOR))
            end_ms = int((end * 1000).to_integral_value(rounding=ROUND_CEILING))
            cues.append(f"{index}\n{timestamp(start_ms)} --> {timestamp(end_ms)}\n{payload(segment.get('text'))}\n\n")
    content = "".join(cues).encode("utf-8", errors="strict")
    require(len(content) <= MAX_OUTPUT_BYTES, "Exported WebVTT exceeds the 4 MiB example limit.")
    return content, len(segments)


def private_directory(parent):
    for ancestor in (parent, *parent.parents):
        info = ancestor.stat(follow_symlinks=False)
        require(stat.S_ISDIR(info.st_mode), "Output ancestry must contain existing directories without symlinks.")
        if os.name != "nt":
            require(info.st_mode & 0o022 == 0, "Output ancestors must not be writable by other users.")
    directory = parent.stat(follow_symlinks=False)
    if os.name != "nt":
        require(directory.st_uid == os.getuid() and directory.st_mode & 0o077 == 0,
                "Output directory must belong to this user and be private (for example mode 0700).")
    return directory.st_dev, directory.st_ino


def export_transcription(config):
    destination = config["destination"]
    require(not os.path.lexists(destination), "OUTPUT_PATH already exists; no file was overwritten.")
    parent = destination.parent
    identity = private_directory(parent)
    deadline = time.monotonic() + 40
    verify_recording(config, deadline)
    transcription = read_json(config, "/transcriptions/" + config["BOTA_TRANSCRIPTION_ID"], deadline)
    content, count = render_webvtt(transcription, config)
    remaining_time(deadline)
    partial = parent / ("." + destination.name + "." + uuid.uuid4().hex + ".partial")
    created = False
    try:
        descriptor = os.open(partial, os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0), 0o600)
        created = True
        with os.fdopen(descriptor, "wb") as file:
            file.write(content)
            file.flush()
            os.fsync(file.fileno())
        require(private_directory(parent) == identity, "Output directory changed; no publication was attempted.")
        # Read ownership after content is flushed and immediately before local publication.
        verify_recording(config, deadline)
        remaining_time(deadline)
        os.link(partial, destination)
    finally:
        if created:
            try:
                partial.unlink()
            except OSError:
                raise SafeError("Partial-file cleanup failed; inspect the private output directory before retrying.") from None
    print(f"Exported {count} WebVTT cues to OUTPUT_PATH.")


if __name__ == "__main__":
    try:
        require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
        export_transcription(configuration())
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Export failed or its time budget expired. Inspect API access and the private filesystem; "
              "no automatic retry or overwrite was made.", file=sys.stderr)
        sys.exit(1)
