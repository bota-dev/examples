import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { configuration } from '../../server/config.mjs';
import { createStore } from '../../server/store.mjs';
import { createApp } from '../../server/app.mjs';
import { demoFetch } from '../../server/demo.mjs';
import { tokenHash } from '../../server/auth.mjs';
import { createHmac } from 'node:crypto';
import { gzipSync } from 'node:zlib';

async function fixture(run, intercept) {
  const config = configuration({}, { demo: true }); const store = createStore();
  const upstream = demoFetch({ onEvent: event => store.acceptEvent(event) });
  const app = createApp({ config, store, fetchImpl: intercept ? (url, options) => intercept(url, options, upstream) : upstream });
  const server = createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  config.origin = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = async (path, { method = 'GET', body, headers = {} } = {}) => {
    const response = await fetch(config.origin + path, { method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), Origin: config.origin,
        ...(body === undefined || Buffer.isBuffer(body) ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }) });
    const setCookie = response.headers.get('set-cookie'); if (setCookie) cookie = setCookie.split(';')[0];
    return { status: response.status, value: await response.json(), headers: response.headers };
  };
  try { await run({ request, config, store }); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); }
}

test('full synthetic workflow: login, recordings, upload, transcript, summary, Ask, events and logout', async () => fixture(async ({ request }) => {
  assert.equal((await request('/api/recordings')).status, 401);
  assert.equal((await request('/api/login', { method: 'POST', body: { username: 'demo' } })).status, 200);
  const list = await request('/api/recordings'); assert.equal(list.value.data.length, 2);
  const upload = await request('/api/uploads', { method: 'POST', body: Buffer.from('synthetic audio bytes'),
    headers: { 'Content-Type': 'audio/wav', 'X-File-Name': encodeURIComponent('fixture.wav') } });
  assert.equal(upload.status, 200); assert.equal(upload.value.operation.state, 'complete');
  const recordingId = upload.value.recording.id;
  const started = await request(`/api/recordings/${recordingId}/transcriptions`, { method: 'POST', body: {} });
  assert.equal(started.status, 200);
  const transcripts = await request(`/api/recordings/${recordingId}/transcriptions`);
  assert.match(transcripts.value.data[0].full_text, /synthetic/);
  const txn = transcripts.value.data[0].id;
  assert.equal((await request(`/api/transcriptions/${txn}/summaries`, { method: 'POST', body: {} })).status, 200);
  const summaries = await request(`/api/transcriptions/${txn}/summaries`);
  assert.match(summaries.value.data[0].output.overview, /Synthetic/);
  const ask = await request(`/api/recordings/${recordingId}/ask`, { method: 'POST', body: { question: 'What was agreed?' } });
  assert.equal(ask.status, 200); assert.equal(ask.value.operation.state, 'complete'); assert.match(ask.value.answer, /Synthetic/);
  const repeated = await request(`/api/recordings/${recordingId}/ask`, { method: 'POST', body: { question: 'What was agreed?' } });
  assert.equal(repeated.value.operation.id, ask.value.operation.id);
  assert.ok((await request('/api/events')).value.data.length >= 3);
  assert.equal((await request('/api/logout', { method: 'POST' })).status, 200);
  assert.equal((await request('/api/recordings')).status, 401);
}));

test('uncertain HTTP writes expose an owned operation and recovery never repeats the upstream create', async () => {
  let creates = 0;
  await fixture(async ({ request, config }) => {
    await request('/api/login', { method: 'POST', body: { username: 'demo' } });
    const failed = await request('/api/recordings/rec_demo002/transcriptions', { method: 'POST', body: {} });
    assert.equal(failed.status, 502); assert.equal(failed.value.operation.state, 'uncertain');
    assert.equal(failed.value.operation.resource_id, null);
    const id = failed.value.operation.id;
    const recovered = await request(`/api/operations/${id}`);
    assert.equal(recovered.status, 200); assert.equal(recovered.value.operation.id, id);
    assert.equal(recovered.value.operation.state, 'uncertain'); assert.equal(creates, 1);
    const repeated = await request('/api/recordings/rec_demo002/transcriptions', { method: 'POST', body: {} });
    assert.equal(repeated.value.operation.id, id); assert.equal(creates, 1);
    await request('/api/logout', { method: 'POST' });
    config.mode = 'live';
    config.accounts = [{ username: 'other', tokenHash: tokenHash('o'.repeat(43)), principal: {
      username: 'other', accountId: 'other', endUserId: 'eu_other', projectId: 'proj_demo', scopeId: 'other',
    } }];
    await request('/api/login', { method: 'POST', body: { username: 'other', token: 'o'.repeat(43) } });
    const foreign = await request(`/api/operations/${id}`);
    assert.equal(foreign.status, 404); assert.equal(foreign.value.operation, undefined);
  }, (url, options, upstream) => {
    if (options.method === 'POST' && new URL(url).pathname === '/v1/transcriptions') {
      creates++; throw new Error('synthetic connection loss after dispatch');
    }
    return upstream(url, options);
  });
});

