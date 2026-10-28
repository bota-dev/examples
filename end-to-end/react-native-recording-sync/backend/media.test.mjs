import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readConfig, SyncService } from './service.mjs';
import { LibraryService } from './library.mjs';
import { createApp } from './server.mjs';
import { createClient } from '../../recordings/backend/http.mjs';
import { createStore as createWebStore } from '../../web-reference/server/store.mjs';

const environment = {
  BOTA_API_BASE_URL: 'https://api.example.test/v1', BOTA_API_KEY: 'sk_test_serverOnly',
  BOTA_PROJECT_ID: 'proj_test', BOTA_END_USER_ID: 'eu_test',
  APP_ACCESS_TOKEN: 'application-only-token-01234567890123456789',
  BOTA_STORAGE_HOSTS: 'storage.example.test',
};
const config = readConfig(environment);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = Buffer.alloc(76);
bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVE', 8);
const input = { name: 'Synthetic.wav', contentType: 'audio/wav', bytes };

function fixture(t, options = {}) {
  const calls = [];
  const state = { pending: false, lose: null, source: 'api_upload', ...options };
  const row = {
    id: 'rec_import', project_id: config.projectId, end_user_id: config.endUserId,
    name: input.name, created_at: '2026-10-20T00:00:00Z', status: 'pending',
    source: 'api_upload', upload_method: 'import', device_id: null, encryption_version: null,
    mime_type: input.contentType, content_sha256: null, content_sha256_verified_at: null,
    file_size_bytes: bytes.length,
  };
  let library;
  const fetchImpl = async (raw, init) => {
    const url = new URL(raw);
    calls.push({ method: init.method, url, headers: init.headers,
      intents: library.store.list(library.principal).map(op => ({ state: op.state, resourceId: op.resourceId })) });
    const phase = url.hostname === 'storage.example.test' ? init.method === 'PUT' ? 'put' : 'get' : url.pathname.split('/').at(-1);
    if (state.lose === phase) throw new Error('PRIVATE_UPSTREAM_DETAIL');
    if (url.hostname === 'storage.example.test') {
      assert.equal(init.headers.Authorization, undefined);
      assert.equal(init.headers.Cookie, undefined);
      assert.equal(init.redirect, 'error');
      if (init.method === 'PUT') { assert.deepEqual(init.body, bytes); return new Response(null, { status: 200 }); }
      if (state.storage) return state.storage(init);
      return new Response(bytes, { headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(bytes.length) } });
    }
    assert.equal(init.headers.Authorization, `Bearer ${config.apiKey}`);
    if (init.method === 'GET' && phase === 'rec_import') return Response.json({ ...row, source: state.source,
      ...(state.ownerChanged ? { end_user_id: 'eu_other' } : {}) });
    if (init.method === 'POST' && phase === 'recordings') return Response.json({ ...row,
      ...(state.badReply ? { end_user_id: 'eu_other' } : {}) }, { status: 201 });
    if (phase === 'upload-url') return Response.json({ upload_url: 'https://storage.example.test/private?signature=secret', content_type: input.contentType });
    if (phase === 'upload-complete') {
      row.content_sha256 = hash(bytes);
      if (state.pending) return Response.json({ error: { code: 'upload_verification_pending' } }, { status: 425 });
      row.status = 'uploaded'; row.content_sha256_verified_at = '2026-10-20T00:01:00Z';
      if (state.loseComplete) throw new Error('PRIVATE_COMPLETION_DETAIL');
      return Response.json(row);
    }
    if (phase === 'download-url') return Response.json({
      download_url: `https://${state.storageHost ?? 'storage.example.test'}/private?signature=secret`,
      content_type: 'audio/wav', expires_in: 300, file_size_bytes: bytes.length,
    });
    throw new Error('UNEXPECTED_UPSTREAM');
  };
  const request = (...args) => createClient(config, { fetchImpl }).request(...args);
  library = new LibraryService(config, { request, fetchImpl });
  const service = new SyncService(config, { database: ':memory:', fetchImpl });
  let server;
  t.after(async () => {
    if (server?.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    library.close(); service.close();
  });
  const start = async () => {
    server = createApp(service, config.appToken, library);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    return (method, path, body, headers = {}, signal) => fetch(origin + path, {
      method, redirect: 'error', signal,
      headers: { Authorization: `Bearer ${config.appToken}`, ...headers },
      ...(body === undefined ? {} : { body }),
    });
  };
  return { calls, state, row, library, start };
}

