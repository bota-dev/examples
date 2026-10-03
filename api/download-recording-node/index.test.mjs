import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { downloadRecording, main, readConfig } from './index.mjs';

const execute = promisify(execFile);
const env = { BOTA_API_BASE_URL: 'https://api.example.test/v1', BOTA_API_KEY: 'sk_test_localFixture',
  BOTA_PROJECT_ID: 'proj_test', BOTA_RECORDING_ID: 'rec_test', BOTA_END_USER_ID: 'eu_test', OUTPUT_PATH: './recording.bin' };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'bota-download-test-'));
  t.after(async () => {
    assert.equal(dirname(resolve(path)), resolve(tmpdir()));
    assert.ok(basename(path).startsWith('bota-download-test-'));
    await rm(path, { recursive: true, force: true });
  });
  return path;
}

async function fixture(t) {
  const dir = await directory(t);
  const config = readConfig({ ...env, OUTPUT_PATH: join(dir, 'original.bin') });
  const calls = [];
  const state = {
    bytes: Buffer.from('BOTAENC2 opaque stored bytes; not assumed playable'),
    recording: { id: 'rec_test', project_id: 'proj_test', end_user_id: 'eu_test', status: 'uploaded',
      audio_url: 'https://do-not-use.example/private', content_sha256: 'f'.repeat(64), content_sha256_verified_at: null },
    target: { download_url: 'https://storage.example.test/original?signature=private', expires_in: 3600,
      content_type: 'audio/ogg', file_size_bytes: null },
    intercept: undefined,
  };
  const fetchImpl = async (url, init) => {
    url = String(url); calls.push({ url, ...init });
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
    if (init.signal.aborted) throw new Error('private request aborted');
    if (state.intercept) { const result = await state.intercept(url, init); if (result) return result; }
    if (url === `${config.base}/recordings/rec_test`) return Response.json(state.recording);
    if (url === `${config.base}/recordings/rec_test/download-url`) return Response.json(state.target);
    if (url === state.target.download_url) return new Response(state.bytes);
    throw new Error('unexpected request');
  };
  return { config, dir, state, calls, fetchImpl,
    run: options => downloadRecording(config, { fetchImpl, ...options }),
    empty: async () => assert.deepEqual(await readdir(dir), []),
  };
}

test('configuration requires HTTPS, selected identity and bounded inputs before requests', () => {
  assert.equal(readConfig(env).recordingId, 'rec_test');
  for (const change of [
    { BOTA_API_BASE_URL: 'http://127.0.0.1/v1' }, { BOTA_API_BASE_URL: 'https://user:key@api.example/v1' },
    { BOTA_API_BASE_URL: 'https://api.example/v1?key=secret' }, { BOTA_API_BASE_URL: 'https://api.example/v1#secret' },
    { BOTA_API_BASE_URL: 'https://api.example/other' }, { BOTA_API_KEY: 'dtok_device' },
    { BOTA_API_KEY: 'sk_test_replace_me' }, { BOTA_PROJECT_ID: '' }, { BOTA_RECORDING_ID: 'rec_/other' },
    { BOTA_END_USER_ID: 'eu_/other' }, { OUTPUT_PATH: '' }, { OUTPUT_PATH: 'a'.repeat(2049) },
    { OUTPUT_PATH: 'bad\0path' }, { EXPECTED_SHA256: 'not-a-hash' },
  ]) assert.throws(() => readConfig({ ...env, ...change }));
});

