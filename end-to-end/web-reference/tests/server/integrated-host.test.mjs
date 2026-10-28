import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createIntegratedServer } from '../../../recordings/backend/server.mjs';
import { readConfig, SyncService } from '../../../react-native-recording-sync/backend/service.mjs';
import { LibraryService } from '../../../react-native-recording-sync/backend/library.mjs';
import { configuration } from '../../server/config.mjs';
import { tokenHash } from '../../server/auth.mjs';
import { createStore } from '../../server/store.mjs';
import { demoFetch } from '../../server/demo.mjs';

const webToken = 'synthetic-web-application-token-01234567890123456789';
const mobileToken = 'synthetic-mobile-application-token-01234567890123456789';
const recordingId = 'rec_demo002';
const transcriptionId = 'txn_demo11';
const question = 'What are the next steps?';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const writes = (calls) => calls.filter((call) => call.method === 'POST');
const page = (data = []) => ({ data, has_more: false, next_cursor: null });

// Real HTTP/cookie/Bearer adapters and real SQLite journals. All upstream calls
// terminate in synthetic fixtures; this proves no live API or device result.
async function fixture(t, intercept = (_call, next) => next()) {
  const web = configuration({}, { demo: true });
  web.mode = 'live';
  web.accounts[0].tokenHash = tokenHash(webToken);
  web.webhookSecret = 'synthetic-integrated-webhook-secret';
  const mobile = readConfig({
    BOTA_API_BASE_URL: web.apiBase,
    BOTA_API_KEY: web.apiKey,
    BOTA_PROJECT_ID: web.projectId,
    BOTA_END_USER_ID: 'eu_demo',
    BOTA_DEVICE_ID: 'dev_demo',
    APP_ACCESS_TOKEN: mobileToken,
    BOTA_STORAGE_HOSTS: 'storage.example.test',
  });
  const calls = [],
    upstream = demoFetch();
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname.replace(/^\/v1/, '');
    const call = { path, method: options.method ?? 'GET' };
    calls.push(call);
    const next = () =>
      path === '/devices/dev_demo'
        ? Response.json({
            id: 'dev_demo',
            project_id: 'proj_demo',
            end_user_id: 'eu_demo',
            status: 'bound',
            binding_generation: 3,
            serial_number: 'SYNTHETIC',
            deleted_at: null,
          })
        : upstream(url, options);
    return intercept(call, next);
  };
  const store = createStore();
  const service = new SyncService(mobile, { database: ':memory:', fetchImpl });
  const library = new LibraryService(mobile, {
    fetchImpl,
    request: (method, path, body) => service.upstream(path, method, body),
  });
  const { server } = createIntegratedServer({
    config: { web, mobile },
    store,
    service,
    library,
    fetchImpl,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  web.origin = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = async (path, { as = 'web', method = 'GET', body, bytes, headers = {} } = {}) => {
    const response = await fetch(web.origin + path, {
      method,
      headers: {
        ...(as === 'web'
          ? { Cookie: cookie, Origin: web.origin }
          : as === 'mobile'
            ? { Authorization: `Bearer ${mobileToken}` }
            : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined && bytes === undefined ? {} : { body: bytes ?? JSON.stringify(body) }),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: response.status, value: await response.json() };
  };
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    library.close();
    service.close();
    store.close();
  });
  assert.equal(
    (await request('/api/login', { method: 'POST', body: { username: 'demo', token: webToken } }))
      .status,
    200,
  );
  return {
    web,
    mobile,
    store,
    service,
    library,
    server,
    calls,
    request,
    get cookie() {
      return cookie;
    },
    principal: web.accounts[0].principal,
  };
}

test('one URL keeps distinct cookie/native DTOs and Bearer library results', async (t) => {
  const f = await fixture(t);
  const web = await f.request('/api/recordings');
  assert.equal(web.status, 200);
  assert.equal(web.value.data.length, 2);
  const native = await f.request('/api/recordings', {
    as: 'mobile',
    headers: { 'X-Bota-Binding-Generation': '3' },
  });
  assert.deepEqual(native, { status: 200, value: { recordings: [] } });
  const library = await f.request('/api/library/recordings', { as: 'mobile' });
  assert.equal(library.status, 200);
  assert.equal(library.value.data.length, 2);
  assert.equal(f.server.requestTimeout, 30_000);
  assert.equal(f.server.headersTimeout, 10_000);
});

for (const peer of ['web', 'mobile'])
  for (const state of ['uncertain', 'complete'])
    test(`${peer} retained ${state} upload refuses a fresh claim from the other adapter`, async (t) => {
      const f = await fixture(t);
      const bytes = Buffer.from('Synthetic ordinary import');
      const details = {
        name: 'Synthetic.wav',
        contentType: 'audio/wav',
        size: bytes.length,
        digest: hash(bytes),
        ...(peer === 'web'
          ? { ...f.principal, accountId: 'removed-account', scopeId: 'historical-scope' }
          : f.library.principal),
      };
      const anchor = hash(
        JSON.stringify({
          accountId: details.accountId,
          name: details.name,
          contentType: details.contentType,
          size: details.size,
          digest: details.digest,
        }),
      );
      const owner =
        peer === 'web'
          ? { ...f.principal, accountId: details.accountId, scopeId: details.scopeId }
          : f.library.principal;
      const store = peer === 'web' ? f.store : f.library.store;
      const op = store.claim(owner, 'upload', anchor, details).operation;
      store.save(owner, op.id, {
        state,
        ...(state === 'complete' ? { resourceId: recordingId } : {}),
      });
      const result = await f.request(peer === 'web' ? '/api/library/uploads' : '/api/uploads', {
        as: peer === 'web' ? 'mobile' : 'web',
        method: 'POST',
        bytes,
        headers: {
          'Content-Type': details.contentType,
          'X-File-Name': encodeURIComponent(details.name),
        },
      });
      assert.equal(result.status, 409);
      assert.equal(result.value.error.code, 'cross_intent_reconciliation_required');
      assert.equal(result.value.operation, undefined);
      assert.equal(JSON.stringify(result).includes(op.id), false);
      assert.equal(f.calls.length, 0);
      assert.equal(
        (peer === 'web' ? f.library.store.list(f.library.principal) : f.store.list(f.principal))
          .length,
        0,
      );
      if (peer === 'mobile' && state === 'uncertain') {
        const recovery = await f.request(`/api/library/operations/${op.id}`, { as: 'mobile' });
        assert.equal(recovery.status, 200);
        assert.equal(recovery.value.operation.state, 'uncertain');
        assert.equal(f.calls.length, 0);
      }
    });

test('mixed/wrong credentials and mobile Origin never fall back or call upstream', async (t) => {
  const f = await fixture(t);
  for (const headers of [
    { Cookie: f.cookie, Authorization: `Bearer ${mobileToken}` },
    { Authorization: 'Bearer incorrect' },
    { Authorization: `Bearer ${mobileToken}`, Origin: f.web.origin },
  ]) {
    const result = await f.request('/api/recordings', { as: 'none', headers });
    assert.equal(result.status, 401);
    assert.equal(result.value.operation, undefined);
  }
  assert.equal((await f.request('/api/library/recordings')).status, 401);
  assert.equal(f.calls.length, 0);
});

test('dispatch preserves body/query/binding checks before any upstream call', async (t) => {
  const f = await fixture(t);
  for (const [path, options, status] of [
    ['/api/library/recordings?cursor=x&cursor=y', { as: 'mobile' }, 400],
    ['/api/library/recordings/%72ec_demo002', { as: 'mobile' }, 404],
    ['/api/recordings?cursor=x', { as: 'mobile' }, 404],
    ['/api/recordings', { as: 'mobile', headers: { 'X-Bota-Binding-Generation': '0' } }, 400],
    [
      `/api/recordings/${recordingId}/transcriptions`,
      { method: 'POST', body: {}, headers: { Origin: 'http://elsewhere.invalid' } },
      403,
    ],
    [
      `/api/library/recordings/${recordingId}/transcriptions`,
      { as: 'mobile', method: 'POST', body: { extra: 'x'.repeat(33 * 1024) } },
      413,
    ],
    [
      `/api/recordings/${recordingId}/transcriptions`,
      { method: 'POST', body: { extra: 'x'.repeat(65 * 1024) } },
      413,
    ],
  ])
    assert.equal((await f.request(path, options)).status, status, path);
  assert.equal(f.calls.length, 0);
});

test('duplicate Authorization headers refuse the first valid credential', async (t) => {
  const f = await fixture(t);
  const result = await new Promise((resolve, reject) => {
    const request = httpRequest(
      f.web.origin + '/api/library/recordings',
      {
        headers: { Authorization: [`Bearer ${mobileToken}`, 'Bearer incorrect'] },
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            value: JSON.parse(Buffer.concat(chunks).toString()),
          }),
        );
        response.on('error', reject);
      },
    );
    request.on('error', reject);
    request.end();
  });
  assert.equal(result.status, 401);
  assert.equal(result.value.operation, undefined);
  assert.equal(f.calls.length, 0);
});

