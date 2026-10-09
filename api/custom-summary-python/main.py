"""Create one scoped custom summary; retain uncertainty and resume by GET only."""

import hashlib
import http.client
import json
import math
import os
import re
import socket
import sqlite3
import stat
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

MAX_RESPONSE_BYTES = 1024 * 1024
MAX_PROMPT_BYTES = 40000
STATUSES = {"pending", "processing", "completed", "failed"}


class SafeError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise SafeError(message)


def resource_id(prefix, value):
    return isinstance(value, str) and re.fullmatch(prefix + r"_[A-Za-z0-9]{1,64}", value)


def configured_path(name):
    value = os.environ.get(name, "")
    require(0 < len(value) <= 2048 and not re.search(r"[\x00-\x1f\x7f]", value),
            f"Set {name} to a trusted local path.")
    return Path(value).absolute()


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
            and "replace_me" not in key.lower(), "Set a server-held project API key.")
    ids = {}
    for name, prefix in (("BOTA_END_USER_ID", "eu"), ("BOTA_RECORDING_ID", "rec"),
                         ("BOTA_TRANSCRIPTION_ID", "txn")):
        value = os.environ.get(name, "")
        require(resource_id(prefix, value) and "replace_me" not in value.lower(),
                f"Set {name} to the exact authorized resource ID.")
        ids[name] = value
    project = os.environ.get("BOTA_PROJECT_ID", "")
    require(re.fullmatch(r"[A-Za-z0-9_-]{3,128}", project) and "replace_me" not in project.lower(),
            "Set BOTA_PROJECT_ID to the exact expected project.")
    provider = os.environ.get("BOTA_SUMMARY_PROVIDER", "")
    require(provider in {"", "gemini", "openai", "claude"},
            "BOTA_SUMMARY_PROVIDER must be empty, gemini, openai or claude.")
    attached = os.environ.get("BOTA_SUMMARY_ID", "")
    require(not attached or resource_id("sum", attached), "BOTA_SUMMARY_ID must be an existing sum_* ID.")
    prompt_path = configured_path("BOTA_PROMPT_PATH")
    require(stat.S_ISREG(prompt_path.stat(follow_symlinks=False).st_mode),
            "BOTA_PROMPT_PATH must be a regular file, not a symlink.")
    descriptor = os.open(prompt_path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    with os.fdopen(descriptor, "rb") as source:
        require(stat.S_ISREG(os.fstat(source.fileno()).st_mode), "Prompt must be a regular file.")
        raw_prompt = source.read(MAX_PROMPT_BYTES + 1)
    require(len(raw_prompt) <= MAX_PROMPT_BYTES, "Prompt exceeds the example's 40,000-byte limit.")
    try:
        prompt = raw_prompt.decode("utf-8")
    except UnicodeError:
        raise SafeError("Prompt must be valid UTF-8.") from None
    # Conservatively fit both documented characters and the service's UTF-16 limit.
    require(10 <= len(prompt) and len(prompt.encode("utf-16-le")) // 2 <= 10000 and prompt.strip(),
            "Prompt needs at least 10 Unicode characters and at most 10,000 UTF-16 units.")
    return {"scheme": base.scheme, "host": base.hostname, "port": port, "key": key,
            "project": project, "provider": provider, "attached": attached, "prompt": prompt,
            "digest": hashlib.sha256(raw_prompt).hexdigest(),
            "state_path": configured_path("SUMMARY_STATE_PATH"), **ids}


def scope(config):
    # Credentials and prompt content never enter the journal.
    return json.dumps([config["scheme"], config["host"], config["port"], "/v1", config["project"],
                       config["BOTA_END_USER_ID"], config["BOTA_RECORDING_ID"],
                       config["BOTA_TRANSCRIPTION_ID"], config["digest"], config["provider"]])


class Journal:
    def __init__(self, config):
        path = config["state_path"]
        directory = path.parent.stat(follow_symlinks=False)
        require(stat.S_ISDIR(directory.st_mode), "Journal directory must already exist and not be a symlink.")
        if os.name != "nt":
            require(directory.st_mode & 0o077 == 0, "Journal directory must be private (mode 0700).")
        try:
            descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0), 0o600)
        except FileExistsError:
            info = path.stat(follow_symlinks=False)
            require(stat.S_ISREG(info.st_mode), "Journal must be a regular file, not a symlink.")
            if os.name != "nt":
                require(info.st_mode & 0o077 == 0, "Journal must be private (mode 0600).")
        else:
            os.close(descriptor)
        self.db = sqlite3.connect(path, timeout=5)
        try:
            self.db.execute("PRAGMA synchronous=FULL")
            self.db.execute("PRAGMA journal_mode=DELETE")
            self.db.execute("""CREATE TABLE IF NOT EXISTS operation (
                id INTEGER PRIMARY KEY CHECK(id=1), scope TEXT NOT NULL,
                phase TEXT NOT NULL CHECK(phase IN ('ready','uncertain','known')), summary_id TEXT
            )""")
            self.db.execute("INSERT OR IGNORE INTO operation VALUES (1,?,'ready',NULL)", (scope(config),))
            self.db.commit()
            saved_scope, phase, summary_id = self.row()
            require(saved_scope == scope(config), "Journal configuration differs; restore the original scope and prompt.")
            require((phase in {"ready", "uncertain"} and summary_id is None)
                    or (phase == "known" and resource_id("sum", summary_id)), "Journal state is invalid; reconcile manually.")
        except BaseException:
            self.db.close()
            raise

    def row(self):
        return self.db.execute("SELECT scope,phase,summary_id FROM operation WHERE id=1").fetchone()

    def claim(self):
        with self.db:
            changed = self.db.execute("UPDATE operation SET phase='uncertain' WHERE id=1 AND phase='ready' AND summary_id IS NULL").rowcount
            require(changed == 1, "Creation is already known or uncertain; no POST was repeated.")

    def remember(self, summary_id):
        with self.db:
            changed = self.db.execute("UPDATE operation SET phase='known',summary_id=? WHERE id=1 AND (summary_id IS NULL OR summary_id=?)",
                                      (summary_id, summary_id)).rowcount
            require(changed == 1, "Journal owns a different summary; no replacement was created.")

    def close(self):
        self.db.close()


