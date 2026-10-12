import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../../server/store.mjs';
import { createAuth, tokenHash } from '../../server/auth.mjs';
import { createClient } from '../../server/client.mjs';

const principal = {
  accountId: 'alice',
  username: 'alice',
  scopeId: 'alice-scope',
  projectId: 'proj_a',
  endUserId: 'eu_a',
};
const config = {
  origin: 'https://app.example.test',
  mode: 'live',
  accounts: [{ username: 'alice', tokenHash: tokenHash('a'.repeat(43)), principal }],
  apiBase: 'https://api.example.test/v1',
  apiKey: 'sk_test_private_server_key',
  storageHosts: ['storage.example.test'],
};
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('session auth uses application tokens, private cookies and expiry', () => {
  let now = 1000;
  const auth = createAuth(config, { now: () => now });
  assert.throws(
    () => auth.login({ username: 'alice', token: config.apiKey }, 'ip'),
    (error) => error.status === 401,
  );
  const session = auth.login({ username: 'alice', token: 'a'.repeat(43) }, 'ip');
  assert.match(session.cookie, /HttpOnly; SameSite=Strict/);
  assert.match(session.cookie, /Secure/);
  assert.equal(auth.principal(session.cookie), principal);
  assert.equal(auth.principal(session.cookie + '; bota_reference=duplicate'), null);
  now += 1800001;
  assert.equal(auth.principal(session.cookie), null);
});

test('sign-in attempts are bounded and logout revokes the exact session', () => {
  const auth = createAuth(config);
  for (let count = 0; count < 10; count++)
    assert.throws(() => auth.login({ username: 'alice', token: 'wrong' }, 'ip'));
  assert.throws(
    () => auth.login({ username: 'alice', token: 'a'.repeat(43) }, 'ip'),
    (error) => error.status === 429,
  );
  const session = auth.login({ username: 'alice', token: 'a'.repeat(43) }, 'other');
  assert.match(auth.logout(session.cookie), /Max-Age=0/);
  assert.equal(auth.principal(session.cookie), null);
});

test('oversized tokens cannot authenticate even against an empty-string token hash', () => {
  const auth = createAuth({
    ...config,
    accounts: [{ ...config.accounts[0], tokenHash: tokenHash('') }],
  });
  assert.throws(
    () => auth.login({ username: 'alice', token: 'x'.repeat(257) }, 'oversized'),
    (error) => error.status === 401,
  );
  assert.throws(
    () => auth.login({ username: 'alice', token: '' }, 'empty'),
    (error) => error.status === 401,
  );
});

test('durable claim prevents duplicate writes across reopen and scope changes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bota-reference-test-'));
  const path = join(directory, 'state.sqlite');
  let store;
  try {
    store = createStore(path);
    const first = store.claim(principal, 'upload', 'digest', { recordingId: 'rec_a' });
    assert.equal(first.fresh, true);
    store.save(principal, first.operation.id, { state: 'creating' });
    store.close();
    store = createStore(path);
    assert.equal(store.claim(principal, 'upload', 'digest', {}).fresh, false);
    assert.equal(store.get(principal, first.operation.id).state, 'creating');
    assert.throws(() => store.get({ ...principal, accountId: 'bob' }, first.operation.id));
    assert.throws(
      () => store.claim({ ...principal, scopeId: 'changed' }, 'upload', 'digest', {}),
      (error) => error.status === 409,
    );
    assert.deepEqual(store.list({ ...principal, accountId: 'bob' }), []);
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('durable webhook dedupe survives reopen and rejects ID conflicts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bota-reference-inbox-'));
  const path = join(directory, 'state.sqlite');
  let store;
  const event = {
    id: 'evt_a',
    type: 'recording.uploaded',
    createdAt: new Date().toISOString(),
    resourceKind: 'recording',
    resourceId: 'rec_a',
    bodyHash: 'a'.repeat(64),
  };
  try {
    store = createStore(path);
    store.acceptEvent(event);
    store.close();
    store = createStore(path);
    store.acceptEvent(event);
    assert.equal(store.events().length, 1);
    assert.throws(
      () => store.acceptEvent({ ...event, bodyHash: 'b'.repeat(64) }),
      (error) => error.status === 409,
    );
    assert.equal(store.events()[0].bodyHash, event.bodyHash);
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('API auth stays on API origin and storage uses only scoped URL/type', async () => {
  const calls = [];
  const client = createClient(config, {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return options.method === 'PUT' ? new Response(null, { status: 200 }) : json({ id: 'rec_a' });
    },
  });
  await client.request('GET', '/recordings/rec_a');
  await client.storagePut(
    'https://storage.example.test/file?signature=synthetic',
    Buffer.from('audio'),
    'audio/wav',
  );
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${config.apiKey}`);
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.headers.Cookie, undefined);
  assert.equal(calls[1].options.redirect, 'error');
  await assert.rejects(
    client.storagePut('https://foreign.example.test/file', Buffer.from('audio'), 'audio/wav'),
  );
  assert.equal(calls.length, 2);
});

test('cloud failure sends no retry and does not expose body, URL or exception', async () => {
  let count = 0;
  const client = createClient(config, {
    fetchImpl: async () => {
      count++;
      throw new Error('private token and URL');
    },
  });
  await assert.rejects(
    client.request('POST', '/transcriptions', { recording_id: 'rec_a' }),
    (error) => error.status === 502 && !error.message.includes('private'),
  );
  assert.equal(count, 1);
});

test('only exact upload pending shape is accepted; invalid JSON and redirect fail', async () => {
  const responses = [
    json({ error: { code: 'upload_verification_pending' } }, 425),
    json({ error: { code: 'other' } }, 425),
    new Response('{"bad":1e999}', { headers: { 'content-type': 'application/json' } }),
    new Response(null, { status: 302 }),
  ];
  const client = createClient(config, { fetchImpl: async () => responses.shift() });
  assert.equal(
    await client.request('POST', '/recordings/rec_a/upload-complete', {}, { pending425: true }),
    null,
  );
  await assert.rejects(
    client.request('POST', '/recordings/rec_a/upload-complete', {}, { pending425: true }),
  );
  await assert.rejects(client.request('GET', '/recordings/rec_a'));
  await assert.rejects(client.request('GET', '/recordings/rec_a'));
});
