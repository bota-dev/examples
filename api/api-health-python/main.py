"""Read one credential-free server database health report."""

import datetime
import http.client
import ipaddress
import json
import math
import os
import re
import socket
import sys
import threading
import time
import urllib.parse

MAX_RESPONSE_BYTES = 64 * 1024
REQUEST_SECONDS = 10
TOTAL_SECONDS = 30


class SafeError(Exception):
    """An error safe to display without origin or upstream details."""


def require(condition, message):
    if not condition:
        raise SafeError(message)


def read_origin():
    origin = os.environ.get("BOTA_API_ORIGIN", "")
    require(0 < len(origin) <= 2048 and origin.isascii()
            and not re.search(r"[\x00-\x20\x7f\\?#]", origin),
            "Set BOTA_API_ORIGIN to an explicit trusted HTTPS root origin without credentials, query or fragment.")
    try:
        url = urllib.parse.urlsplit(origin)
        port = url.port
        host = url.hostname
        require(url.scheme == "https" and host and url.path in {"", "/"}
                and url.username is None and url.password is None
                and not url.query and not url.fragment and not url.netloc.endswith(":")
                and (port is None or 1 <= port <= 65535),
                "BOTA_API_ORIGIN must be an HTTPS root origin, without credentials, query or fragment.")
        if url.netloc.startswith("["):
            require(":" in host and "%" not in host,
                    "BOTA_API_ORIGIN must contain an unscoped IPv6 host.")
            ipaddress.IPv6Address(host)
        else:
            labels = host.rstrip(".").split(".")
            require(len(host) <= 253 and all(re.fullmatch(
                r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label
            ) for label in labels), "BOTA_API_ORIGIN must contain a valid ASCII host.")
    except ValueError:
        raise SafeError("Set a valid trusted HTTPS root BOTA_API_ORIGIN.") from None
    return host, port


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
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Nonfinite JSON number")
    return number


def read_health(host, port, total_deadline):
    deadline = min(total_deadline, time.monotonic() + REQUEST_SECONDS)
    remaining = deadline - time.monotonic()
    require(remaining > 0, "Health probe exceeded its elapsed-time budget.")
    connection = http.client.HTTPSConnection(host, port, timeout=remaining)
    timer = None
    try:
        connection.connect()
        remaining = deadline - time.monotonic()
        require(remaining > 0, "Health probe exceeded its request-time budget.")
        transport = connection.sock
        transport.settimeout(remaining)

        def interrupt_transport():
            # Interrupt connected headers/body even when bytes arrive slowly.
            try:
                transport.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

        timer = threading.Timer(remaining, interrupt_transport)
        timer.daemon = True
        timer.start()
        connection.request("GET", "/health", headers={
            "Accept": "application/json",
            "Accept-Encoding": "identity",
        })
        with connection.getresponse() as response:
            status = response.status
            require(status in {200, 503},
                    "Health probe returned an unsupported HTTP status; no redirect or retry was made.")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
                    == "application/json", "Health response must be application/json.")
            require(response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Encoded health responses are not supported.")
            chunks = []
            total = 0
            while True:
                require(time.monotonic() < deadline, "Health probe exceeded its request-time budget.")
                chunk = response.read1(min(16 * 1024, MAX_RESPONSE_BYTES + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                require(total <= MAX_RESPONSE_BYTES, "Health response exceeds the 64 KiB limit.")
                chunks.append(chunk)
            require(time.monotonic() < deadline, "Health probe exceeded its request-time budget.")
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()
    try:
        report = json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                            parse_constant=reject_constant, parse_float=finite_float)
    except (UnicodeError, ValueError, RecursionError):
        raise SafeError("Health response is not supported strict UTF-8 JSON.") from None
    expected = ("healthy", "connected") if status == 200 else ("unhealthy", "disconnected")
    require(isinstance(report, dict) and set(report) == {"status", "database", "billing"}
            and (report.get("status"), report.get("database")) == expected
            and report.get("billing") in ("enabled", "disabled"),
            "Health response does not match the supported source-specific status and shape.")
    return status, {"status": report["status"], "database": report["database"]}


def main():
    require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
    started = time.monotonic()
    total_deadline = started + TOTAL_SECONDS
    host, port = read_origin()
    status, selected = read_health(host, port, total_deadline)
    require(time.monotonic() < total_deadline, "Health probe exceeded its elapsed-time budget.")
    print(json.dumps({
        "selected_report": selected,
        "http_status": status,
        "observed_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "elapsed_seconds": round(time.monotonic() - started, 3),
        "evidence": "one_server_database_health_report",
        "whole_system_availability_verified": False,
        "storage_operations_verified": False,
        "authenticated_api_verified": False,
        "processing_queue_verified": False,
        "ai_provider_verified": False,
        "physical_device_verified": False,
        "sustained_uptime_verified": False,
    }, indent=2, ensure_ascii=True, allow_nan=False))
    return 0 if status == 200 else 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (Exception, KeyboardInterrupt):
        print("Health probe failed. Check the trusted origin and network; no automatic retry was made.",
              file=sys.stderr)
        sys.exit(1)