test('CSRF, forged scope, unsupported files and private projections are rejected', async () => fixture(async ({ request }) => {
  assert.equal((await request('/api/login', { method: 'POST', body: { username: 'demo' }, headers: { Origin: 'https://foreign.example.test' } })).status, 403);
  await request('/api/login', { method: 'POST', body: { username: 'demo' } });
  assert.equal((await request('/api/recordings?end_user_id=eu_foreign')).status, 400);
  assert.equal((await request('/api/recordings/rec_demo001/transcriptions', { method: 'POST', body: { end_user_id: 'eu_foreign' } })).status, 400);
  assert.equal((await request('/api/uploads', { method: 'POST', body: Buffer.from('x'), headers: { 'Content-Type': 'text/plain', 'X-File-Name': 'x.txt' } })).status, 415);
  const me = await request('/api/me'); assert.deepEqual(me.value.user, { username: 'demo' });
  assert.ok(!JSON.stringify(me.value).includes('sk_test_')); assert.equal(me.headers.get('cache-control'), 'no-store');
}));

test('live-mode application account cannot retrieve another end user or change its binding', async () => fixture(async ({ request, config }) => {
  config.mode = 'live';
  config.accounts = [{ username: 'foreign', tokenHash: tokenHash('t'.repeat(43)), principal: {
    username: 'foreign', accountId: 'foreign', endUserId: 'eu_foreign', projectId: 'proj_demo', scopeId: 'foreign',
  } }];
  assert.equal((await request('/api/login', { method: 'POST', body: { username: 'foreign', token: 't'.repeat(43) } })).status, 200);
  assert.equal((await request('/api/recordings/rec_demo001')).status, 403);
  assert.equal((await request('/api/recordings/rec_demo001/ask', { method: 'POST', body: { question: 'leak?' } })).status, 403);
  assert.deepEqual((await request('/api/operations')).value.data, []);
  assert.deepEqual((await request('/api/events')).value.data, []);
}));

test('HTTP webhook route verifies original bytes and commits dedupe before acknowledgement', async () => fixture(async ({ request, config, store }) => {
  config.webhookSecret = 'synthetic-only-webhook-secret-for-http-tests';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bytes = Buffer.from(JSON.stringify({ id: 'evt_httpfixture', type: 'recording.uploaded',
    created_at: new Date().toISOString(), data: { recording: { id: 'rec_demo001' } } }));
  const signature = 'v1=' + createHmac('sha256', config.webhookSecret).update(timestamp + '.').update(bytes).digest('hex');
  const headers = { 'Content-Type': 'application/json', 'X-Bota-Timestamp': timestamp, 'X-Bota-Signature': signature };
  assert.equal((await request('/webhooks/bota', { method: 'POST', body: bytes, headers })).status, 200);
  assert.ok(store.events().some(event => event.id === 'evt_httpfixture'));
  assert.equal((await request('/webhooks/bota', { method: 'POST', body: bytes, headers })).status, 200);
  assert.equal(store.events().filter(event => event.id === 'evt_httpfixture').length, 1);
  assert.equal((await request('/webhooks/bota', { method: 'POST', body: Buffer.concat([bytes, Buffer.from(' ')]), headers })).status, 401);
  assert.equal((await request('/webhooks/bota', { method: 'POST', body: gzipSync(bytes), headers: { ...headers, 'Content-Encoding': 'gzip' } })).status, 415);
  assert.equal(store.events().filter(event => event.id === 'evt_httpfixture').length, 1);
  await request('/api/login', { method: 'POST', body: { username: 'demo' } });
  assert.equal((await request('/api/uploads', { method: 'POST', body: gzipSync(Buffer.from('audio')), headers: {
    'Content-Type': 'audio/wav', 'X-File-Name': 'encoded.wav', 'Content-Encoding': 'gzip',
  } })).status, 415);
  assert.deepEqual((await request('/api/operations')).value.data, []);
}));
