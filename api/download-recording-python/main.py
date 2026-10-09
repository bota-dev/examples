"""Download opaque original recording bytes, with no API or device writes."""

import hashlib
import hmac
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
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlsplit

MAX_BYTES = 25 * 1024 * 1024
MAX_JSON_BYTES = 256 * 1024
HOST = r"(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"


class SafeError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise SafeError(message)


def remaining_time(deadline):
    remaining = deadline - time.monotonic()
    require(remaining > 0, "Download time budget expired; no automatic retry was made.")
    return remaining


def https_url(value):
    require(isinstance(value, str) and 0 < len(value) <= 8192
            and not re.search(r"[^\x21-\x7e]|\\", value), "Invalid HTTPS URL.")
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        raise SafeError("Invalid HTTPS URL.") from None
    require(parsed.scheme == "https" and parsed.hostname
            and re.fullmatch(HOST, parsed.hostname) and parsed.username is None
            and parsed.password is None and not parsed.fragment
            and (port is None or 1 <= port <= 65535), "Invalid HTTPS URL origin.")
    return parsed


def configuration():
    base = https_url(os.environ.get("BOTA_API_BASE_URL", ""))
    require(base.path in {"/v1", "/v1/"} and not base.query,
            "Set a trusted HTTPS API origin ending in /v1 without a query.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(), "Set a server-held project key with recordings:read.")
    project = os.environ.get("BOTA_PROJECT_ID", "")
    require(re.fullmatch(r"proj_[A-Za-z0-9]{1,64}", project) and "replace_me" not in project.lower(),
            "Set the exact expected BOTA_PROJECT_ID.")
    ids = {}
    for name, prefix in (("BOTA_END_USER_ID", "eu"), ("BOTA_RECORDING_ID", "rec")):
        value = os.environ.get(name, "")
        require(re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value)
                and "replace_me" not in value.lower(), "Set the fixed authorized end user and recording IDs.")
        ids[name] = value
    hosts = os.environ.get("BOTA_STORAGE_HOST_ALLOWLIST", "")
    require(0 < len(hosts) <= 4096, "Configure storage hosts independently from a trusted operator source.")
    allowlist = [host.strip().lower() for host in hosts.split(",")]
    require(1 <= len(allowlist) <= 16 and all(re.fullmatch(HOST, host) for host in allowlist),
            "Storage allowlist must contain exact DNS hostnames, without schemes, ports or wildcards.")
    expected_hash = os.environ.get("EXPECTED_SHA256", "")
    require(not expected_hash or re.fullmatch(r"[A-Fa-f0-9]{64}", expected_hash),
            "EXPECTED_SHA256 must be a trusted original-byte SHA-256 or blank.")
    output = os.environ.get("OUTPUT_PATH", "")
    require(0 < len(output) <= 2048 and not re.search(r"[\x00-\x1f\x7f]", output),
            "Set OUTPUT_PATH to a new file in an existing private directory.")
    return {"host": base.hostname, "port": base.port, "key": key, "project": project,
            "storage_hosts": set(allowlist), "expected_hash": expected_hash.lower(),
            "output": Path(output).absolute(), **ids}


def byte_count(value):
    # PostgreSQL bigint fields may serialize as canonical decimal strings.
    if isinstance(value, str) and re.fullmatch(r"0|[1-9][0-9]{0,15}", value):
        value = int(value)
    require(type(value) is int and 0 <= value <= MAX_BYTES,
            "Invalid byte count or download exceeds this example's 25 MiB limit.")
    return value


def header(response, name):
    values = response.headers.get_all(name, [])
    require(len(values) <= 1, "Duplicate response headers are unsupported.")
    return values[0].strip() if values else None


@contextmanager
def response_for(host, port, path, headers, deadline):
    connection = http.client.HTTPSConnection(host, port, timeout=min(10, remaining_time(deadline)))
    timer = None
    try:
        connection.connect()
        remaining = remaining_time(deadline)
        transport = connection.sock
        transport.settimeout(min(10, remaining))

        def stop_transport():
            try:
                transport.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

        timer = threading.Timer(remaining, stop_transport)
        timer.daemon = True
        timer.start()
        connection.request("GET", path, headers=headers)
        with connection.getresponse() as response:
            require(response.status == 200, "GET failed; redirects and automatic retries are disabled.")
            require(header(response, "Content-Encoding") in {None, "identity"},
                    "Encoded HTTP bodies are unsupported; original bytes are required.")
            require(header(response, "Content-Range") is None, "Partial HTTP responses are unsupported.")
            transfer = header(response, "Transfer-Encoding")
            require(transfer in {None, "chunked"}
                    and not (transfer and header(response, "Content-Length") is not None),
                    "Ambiguous HTTP response framing is unsupported.")
            yield response
            remaining_time(deadline)
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()


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


def read_json(config, path, deadline):
    request_deadline = min(deadline, time.monotonic() + 10)
    with response_for(config["host"], config["port"], "/v1" + path, {
        "Authorization": "Bearer " + config["key"], "Accept": "application/json", "Accept-Encoding": "identity",
    }, request_deadline) as response:
        require((header(response, "Content-Type") or "").split(";", 1)[0].lower() == "application/json",
                "API response must be application/json.")
        declared = header(response, "Content-Length")
        length = None if declared is None else byte_count(declared)
        require(length is None or length <= MAX_JSON_BYTES, "API metadata exceeds the 256 KiB limit.")
        chunks = []
        total = 0
        while True:
            remaining_time(request_deadline)
            chunk = response.read1(min(65536, MAX_JSON_BYTES + 1 - total))
            if not chunk:
                break
            total += len(chunk)
            require(total <= MAX_JSON_BYTES, "API metadata exceeds the 256 KiB limit.")
            chunks.append(chunk)
        require(length is None or total == length, "Incomplete API metadata response.")
    try:
        result = json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                            parse_constant=reject_constant, parse_float=finite_float)
        # Reject escaped unpaired surrogates as well as invalid input UTF-8.
        json.dumps(result, ensure_ascii=False, allow_nan=False).encode("utf-8")
        return result
    except (UnicodeError, ValueError, RecursionError):
        raise SafeError("API returned invalid strict UTF-8 JSON.") from None


