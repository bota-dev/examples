import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm, copyFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { uploadAndTranscribe } from './index.mjs';

// Synthetic silence exercises byte transport; it is not ASR acceptance evidence.
const audio = Buffer.alloc(1644);
audio.write('RIFF'); audio.writeUInt32LE(1636, 4); audio.write('WAVEfmt ', 8);
audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
audio.writeUInt32LE(8000, 24); audio.writeUInt32LE(16000, 28);
audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
audio.write('data', 36); audio.writeUInt32LE(1600, 40);
const hash = createHash('sha256').update(audio).digest('hex');
const verified = { id: 'rec_test', status: 'uploaded', content_sha256: hash,
  content_sha256_verified_at: '2026-09-28T12:00:00Z' };
const result = { id: 'txn_test', recording_id: 'rec_test', status: 'completed', full_text: 'Synthetic test result.' };
const json = (body, status = 200) => Response.json(body, { status });

async function fixture(t) {
  const prefix = join(tmpdir(), 'bota-upload-example-');
  const directory = await mkdtemp(prefix);
  t.after(async () => {
    assert.ok(directory.startsWith(prefix));
    await rm(directory, { recursive: true, force: true });
  });
  const filePath = join(directory, 'silence.wav');
  await writeFile(filePath, audio);
  return { directory, filePath, apiBaseUrl: 'https://api.example.test/v1',
    apiKey: 'sk_test_mock_secret', endUserId: 'eu_test' };
}

function transport(overrides = {}) {
  const calls = [];
  const defaults = {
    '/v1/recordings': () => json({ id: 'rec_test' }, 201),
    '/v1/recordings/rec_test/upload-url': () => json({
      upload_url: 'https://storage.example.test/audio?signature=private', content_type: 'audio/wav',
    }),
    '/audio': () => new Response(null, { status: 200 }),
    '/v1/recordings/rec_test/upload-complete': () => json(verified),
    '/v1/transcriptions': () => json({ id: 'txn_test', status: 'pending' }, 201),
    '/v1/transcriptions/txn_test': () => json(result),
  };
  return { calls, fetchImpl: async (url, options) => {
    calls.push({ url, ...options });
    const path = new URL(url).pathname;
    const handler = overrides[path] ?? defaults[path];
    assert.ok(handler, `Unexpected request ${path}`);
    return handler(options);
  } };
}

test('uploads exact bytes without API credentials, verifies hash before transcription, preserves source', async t => {
  const input = await fixture(t);
  let completions = 0;
  let reads = 0;
  const http = transport({
    '/v1/recordings/rec_test/upload-complete': () => ++completions < 3 ? json({}, 425) : json(verified),
    '/v1/transcriptions/txn_test': () => ++reads < 2 ? json({ ...result, status: 'processing' }) : json(result),
  });
  const progress = [];
  assert.deepEqual(await uploadAndTranscribe(input, { ...http, pollIntervalMs: 1, onProgress: value => progress.push(value) }),
    { recording_id: 'rec_test', transcription_id: 'txn_test', text: result.full_text });
  assert.deepEqual(JSON.parse(http.calls[0].body), {
    end_user_id: 'eu_test', name: JSON.parse(http.calls[0].body).name, source: 'api_upload', upload_method: 'import',
  });
  assert.match(JSON.parse(http.calls[0].body).name, /^API upload example /);
  const put = http.calls.find(call => call.method === 'PUT');
  assert.deepEqual(put.headers, { 'Content-Type': 'audio/wav' });
  assert.deepEqual(put.body, audio);
  assert.equal(put.redirect, 'error');
  for (const call of http.calls.filter(call => call.method !== 'PUT')) {
    assert.equal(call.headers.Authorization, `Bearer ${input.apiKey}`);
    assert.equal(call.redirect, 'error');
  }
  const completes = http.calls.filter(call => call.url.endsWith('/upload-complete'));
  assert.equal(completes.length, 3);
  for (const call of completes) assert.deepEqual(JSON.parse(call.body), { content_sha256: hash });
  assert.equal(JSON.parse(http.calls[1].body).file_size_bytes, audio.length);
  assert.ok(http.calls.findIndex(call => call.url.endsWith('/transcriptions')) > http.calls.lastIndexOf(completes.at(-1)));
  assert.deepEqual(await readFile(input.filePath), audio);
  assert.doesNotMatch(progress.join('\n'), /sk_test_mock_secret|signature=|Synthetic test result/);
});

for (const status of [401, 409, 429, 500]) {
  test(`recording creation HTTP ${status} stops without blind retries or error-body disclosure`, async t => {
    const input = await fixture(t);
    const http = transport({ '/v1/recordings': () => json({ error: 'sk_test_mock_secret signature=private' }, status) });
    await assert.rejects(uploadAndTranscribe(input, http), error => {
      assert.match(error.message, new RegExp(`HTTP ${status}`));
      assert.doesNotMatch(error.message, /mock_secret|signature=/);
      return true;
    });
    assert.equal(http.calls.length, 1);
  });
}

test('failed storage PUT never confirms upload or starts processing', async t => {
  const input = await fixture(t);
  const http = transport({ '/audio': () => new Response('private storage diagnostic', { status: 403 }) });
  await assert.rejects(uploadAndTranscribe(input, http), /Storage PUT failed \(HTTP 403\)/);
  assert.equal(http.calls.length, 3);
});

