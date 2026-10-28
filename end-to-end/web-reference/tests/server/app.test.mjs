import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { configuration } from '../../server/config.mjs';
import { createStore } from '../../server/store.mjs';
import { createApp } from '../../server/app.mjs';
import { demoFetch } from '../../server/demo.mjs';
import { tokenHash } from '../../server/auth.mjs';
import { createHash, createHmac } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { AppError } from '../../server/errors.mjs';
import { fileURLToPath } from 'node:url';

async function fixture(run, intercept, options = {}) {
  const config = configuration({}, { demo: true });
  const store = createStore();
  const upstream = demoFetch({ onEvent: (event) => store.acceptEvent(event) });
  const app = createApp({
    config,
    store,
    fetchImpl: intercept ? (url, options) => intercept(url, options, upstream) : upstream,
    ...options,
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  config.origin = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = async (path, { method = 'GET', body, headers = {} } = {}) => {
    const response = await fetch(config.origin + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        Origin: config.origin,
        ...(body === undefined || Buffer.isBuffer(body)
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: response.status, value: await response.json(), headers: response.headers };
  };
  try {
    await run({ request, config, store });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
}

test('served app permits same-origin WebAssembly without general script evaluation', async () =>
  fixture(
    async ({ request }) => {
      const response = await request('/api/me');
      assert.equal(response.status, 200);
      const policy = response.headers.get('content-security-policy');
      assert.ok(policy);
      const directives = new Map(
        policy.split(';').map((entry) => {
          const [name, ...values] = entry.trim().split(/\s+/);
          return [name, values];
        }),
      );
      assert.deepEqual(directives.get('script-src'), ["'self'", "'wasm-unsafe-eval'"]);
      assert.deepEqual(directives.get('default-src'), ["'self'"]);
      assert.deepEqual(directives.get('object-src'), ["'none'"]);
      assert.deepEqual(directives.get('base-uri'), ["'none'"]);
      assert.deepEqual(directives.get('frame-ancestors'), ["'none'"]);
      assert.equal(directives.get('script-src').includes("'unsafe-eval'"), false);
      assert.equal(directives.get('script-src').includes("'unsafe-inline'"), false);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    },
    undefined,
    { staticDirectory: fileURLToPath(new URL('../../web', import.meta.url)) },
  ));

test('full synthetic workflow: login, recordings, upload, transcript, summary, Ask, events and logout', async () =>
  fixture(async ({ request }) => {
    assert.equal((await request('/api/recordings')).status, 401);
    assert.equal(
      (await request('/api/login', { method: 'POST', body: { username: 'demo' } })).status,
      200,
    );
    const list = await request('/api/recordings');
    assert.equal(list.value.data.length, 2);
    const upload = await request('/api/uploads', {
      method: 'POST',
      body: Buffer.from('synthetic audio bytes'),
      headers: { 'Content-Type': 'audio/wav', 'X-File-Name': encodeURIComponent('fixture.wav') },
    });
    assert.equal(upload.status, 200);
    assert.equal(upload.value.operation.state, 'complete');
    const recordingId = upload.value.recording.id;
    const started = await request(`/api/recordings/${recordingId}/transcriptions`, {
      method: 'POST',
      body: {},
    });
    assert.equal(started.status, 200);
    const transcripts = await request(`/api/recordings/${recordingId}/transcriptions`);
    assert.match(transcripts.value.data[0].full_text, /synthetic/);
    const txn = transcripts.value.data[0].id;
    assert.equal(
      (await request(`/api/transcriptions/${txn}/summaries`, { method: 'POST', body: {} })).status,
      200,
    );
    const summaries = await request(`/api/transcriptions/${txn}/summaries`);
    assert.match(summaries.value.data[0].output.overview, /Synthetic/);
    const ask = await request(`/api/recordings/${recordingId}/ask`, {
      method: 'POST',
      body: { question: 'What was agreed?' },
    });
    assert.equal(ask.status, 200);
    assert.equal(ask.value.operation.state, 'complete');
    assert.match(ask.value.answer, /Synthetic/);
    const repeated = await request(`/api/recordings/${recordingId}/ask`, {
      method: 'POST',
      body: { question: 'What was agreed?' },
    });
    assert.equal(repeated.value.operation.id, ask.value.operation.id);
    assert.ok((await request('/api/events')).value.data.length >= 3);
    assert.equal((await request('/api/logout', { method: 'POST' })).status, 200);
    assert.equal((await request('/api/recordings')).status, 401);
  }));

test('uncertain HTTP writes expose an owned operation and recovery never repeats the upstream create', async () => {
  let creates = 0;
  await fixture(
    async ({ request, config }) => {
      await request('/api/login', { method: 'POST', body: { username: 'demo' } });
      const failed = await request('/api/recordings/rec_demo002/transcriptions', {
        method: 'POST',
        body: {},
      });
      assert.equal(failed.status, 502);
      assert.equal(failed.value.operation.state, 'uncertain');
      assert.equal(failed.value.operation.resource_id, null);
      const id = failed.value.operation.id;
      const recovered = await request(`/api/operations/${id}`);
      assert.equal(recovered.status, 200);
      assert.equal(recovered.value.operation.id, id);
      assert.equal(recovered.value.operation.state, 'uncertain');
      assert.equal(creates, 1);
      const repeated = await request('/api/recordings/rec_demo002/transcriptions', {
        method: 'POST',
        body: {},
      });
      assert.equal(repeated.value.operation.id, id);
      assert.equal(creates, 1);
      await request('/api/logout', { method: 'POST' });
      config.mode = 'live';
      config.accounts = [
        {
          username: 'other',
          tokenHash: tokenHash('o'.repeat(43)),
          principal: {
            username: 'other',
            accountId: 'other',
            endUserId: 'eu_other',
            projectId: 'proj_demo',
            scopeId: 'other',
          },
        },
      ];
      await request('/api/login', {
        method: 'POST',
        body: { username: 'other', token: 'o'.repeat(43) },
      });
      const foreign = await request(`/api/operations/${id}`);
      assert.equal(foreign.status, 404);
      assert.equal(foreign.value.operation, undefined);
    },
    (url, options, upstream) => {
      if (options.method === 'POST' && new URL(url).pathname === '/v1/transcriptions') {
        creates++;
        throw new Error('synthetic connection loss after dispatch');
      }
      return upstream(url, options);
    },
  );
});

test('CSRF, forged scope, unsupported files and private projections are rejected', async () =>
  fixture(async ({ request }) => {
    assert.equal(
      (
        await request('/api/login', {
          method: 'POST',
          body: { username: 'demo' },
          headers: { Origin: 'https://foreign.example.test' },
        })
      ).status,
      403,
    );
    await request('/api/login', { method: 'POST', body: { username: 'demo' } });
    assert.equal((await request('/api/recordings?end_user_id=eu_foreign')).status, 400);
    assert.equal(
      (
        await request('/api/recordings/rec_demo001/transcriptions', {
          method: 'POST',
          body: { end_user_id: 'eu_foreign' },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request('/api/uploads', {
          method: 'POST',
          body: Buffer.from('x'),
          headers: { 'Content-Type': 'text/plain', 'X-File-Name': 'x.txt' },
        })
      ).status,
      415,
    );
    const me = await request('/api/me');
    assert.deepEqual(me.value.user, { username: 'demo' });
    assert.ok(!JSON.stringify(me.value).includes('sk_test_'));
    assert.equal(me.headers.get('cache-control'), 'no-store');
  }));

test('live-mode application account cannot retrieve another end user or change its binding', async () =>
  fixture(async ({ request, config }) => {
    config.mode = 'live';
    config.accounts = [
      {
        username: 'foreign',
        tokenHash: tokenHash('t'.repeat(43)),
        principal: {
          username: 'foreign',
          accountId: 'foreign',
          endUserId: 'eu_foreign',
          projectId: 'proj_demo',
          scopeId: 'foreign',
        },
      },
    ];
    assert.equal(
      (
        await request('/api/login', {
          method: 'POST',
          body: { username: 'foreign', token: 't'.repeat(43) },
        })
      ).status,
      200,
    );
    assert.equal((await request('/api/recordings/rec_demo001')).status, 403);
    assert.equal(
      (
        await request('/api/recordings/rec_demo001/ask', {
          method: 'POST',
          body: { question: 'leak?' },
        })
      ).status,
      403,
    );
    assert.deepEqual((await request('/api/operations')).value.data, []);
    assert.deepEqual((await request('/api/events')).value.data, []);
  }));

test('HTTP webhook route verifies original bytes and commits dedupe before acknowledgement', async () =>
  fixture(async ({ request, config, store }) => {
    config.webhookSecret = 'synthetic-only-webhook-secret-for-http-tests';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const bytes = Buffer.from(
      JSON.stringify({
        id: 'evt_httpfixture',
        type: 'recording.uploaded',
        created_at: new Date().toISOString(),
        data: { recording: { id: 'rec_demo001' } },
      }),
    );
    const signature =
      'v1=' +
      createHmac('sha256', config.webhookSecret)
        .update(timestamp + '.')
        .update(bytes)
        .digest('hex');
    const headers = {
      'Content-Type': 'application/json',
      'X-Bota-Timestamp': timestamp,
      'X-Bota-Signature': signature,
    };
    assert.equal(
      (await request('/webhooks/bota', { method: 'POST', body: bytes, headers })).status,
      200,
    );
    assert.ok(store.events().some((event) => event.id === 'evt_httpfixture'));
    assert.equal(
      (await request('/webhooks/bota', { method: 'POST', body: bytes, headers })).status,
      200,
    );
    assert.equal(store.events().filter((event) => event.id === 'evt_httpfixture').length, 1);
    assert.equal(
      (
        await request('/webhooks/bota', {
          method: 'POST',
          body: Buffer.concat([bytes, Buffer.from(' ')]),
          headers,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request('/webhooks/bota', {
          method: 'POST',
          body: gzipSync(bytes),
          headers: { ...headers, 'Content-Encoding': 'gzip' },
        })
      ).status,
      415,
    );
    assert.equal(store.events().filter((event) => event.id === 'evt_httpfixture').length, 1);
    await request('/api/login', { method: 'POST', body: { username: 'demo' } });
    assert.equal(
      (
        await request('/api/uploads', {
          method: 'POST',
          body: gzipSync(Buffer.from('audio')),
          headers: {
            'Content-Type': 'audio/wav',
            'X-File-Name': 'encoded.wav',
            'Content-Encoding': 'gzip',
          },
        })
      ).status,
      415,
    );
    assert.deepEqual((await request('/api/operations')).value.data, []);
  }));

test('processing and canonical Ask coordinate their work and guard only a new durable claim', async () => {
  const held = new Set(),
    claims = [],
    coordinated = [];
  const coordinate = async (kind, source, work) => {
    coordinated.push({ kind, source });
    held.add(kind);
    try {
      return await work();
    } finally {
      held.delete(kind);
    }
  };
  await fixture(
    async ({ request }) => {
      await request('/api/login', { method: 'POST', body: { username: 'demo' } });
      const path = '/api/recordings/rec_demo002/transcriptions';
      const transcription = await request(path, { method: 'POST', body: {} });
      assert.equal(transcription.status, 200);
      const txn = transcription.value.operation.resource_id;
      assert.equal((await request(path, { method: 'POST', body: {} })).status, 200);
      const summaryPath = `/api/transcriptions/${txn}/summaries`;
      assert.equal((await request(summaryPath, { method: 'POST', body: {} })).status, 200);
      assert.equal((await request(summaryPath, { method: 'POST', body: {} })).status, 200);
      const askPath = '/api/recordings/rec_demo002/ask';
      assert.equal(
        (await request(askPath, { method: 'POST', body: { question: '  What was agreed?  ' } }))
          .status,
        200,
      );
      assert.equal(
        (await request(askPath, { method: 'POST', body: { question: 'What was agreed?' } })).status,
        200,
      );
      assert.deepEqual(
        claims.map(({ kind }) => kind),
        ['transcription', 'summary', 'ask'],
      );
      assert.deepEqual(claims[0].details, { recordingId: 'rec_demo002' });
      assert.equal(claims[1].details.transcriptionId, txn);
      assert.equal(claims[2].details.questionFormat, 'trim-v1');
      assert.equal(
        claims[2].anchor,
        `rec_demo002:${createHash('sha256').update('What was agreed?').digest('hex')}`,
      );
      assert.equal(coordinated.length, 6);
      assert.ok(
        coordinated
          .filter(({ kind }) => kind === 'ask')
          .every(({ source }) => source === 'rec_demo002:What was agreed?'),
      );
      assert.equal(held.size, 0);
    },
    undefined,
    {
      beforeClaim(principal, kind, anchor, details) {
        assert.ok(held.has(kind), 'fresh claim must occur inside its coordinator');
        assert.equal(principal.accountId, 'demo');
        claims.push({ kind, anchor, details });
      },
      coordinateTranscription: (id, work) => coordinate('transcription', id, work),
      coordinateSummary: (id, work) => coordinate('summary', id, work),
      coordinateAsk: (id, question, work) => coordinate('ask', `${id}:${question}`, work),
    },
  );
});

test('peer guard refuses a fresh HTTP claim without saving or exposing a peer operation', async () => {
  let guardedStore,
    upstreamWrites = 0,
    guardCalls = 0;
  await fixture(
    async ({ request, store, config }) => {
      guardedStore = store;
      const peer = store.claim(
        { accountId: 'removed-account', scopeId: 'retained-old-scope' },
        'transcription',
        'rec_demo002',
        { recordingId: 'rec_demo002' },
      ).operation;
      store.save({ accountId: 'removed-account', scopeId: 'retained-old-scope' }, peer.id, {
        state: 'uncertain',
        resourceId: 'txn_privatePeer',
      });
      await request('/api/login', { method: 'POST', body: { username: 'demo' } });
      const rejected = await request('/api/recordings/rec_demo002/transcriptions', {
        method: 'POST',
        body: {},
      });
      assert.deepEqual(rejected.value, {
        error: {
          code: 'cross_intent_reconciliation_required',
          message: 'A retained request requires reconciliation before a new action.',
        },
      });
      assert.equal(rejected.status, 409);
      assert.equal(guardCalls, 1);
      assert.equal(upstreamWrites, 0);
      assert.deepEqual(store.list(config.accounts[0].principal), []);
      for (const secret of [peer.id, 'removed-account', 'retained-old-scope', 'txn_privatePeer'])
        assert.ok(!JSON.stringify(rejected.value).includes(secret));
    },
    (url, options, upstream) => {
      if (options.method === 'POST') upstreamWrites += 1;
      return upstream(url, options);
    },
    {
      beforeClaim(principal, kind, anchor, details) {
        guardCalls += 1;
        guardedStore.assertPeerIntent(kind, anchor, {
          principal,
          recordingId: details.recordingId,
        });
      },
    },
  );
});

test('asynchronous claim guards refuse before creating intent or sending an upstream write', async () => {
  for (const rejects of [false, true]) {
    let upstreamWrites = 0;
    await fixture(
      async ({ request, store, config }) => {
        await request('/api/login', { method: 'POST', body: { username: 'demo' } });
        const rejected = await request('/api/recordings/rec_demo002/transcriptions', {
          method: 'POST',
          body: {},
        });
        assert.equal(rejected.status, 500);
        assert.deepEqual(rejected.value, {
          error: { code: 'configuration', message: 'Claim guards must complete synchronously.' },
        });
        assert.equal(upstreamWrites, 0);
        assert.deepEqual(store.list(config.accounts[0].principal), []);
      },
      (url, options, upstream) => {
        if (options.method === 'POST') upstreamWrites += 1;
        return upstream(url, options);
      },
      {
        async beforeClaim() {
          if (rejects) throw new Error('private guard failure');
        },
      },
    );
  }
});

test('retained own processing and Ask recover by GET even when fresh claims would be refused', async () => {
  let guardCalls = 0,
    upstreamWrites = 0;
  await fixture(
    async ({ request, store, config }) => {
      await request('/api/login', { method: 'POST', body: { username: 'demo' } });
      const principal = config.accounts[0].principal;
      const transcriptions = await request('/api/recordings/rec_demo001/transcriptions');
      const txn = transcriptions.value.data[0].id;
      const summaries = await request(`/api/transcriptions/${txn}/summaries`);
      const questionHash = createHash('sha256').update('What was agreed?').digest('hex');
      const legacyHash = createHash('sha256').update(' Legacy question ').digest('hex');
      const cases = [
        {
          kind: 'transcription',
          anchor: 'rec_demo002',
          details: { recordingId: 'rec_demo002' },
          path: '/api/recordings/rec_demo002/transcriptions',
          body: {},
          resourceId: null,
        },
        {
          kind: 'summary',
          anchor: `${txn}:tmpl_general_notes`,
          details: {
            recordingId: 'rec_demo001',
            transcriptionId: txn,
            templateId: 'tmpl_general_notes',
          },
          path: `/api/transcriptions/${txn}/summaries`,
          body: {},
          resourceId: summaries.value.data[0].id,
        },
        {
          kind: 'ask',
          anchor: `rec_demo002:${questionHash}`,
          details: { recordingId: 'rec_demo002', questionHash, questionFormat: 'trim-v1' },
          path: '/api/recordings/rec_demo002/ask',
          body: { question: ' What was agreed? ' },
          resourceId: null,
        },
        {
          kind: 'ask',
          anchor: `rec_demo001:${legacyHash}`,
          details: { recordingId: 'rec_demo001', questionHash: legacyHash },
          path: '/api/recordings/rec_demo001/ask',
          body: { question: ' Legacy question ' },
          resourceId: null,
        },
      ];
      for (const row of cases) {
        const operation = store.claim(principal, row.kind, row.anchor, row.details).operation;
        store.save(principal, operation.id, { state: 'uncertain', resourceId: row.resourceId });
        const recovered = await request(row.path, { method: 'POST', body: row.body });
        assert.equal(recovered.status, 200);
        assert.equal(recovered.value.operation.id, operation.id);
        assert.equal(recovered.value.operation.resource_id, row.resourceId);
        assert.equal(recovered.value.operation.state, row.resourceId ? 'complete' : 'uncertain');
        const refreshed = await request(`/api/operations/${operation.id}`);
        assert.equal(refreshed.status, 200);
        assert.equal(refreshed.value.operation.id, operation.id);
        assert.equal(refreshed.value.operation.resource_id, row.resourceId);
      }
      assert.equal(guardCalls, 0);
      assert.equal(upstreamWrites, 0);
    },
    (url, options, upstream) => {
      if (options.method === 'POST') upstreamWrites += 1;
      return upstream(url, options);
    },
    {
      beforeClaim() {
        guardCalls += 1;
        throw new AppError(
          409,
          'cross_intent_reconciliation_required',
          'Fresh claims are blocked.',
        );
      },
    },
  );
});