def verify_recording(config, deadline):
    recording = read_json(config, "/recordings/" + config["BOTA_RECORDING_ID"], deadline)
    require(isinstance(recording, dict) and recording.get("id") == config["BOTA_RECORDING_ID"]
            and recording.get("end_user_id") == config["BOTA_END_USER_ID"]
            and recording.get("deleted_at") is None
            and ("project_id" not in recording or recording["project_id"] == config["project"]),
            "Recording identity, project, owner or deletion state does not match.")
    require(recording.get("status") in {"uploaded", "processing", "completed"},
            "Recording must have status uploaded, processing or completed.")
    size = recording.get("file_size_bytes")
    return None if size is None else byte_count(size)


def download(config):
    destination = config["output"]
    require(not os.path.lexists(destination), "OUTPUT_PATH already exists; no overwrite was made.")
    parent = destination.parent
    directory = parent.stat(follow_symlinks=False)
    require(stat.S_ISDIR(directory.st_mode), "Output parent must be an existing regular directory, without a symlink.")
    if os.name != "nt":
        require(directory.st_mode & 0o077 == 0, "Output parent must be private (for example mode 0700).")
    deadline = time.monotonic() + 120
    recording_size = verify_recording(config, deadline)
    descriptor = read_json(config, "/recordings/" + config["BOTA_RECORDING_ID"] + "/download-url", deadline)
    require(isinstance(descriptor, dict)
            and {"download_url", "expires_in", "content_type", "file_size_bytes"} <= descriptor.keys()
            and type(descriptor.get("expires_in")) is int
            and 0 < descriptor["expires_in"] <= 86400, "Invalid download URL lifetime metadata.")
    content_type = descriptor.get("content_type")
    require(content_type is None or (isinstance(content_type, str) and len(content_type) <= 256
            and not re.search(r"[\x00-\x1f\x7f]", content_type)), "Invalid download content-type metadata.")
    size = descriptor.get("file_size_bytes")
    expected_size = None if size is None else byte_count(size)
    require(recording_size is None or expected_size is None or recording_size == expected_size,
            "Recording and download descriptor sizes differ.")
    target = https_url(descriptor.get("download_url"))
    require(target.hostname in config["storage_hosts"] and target.port in {None, 443},
            "Storage URL is outside the independently trusted HTTPS host allowlist or port 443.")
    path = target.path or "/"
    if target.query:
        path += "?" + target.query
    partial = parent / ("." + destination.name + "." + uuid.uuid4().hex + ".partial")
    created = False
    try:
        flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0)
        file_descriptor = os.open(partial, flags, 0o600)
        created = True
        with os.fdopen(file_descriptor, "wb") as file:
            require(stat.S_ISREG(os.fstat(file.fileno()).st_mode), "Partial output must be a regular file.")
            # A fresh connection and fixed headers keep API credentials and cookies off storage.
            with response_for(target.hostname, target.port, path, {"Accept-Encoding": "identity"}, deadline) as response:
                declared = header(response, "Content-Length")
                declared_size = None if declared is None else byte_count(declared)
                hash_state = hashlib.sha256()
                total = 0
                while True:
                    remaining_time(deadline)
                    chunk = response.read1(min(65536, MAX_BYTES + 1 - total))
                    if not chunk:
                        break
                    total += len(chunk)
                    require(total <= MAX_BYTES, "Download exceeds this example's 25 MiB limit.")
                    require(all(bound is None or total <= bound for bound in (recording_size, expected_size, declared_size)),
                            "Downloaded size exceeds supplied metadata.")
                    hash_state.update(chunk)
                    require(file.write(chunk) == len(chunk), "Could not write complete downloaded bytes.")
                require(total > 0 and all(bound is None or total == bound
                        for bound in (recording_size, expected_size, declared_size)), "Downloaded bytes are empty or incomplete.")
                require(not config["expected_hash"] or hmac.compare_digest(hash_state.hexdigest(), config["expected_hash"]),
                        "Downloaded bytes do not match the trusted EXPECTED_SHA256.")
            file.flush()
            os.fsync(file.fileno())
        verify_recording(config, deadline)
        remaining_time(deadline)
        # Same-directory hard linking publishes complete bytes and refuses every existing path.
        os.link(partial, destination)
    finally:
        if created:
            try:
                partial.unlink()
            except OSError:
                raise SafeError("Partial cleanup failed; inspect the private directory before retrying. A completed output may exist.") from None
    print("Downloaded original stored bytes to OUTPUT_PATH.")


if __name__ == "__main__":
    try:
        require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
        require(len(sys.argv) == 1, "Configure process environment variables; no CLI arguments are accepted.")
        download(configuration())
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Download failed. Check API authorization, trusted hosts and the private filesystem; "
              "no overwrite or automatic retry was made.", file=sys.stderr)
        sys.exit(1)
