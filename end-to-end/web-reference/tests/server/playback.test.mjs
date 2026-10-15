import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createClient } from '../../server/client.mjs';
import { playbackAudio } from '../../server/features/playback.mjs';
import { syntheticPlaybackAudio, demoFetch } from '../../server/demo.mjs';
import { configuration } from '../../server/config.mjs';
import { createApp } from '../../server/app.mjs';
import { createStore } from '../../server/store.mjs';

const bytes = syntheticPlaybackAudio();
const principal = { projectId: 'proj_a', endUserId: 'eu_a' };
const row = () => ({
  id: 'rec_a',
  project_id: 'proj_a',
  end_user_id: 'eu_a',
  source: 'api_upload',
  upload_method: 'import',
  device_id: null,
  encryption_version: null,
  status: 'uploaded',
  created_at: '2026-10-15T00:00:00Z',
  mime_type: 'audio/wav',
  content_sha256: 'a'.repeat(64),
  content_sha256_verified_at: '2026-10-15T00:01:00Z',
  file_size_bytes: bytes.length,
});
const target = () => ({
  download_url: 'https://storage.example.test/audio?signature=private',
  expires_in: 3600,
  content_type: 'audio/wav',
  file_size_bytes: bytes.length,
});
const json = (value) => Response.json(value);
function fixture({ before = {}, after = {}, descriptor = {}, storage, signal, deadline } = {}) {
  const calls = [];
  let reads = 0;
  const ctx = {
    principal,
    ...createClient(
      {
        apiBase: 'https://api.example.test/v1',
        apiKey: 'sk_test_private',
        storageHosts: ['storage.example.test'],
      },
      {
        signal,
        deadline,
        fetchImpl: async (raw, options) => {
          const url = new URL(raw);
          calls.push({ url, options });
          if (url.pathname.endsWith('/download-url')) return json({ ...target(), ...descriptor });
          if (url.hostname === 'storage.example.test')
            return storage
              ? storage(options)
              : new Response(bytes, {
                  headers: {
                    'Content-Type': 'audio/wav',
                    'Content-Length': String(bytes.length),
                  },
                });
          reads++;
          return json({ ...row(), ...before, ...(reads > 1 ? after : {}) });
        },
      },
    ),
  };
  return { calls, run: () => playbackAudio(ctx, 'rec_a') };
}

test('playback uses fixed public WAV export, credential-free storage and final ownership read', async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), bytes);
  assert.equal(f.calls.length, 4);
  assert.equal(
    f.calls[1].url.href,
    'https://api.example.test/v1/recordings/rec_a/download-url?format=wav&use_enhanced=false',
  );
  const storage = f.calls[2].options;
  assert.deepEqual(storage.headers, { Accept: 'audio/wav', 'Accept-Encoding': 'identity' });
  assert.equal(storage.method, 'GET');
  assert.equal(storage.redirect, 'error');
  assert.equal(storage.credentials, 'omit');
  assert.equal(storage.referrerPolicy, 'no-referrer');
  assert.equal(f.calls[3].url.pathname, '/v1/recordings/rec_a');
  assert.ok(f.calls.every(({ options }) => options.method === 'GET'));
});

test('playback refuses foreign ownership, deleted, encrypted, unverified and unsupported sources before export', async () => {
  for (const before of [
    { id: 'rec_other' },
    { project_id: 'proj_other' },
    { end_user_id: 'eu_other' },
    { deleted_at: '2026-10-15T00:02:00Z' },
    { source: 'device' },
    { source: 'app_import' },
    { upload_method: 'ble' },
    { device_id: 'dev_a' },
    { device_id: undefined },
    { encryption_version: 1 },
    { encryption_version: 2 },
    { encryption_version: '0' },
    { encryption_version: undefined },
    { encryption_version: -1 },
    { encryption_version: false },
    { status: 'pending' },
    { status: 'streaming' },
    { status: 'integrity_failure' },
    { content_sha256: null },
    { content_sha256_verified_at: null },
    { mime_type: 'application/octet-stream' },
    { upload_contract: 'byo_v1' },
  ]) {
    const f = fixture({ before });
    await assert.rejects(f.run());
    assert.equal(f.calls.length, 1, JSON.stringify(before));
  }
});

test('fresh owner/source change withholds audio already fetched', async () => {
  for (const after of [
    { project_id: 'proj_other' },
    { end_user_id: 'eu_other' },
    { deleted_at: '2026-10-15T00:02:00Z' },
    { source: 'device' },
    { encryption_version: 1 },
    { content_sha256: 'b'.repeat(64) },
    { content_sha256_verified_at: '2026-10-15T00:02:00Z' },
    { mime_type: 'audio/mpeg' },
    { s3_key: 'a-different-private-object' },
    { file_size_bytes: bytes.length + 1 },
    { upload_contract: 'legacy_v1' },
  ]) {
    const f = fixture({ after });
    await assert.rejects(f.run());
    assert.equal(f.calls.length, 4);
  }
  assert.deepEqual(
    await fixture({ after: { status: 'completed', name: 'A new title' } }).run(),
    bytes,
  );
});