test('downloads opaque original bytes, hashes them and separates API and storage credentials', async t => {
  const f = await fixture(t); f.config.expectedHash = sha(f.state.bytes);
  f.state.target.file_size_bytes = String(f.state.bytes.length);
  const result = await f.run();
  assert.deepEqual(await readFile(f.config.outputPath), f.state.bytes);
  assert.deepEqual(result, { recording_id: 'rec_test', bytes_written: f.state.bytes.length,
    sha256: sha(f.state.bytes), expected_sha256_matched: true });
  assert.deepEqual(await readdir(f.dir), ['original.bin']);
  assert.equal(f.calls.length, 3);
  for (const call of f.calls.slice(0, 2)) assert.equal(call.headers.Authorization, `Bearer ${env.BOTA_API_KEY}`);
  assert.equal(f.calls[1].url.endsWith('/download-url'), true); // No format/enhancement query.
  assert.deepEqual(f.calls[2].headers, { 'Accept-Encoding': 'identity' });
  assert.equal(f.calls[2].credentials, 'omit'); assert.equal(f.calls[2].referrerPolicy, 'no-referrer');
  for (const secret of [env.BOTA_API_KEY, 'signature=', f.state.recording.audio_url]) assert.ok(!JSON.stringify(result).includes(secret));
  if (process.platform !== 'win32') assert.equal((await lstat(f.config.outputPath)).mode & 0o777, 0o600);
});

test('missing expected hash is reported as unverified, not server-verified integrity', async t => {
  const f = await fixture(t); const result = await f.run();
  assert.equal(result.expected_sha256_matched, null);
  assert.equal(result.sha256, sha(f.state.bytes));
});

test('preflight refuses wrong recording, project, end user and deleted records', async t => {
  for (const change of [{ id: 'rec_other' }, { project_id: 'proj_other' }, { end_user_id: 'eu_other' }, { deleted_at: '2026-01-01' }]) {
    const f = await fixture(t); Object.assign(f.state.recording, change);
    await assert.rejects(f.run(), /ownership/);
    assert.equal(f.calls.length, 1); await f.empty();
  }
});

test('incomplete, failed, unknown and integrity-failed states never request a URL', async t => {
  for (const status of ['pending', 'streaming', 'failed', 'integrity_failure', 'unknown']) {
    const f = await fixture(t); f.state.recording.status = status;
    await assert.rejects(f.run(), /requires recording status/);
    assert.equal(f.calls.length, 1); await f.empty();
  }
});

test('download descriptor rejects insecure URLs and malformed or oversized metadata', async t => {
  for (const change of [
    { download_url: 'http://127.0.0.1/private' }, { download_url: 'https://user:secret@store.example/x' },
    { download_url: 'https://store.example/x#fragment' }, { expires_in: 0 }, { expires_in: '3600' },
    { content_type: undefined }, { file_size_bytes: '1e3' }, { file_size_bytes: ' 8' },
    { file_size_bytes: '1.5' }, { file_size_bytes: '-1' }, { file_size_bytes: '9007199254740993' },
    { file_size_bytes: 25 * 1024 * 1024 + 1 }, { file_size_bytes: undefined },
  ]) {
    const f = await fixture(t); Object.assign(f.state.target, change);
    await assert.rejects(f.run()); assert.equal(f.calls.length, 2); await f.empty();
  }
});

test('existing destination is rejected before network access and remains unchanged', async t => {
  const f = await fixture(t); await writeFile(f.config.outputPath, 'keep me');
  await assert.rejects(f.run(), /already exists/);
  assert.equal(await readFile(f.config.outputPath, 'utf8'), 'keep me'); assert.equal(f.calls.length, 0);
});

test('publication race never overwrites a file created during download', async t => {
  const f = await fixture(t);
  f.state.intercept = async url => { if (url.startsWith('https://storage.')) await writeFile(f.config.outputPath, 'other process'); };
  await assert.rejects(f.run(), /already exists/);
  assert.equal(await readFile(f.config.outputPath, 'utf8'), 'other process');
  assert.deepEqual(await readdir(f.dir), ['original.bin']);
});

test('API HTTP failure is redacted and response body is cancelled', async t => {
  for (const status of [401, 403, 404, 429, 500]) {
    const f = await fixture(t); let cancelled = false;
    f.state.intercept = async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status });
    await assert.rejects(f.run(), new RegExp(`HTTP ${status}`));
    assert.equal(cancelled, true); assert.equal(f.calls.length, 1); await f.empty();
  }
});

