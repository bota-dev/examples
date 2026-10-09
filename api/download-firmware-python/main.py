"""Download one declared BIN artifact for private inspection, never installation."""

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
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlsplit

MAX_IMAGE_BYTES = 64 * 1024 * 1024
MAX_JSON_BYTES = 1024 * 1024
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
            and not re.search(r"[^\x21-\x7e]|\\", value), "Invalid trusted HTTPS URL.")
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        raise SafeError("Invalid HTTPS URL.") from None
    require(parsed.scheme == "https" and parsed.hostname
            and re.fullmatch(HOST, parsed.hostname) and parsed.username is None
            and parsed.password is None and not parsed.fragment and port in {None, 443},
            "Use HTTPS port 443 without credentials or fragments.")
    return parsed


def configuration():
    base = https_url(os.environ.get("BOTA_API_BASE_URL", ""))
    require(base.path in {"/v1", "/v1/"} and not base.query,
            "Set a trusted HTTPS API origin ending in /v1 without a query.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(), "Set a server-held project key with devices:read.")
    ids = {}
    for name, prefix in (("PROJECT", "proj"), ("END_USER", "eu"), ("DEVICE", "dev"),
                         ("FIRMWARE_RELEASE", "fw")):
        value = os.environ.get("BOTA_" + name + "_ID", "")
        require(re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value)
                and "replace_me" not in value.lower(), "Set exact authorized project, owner, device and release IDs.")
        ids[name] = value
    hosts = os.environ.get("BOTA_STORAGE_HOST_ALLOWLIST", "")
    require(0 < len(hosts) <= 4096, "Set storage hosts independently from a trusted operator source.")
    allowlist = [host.strip().lower() for host in hosts.split(",")]
    require(1 <= len(allowlist) <= 16 and all(re.fullmatch(HOST, host) for host in allowlist),
            "Storage allowlist requires exact DNS hostnames, without schemes, ports or wildcards.")
    output = os.environ.get("OUTPUT_PATH", "")
    require(0 < len(output) <= 2048 and not re.search(r"[\x00-\x1f\x7f]", output),
            "Set OUTPUT_PATH to a new .bin file in an existing private directory.")
    destination = Path(output)
    require(".." not in destination.parts and destination.suffix.lower() == ".bin",
            "OUTPUT_PATH must end in .bin and contain no parent traversal.")
    return {"host": base.hostname, "key": key, "storage_hosts": set(allowlist),
            "destination": destination.absolute(), **ids}


def byte_count(value, maximum):
    # bigint serialization may use canonical decimal strings.
    if isinstance(value, str) and re.fullmatch(r"0|[1-9][0-9]{0,15}", value):
        value = int(value)
    require(type(value) is int and 0 < value <= maximum, "Invalid or oversized positive byte count.")
    return value


def header(response, name):
    values = response.headers.get_all(name, [])
    require(len(values) <= 1, "Duplicate response headers are unsupported.")
    return values[0].strip() if values else None


@contextmanager
def response_for(host, path, headers, deadline):
    connection = http.client.HTTPSConnection(host, 443, timeout=min(15, remaining_time(deadline)))
    timer = None
    try:
        connection.connect()
        remaining = remaining_time(deadline)
        transport = connection.sock
        transport.settimeout(min(15, remaining))

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
                    "Compressed bodies are unsupported; original bytes are required.")
            require(header(response, "Content-Range") is None, "Partial responses are unsupported.")
            transfer = header(response, "Transfer-Encoding")
            require(transfer in {None, "chunked"}
                    and not (transfer and header(response, "Content-Length") is not None),
                    "Ambiguous HTTP framing is unsupported.")
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
    request_deadline = min(deadline, time.monotonic() + 15)
    with response_for(config["host"], "/v1" + path, {
        "Authorization": "Bearer " + config["key"], "Accept": "application/json", "Accept-Encoding": "identity",
    }, request_deadline) as response:
        require((header(response, "Content-Type") or "").split(";", 1)[0].strip().lower() == "application/json",
                "API response must be application/json.")
        declared = header(response, "Content-Length")
        length = None if declared is None else byte_count(declared, MAX_JSON_BYTES)
        chunks = []
        total = 0
        while True:
            remaining_time(request_deadline)
            chunk = response.read1(min(65536, MAX_JSON_BYTES + 1 - total))
            if not chunk:
                break
            total += len(chunk)
            require(total <= MAX_JSON_BYTES, "API response exceeds the 1 MiB limit.")
            chunks.append(chunk)
        require(length is None or total == length, "Incomplete API metadata response.")
    try:
        result = json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                            parse_constant=reject_constant, parse_float=finite_float)
        json.dumps(result, ensure_ascii=False, allow_nan=False).encode("utf-8")
        remaining_time(deadline)
        return result
    except (UnicodeError, ValueError, RecursionError):
        raise SafeError("API returned invalid strict UTF-8 JSON.") from None