test('mobile raw import and WAV response use the shared bounded transport and durable intent', async t => {
  const f = fixture(t), send = await f.start();
  const response = await send('POST', '/api/library/uploads', bytes, { 'Content-Type': input.contentType, 'X-File-Name': encodeURIComponent(input.name) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.operation.kind, 'upload'); assert.equal(result.operation.state, 'complete');
  assert.equal(result.recording.id, 'rec_import'); assert.equal(result.recording.upload_verified, true);
  assert.equal(f.calls.filter(call => call.method !== 'GET').length, 4);
  assert.ok(f.calls.filter(call => call.method !== 'GET').every(call => call.intents.length === 1));
  const audio = await send('GET', '/api/library/recordings/rec_import/audio');
  assert.equal(audio.status, 200); assert.equal(audio.headers.get('content-type'), 'audio/wav');
  assert.equal(audio.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await audio.arrayBuffer()), bytes);
  assert.equal(JSON.stringify(result).includes('signature='), false);
  assert.equal((await f.library.upload(input)).operation.state, 'complete');
  assert.equal(f.calls.filter(call => call.method !== 'GET').length, 4);
});

test('425 upload verification reconciles only the known resource by GET', async t => {
  const f = fixture(t, { pending: true });
  const pending = await f.library.upload(input);
  assert.equal(pending.operation.state, 'verification_pending');
  const writes = f.calls.filter(call => call.method !== 'GET').length;
  assert.equal((await f.library.route('GET', `/api/library/operations/${pending.operation.id}`)).operation.state, 'verification_pending');
  f.row.status = 'uploaded'; f.row.content_sha256_verified_at = '2026-10-20T00:01:00Z';
  assert.equal((await f.library.route('GET', `/api/library/operations/${pending.operation.id}`)).operation.state, 'complete');
  assert.equal(f.calls.filter(call => call.method !== 'GET').length, writes);
});

test('unknown create retains operation metadata and never repeats POST or PUT', async t => {
  const f = fixture(t, { lose: 'recordings' }), send = await f.start();
  const response = await send('POST', '/api/library/uploads', bytes, { 'Content-Type': input.contentType, 'X-File-Name': input.name });
  assert.equal(response.status, 502);
  const result = await response.json();
  assert.equal(result.operation.kind, 'upload'); assert.equal(result.operation.state, 'uncertain');
  assert.equal(result.operation.resource_id, null);
  assert.equal(JSON.stringify(result).includes('PRIVATE_'), false);
  assert.equal((await f.library.route('GET', `/api/library/operations/${result.operation.id}`)).operation.state, 'uncertain');
  assert.equal((await f.library.upload(input)).operation.state, 'uncertain');
  assert.equal(f.calls.length, 1);
});

test('lost completion retains its identity and recovers verified state without another completion', async t => {
  const f = fixture(t, { loseComplete: true });
  await assert.rejects(f.library.upload(input), error => error.operation?.resource_id === 'rec_import');
  const op = f.library.store.list(f.library.principal)[0];
  assert.equal((await f.library.route('GET', `/api/library/operations/${op.id}`)).operation.state, 'complete');
  assert.equal(f.calls.filter(call => call.url.pathname.endsWith('/upload-complete')).length, 1);
});

test('foreign create reply keeps the returned ID privately and denies further privileged writes', async t => {
  const f = fixture(t, { badReply: true });
  await assert.rejects(f.library.upload(input), { status: 403 });
  const op = f.library.store.list(f.library.principal)[0];
  assert.equal(op.resourceId, 'rec_import'); assert.equal(op.state, 'uncertain');
  assert.equal(f.calls.length, 1);
});

