"""Watch an existing transcription using bounded, read-only public API requests."""

import http.client
import json
import os
import re
import socket
import sys
import threading
import time
from urllib.parse import urlsplit

MAX_RESPONSE_BYTES = 1024 * 1024
MAX_POLLS = 20
POLL_DELAY_SECONDS = 2
TOTAL_BUDGET_SECONDS = 60
OWNER_CHECK_RESERVE_SECONDS = 10
STATUSES = {"pending", "processing", "completed", "failed"}


class SafeError(Exception):
    pass


class DeadlineExpired(SafeError):
    pass


def require(condition, message):
    if not condition:
        raise SafeError(message)


def remaining_time(deadline):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise DeadlineExpired("Inconclusive: the watcher elapsed-time budget expired.")
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
            "Use an explicit HTTPS API origin ending in /v1; HTTP is permitted on loopback only.")
    key = os.environ.get("BOTA_API_KEY", "")
    require(len(key) <= 256 and re.fullmatch(r"(?:sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+", key)
            and "replace_me" not in key.lower(), "Set a server-side key with recordings:read and transcriptions:read.")
    ids = {}
    for name, prefix in (("BOTA_END_USER_ID", "eu"), ("BOTA_RECORDING_ID", "rec"), ("BOTA_TRANSCRIPTION_ID", "txn")):
        value = os.environ.get(name, "")
        require(re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value) and "replace_me" not in value.lower(),
                f"Set {name} to the expected authorized resource ID.")
        ids[name] = value
    return {"host": base.hostname, "port": port, "scheme": base.scheme, "key": key, **ids}


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
            # Fixed elapsed deadline covers sending and trickling response headers/body.
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
                    f"API read failed (HTTP {response.status}); no redirects or automatic request retries are made.")
            media_type = response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
            require(media_type == "application/json", "The API must return application/json.")
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
    except TimeoutError:
        raise DeadlineExpired("Inconclusive: an API connection or read timed out.") from None
    except (OSError, http.client.HTTPException):
        remaining_time(deadline)
        raise SafeError("API transport failed; no automatic request retry was made.") from None
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()
    try:
        return json.loads(b"".join(chunks).decode("utf-8"))
    except (UnicodeError, ValueError, RecursionError):
        raise SafeError("The API returned invalid UTF-8 JSON.") from None


def verify_owner(config, deadline):
    recording = read_json(config, "/recordings/" + config["BOTA_RECORDING_ID"], deadline)
    require(isinstance(recording, dict) and recording.get("id") == config["BOTA_RECORDING_ID"]
            and recording.get("end_user_id") == config["BOTA_END_USER_ID"] and not recording.get("deleted_at"),
            "Recording identity or configured end-user ownership does not match.")


def select_transcription(row, config):
    require(isinstance(row, dict) and row.get("id") == config["BOTA_TRANSCRIPTION_ID"]
            and row.get("recording_id") == config["BOTA_RECORDING_ID"],
            "Transcription identity or source recording does not match.")
    require(isinstance(row.get("status"), str) and row["status"] in STATUSES,
            "The transcription status is outside the selected public contract.")
    word_count = row.get("word_count")
    require(word_count is None or (type(word_count) is int and 0 <= word_count <= 2**53 - 1),
            "The transcription word count is invalid.")
    return {"id": row["id"], "recording_id": row["recording_id"], "status": row["status"], "word_count": word_count}


def watch(config):
    deadline = time.monotonic() + TOTAL_BUDGET_SECONDS
    poll_deadline = deadline - OWNER_CHECK_RESERVE_SECONDS
    verify_owner(config, min(poll_deadline, time.monotonic() + 10))
    last = None
    reads = 0
    stop_reason = "poll_cap"
    for _ in range(MAX_POLLS):
        try:
            remaining_time(poll_deadline)
            row = read_json(config, "/transcriptions/" + config["BOTA_TRANSCRIPTION_ID"], poll_deadline)
        except DeadlineExpired:
            stop_reason = "elapsed_budget"
            break
        reads += 1
        last = select_transcription(row, config)
        if last["status"] in {"completed", "failed"}:
            stop_reason = "terminal_status"
            break
        if reads == MAX_POLLS:
            break
        if poll_deadline - time.monotonic() <= POLL_DELAY_SECONDS:
            stop_reason = "elapsed_budget"
            break
        time.sleep(POLL_DELAY_SECONDS)
    # A changed or unconfirmed owner prevents emitting even selected job metadata.
    verify_owner(config, deadline)
    remaining_time(deadline)
    status = last["status"] if last is not None else None
    outcome = status if status in {"completed", "failed"} else "inconclusive"
    print(json.dumps({
        "transcription": last, "outcome": outcome, "stop_reason": stop_reason, "successful_polls": reads,
    }, indent=2, ensure_ascii=True))
    return 0 if outcome == "completed" else 1 if outcome == "failed" else 2


if __name__ == "__main__":
    try:
        require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
        sys.exit(watch(configuration()))
    except DeadlineExpired:
        print("Inconclusive: watcher or ownership-check budget expired. This watcher made no cloud changes; "
              "re-run the same IDs to continue GET-only observation.", file=sys.stderr)
        sys.exit(2)
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Watcher failed. Check configuration, network and API access; no cloud write or automatic retry was made.",
              file=sys.stderr)
        sys.exit(1)