test('export descriptor and storage URL validation never permit unsupported requests', async () => {
  for (const descriptor of [
    { expires_in: 0 },
    { expires_in: '3600' },
    { expires_in: 3601 },
    { content_type: 'audio/mpeg' },
    { file_size_bytes: undefined },
    { file_size_bytes: -1 },
    { file_size_bytes: '03' },
    { file_size_bytes: 26 * 1024 * 1024 },
    { download_url: 'http://storage.example.test/audio' },
    { download_url: 'https://storage.example.test:444/audio' },
    { download_url: 'https://storage.example.test.evil.test/audio' },
    { download_url: 'https://user:password@storage.example.test/audio' },
    { download_url: 'https://storage.example.test/audio#private' },
  ]) {
    const f = fixture({ descriptor });
    await assert.rejects(f.run());
    assert.equal(f.calls.length, 2);
  }
  assert.deepEqual(
    await fixture({ descriptor: { file_size_bytes: String(bytes.length) } }).run(),
    bytes,
  );
  assert.deepEqual(await fixture({ descriptor: { file_size_bytes: null } }).run(), bytes);
});

test('storage rejects expiry, redirects, partial, encoded, wrong-type, empty and incomplete responses', async () => {
  for (const [body, init] of [
    [null, { status: 403 }],
    [null, { status: 404 }],
    [null, { status: 302 }],
    [bytes, { status: 206 }],
    [bytes, { headers: { 'Content-Type': 'audio/wav', 'Content-Range': 'bytes 0-10/100' } }],
    [bytes, { headers: { 'Content-Type': 'audio/wav', 'Content-Encoding': 'gzip' } }],
    [bytes, { headers: { 'Content-Type': 'application/octet-stream' } }],
    [new Uint8Array(), { headers: { 'Content-Type': 'audio/wav' } }],
    [bytes.subarray(0, bytes.length - 1), { headers: { 'Content-Type': 'audio/wav' } }],
    [
      bytes,
      { headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(bytes.length + 1) } },
    ],
    [bytes, { headers: { 'Content-Type': 'audio/wav', 'Content-Length': '99999999999999999999' } }],
  ]) {
    const f = fixture({ storage: () => new Response(body, init) });
    await assert.rejects(f.run(), (error) => {
      assert.doesNotMatch(error.message, /signature|private|https:/);
      if ([403, 404].includes(init.status)) assert.equal(error.code, 'STORAGE_EXPIRED');
      return true;
    });
    assert.equal(f.calls.length, 3);
  }
});

test('actual storage bytes enforce the size limit even without advertised lengths', async () => {
  const f = fixture({
    descriptor: { file_size_bytes: null },
    storage: () =>
      new Response(new Uint8Array(25 * 1024 * 1024 + 1), {
        headers: { 'Content-Type': 'audio/wav' },
      }),
  });
  await assert.rejects(f.run(), { code: 'RESPONSE_LIMIT' });
});

test('WAV signature rejects nonaudio or corrupt container but accepts bounded FFmpeg pipe sentinel', async () => {
  for (const corrupt of [
    Buffer.from('not a WAV'),
    Buffer.alloc(bytes.length),
    (() => {
      const bad = Buffer.from(bytes);
      bad.writeUInt32LE(3, 4);
      return bad;
    })(),
  ]) {
    await assert.rejects(
      fixture({
        descriptor: { file_size_bytes: null },
        storage: () => new Response(corrupt, { headers: { 'Content-Type': 'audio/wav' } }),
      }).run(),
      (error) => ['INVALID_STORAGE', 'invalid_playback'].includes(error.code),
    );
  }
  const pipe = Buffer.from(bytes);
  pipe.writeUInt32LE(0xffffffff, 4);
  assert.deepEqual(
    await fixture({
      storage: () =>
        new Response(pipe, {
          headers: { 'Content-Type': 'audio/wav' },
        }),
    }).run(),
    pipe,
  );
});

test('WAV signatures compare exact bytes rather than masking the high bit', async () => {
  for (const offsets of [[0], [8], [0, 8]]) {
    const corrupt = Buffer.from(bytes);
    for (const offset of offsets) {
      for (let index = offset; index < offset + 4; index++) corrupt[index] |= 0x80;
    }
    await assert.rejects(
      fixture({
        storage: () =>
          new Response(corrupt, {
            headers: { 'Content-Type': 'audio/wav' },
          }),
      }).run(),
      { code: 'invalid_playback' },
    );
  }
});

test('network failures are bounded and do not retry or expose signed URLs', async () => {
  const f = fixture({
    storage: () => {
      throw new Error('https://storage.example.test/private-signature');
    },
  });
  await assert.rejects(f.run(), {
    code: 'STORAGE_FAILURE',
    message: 'Audio could not be loaded. No automatic retry was made.',
  });
  assert.equal(f.calls.length, 3);
});