def remaining_time(deadline):
    remaining = deadline - time.monotonic()
    require(remaining > 0, "Observation deadline expired; outcome is inconclusive. Keep the journal and resume by GET.")
    return remaining


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


def api(config, path, deadline, body=None):
    deadline = min(deadline, time.monotonic() + 15)
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
        headers = {"Authorization": "Bearer " + config["key"], "Accept": "application/json", "Accept-Encoding": "identity"}
        payload = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            payload = json.dumps(body, ensure_ascii=False, allow_nan=False).encode("utf-8")
        connection.request("POST" if body is not None else "GET", "/v1" + path, body=payload, headers=headers)
        with connection.getresponse() as response:
            require(response.status == (201 if body is not None else 200),
                    f"API request failed (HTTP {response.status}); keep the journal. No redirect or automatic retry was made.")
            require(response.getheader("Content-Type", "").split(";", 1)[0].strip().lower() == "application/json",
                    "API must return application/json; keep the journal.")
            require(response.getheader("Content-Encoding", "identity").strip().lower() == "identity",
                    "Encoded API responses are unsupported; keep the journal.")
            chunks = []
            total = 0
            while True:
                remaining_time(deadline)
                chunk = response.read1(min(65536, MAX_RESPONSE_BYTES + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                require(total <= MAX_RESPONSE_BYTES, "API response exceeds 1 MiB; keep the journal.")
                chunks.append(chunk)
            remaining_time(deadline)
    finally:
        if timer is not None:
            timer.cancel()
            timer.join()
        connection.close()
    try:
        return json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=unique_object,
                          parse_constant=reject_constant, parse_float=finite_float)
    except (UnicodeError, ValueError, RecursionError):
        raise SafeError("API returned invalid UTF-8 JSON, duplicate keys or nonfinite numbers; keep the journal.") from None


def verify_source(config, deadline):
    recording = api(config, "/recordings/" + config["BOTA_RECORDING_ID"], deadline)
    require(isinstance(recording, dict) and recording.get("id") == config["BOTA_RECORDING_ID"]
            and recording.get("end_user_id") == config["BOTA_END_USER_ID"]
            and recording.get("deleted_at") is None and recording.get("status") != "deleted"
            and ("project_id" not in recording or recording["project_id"] == config["project"]),
            "Recording identity, configured owner or project does not match.")
    transcription = api(config, "/transcriptions/" + config["BOTA_TRANSCRIPTION_ID"], deadline)
    require(isinstance(transcription, dict) and transcription.get("id") == config["BOTA_TRANSCRIPTION_ID"]
            and transcription.get("recording_id") == config["BOTA_RECORDING_ID"] and transcription.get("status") == "completed"
            and ("project_id" not in transcription or transcription["project_id"] == config["project"]),
            "Transcription identity, project, source or completed status does not match.")


def verify_summary(config, summary, expected_id=None):
    require(isinstance(summary, dict) and resource_id("sum", summary.get("id"))
            and (expected_id is None or summary["id"] == expected_id)
            and summary.get("project_id") == config["project"]
            and summary.get("transcription_id") == config["BOTA_TRANSCRIPTION_ID"]
            and "template_id" in summary and summary["template_id"] is None
            and summary.get("custom_prompt") == config["prompt"]
            and summary.get("provider") in {"gemini", "openai", "claude"}
            and (not config["provider"] or summary["provider"] == config["provider"])
            and summary.get("status") in STATUSES,
            "Summary identity, project, source, prompt, provider or status does not match; keep the journal.")
    if summary["status"] == "completed":
        require(isinstance(summary.get("output"), dict), "Completed summary lacks a structured output object.")


def summarize(config):
    deadline = time.monotonic() + 300
    journal = Journal(config)
    try:
        verify_source(config, deadline)
        _, phase, known_id = journal.row()
        if config["attached"]:
            require(known_id is None or known_id == config["attached"], "Journal owns a different summary ID.")
            summary = api(config, "/summaries/" + config["attached"], deadline)
            verify_summary(config, summary, config["attached"])
            journal.remember(summary["id"])
        elif known_id is None:
            require(phase == "ready", "POST outcome is uncertain. Reconcile manually, then set BOTA_SUMMARY_ID; never delete the journal to retry.")
            # Durable intent commits before the sole permitted POST, including crash uncertainty.
            journal.claim()
            body = {"transcription_id": config["BOTA_TRANSCRIPTION_ID"], "prompt": config["prompt"]}
            if config["provider"]:
                body["provider"] = config["provider"]
            summary = api(config, "/summaries", deadline, body)
            verify_summary(config, summary)
            journal.remember(summary["id"])
        known_id = journal.row()[2]
        while True:
            remaining_time(deadline)
            summary = api(config, "/summaries/" + known_id, deadline)
            verify_summary(config, summary, known_id)
            require(summary["status"] != "failed", "Saved summary failed; no replacement was created. Inspect it privately.")
            if summary["status"] == "completed":
                verify_source(config, deadline)
                document = {"summary_id": known_id, "status": "completed", "output": summary["output"]}
                try:
                    content = json.dumps(document, ensure_ascii=False, allow_nan=False, indent=2)
                    require(len(content.encode("utf-8")) <= 2 * MAX_RESPONSE_BYTES, "Output exceeds the example's 2 MiB limit.")
                except (UnicodeError, ValueError, RecursionError):
                    raise SafeError("Output cannot be emitted as strict UTF-8 JSON.") from None
                remaining_time(deadline)
                print(content)
                return
            time.sleep(min(2, remaining_time(deadline)))
    finally:
        journal.close()


if __name__ == "__main__":
    try:
        require(sys.version_info >= (3, 12), "Use Python 3.12 or newer.")
        require(len(sys.argv) == 1, "Use environment configuration; prompt text must come from BOTA_PROMPT_PATH.")
        if os.name != "nt":
            os.umask(0o077)
        summarize(configuration())
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (Exception, KeyboardInterrupt):
        print("Stopped without a verified result. Keep the journal; a POST may have succeeded. "
              "Restore configuration and resume a known ID by GET, or reconcile the uncertain operation manually.", file=sys.stderr)
        sys.exit(1)