def available_identity(row, config):
    return (isinstance(row, dict) and row.get("deleted_at") is None and row.get("status") != "deleted"
            and ("project_id" not in row or row["project_id"] == config["PROJECT"]))


def verify_device(config, deadline):
    device = read_json(config, "/devices/" + config["DEVICE"], deadline)
    require(available_identity(device, config) and device.get("id") == config["DEVICE"]
            and device.get("end_user_id") == config["END_USER"] and device.get("status") == "bound",
            "Device identity, current owner, project or bound state does not match.")
    if "binding_generation" not in device:
        return None
    generation = device["binding_generation"]
    require(type(generation) is int and 0 <= generation <= 9007199254740991,
            "Invalid available device binding generation.")
    return generation


def release_metadata(row, config):
    require(available_identity(row, config) and row.get("id") == config["FIRMWARE_RELEASE"]
            and row.get("is_released") is True, "Exact release is unavailable or not currently released.")
    version = row.get("version")
    require(isinstance(version, str) and 1 <= len(version) <= 128
            and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._+-]*", version), "Invalid declared firmware version.")
    sha256 = row.get("bin_sha256")
    require(isinstance(sha256, str) and re.fullmatch(r"[a-fA-F0-9]{64}", sha256),
            "Invalid declared BIN SHA-256.")
    return {"id": row["id"], "version": version, "is_released": True,
            "bin_sha256": sha256.lower(), "bin_file_size_bytes": byte_count(row.get("bin_file_size_bytes"), MAX_IMAGE_BYTES)}


def catalog_selection(config, deadline):
    catalog = read_json(config, "/firmware-releases?" + urlencode({"device_id": config["DEVICE"]}), deadline)
    require(isinstance(catalog, dict) and isinstance(catalog.get("data"), list)
            and len(catalog["data"]) <= 100, "Invalid or oversized device-filtered firmware catalog.")
    rows = catalog["data"]
    require(all(isinstance(row, dict) and isinstance(row.get("id"), str)
                and re.fullmatch(r"fw_[A-Za-z0-9]{1,64}", row["id"]) for row in rows),
            "Firmware catalog contains invalid release IDs.")
    require(len({row["id"] for row in rows}) == len(rows), "Firmware catalog contains duplicate release IDs.")
    matches = [row for row in rows if row["id"] == config["FIRMWARE_RELEASE"]]
    require(len(matches) == 1, "Exact release is absent from the device-filtered catalog; no fallback selected.")
    return release_metadata(matches[0], config)


def download_descriptor(config, release, deadline):
    descriptor = read_json(config, "/firmware-releases/" + release["id"] + "/download-url?type=bin", deadline)
    require(isinstance(descriptor, dict) and descriptor.get("version") == release["version"],
            "Download descriptor version differs from the exact declared release.")
    sha256 = descriptor.get("sha256")
    require(isinstance(sha256, str) and re.fullmatch(r"[a-fA-F0-9]{64}", sha256)
            and hmac.compare_digest(sha256.lower(), release["bin_sha256"])
            and byte_count(descriptor.get("file_size_bytes"), MAX_IMAGE_BYTES) == release["bin_file_size_bytes"],
            "Download descriptor hash or size differs from declared BIN metadata.")
    expires = descriptor.get("expires_at")
    require(isinstance(expires, str) and len(expires) <= 40 and re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})", expires),
        "Invalid download URL expiry.")
    try:
        expiry = datetime.fromisoformat(expires.replace("Z", "+00:00"))
    except ValueError:
        raise SafeError("Invalid download URL expiry.") from None
    require(expiry > datetime.now(timezone.utc), "Download URL has expired.")
    target = https_url(descriptor.get("download_url"))
    require(target.hostname in config["storage_hosts"], "Storage host is outside the trusted exact allowlist.")
    return target, expiry


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