test('conflicting completion is not retried and cannot start transcription', async t => {
  const input = await fixture(t);
  const http = transport({ '/v1/recordings/rec_test/upload-complete': () => json({}, 409) });
  await assert.rejects(uploadAndTranscribe(input, http), /HTTP 409/);
  assert.equal(http.calls.length, 4);
});

test('pending integrity verification has a deadline and never starts transcription', async t => {
  const input = await fixture(t);
  const http = transport({ '/v1/recordings/rec_test/upload-complete': () => json({}, 425) });
  await assert.rejects(uploadAndTranscribe(input, { ...http, pollIntervalMs: 5, pollTimeoutMs: 25 }), /Upload verification timed out/);
  assert.equal(http.calls.some(call => call.url.includes('/transcriptions')), false);
});

test('a success response with the wrong hash cannot authorize processing', async t => {
  const input = await fixture(t);
  const http = transport({ '/v1/recordings/rec_test/upload-complete': () => json({ ...verified, content_sha256: '0'.repeat(64) }) });
  await assert.rejects(uploadAndTranscribe(input, http), /expected recording and hash/);
  assert.equal(http.calls.length, 4);
});

test('transcription creation timeout is ambiguous and not automatically retried', async t => {
  const input = await fixture(t);
  const http = transport({ '/v1/transcriptions': ({ signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('secret echoed by network')), { once: true });
    // Keep the event loop alive, like an actual in-flight socket.
    const timer = setTimeout(() => reject(new Error('test request did not abort')), 1000);
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  }) });
  await assert.rejects(uploadAndTranscribe(input, { ...http, requestTimeoutMs: 10 }), /POST \/transcriptions did not return a usable response/);
  assert.equal(http.calls.filter(call => call.url.endsWith('/transcriptions')).length, 1);
});

for (const status of ['failed', 'unexpected', 'processing']) {
  test(`transcription ${status} exits without creating another job`, async t => {
    const input = await fixture(t);
    const http = transport({ '/v1/transcriptions/txn_test': () => json({ ...result, status, error_message: 'private provider diagnostic' }) });
    const message = status === 'failed' ? /txn_test failed/ : status === 'processing' ? /Transcription timed out/ : /Unexpected transcription/;
    await assert.rejects(uploadAndTranscribe(input, { ...http, pollIntervalMs: 5, pollTimeoutMs: 25 }), message);
    assert.equal(http.calls.filter(call => call.url.endsWith('/transcriptions')).length, 1);
  });
}

test('rejects insecure configuration and invalid input before creating cloud resources', async t => {
  const input = await fixture(t);
  const http = transport();
  for (const patch of [
    { apiBaseUrl: 'http://api.example.test/v1' }, { apiBaseUrl: 'https://api.example.test' },
    { apiKey: '' }, { endUserId: 'eu_replace_me' }, { filePath: join(input.directory, 'missing.wav') },
    { filePath: join(input.directory, 'recording.txt') },
  ]) await assert.rejects(uploadAndTranscribe({ ...input, ...patch }, http));
  await writeFile(input.filePath, '');
  await assert.rejects(uploadAndTranscribe(input, http), /nonempty/);
  assert.equal(http.calls.length, 0);
});

test('standalone CLI runs through a real local HTTP server with .env and JSON output', async t => {
  const input = await fixture(t);
  const calls = [];
  const server = createServer(async (req, res) => {
    const parts = [];
    for await (const part of req) parts.push(part);
    const body = Buffer.concat(parts);
    calls.push({ path: req.url, headers: req.headers, body });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/v1/recordings') { res.statusCode = 201; res.end(JSON.stringify({ id: 'rec_test' })); }
    else if (req.url === '/v1/recordings/rec_test/upload-url') res.end(JSON.stringify({
      upload_url: `http://127.0.0.1:${server.address().port}/audio`, content_type: 'audio/wav',
    }));
    else if (req.url === '/audio') res.end();
    else if (req.url === '/v1/recordings/rec_test/upload-complete') res.end(JSON.stringify(verified));
    else if (req.url === '/v1/transcriptions') { res.statusCode = 201; res.end(JSON.stringify({ id: 'txn_test' })); }
    else if (req.url === '/v1/transcriptions/txn_test') res.end(JSON.stringify(result));
    else { res.statusCode = 404; res.end('{}'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  await copyFile(new URL('./index.mjs', import.meta.url), join(input.directory, 'index.mjs'));
  await writeFile(join(input.directory, '.env'), `BOTA_API_BASE_URL=http://127.0.0.1:${server.address().port}/v1\nBOTA_API_KEY=sk_test_mock_secret\nBOTA_END_USER_ID=eu_test\n`);
  const env = { ...process.env };
  for (const key of ['BOTA_API_BASE_URL', 'BOTA_API_KEY', 'BOTA_END_USER_ID']) delete env[key];
  const child = spawn(process.execPath, ['--env-file=.env', 'index.mjs', 'silence.wav'], { cwd: input.directory, env, windowsHide: true });
  t.after(() => child.kill());
  let stdout = ''; let stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  assert.equal(code, 0, stderr);
  assert.equal(JSON.parse(stdout).text, result.full_text);
  assert.match(stderr, /Recording created: rec_test/);
  assert.doesNotMatch(stderr, /mock_secret|Synthetic test result/);
  assert.equal(calls.length, 6);
  assert.equal(calls.find(call => call.path === '/audio').headers.authorization, undefined);
  assert.deepEqual(calls.find(call => call.path === '/audio').body, audio);
});