test('media routes authenticate before reading and reject query/range/unsupported body inputs', async t => {
  const f = fixture(t), send = await f.start();
  for (const headers of [{ Authorization: 'Bearer wrong' }, { Origin: 'https://other.example' }]) {
    assert.equal((await send('POST', '/api/library/uploads', bytes, headers)).status, 401);
  }
  assert.equal((await send('POST', '/api/library/uploads', bytes, { 'Content-Type': 'text/html' })).status, 415);
  assert.equal((await send('POST', '/api/library/uploads', bytes, { 'Content-Type': 'audio/wav', 'Content-Encoding': 'gzip' })).status, 415);
  assert.equal((await send('POST', '/api/library/uploads', bytes, { 'Content-Type': 'audio/wav', 'X-File-Name': '%GG' })).status, 400);
  assert.equal((await send('GET', '/api/library/recordings/rec_import/audio', undefined, { Range: 'bytes=0-5' })).status, 400);
  assert.equal((await send('GET', '/api/library/recordings/rec_import/audio?format=ogg')).status, 400);
  assert.equal(f.calls.length, 0);
});

test('playback refuses device sources, changed owners and a non-allowlisted storage host', async t => {
  const f = fixture(t); await f.library.upload(input);
  f.state.source = 'device';
  await assert.rejects(f.library.route('GET', '/api/library/recordings/rec_import/audio'), { code: 'playback_unavailable' });
  f.state.source = 'api_upload'; f.state.ownerChanged = true;
  await assert.rejects(f.library.route('GET', '/api/library/recordings/rec_import/audio'), { status: 403 });
  f.state.ownerChanged = false; f.state.storageHost = 'attacker.example';
  await assert.rejects(f.library.route('GET', '/api/library/recordings/rec_import/audio'), { code: 'INVALID_STORAGE' });
  assert.equal(f.calls.some(call => call.url.hostname === 'attacker.example'), false);
});

test('missing storage configuration disables only new media actions', async t => {
  const library = new LibraryService(readConfig({ ...environment, BOTA_STORAGE_HOSTS: '' }), { request: async () => { throw new Error('must not call'); } });
  t.after(() => library.close());
  assert.throws(() => library.upload(input), { code: 'media_not_configured' });
  assert.deepEqual(await library.route('GET', '/api/library/operations'), { data: [] });
});

test('disconnecting a mobile audio reader aborts the pending storage read', async t => {
  const f = fixture(t); await f.library.upload(input);
  let started, stopped;
  const storageStarted = new Promise(resolve => { started = resolve; });
  const storageStopped = new Promise(resolve => { stopped = resolve; });
  f.state.storage = init => new Promise((_, reject) => {
    started();
    init.signal.addEventListener('abort', () => { stopped(); reject(new Error('cancelled')); }, { once: true });
  });
  const send = await f.start(), abort = new AbortController();
  const reading = send('GET', '/api/library/recordings/rec_import/audio', undefined, {}, abort.signal);
  const rejected = assert.rejects(reading, { name: 'AbortError' });
  await storageStarted; abort.abort();
  await rejected;
  let timer;
  try {
    await Promise.race([storageStopped, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Storage abort did not settle')), 5000); })]);
  } finally { clearTimeout(timer); }
  assert.equal(f.calls.filter(call => call.method !== 'GET').length, 4);
});

test('retained upload comparison spans adapter scopes without adopting peer IDs', async t => {
  const f = fixture(t, { pending: true }); await f.library.upload(input);
  const details = f.library.store.list(f.library.principal)[0].details;
  const web = createWebStore(':memory:'); t.after(() => web.close());
  const principal = { ...f.library.principal, accountId: 'synthetic-web-account' };
  web.claim(principal, 'upload', 'web-anchor', details);
  assert.throws(() => web.assertPeerUpload(details), { code: 'cross_intent_reconciliation_required' });
  assert.equal(web.assertPeerUpload(details, { principal }), true);
  assert.throws(() => f.library.assertPeerUpload(details), { code: 'cross_intent_reconciliation_required' });
  assert.equal(web.assertPeerUpload({ ...details, digest: 'b'.repeat(64) }), true);
  assert.equal(f.library.assertPeerUpload({ ...details, endUserId: 'eu_other' }), true);
  assert.equal(f.library.store.list(f.library.principal).length, 1);
});