test('abort during a storage read cancels the body without another request', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const f = fixture({
    signal: controller.signal,
    descriptor: { file_size_bytes: null },
    storage: () =>
      new Response(
        new ReadableStream({
          pull(stream) {
            stream.enqueue(bytes);
            controller.abort();
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { 'Content-Type': 'audio/wav' } },
      ),
  });
  await assert.rejects(f.run(), { code: 'STORAGE_FAILURE' });
  assert.equal(cancelled, true);
  assert.equal(f.calls.length, 3);
});

test('an exhausted operation deadline refuses before any upstream request', async () => {
  let calls = 0;
  const client = createClient(
    { apiBase: 'https://api.example.test/v1', apiKey: 'private' },
    {
      deadline: performance.now() - 1,
      fetchImpl: async () => {
        calls++;
        throw new Error('must not fetch');
      },
    },
  );
  await assert.rejects(playbackAudio({ principal, ...client }, 'rec_a'), { code: 'TIMEOUT' });
  assert.equal(calls, 0);
});

test('operation deadline aborts an actual fetch body stalled after its first bytes', async () => {
  let arrived = false;
  let closed;
  const disconnected = new Promise((resolve) => {
    closed = resolve;
  });
  const server = createServer((_request, response) => {
    arrived = true;
    response.once('close', closed);
    response.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': String(bytes.length),
    });
    response.write(bytes.subarray(0, 64));
    // Deliberately never finish. Actual fetch must cancel the in-progress body.
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const f = fixture({
      deadline: performance.now() + 500,
      storage: (options) => fetch(`http://127.0.0.1:${server.address().port}/stalled`, options),
    });
    await assert.rejects(f.run(), { code: 'STORAGE_FAILURE' });
    assert.equal(arrived, true);
    assert.equal(f.calls.length, 3);
    await disconnected;
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

async function httpFixture(run, { intercept, now } = {}) {
  const config = configuration({}, { demo: true });
  const store = createStore();
  const upstream = demoFetch();
  const app = createApp({
    config,
    store,
    now,
    staticDirectory: '.',
    fetchImpl: intercept ? (url, options) => intercept(url, options, upstream) : upstream,
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  config.origin = `http://127.0.0.1:${server.address().port}`;
  const call = (path, options = {}) =>
    fetch(config.origin + path, {
      ...options,
      headers: { Origin: config.origin, ...options.headers },
    });
  try {
    const login = await call('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"username":"demo"}',
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    await login.body.cancel();
    await run({ call, cookie, store });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
}

test('authenticated same-origin route returns only bounded WAV and leaves journals untouched', async () => {
  await httpFixture(async ({ call, cookie, store }) => {
    assert.equal((await call('/api/recordings/rec_demo001/audio')).status, 401);
    const response = await call('/api/recordings/rec_demo001/audio', {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/wav');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-security-policy'), /media-src 'self' blob:/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.deepEqual(store.list({ accountId: 'demo', scopeId: 'demo' }), []);
    for (const [path, options] of [
      ['/api/recordings/rec_demo001/audio?format=mp3', {}],
      ['/api/recordings/rec_demo001/audio', { method: 'HEAD' }],
      ['/api/recordings/rec_demo001/audio', { headers: { Range: 'bytes=0-10' } }],
    ]) {
      const refused = await call(path, {
        ...options,
        headers: { Cookie: cookie, ...options.headers },
      });
      assert.equal(refused.status, 400);
      await refused.body?.cancel();
    }
  });
});

test('logout or session expiry during storage fetch withholds audio', async () => {
  for (const action of ['logout', 'expiry']) {
    let now = 1000;
    let release;
    let entered;
    const ready = new Promise((resolve) => {
      entered = resolve;
    });
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    await httpFixture(
      async ({ call, cookie }) => {
        const pending = call('/api/recordings/rec_demo001/audio', { headers: { Cookie: cookie } });
        await ready;
        if (action === 'logout') {
          const logout = await call('/api/logout', { method: 'POST', headers: { Cookie: cookie } });
          assert.equal(logout.status, 200);
          await logout.body.cancel();
        } else now += 1800001;
        release();
        const response = await pending;
        assert.equal(response.status, 401);
        assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
      },
      {
        now: () => now,
        intercept: async (url, options, upstream) => {
          if (new URL(url).hostname === 'storage.example.test') {
            entered();
            await blocked;
          }
          return upstream(url, options);
        },
      },
    );
  }
});

test('browser disconnect aborts the pending storage fetch and releases the route', async () => {
  let entered;
  let stopped;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const cancelled = new Promise((resolve) => {
    stopped = resolve;
  });
  await httpFixture(
    async ({ call, cookie }) => {
      const controller = new AbortController();
      const pending = call('/api/recordings/rec_demo001/audio', {
        signal: controller.signal,
        headers: { Cookie: cookie },
      }).catch((error) => error);
      await ready;
      controller.abort();
      assert.equal((await pending).name, 'AbortError');
      await cancelled;
    },
    {
      intercept: (url, options, upstream) => {
        if (new URL(url).hostname !== 'storage.example.test') return upstream(url, options);
        entered();
        return new Promise((_resolve, reject) =>
          options.signal.addEventListener(
            'abort',
            () => {
              stopped();
              reject(options.signal.reason);
            },
            { once: true },
          ),
        );
      },
    },
  );
});
