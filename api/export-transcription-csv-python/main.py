"""Export existing timed segments as private CSV with prefixed string cells."""

import csv
import http.client
import io
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
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlsplit

MAX_RESPONSE_BYTES = 8 * 1024 * 1024
MAX_TEXT_BYTES = 4 * 1024 * 1024
MAX_OUTPUT_BYTES = 8 * 1024 * 1024
COLUMNS = ("segment_index", "start_seconds", "end_seconds", "text", "speaker")


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
            "Set a trusted explicit HTTPS API origin ending in /v1.")
    try:
        base = urlsplit(raw)
        port = base.port
    except ValueError:
        raise SafeError("Invalid HTTPS API origin.") from None
    require(base.scheme == "https" and base.hostname and base.path in {"/v1", "/v1/"}
            and base.username is None and base.password is None and not base.query and not base.fragment
            and (port is None or 1 <= port <= 65535), "Use HTTPS and /v1 without URL credentials/query/fragment.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(),
            "Set a server-held project key with recordings:read and transcriptions:read.")
    config = {"host": base.hostname, "port": port, "key": key}
    for name, prefix in (("BOTA_PROJECT_ID", "proj"), ("BOTA_END_USER_ID", "eu"),
                         ("BOTA_RECORDING_ID", "rec"), ("BOTA_TRANSCRIPTION_ID", "txn")):
        value = os.environ.get(name, "")
        require(re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value)
                and "replace_me" not in value.lower(), f"Set the exact authorized {name}.")
        config[name] = value
    output = os.environ.get("OUTPUT_PATH", "")
    require(0 < len(output) <= 2048 and not re.search(r"[\x00-\x1f\x7f]", output)
            and Path(output).suffix.lower() == ".csv" and ".." not in Path(output).parts,
            "Set OUTPUT_PATH to a new .csv file in an existing private directory without parent traversal.")
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
    request_deadline = min(deadline, time.monotonic() + 10)
    connection = http.client.HTTPSConnection(config["host"], config["port"],
                                             timeout=remaining_time(request_deadline))
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
            require(response.status == 200, "API GET failed; no redirect or retry was made.")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower() == "application/json",
                    "The API must return application/json.")
            require(response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Compressed API responses are unsupported.")
            chunks, total = [], 0
            while True:
                remaining_time(request_deadline)
                chunk = response.read1(min(65536, MAX_RESPONSE_BYTES + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                require(total <= MAX_RESPONSE_BYTES, "API response exceeds the 8 MiB example limit.")
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
        raise SafeError("API returned invalid UTF-8 JSON, duplicate keys or invalid numbers.") from None


def available_identity(row, config):
    return (isinstance(row, dict) and row.get("deleted_at") is None and row.get("status") != "deleted"
            and ("project_id" not in row or row["project_id"] == config["BOTA_PROJECT_ID"]))


def verify_recording(config, deadline):
    row = read_json(config, "/recordings/" + config["BOTA_RECORDING_ID"], deadline)
    require(available_identity(row, config) and row.get("id") == config["BOTA_RECORDING_ID"]
            and row.get("end_user_id") == config["BOTA_END_USER_ID"],
            "Recording identity, current owner, project or deletion state does not match.")


def seconds(value):
    require(type(value) in {int, Decimal}, "Segments require numeric seconds, excluding booleans.")
    number = Decimal(value)
    require(number.is_finite() and number >= 0, "Segment timestamps must be finite and nonnegative.")
    require(len(number.as_tuple().digits) <= 30 and -30 <= number.as_tuple().exponent <= 30,
            "Segment timestamps exceed this example's precision/formatting limit.")
    return number


def string_cell(value):
    require(isinstance(value, str), "Segment text and available speaker must be strings.")
    require(all(unicodedata.category(char) not in {"Cc", "Cf"} or char in "\t\r\n" for char in value),
            "Segment strings contain unsupported control or format characters.")
    # Every nonempty string receives a prefix before CSV quoting, even leading whitespace.
    return "'" + value if value else ""


def render_csv(transcription, config, deadline):
    require(available_identity(transcription, config)
            and transcription.get("id") == config["BOTA_TRANSCRIPTION_ID"]
            and transcription.get("recording_id") == config["BOTA_RECORDING_ID"]
            and transcription.get("status") == "completed",
            "Transcription identity, completed status, project or source does not match.")
    segments = transcription.get("segments")
    require(isinstance(segments, list) and len(segments) <= 20000,
            "The completed transcription must supply at most 20,000 segments, not null.")
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(COLUMNS)
    previous_start, text_bytes = Decimal(-1), 0
    for index, segment in enumerate(segments, 1):
        remaining_time(deadline)
        require(isinstance(segment, dict), "Invalid transcription segment.")
        start, end = seconds(segment.get("start")), seconds(segment.get("end"))
        require(start >= previous_start and end > start,
                "Segments require nondecreasing starts and end strictly after start.")
        previous_start = start
        text = segment.get("text")
        speaker = segment.get("speaker")
        if speaker is None:
            speaker = ""
        safe_text, safe_speaker = string_cell(text), string_cell(speaker)
        text_bytes += len(text.encode("utf-8")) + len(speaker.encode("utf-8"))
        require(text_bytes <= MAX_TEXT_BYTES, "Supplied text and speaker bytes exceed the 4 MiB limit.")
        writer.writerow((index, format(start, "f"), format(end, "f"), safe_text, safe_speaker))
    content = buffer.getvalue().encode("utf-8")
    require(len(content) <= MAX_OUTPUT_BYTES, "Exported CSV exceeds the 8 MiB limit.")
    remaining_time(deadline)
    return content, len(segments)


def private_directory(parent):
    for ancestor in (parent, *parent.parents):
        info = ancestor.stat(follow_symlinks=False)
        require(stat.S_ISDIR(info.st_mode), "Output ancestry must be existing directories without symlinks.")
        if os.name != "nt":
            require(info.st_mode & 0o022 == 0, "Output ancestors must not be writable by other users.")
    directory = parent.stat(follow_symlinks=False)
    if os.name != "nt":
        require(directory.st_uid == os.getuid() and directory.st_mode & 0o077 == 0,
                "Output directory must belong to this user and be private (for example mode 0700).")
    return directory.st_dev, directory.st_ino


def export_transcription(config):
    destination = config["destination"]
    require(not os.path.lexists(destination), "OUTPUT_PATH exists; no file was overwritten.")
    parent = destination.parent
    identity = private_directory(parent)
    deadline = time.monotonic() + 60
    verify_recording(config, deadline)
    transcription = read_json(config, "/transcriptions/" + config["BOTA_TRANSCRIPTION_ID"], deadline)
    content, count = render_csv(transcription, config, deadline)
    partial = parent / ("." + destination.name + "." + uuid.uuid4().hex + ".partial")
    created = False
    try:
        descriptor = os.open(partial, os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0), 0o600)
        created = True
        with os.fdopen(descriptor, "wb") as file:
            require(file.write(content) == len(content), "Could not write the complete CSV.")
            file.flush()
            os.fsync(file.fileno())
        require(private_directory(parent) == identity, "Output directory changed; no publication attempted.")
        verify_recording(config, deadline)
        remaining_time(deadline)
        os.link(partial, destination)
    finally:
        if created:
            try:
                partial.unlink()
            except OSError:
                raise SafeError("Partial cleanup failed; inspect private output before retrying. A completed CSV may exist.") from None
    print(json.dumps({"segment_count": count, "string_cells_prefixed": True,
                      "timing_inferred": False, "atomic_snapshot": False,
                      "spreadsheet_consumer_safety_verified": False}, indent=2))


if __name__ == "__main__":
    try:
        require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
        require(len(sys.argv) == 1, "Configure environment variables; no CLI arguments are accepted.")
        export_transcription(configuration())
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("CSV export failed or its budget expired. Inspect API access and private storage; "
              "no overwrite or automatic retry was made.", file=sys.stderr)
        sys.exit(1)
