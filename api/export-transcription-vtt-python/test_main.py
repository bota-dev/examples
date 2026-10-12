"""Synthetic WebVTT contract tests; no API requests or subtitle player."""

import contextlib
import io
import os
import stat
import tempfile
import time
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import main


CONFIG = {
    "BOTA_PROJECT_ID": "proj_test",
    "BOTA_END_USER_ID": "eu_test",
    "BOTA_RECORDING_ID": "rec_test",
    "BOTA_TRANSCRIPTION_ID": "txn_test",
    "host": "api.example.test", "port": None, "key": "sk_test_synthetic",
}


DEFAULT_SEGMENTS = object()


def transcription(segments=DEFAULT_SEGMENTS, **changes):
    value = {
        "id": "txn_test", "project_id": "proj_test", "recording_id": "rec_test",
        "status": "completed",
        "segments": [{"start": 0, "end": 1, "text": "Hello"}] if segments is DEFAULT_SEGMENTS else segments,
    }
    return {**value, **changes}


class FormatTests(unittest.TestCase):
    def test_exact_decimal_timing_widens_positive_sub_millisecond_cues(self):
        content, count = main.render_webvtt(transcription([
            {"start": Decimal("0.0009"), "end": Decimal("0.0011"), "text": "Hello"},
            {"start": Decimal("360000"), "end": Decimal("360000.125"), "text": "Later"},
        ]), CONFIG)
        self.assertEqual(count, 2)
        self.assertEqual(content, b"WEBVTT\n\n1\n00:00:00.000 --> 00:00:00.002\nHello\n\n"
                                 b"2\n100:00:00.000 --> 100:00:00.125\nLater\n\n")

    def test_untrusted_markup_and_block_text_stay_in_one_escaped_payload_line(self):
        content, _ = main.render_webvtt(transcription([
            {"start": 0, "end": 2, "text": "<b>&lt; -->\n\nSTYLE\tNOTE\u202eREGION"},
        ]), CONFIG)
        self.assertIn(b"&lt;b&gt;&amp;lt; --&gt; STYLE NOTE REGION\n\n", content)
        self.assertEqual(content.count(b"\n\n"), 2)
        self.assertNotIn(b"<b>", content)

    def test_overlapping_and_equal_start_cues_are_retained_in_source_order(self):
        content, count = main.render_webvtt(transcription([
            {"start": 1, "end": 4, "text": "First"},
            {"start": 1, "end": 2, "text": "Second"},
        ]), CONFIG)
        self.assertEqual(count, 2)
        self.assertLess(content.index(b"First"), content.index(b"Second"))

    def test_invalid_timing_is_rejected_without_sorting_or_inference(self):
        for start, end in [(True, 1), (0, False), (-1, 2), (2, 2), (2, 1),
                           (Decimal("NaN"), 2), (0, Decimal("Infinity")),
                           (0, main.MAX_SECONDS + 1), (Decimal("1e-31"), 1)]:
            with self.subTest(start=start, end=end), self.assertRaises(main.SafeError):
                main.render_webvtt(transcription([{"start": start, "end": end, "text": "Hello"}]), CONFIG)
        with self.assertRaises(main.SafeError):
            main.render_webvtt(transcription([
                {"start": 2, "end": 3, "text": "First"},
                {"start": 1, "end": 2, "text": "Second"},
            ]), CONFIG)

    def test_wrong_source_owner_project_and_incomplete_content_are_not_exported(self):
        for changes in [{"id": "txn_other"}, {"recording_id": "rec_other"},
                        {"project_id": "proj_other"}, {"deleted_at": "now"},
                        {"status": "processing"}, {"segments": []}, {"segments": None}]:
            with self.subTest(changes=changes), self.assertRaises(main.SafeError):
                main.render_webvtt(transcription(**changes), CONFIG)
        with patch.object(main, "read_json", return_value={
                "id": "rec_test", "end_user_id": "eu_other"}), self.assertRaises(main.SafeError):
            main.verify_recording(CONFIG, time.monotonic() + 10)

    def test_output_size_limit_and_nonprintable_payloads_are_rejected(self):
        with patch.object(main, "MAX_OUTPUT_BYTES", 10), self.assertRaises(main.SafeError):
            main.render_webvtt(transcription(), CONFIG)
        with self.assertRaises(main.SafeError):
            main.render_webvtt(transcription([{"start": 0, "end": 1, "text": "\u200d\n\t"}]), CONFIG)


class FakeResponse:
    def __init__(self, body, status=200, headers=None):
        self.body = io.BytesIO(body)
        self.status = status
        self.headers = {"Content-Type": "application/json", **(headers or {})}

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        pass

    def getheader(self, name, default=None):
        return self.headers.get(name, default)

    def read1(self, size):
        return self.body.read(size)


class FakeConnection:
    def __init__(self, response):
        self.response = response
        self.requests = []
        self.closed = False
        self.sock = self

    def connect(self):
        pass

    def settimeout(self, _timeout):
        pass

    def shutdown(self, _how):
        pass

    def request(self, method, path, headers):
        self.requests.append((method, path, headers))

    def getresponse(self):
        return self.response

    def close(self):
        self.closed = True