test('invalid and oversized JSON stop before storage access', async t => {
  for (const body of ['not JSON with a private URL', JSON.stringify({ text: 'x'.repeat(256 * 1024) })]) {
    const f = await fixture(t); f.state.intercept = async () => new Response(body);
    await assert.rejects(f.run()); assert.equal(f.calls.length, 1); await f.empty();
  }
});

test('storage HTTP errors, partial responses and HTTP encodings remove temporary bytes', async t => {
  for (const init of [
    { status: 403 }, { status: 404 }, { status: 206 }, { status: 200, headers: { 'content-range': 'bytes 0-1/50' } },
    { status: 200, headers: { 'content-encoding': 'gzip' } },
  ]) {
    const f = await fixture(t); f.state.intercept = async url => url.startsWith('https://storage.') ? new Response('private storage error', init) : undefined;
    await assert.rejects(f.run(), error => !error.message.includes('private storage error'));
    await f.empty(); assert.equal(f.calls.length, 3);
  }
});

test('declared and actual size mismatches never publish', async t => {
  for (const scenario of ['too-short', 'too-long', 'header', 'empty']) {
    const f = await fixture(t);
    if (scenario === 'too-short') f.state.target.file_size_bytes = f.state.bytes.length + 1;
    if (scenario === 'too-long') f.state.target.file_size_bytes = f.state.bytes.length - 1;
    if (scenario === 'empty') f.state.bytes = Buffer.alloc(0);
    if (scenario === 'header') f.state.intercept = async url => url.startsWith('https://storage.') ? new Response(f.state.bytes, { headers: { 'content-length': '100' } }) : undefined;
    await assert.rejects(f.run(), /length/); await f.empty();
  }
});

test('unannounced streamed body cannot exceed the 25 MiB cap', async t => {
  const f = await fixture(t); let chunks = 0; let cancelled = false;
  f.state.intercept = async url => url.startsWith('https://storage.') ? new Response(new ReadableStream({
    pull(controller) { if (chunks++ < 27) controller.enqueue(new Uint8Array(1024 * 1024)); else controller.close(); },
    cancel() { cancelled = true; },
  })) : undefined;
  await assert.rejects(f.run(), /25 MiB/); assert.equal(cancelled, true); await f.empty();
});

test('trusted hash mismatch preserves no partial output', async t => {
  const f = await fixture(t); f.config.expectedHash = '0'.repeat(64);
  await assert.rejects(f.run(), /EXPECTED_SHA256/); await f.empty();
});

test('interrupted body removes a partial file and does not request a retry', async t => {
  const f = await fixture(t); let reads = 0;
  f.state.intercept = async url => url.startsWith('https://storage.') ? new Response(new ReadableStream({
    pull(controller) { if (reads++ === 0) controller.enqueue(new Uint8Array([1, 2])); else controller.error(new Error('secret socket error')); },
  })) : undefined;
  await assert.rejects(f.run(), /Download failed/); await f.empty(); assert.equal(f.calls.length, 3);
});

test('cancellation before start makes no request or file', async t => {
  const f = await fixture(t); const controller = new AbortController(); controller.abort();
  await assert.rejects(f.run({ signal: controller.signal }), /cancelled/);
  assert.equal(f.calls.length, 0); await f.empty();
});

test('total deadline aborts a stalled stream and removes the partial file', async t => {
  const f = await fixture(t); let aborted = false;
  f.state.intercept = async (url, init) => url.startsWith('https://storage.') ? new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
      const keepAlive = setTimeout(() => controller.error(new Error('deadline failed')), 2000);
      init.signal.addEventListener('abort', () => { clearTimeout(keepAlive); aborted = true; controller.error(new Error('aborted')); }, { once: true });
    },
  })) : undefined;
  await assert.rejects(f.run({ totalTimeoutMs: 80 }), /deadline/);
  assert.equal(aborted, true); await f.empty();
});

async function server(t, handler) {
  const instance = createServer(handler);
  await new Promise(resolve => instance.listen(0, '127.0.0.1', resolve));
  t.after(async () => { instance.closeAllConnections(); await new Promise(resolve => instance.close(resolve)); });
  return `http://127.0.0.1:${instance.address().port}`;
}