test('signed webhook still verifies raw bytes and deduplicates before acknowledgement', async (t) => {
  const f = await fixture(t);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bytes = Buffer.from(
    JSON.stringify({
      id: 'evt_integrated',
      type: 'recording.uploaded',
      created_at: new Date().toISOString(),
      data: { recording: { id: recordingId } },
    }),
  );
  const headers = {
    'Content-Type': 'application/json',
    'X-Bota-Timestamp': timestamp,
    'X-Bota-Signature':
      'v1=' +
      createHmac('sha256', f.web.webhookSecret)
        .update(timestamp + '.')
        .update(bytes)
        .digest('hex'),
  };
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await f.request('/webhooks/bota', { as: 'none', method: 'POST', bytes, headers })).status,
      200,
    );
  assert.equal(f.store.events().filter((event) => event.id === 'evt_integrated').length, 1);
  assert.equal(
    (
      await f.request('/webhooks/bota', {
        as: 'none',
        method: 'POST',
        bytes: Buffer.concat([bytes, Buffer.from(' ')]),
        headers,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.request('/webhooks/bota', {
        as: 'none',
        method: 'POST',
        bytes: Buffer.alloc(1024 * 1024 + 1),
        headers,
      })
    ).status,
    413,
  );
  assert.equal(writes(f.calls).length, 0);
});