def download(config):
    destination = config["destination"]
    require(not os.path.lexists(destination), "OUTPUT_PATH exists; no overwrite was made.")
    parent = destination.parent
    directory_identity = private_directory(parent)
    deadline = time.monotonic() + 90
    generation = verify_device(config, deadline)
    release = catalog_selection(config, deadline)
    release_path = "/firmware-releases/" + release["id"]
    require(release_metadata(read_json(config, release_path, deadline), config) == release,
            "Catalog and exact release metadata differ; no download attempted.")
    target, expiry = download_descriptor(config, release, deadline)
    path = target.path or "/"
    if target.query:
        path += "?" + target.query  # Signed query is opaque; never print it or send API credentials.
    partial = parent / ("." + destination.name + "." + uuid.uuid4().hex + ".partial")
    created = False
    try:
        descriptor = os.open(partial, os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0), 0o600)
        created = True
        with os.fdopen(descriptor, "wb") as file:
            require(stat.S_ISREG(os.fstat(file.fileno()).st_mode), "Partial output must be a regular file.")
            require(expiry > datetime.now(timezone.utc), "Download URL expired before storage access.")
            with response_for(target.hostname, path, {"Accept-Encoding": "identity"}, deadline) as response:
                declared = header(response, "Content-Length")
                require(declared is None or byte_count(declared, MAX_IMAGE_BYTES) == release["bin_file_size_bytes"],
                        "Storage Content-Length contradicts declared BIN size.")
                hash_state = hashlib.sha256()
                total = 0
                while True:
                    remaining_time(deadline)
                    chunk = response.read1(min(65536, release["bin_file_size_bytes"] + 1 - total))
                    if not chunk:
                        break
                    total += len(chunk)
                    require(total <= release["bin_file_size_bytes"], "Storage bytes exceed declared BIN size.")
                    hash_state.update(chunk)
                    require(file.write(chunk) == len(chunk), "Could not write complete downloaded bytes.")
                require(total == release["bin_file_size_bytes"]
                        and hmac.compare_digest(hash_state.hexdigest(), release["bin_sha256"]),
                        "Downloaded bytes do not match declared BIN SHA-256 and size.")
            require(expiry > datetime.now(timezone.utc), "URL expired during download; no publication attempted.")
            file.flush()
            os.fsync(file.fileno())
        require(release_metadata(read_json(config, release_path, deadline), config) == release,
                "Exact release is no longer eligible or its declared metadata changed.")
        require(private_directory(parent) == directory_identity, "Private output directory changed.")
        require(verify_device(config, deadline) == generation, "Device binding generation changed or disappeared.")
        remaining_time(deadline)
        os.link(partial, destination)
    finally:
        if created:
            try:
                partial.unlink()
            except OSError:
                raise SafeError("Partial cleanup failed; inspect private output before retrying. A completed file may exist.") from None
    print(json.dumps({"release": release, "artifact": "bin", "matches_api_declared_bytes": True,
                      "physical_compatibility_verified": False, "firmware_signature_verified": False,
                      "installed": False, "selection_atomic": False}, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    try:
        require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
        require(len(sys.argv) == 1, "Configure environment variables; no CLI arguments are accepted.")
        download(configuration())
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Firmware download failed or its budget expired. Inspect API access, trusted hosts and private storage; "
              "no overwrite, automatic retry or installation was made.", file=sys.stderr)
        sys.exit(1)
