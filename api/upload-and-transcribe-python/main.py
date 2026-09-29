"""Server-side upload/transcription example using only Python's standard library."""
import argparse
import hashlib
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TYPES = {'.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
         '.opus': 'audio/opus', '.flac': 'audio/flac', '.webm': 'audio/webm', '.aac': 'audio/aac'}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(url, method, headers, body=None):
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=30) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        error.close()
        return error.code, b''
    except (OSError, urllib.error.URLError):
        raise RuntimeError('Request failed or timed out; reconcile the resource before retrying.') from None


def secure_url(value):
    if not isinstance(value, str):
        raise ValueError('An HTTPS URL is required.')
    url = urllib.parse.urlsplit(value)
    if url.scheme != 'https' or not url.netloc or url.username or url.password or url.fragment:
        raise ValueError('An HTTPS URL without embedded credentials is required.')
    return url


def run(path, config, send=request, pause=time.sleep, timeout=300):
    if not isinstance(config, dict) or any(not isinstance(config.get(key), str) for key in ('api_base_url', 'api_key', 'end_user_id')):
        raise ValueError('Set all three string configuration fields.')
    base = config['api_base_url'].rstrip('/')
    parsed = secure_url(base)
    if parsed.path != '/v1' or parsed.query:
        raise ValueError('API base URL must end in /v1 without a query.')
    if not config['api_key'] or config['api_key'] == 'replace_me' or config['end_user_id'] == 'eu_replace_me':
        raise ValueError('Set a server API key and existing test end user.')
    path = Path(path)
    if path.suffix.lower() not in TYPES or not path.is_file() or not 0 < path.stat().st_size <= 25 * 1024 * 1024:
        raise ValueError('Use a supported nonempty audio file no larger than 25 MiB.')
    audio = path.read_bytes()
    digest = hashlib.sha256(audio).hexdigest()

    def api(endpoint, body=None, pending=False):
        method = 'GET' if body is None else 'POST'
        status, raw = send(base + endpoint, method, {
            'Authorization': 'Bearer ' + config['api_key'], 'Content-Type': 'application/json'},
            None if body is None else json.dumps(body).encode())
        if pending and status == 425:
            return None
        if (pending and status != 200) or not 200 <= status < 300:
            raise RuntimeError(f'{method} {endpoint} returned HTTP {status}; inspect before retrying.')
        try:
            result = json.loads(raw)
            if not isinstance(result, dict):
                raise ValueError('Expected an object.')
            return result
        except (ValueError, UnicodeError):
            raise RuntimeError('API returned an unusable response; reconcile before retrying.') from None

    def poll(label, check):
        deadline = time.monotonic() + timeout
        delay = 2
        while time.monotonic() < deadline:
            result = check()
            if result is not None:
                return result
            pause(min(delay, max(0, deadline - time.monotonic())))
            delay = min(delay * 2, 10)
        raise RuntimeError(label + ' deadline reached; cloud work may still be running.')

    def identifier(value, prefix):
        import re
        if not isinstance(value, str) or not re.fullmatch(prefix + r'_[A-Za-z0-9_-]+', value):
            raise RuntimeError('Unexpected API identifier.')
        return value

    rec = api('/recordings', {'source': 'api_upload', 'upload_method': 'import',
              'end_user_id': config['end_user_id'], 'name': 'Python API example ' + datetime.now(timezone.utc).isoformat()})
    recording_id = identifier(rec['id'], 'rec')
    print('Recording created: ' + recording_id, file=sys.stderr)
    upload = api(f'/recordings/{recording_id}/upload-url', {'content_type': TYPES[path.suffix.lower()], 'file_size_bytes': len(audio)})
    secure_url(upload['upload_url'])
    if upload['content_type'] not in TYPES.values():
        raise RuntimeError('Unexpected upload content type.')
    status, _ = send(upload['upload_url'], 'PUT', {'Content-Type': upload['content_type']}, audio)
    if not 200 <= status < 300:
        raise RuntimeError(f'Storage PUT returned HTTP {status}.')
    complete = poll('Upload verification', lambda: api(f'/recordings/{recording_id}/upload-complete', {'content_sha256': digest}, True))
    if complete.get('id') != recording_id or complete.get('status') != 'uploaded' or complete.get('content_sha256') != digest or not complete.get('content_sha256_verified_at'):
        raise RuntimeError('Upload integrity confirmation did not match.')
    txn = api('/transcriptions', {'recording_id': recording_id})
    transcription_id = identifier(txn['id'], 'txn')
    print('Transcription created: ' + transcription_id, file=sys.stderr)

    def result():
        current = api('/transcriptions/' + transcription_id)
        if current.get('id') != transcription_id or current.get('recording_id') != recording_id:
            raise RuntimeError('Transcription identity mismatch.')
        if current['status'] == 'completed' and isinstance(current.get('full_text'), str):
            return {'recording_id': recording_id, 'transcription_id': transcription_id, 'text': current['full_text']}
        if current['status'] not in ('pending', 'processing'):
            raise RuntimeError('Transcription failed or returned an unexpected result. Inspect its ID.')
        return None
    return poll('Transcription', result)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('audio')
    parser.add_argument('--config', default='config.json')
    args = parser.parse_args()
    try:
        config = json.loads(Path(args.config).read_text(encoding='utf-8'))
        print(json.dumps(run(args.audio, config), indent=2))
    except (KeyError, ValueError, RuntimeError, OSError) as error:
        print(str(error) if isinstance(error, RuntimeError) else 'Invalid configuration or input; see README.md.', file=sys.stderr)
        sys.exit(1)