test('raw audio import keeps the original byte upload path and size limit', async (t) => {
  const f = await fixture(t);
  const headers = { 'Content-Type': 'audio/wav', 'X-File-Name': 'synthetic.wav' };
  const result = await f.request('/api/uploads', {
    method: 'POST',
    bytes: Buffer.from('audio'),
    headers,
  });
  assert.equal(result.status, 200);
  assert.equal(result.value.operation.state, 'complete');
  const before = writes(f.calls).length;
  assert.equal(
    (
      await f.request('/api/uploads', {
        method: 'POST',
        bytes: Buffer.alloc(25 * 1024 * 1024 + 1),
        headers,
      })
    ).status,
    413,
  );
  assert.equal(writes(f.calls).length, before);
});

const cases = [
  [
    'transcription',
    recordingId,
    { recordingId },
    `/api/recordings/${recordingId}/transcriptions`,
    `/api/library/recordings/${recordingId}/transcriptions`,
    {},
  ],
  [
    'summary',
    `${transcriptionId}:tmpl_general_notes`,
    { recordingId: 'rec_demo001', transcriptionId, templateId: 'tmpl_general_notes' },
    `/api/transcriptions/${transcriptionId}/summaries`,
    `/api/library/transcriptions/${transcriptionId}/summaries`,
    {},
  ],
  [
    'ask',
    `${recordingId}:${hash(question)}`,
    { recordingId, questionHash: hash(question), questionFormat: 'trim-v1' },
    `/api/recordings/${recordingId}/ask`,
    `/api/library/recordings/${recordingId}/ask`,
    { question },
  ],
];

for (const [kind, anchor, details, webPath, mobilePath, body] of cases) {
  test(`Web ${kind} refuses a retained mobile intent without peer metadata`, async (t) => {
    const f = await fixture(t);
    const claim = f.library.store.claim(f.library.principal, kind, anchor, details);
    f.library.store.save(f.library.principal, claim.operation.id, { state: 'uncertain' });
    const result = await f.request(webPath, { method: 'POST', body });
    assert.equal(result.status, 409);
    assert.equal(result.value.error.code, 'cross_intent_reconciliation_required');
    assert.equal(result.value.operation, undefined);
    assert.ok(!JSON.stringify(result).includes(claim.operation.id));
    assert.equal(writes(f.calls).length, 0);
  });
  test(`Mobile ${kind} refuses a retained removed-account Web intent`, async (t) => {
    const f = await fixture(t);
    const peer = {
      ...f.principal,
      accountId: 'removed-private-account',
      scopeId: 'old-private-scope',
    };
    const claim = f.store.claim(peer, kind, anchor, details);
    f.store.save(peer, claim.operation.id, { state: 'uncertain' });
    const result = await f.request(mobilePath, { as: 'mobile', method: 'POST', body });
    assert.equal(result.status, 409);
    assert.equal(result.value.operation, undefined);
    for (const value of [peer.accountId, peer.scopeId, claim.operation.id])
      assert.ok(!JSON.stringify(result).includes(value));
    assert.equal(writes(f.calls).length, 0);
  });
}

test('legacy peer Ask blocks a different canonical question', async (t) => {
  const f = await fixture(t);
  f.store.claim(
    { ...f.principal, accountId: 'removed' },
    'ask',
    `${recordingId}:${hash(' old ')}`,
    { recordingId, questionHash: hash(' old ') },
  );
  assert.equal(
    (
      await f.request(`/api/library/recordings/${recordingId}/ask`, {
        as: 'mobile',
        method: 'POST',
        body: { question },
      })
    ).status,
    409,
  );
  assert.equal(writes(f.calls).length, 0);
});