test('real HTTP transport rejects API and storage redirects without following them', async t => {
  let leaked = 0;
  const trap = await server(t, (req, res) => { leaked++; res.end('not reached'); });
  for (const redirectAt of ['api', 'storage']) {
    const f = await fixture(t);
    const origin = await server(t, (req, res) => {
      if (redirectAt === 'api' || req.url === '/original?signature=private') {
        res.writeHead(302, { location: trap }); res.end(); return;
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(req.url.endsWith('/download-url') ? f.state.target : f.state.recording));
    });
    const transport = (url, init) => { const value = new URL(url); return fetch(origin + value.pathname + value.search, init); };
    await assert.rejects(f.run({ fetchImpl: transport }), /Download failed/); await f.empty();
  }
  assert.equal(leaked, 0);
});

test('real HTTP stalled API body is bounded by the per-request timeout', async t => {
  const f = await fixture(t);
  const origin = await server(t, (req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.write('{'); });
  await assert.rejects(f.run({ fetchImpl: (url, init) => fetch(origin, init), requestTimeoutMs: 60 }), /Download failed/);
  await f.empty();
});

test('standalone child process uses an explicit offline transport and keeps secrets off storage and output', async t => {
  const f = await fixture(t); const requests = [];
  const origin = await server(t, (req, res) => {
    requests.push({ path: req.url, authorization: req.headers.authorization, cookie: req.headers.cookie, referer: req.headers.referer });
    if (req.url.startsWith('/original')) { res.end(f.state.bytes); return; }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(req.url.endsWith('/download-url') ? f.state.target : f.state.recording));
  });
  await copyFile(new URL('./index.mjs', import.meta.url), join(f.dir, 'index.mjs'));
  await writeFile(join(f.dir, '.env'), Object.entries({ ...env, OUTPUT_PATH: f.config.outputPath, EXPECTED_SHA256: sha(f.state.bytes) }).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n'));
  await writeFile(join(f.dir, 'offline.mjs'), `import {main} from './index.mjs';\nprocess.exitCode = await main(process.env, {args:[], fetchImpl:(url, init) => { const target=new URL(url); if (!['api.example.test','storage.example.test'].includes(target.hostname)) throw new Error('offline only'); return fetch(${JSON.stringify(origin)} + target.pathname + target.search, init); }});`);
  const { stdout, stderr } = await execute(process.execPath, ['--env-file=.env', 'offline.mjs'], { cwd: f.dir });
  assert.equal(stderr, ''); assert.equal(JSON.parse(stdout).sha256, sha(f.state.bytes));
  assert.deepEqual(await readFile(f.config.outputPath), f.state.bytes);
  assert.equal(requests.length, 3);
  assert.equal(requests[0].authorization, `Bearer ${env.BOTA_API_KEY}`);
  assert.equal(requests[1].authorization, `Bearer ${env.BOTA_API_KEY}`);
  assert.equal(requests[2].authorization, undefined); assert.equal(requests[2].cookie, undefined); assert.equal(requests[2].referer, undefined);
  assert.ok(!stdout.includes(env.BOTA_API_KEY)); assert.ok(!stdout.includes('signature='));
});

test('CLI help makes no requests; failures emit only safe stderr and no JSON', async t => {
  const lines = []; const errors = []; let called = false;
  assert.equal(await main({}, { args: ['--help'], output: value => lines.push(value), fetchImpl: () => { called = true; } }), 0);
  assert.equal(called, false);
  const f = await fixture(t);
  const code = await main({ ...env, OUTPUT_PATH: f.config.outputPath }, { args: [],
    fetchImpl: async () => { throw new Error('private key sk_test_leaked and signed URL'); },
    output: value => lines.push(value), errorOutput: value => errors.push(value) });
  assert.equal(code, 1); assert.equal(lines.length, 1); assert.equal(errors.length, 1);
  assert.ok(!errors[0].includes('sk_test_leaked')); await f.empty();
});
