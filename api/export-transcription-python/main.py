"""Export existing completed full_text as UTF-8 plain text, without cloud writes."""

import http.client
import json
import math
import os
import re
import socket
import stat
import sys
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlsplit

MAX_RESPONSE_BYTES = 1024 * 1024
MAX_OUTPUT_BYTES = 1024 * 1024


class SafeError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise SafeError(message)


def remaining_time(deadline):
    remaining = deadline - time.monotonic()
    require(remaining > 0, "Export elapsed-time budget expired; no automatic retry was made.")
    return remaining


def configuration():
    raw_base = os.environ.get("BOTA_API_BASE_URL", "")
    try:
        base = urlsplit(raw_base)
        port = base.port
    except ValueError:
        raise SafeError("Set a valid explicit BOTA_API_BASE_URL ending in /v1.") from None
    require(base.hostname and base.path in {"/v1", "/v1/"} and not base.query and not base.fragment
            and base.username is None and base.password is None and (port is None or 1 <= port <= 65535)
            and not re.search(r"[\x00-\x20\x7f]", raw_base)
            and (base.scheme == "https" or (base.scheme == "http" and
                 base.hostname in {"localhost", "127.0.0.1", "::1"})),
            "Use an explicit HTTPS API origin ending in /v1; HTTP is loopback-only.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(),
            "Set a server-held key with recordings:read and transcriptions:read.")
    ids = {}
    for name, prefix in (("BOTA_END_USER_ID", "eu"), ("BOTA_RECORDING_ID", "rec"),
                         ("BOTA_TRANSCRIPTION_ID", "txn")):
        value = os.environ.get(name, "")
        require(re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value) and "replace_me" not in value.lower(),
                f"Set {name} to the expected authorized resource ID.")
        ids[name] = value
    project = os.environ.get("BOTA_PROJECT_ID", "")
    require(re.fullmatch(r"[A-Za-z0-9_-]{3,128}", project) and "replace_me" not in project.lower(),
            "Set BOTA_PROJECT_ID to the exact expected project.")
    output = os.environ.get("OUTPUT_PATH", "")
    require(0 < len(output) <= 2048 and not re.search(r"[\x00-\x1f\x7f]", output)
            and Path(output).suffix.lower() == ".txt",
            "Set OUTPUT_PATH to a new .txt file in an existing private directory.")
    return {"scheme": base.scheme, "host": base.hostname, "port": port, "key": key,
            "project": project, "output_path": Path(output).absolute(), **ids}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def reject_constant(_value):
    raise ValueError("Non-JSON number")


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
    remaining = remaining_time(deadline)
    connection_class = http.client.HTTPSConnection if config["scheme"] == "https" else http.client.HTTPConnection
    connection = connection_class(config["host"], config["port"], timeout=min(10, remaining))
    timer = None
    try:
        connection.connect()
        remaining = remaining_time(deadline)
        transport = connection.sock
        transport.settimeout(remaining)

        def stop_transport():
            try:
                transport.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

        timer = threading.Timer(remaining, stop_transport)
        timer.daemon = True
        timer.start()
        connection.request("GET", "/v1" + path, headers={
            "Authorization": "Bearer " + config["key"], "Accept": "application/json", "Accept-Encoding": "identity",
        })
        with connection.getresponse() as response:
            require(response.status == 200,
                    f"API read failed (HTTP {response.status}); no redirect or automatic retry was made.")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower() == "application/json",
                    "The API must return application/json.")
            require(response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Encoded API responses are unsupported.")
            chunks = []
            total = 0
            while True:
                remaining_time(deadline)
                chunk = response.read1(min(65536, MAX_RESPONSE_BYTES + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                require(total <= MAX_RESPONSE_BYTES, "API response exceeds this example's 1 MiB limit.")
                chunks.append(chunk)
            remaining_time(deadline)
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()
    try:
        document = json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                              parse_constant=reject_constant, parse_float=finite_float)
        check_unicode(document)
        return document
    except (UnicodeError, ValueError, RecursionError):
        raise SafeError("The API returned invalid UTF-8 JSON, duplicate keys, nonfinite numbers or unpaired surrogates.") from None


def verify_recording(config, deadline):
    recording = read_json(config, "/recordings/" + config["BOTA_RECORDING_ID"], deadline)
    require(isinstance(recording, dict) and recording.get("id") == config["BOTA_RECORDING_ID"]
            and recording.get("end_user_id") == config["BOTA_END_USER_ID"]
            and recording.get("deleted_at") is None and recording.get("status") != "deleted"
            and ("project_id" not in recording or recording["project_id"] == config["project"]),
            "Recording identity, configured owner/project or deletion state does not match.")


def export_transcription(config):
    destination = config["output_path"]
    require(not os.path.lexists(destination), "OUTPUT_PATH already exists; no file was overwritten.")
    parent = destination.parent
    directory = parent.stat(follow_symlinks=False)
    require(stat.S_ISDIR(directory.st_mode), "Output directory must already exist and must not be a symlink.")
    if os.name != "nt":
        require(directory.st_mode & 0o077 == 0, "Output directory must be private to its owner (for example mode 0700).")
    deadline = time.monotonic() + 30
    verify_recording(config, deadline)
    transcription = read_json(config, "/transcriptions/" + config["BOTA_TRANSCRIPTION_ID"], deadline)
    require(isinstance(transcription, dict) and transcription.get("id") == config["BOTA_TRANSCRIPTION_ID"]
            and transcription.get("recording_id") == config["BOTA_RECORDING_ID"]
            and transcription.get("status") == "completed"
            and ("project_id" not in transcription or transcription["project_id"] == config["project"]),
            "Transcription identity, project, source or completed status does not match.")
    require(isinstance(transcription.get("full_text"), str),
            "Completed transcription must contain string-valued full_text; missing or null text cannot be exported.")
    content = transcription["full_text"].encode("utf-8", errors="strict")
    require(len(content) <= MAX_OUTPUT_BYTES, "Exported transcript exceeds this example's 1 MiB limit.")
    verify_recording(config, deadline)
    remaining_time(deadline)
    partial = parent / ("." + destination.name + "." + uuid.uuid4().hex + ".partial")
    created = False
    try:
        flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0)
        descriptor = os.open(partial, flags, 0o600)
        created = True
        with os.fdopen(descriptor, "wb") as file:
            file.write(content)
            file.flush()
            os.fsync(file.fileno())
        remaining_time(deadline)
        # Same-directory link publishes complete bytes, refusing an existing file or symlink.
        os.link(partial, destination)
    finally:
        if created:
            try:
                partial.unlink()
            except OSError:
                raise SafeError("Could not remove this invocation's partial file; inspect the private output directory.") from None
    print("Exported completed transcription text to OUTPUT_PATH.")


if __name__ == "__main__":
    try:
        require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
        export_transcription(configuration())
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Export failed or its time budget expired. Check API access and the local filesystem; "
              "no cloud write, overwrite or automatic retry was made.", file=sys.stderr)
        sys.exit(1)
