import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from main import run


class WorkflowTest(unittest.TestCase):
    def test_integrity_retry_and_credential_boundary(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'sample.wav'
            path.write_bytes(b'synthetic-byte-fixture')
            calls = []
            responses = [(201, {'id': 'rec_test'}), (200, {'upload_url': 'https://storage.example.test/audio', 'content_type': 'audio/wav'}),
                         (200, {}), (425, {}), (200, {'id': 'rec_test', 'status': 'uploaded', 'content_sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'content_sha256_verified_at': '2026-09-29T00:00:00Z'}),
                         (201, {'id': 'txn_test'}), (200, {'id': 'txn_test', 'recording_id': 'rec_test', 'status': 'completed', 'full_text': 'test'})]
            def send(*args):
                calls.append(args)
                status, body = responses.pop(0)
                return status, json.dumps(body).encode()
            result = run(path, {'api_base_url': 'https://api.example.test/v1', 'api_key': 'test-only', 'end_user_id': 'eu_test'}, send=send, pause=lambda _: None)
            self.assertEqual(result['text'], 'test')
            self.assertNotIn('Authorization', calls[2][2])
            self.assertEqual(calls[2][3], path.read_bytes())
            self.assertEqual(calls[3][3], calls[4][3])
            self.assertTrue(path.exists())

    def test_failed_creation_is_not_retried(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.wav'; path.write_bytes(b'test')
            calls = []
            def send(*args):
                calls.append(args)
                return 500, b'private diagnostic'
            with self.assertRaisesRegex(RuntimeError, 'HTTP 500'):
                run(path, {'api_base_url': 'https://api.example.test/v1', 'api_key': 'test-only', 'end_user_id': 'eu_test'}, send=send)
            self.assertEqual(len(calls), 1)

    def test_unverified_completion_never_starts_processing(self):
        for completion in ({'id': 'rec_test', 'status': 'uploaded'},
                           {'id': 'rec_other', 'status': 'uploaded', 'content_sha256': '0'*64, 'content_sha256_verified_at': 'now'}):
            with self.subTest(completion=completion), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'test.wav'
                path.write_bytes(b'synthetic')
                calls = []
                responses = [(201, {'id': 'rec_test'}),
                             (200, {'upload_url': 'https://storage.example.test/audio', 'content_type': 'audio/wav'}),
                             (200, {}), (200, completion)]
                def send(*args):
                    calls.append(args)
                    status, body = responses.pop(0)
                    return status, json.dumps(body).encode()
                with self.assertRaisesRegex(RuntimeError, 'integrity'):
                    run(path, {'api_base_url': 'https://api.example.test/v1', 'api_key': 'test-only', 'end_user_id': 'eu_test'}, send=send)
                self.assertEqual(len(calls), 4)
                self.assertEqual(path.read_bytes(), b'synthetic')


if __name__ == '__main__':
    unittest.main()