test('own known/unknown recovery is still GET-only while a peer intent exists', async (t) => {
  const f = await fixture(t);
  const own = f.store.claim(f.principal, 'transcription', recordingId, { recordingId });
  f.store.save(f.principal, own.operation.id, { state: 'uncertain' });
  f.library.store.claim(f.library.principal, 'transcription', recordingId, { recordingId });
  const result = await f.request(`/api/recordings/${recordingId}/transcriptions`, {
    method: 'POST',
    body: {},
  });
  assert.equal(result.status, 200);
  assert.equal(result.value.operation.id, own.operation.id);
  assert.equal(result.value.operation.state, 'uncertain');
  assert.equal((await f.request(`/api/operations/${own.operation.id}`)).status, 200);
  assert.equal(writes(f.calls).length, 0);
});

for (const [state, id] of [
  ['uncertain', null],
  ['known', 'txn_private'],
]) {
  test(`Web fresh transcription respects native ${state} state without exposing its ID`, async (t) => {
    const f = await fixture(t);
    f.service.db
      .prepare(
        `INSERT INTO captures(capture_key,generation,identity,recording_id,
      transcription_state,transcription_id) VALUES('synthetic',3,'{}',?,?,?)`,
      )
      .run(recordingId, state, id);
    const result = await f.request(`/api/recordings/${recordingId}/transcriptions`, {
      method: 'POST',
      body: {},
    });
    assert.equal(result.status, 409);
    assert.equal(result.value.error.code, 'cross_intent_reconciliation_required');
    assert.equal(result.value.operation, undefined);
    assert.ok(!JSON.stringify(result).includes('txn_private'));
    assert.equal(writes(f.calls).length, 0);
  });
}

test('native creation guard refuses either cloud journal without peer identity', async (t) => {
  const f = await fixture(t);
  const claim = f.store.claim(f.principal, 'transcription', recordingId, { recordingId });
  assert.throws(
    () => f.service.beforeTranscriptionCreate(recordingId),
    (error) =>
      error.status === 409 && !error.operation && !error.message.includes(claim.operation.id),
  );
  assert.equal(writes(f.calls).length, 0);
});

for (const [kind, , , webPath, mobilePath, body] of cases) {
  test(`overlapping Web/mobile ${kind} shares one lock`, async (t) => {
    let enter, release;
    const entered = new Promise((resolve) => {
      enter = resolve;
    });
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    let held = false;
    const f = await fixture(t, async (call, next) => {
      const path =
        kind === 'summary' ? `/transcriptions/${transcriptionId}` : `/recordings/${recordingId}`;
      if (!held && call.path === path) {
        held = true;
        enter();
        await blocked;
      }
      if (kind === 'summary' && call.path === '/summaries' && call.method === 'GET')
        return Response.json(page());
      return next();
    });
    const first = f.request(webPath, { method: 'POST', body });
    try {
      await entered;
      const second = await f.request(mobilePath, {
        as: 'mobile',
        method: 'POST',
        body: kind === 'ask' ? { question: `  ${question}  ` } : body,
      });
      assert.equal(second.status, 409);
      assert.equal(second.value.error.code, 'operation_in_progress');
    } finally {
      release();
    }
    assert.equal((await first).status, 200);
    assert.equal(
      writes(f.calls).filter(
        (call) =>
          call.path ===
          (kind === 'transcription'
            ? '/transcriptions'
            : kind === 'summary'
              ? '/summaries'
              : '/ask/sessions'),
      ).length,
      1,
    );
  });
}

test('native recording lock serializes both cloud adapters and releases after failure', async (t) => {
  const f = await fixture(t);
  let entered, release;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const native = f.service.exclusive(`recording:${recordingId}`, async () => {
    entered();
    await held;
  });
  await ready;
  try {
    assert.equal(
      (
        await f.request(`/api/recordings/${recordingId}/transcriptions`, {
          method: 'POST',
          body: {},
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.request(`/api/library/recordings/${recordingId}/transcriptions`, {
          as: 'mobile',
          method: 'POST',
          body: {},
        })
      ).status,
      409,
    );
    assert.equal(writes(f.calls).length, 0);
  } finally {
    release();
    await native;
  }
  assert.equal(
    (await f.request(`/api/recordings/${recordingId}/transcriptions`, { method: 'POST', body: {} }))
      .status,
    200,
  );
});