class TransportTests(unittest.TestCase):
    def read(self, response):
        connection = FakeConnection(response)
        with patch.object(main.http.client, "HTTPSConnection", return_value=connection):
            try:
                return main.read_json(CONFIG, "/transcriptions/txn_test", time.monotonic() + 10)
            finally:
                self.assertTrue(connection.closed)
                self.assertEqual(len(connection.requests), 1)
                method, path, headers = connection.requests[0]
                self.assertEqual((method, path), ("GET", "/v1/transcriptions/txn_test"))
                self.assertEqual(headers["Authorization"], "Bearer sk_test_synthetic")

    def test_numeric_json_fractions_preserve_original_decimal_precision(self):
        document = self.read(FakeResponse(b'{"start":0.0010000000000000000000001}'))
        self.assertEqual(document["start"], Decimal("0.0010000000000000000000001"))

    def test_invalid_utf8_duplicate_keys_and_invalid_numbers_are_rejected(self):
        for body in [b'{"x":"\xff"}', b'{"x":1,"x":2}', b'{"x":NaN}',
                     b'{"x":"\\ud800"}', b'{"x":Infinity}', b'{']:
            with self.subTest(body=body), self.assertRaises(main.SafeError):
                self.read(FakeResponse(body))

    def test_http_redirect_and_compressed_or_oversized_json_never_retry(self):
        for response in [FakeResponse(b"secret upstream body", status=302),
                         FakeResponse(b"{}", headers={"Content-Encoding": "gzip"}),
                         FakeResponse(b"{}", headers={"Content-Type": "text/html"})]:
            with self.subTest(response=response), self.assertRaises(main.SafeError) as raised:
                self.read(response)
            self.assertNotIn("secret", str(raised.exception))
        with patch.object(main, "MAX_RESPONSE_BYTES", 16), self.assertRaises(main.SafeError):
            self.read(FakeResponse(b'{"text":"' + b"x" * 30 + b'"}'))


class PublicationTests(unittest.TestCase):
    def export(self, directory, *, final_owner=True, existing=False, racing=False):
        destination = Path(directory) / "transcript.vtt"
        config = {**CONFIG, "destination": destination}
        recording = {"id": "rec_test", "end_user_id": "eu_test", "project_id": "proj_test"}
        replies = [recording, transcription(), recording if final_owner else {**recording, "end_user_id": "eu_other"}]
        calls = []
        original_link = os.link

        def read(_config, path, _deadline):
            calls.append(path)
            return replies.pop(0)

        def publish(source, target):
            if racing:
                Path(target).write_bytes(b"existing winner")
            return original_link(source, target)

        if existing:
            destination.write_bytes(b"existing original")
        # Directory ancestry/ACL setup is operator-owned. This test exercises real
        # file writes/hard-link publication in a temporary directory, not ACL policy.
        with patch.object(main, "private_directory", return_value=(1, 2)), \
                patch.object(main, "read_json", side_effect=read), \
                patch.object(main.os, "link", side_effect=publish), \
                contextlib.redirect_stdout(io.StringIO()) as output:
            try:
                main.export_transcription(config)
                error = None
            except (main.SafeError, FileExistsError) as caught:
                error = caught
        return destination, calls, output.getvalue(), error

    def test_complete_publication_has_owner_reads_on_both_sides_and_no_partial_left(self):
        with tempfile.TemporaryDirectory() as directory:
            destination, calls, output, error = self.export(directory)
            self.assertIsNone(error)
            self.assertEqual(calls, ["/recordings/rec_test", "/transcriptions/txn_test", "/recordings/rec_test"])
            self.assertTrue(destination.read_bytes().startswith(b"WEBVTT\n\n"))
            self.assertEqual(list(Path(directory).iterdir()), [destination])
            self.assertEqual(output, "Exported 1 WebVTT cues to OUTPUT_PATH.\n")
            self.assertNotIn("Hello", output)
            if os.name != "nt":
                self.assertEqual(stat.S_IMODE(destination.stat().st_mode), 0o600)

    def test_owner_change_after_flush_prevents_publication_and_cleans_only_own_partial(self):
        with tempfile.TemporaryDirectory() as directory:
            unrelated = Path(directory) / ".unrelated.partial"
            unrelated.write_bytes(b"retain")
            destination, calls, output, error = self.export(directory, final_owner=False)
            self.assertIsInstance(error, main.SafeError)
            self.assertEqual(len(calls), 3)
            self.assertFalse(destination.exists())
            self.assertEqual(list(Path(directory).iterdir()), [unrelated])
            self.assertEqual(output, "")

    def test_existing_destination_and_publication_race_are_never_overwritten(self):
        for existing, racing, expected in [(True, False, b"existing original"), (False, True, b"existing winner")]:
            with self.subTest(existing=existing), tempfile.TemporaryDirectory() as directory:
                destination, calls, output, error = self.export(directory, existing=existing, racing=racing)
                self.assertIsNotNone(error)
                self.assertEqual(destination.read_bytes(), expected)
                self.assertEqual(list(Path(directory).iterdir()), [destination])
                self.assertEqual(output, "")
                if existing:
                    self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
