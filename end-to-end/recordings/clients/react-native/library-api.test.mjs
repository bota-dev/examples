import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryApi, LibraryError, normalizeQuestion } from './library-api.ts';

const token = 'application-token-'.padEnd(48, 'x');
const rec = { id: 'rec_test', name: 'Test recording', status: 'uploaded', created_at: '2026-01-15T10:00:00Z', duration_seconds: 12, upload_verified: true };
const op = { id: 'op_test', kind: 'ask', state: 'complete', resource_id: 'as_test', updated_at: '2026-01-15T10:00:00Z' };
const apiFor = fetchImpl => createLibraryApi('http://127.0.0.1:8787', token, () => {}, fetchImpl);

test('customer token only goes to exact HTTPS/loopback origin; Bota credentials are rejected before fetch', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    assert.equal(url, 'http://127.0.0.1:8787/api/library/recordings');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.headers['X-Bota-Binding-Generation'], undefined);
    assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
    return Response.json({ data: [rec], has_more: false, next_cursor: null });
  };
  assert.equal((await apiFor(fetchImpl).list()).data[0].id, rec.id);
  for (const origin of ['http://192.168.1.2:8787', 'https://user:secret@example.test', 'https://example.test/api', 'https://example.test/?secret=yes']) {
    assert.throws(() => createLibraryApi(origin, token, () => {}, fetchImpl), LibraryError);
  }
  for (const secret of ['sk_test_', 'sk_live_', 'rk_', 'dtok_', 'up_', 'rct_']) {
    assert.throws(() => createLibraryApi('https://example.test', secret + 'x'.repeat(40), () => {}, fetchImpl), LibraryError);
  }
  assert.equal(calls, 1);
});

test('strict DTO projection drops untrusted extra fields and preserves recording/source identity', async () => {
  const api = apiFor(async url => {
    if (url.endsWith('/transcriptions')) return Response.json({ data: [{ id: 'txn_test', recording_id: 'rec_wrong', status: 'completed', full_text: 'private' }] });
    return Response.json({ ...rec, signed_url: 'https://private.test/token', debug: 'secret' });
  });
  assert.deepEqual(await api.detail('rec_test'), rec);
  await assert.rejects(api.detail('rec_other'), /verified/);
  await assert.rejects(api.transcriptions('rec_test'), /verified/);
});

test('lists reject invalid cursors, duplicate recording IDs and incomplete pagination metadata', async () => {
  const malformed = [
    { data: [rec, rec], has_more: false, next_cursor: null },
    { data: [rec], has_more: true, next_cursor: null },
    { data: [], has_more: true, next_cursor: 'next' },
    { data: [rec], has_more: false, next_cursor: 'next' },
    { data: [{ ...rec, upload_verified: 'yes' }], has_more: false, next_cursor: null },
  ];
  for (const page of malformed) await assert.rejects(apiFor(async () => Response.json(page)).list(), /verified/);
  let calls = 0;
  await assert.rejects(apiFor(async () => { calls++; return Response.json({}); }).list('bad\ncursor'), /verified/);
  assert.equal(calls, 0);
});

test('summary output is bounded structured text and must match the chosen transcript/template', async () => {
  const output = { overview: 'Overview', key_points: [], action_items: [], participants: [], decisions: [] };
  const row = { id: 'sum_test', transcription_id: 'txn_test', recording_id: rec.id, template_id: 'tmpl_general_notes', status: 'completed', output };
  assert.deepEqual((await apiFor(async () => Response.json({ data: [row] })).summaries('txn_test', rec.id))[0].output, output);
  for (const invalid of [{ ...row, transcription_id: 'txn_other' }, { ...row, recording_id: 'rec_other' }, { ...row, recording_id: undefined }, { ...row, template_id: 'other' }, { ...row, output: { ...output, action_items: ['x'.repeat(10001)] } }]) {
    await assert.rejects(apiFor(async () => Response.json({ data: [invalid] })).summaries('txn_test', rec.id), /verified/);
  }
});

test('Ask sends the canonical question once, uses its longer bounded timeout and checks citations', async () => {
  let calls = 0;
  const delays = [];
  const original = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => { delays.push(delay); return original(callback, delay, ...args); };
  try {
    const api = apiFor(async (url, options) => {
      calls++; assert.equal(url.endsWith('/recordings/rec_test/ask'), true);
      assert.deepEqual(JSON.parse(options.body), { question: 'Next steps? 😀' });
      return Response.json({ operation: op, answer: 'Sample answer', citations: [{ recording_id: rec.id, start_ms: 0 }] });
    });
    assert.equal((await api.ask(rec.id, '  Next steps? 😀\n')).answer, 'Sample answer');
    assert.equal(calls, 1); assert.deepEqual(delays, [210000]);
  } finally { globalThis.setTimeout = original; }
  await assert.rejects(apiFor(async () => Response.json({ operation: op, answer: 'Other source', citations: [{ recording_id: 'rec_other', start_ms: 0 }] })).ask(rec.id, 'Next?'), error => {
    assert.match(error.message, /verified/); assert.equal(error.operation.id, op.id); assert.equal(error.operationPresent, true); return true;
  });
  for (const question of ['', '  ', '\uD800', 'x'.repeat(10001)]) assert.throws(() => normalizeQuestion(question), LibraryError);
});

test('saved request reads verify exact ID and expose content only in the known recording scope', async () => {
  const api = apiFor(async () => Response.json({ operation: op, answer: 'private answer', citations: [{ recording_id: rec.id, start_ms: 0 }] }));
  assert.deepEqual(await api.operation(op.id), { operation: op });
  assert.equal((await api.operation(op.id, undefined, rec.id)).answer, 'private answer');
  await assert.rejects(api.operation('op_other'), /verified/);
});

test('network interruption is never retried; raw upstream errors do not reach the UI', async () => {
  let calls = 0;
  const api = apiFor(async () => { calls++; throw Error('https://signed.test/secret'); });
  await assert.rejects(api.startTranscription(rec.id), error => error instanceof LibraryError && error.code === 'outcome_unknown' && !error.message.includes('signed'));
  assert.equal(calls, 1);
  const failed = apiFor(async () => Response.json({ error: { code: 'session_unknown', message: 'private signed token' }, operation: { ...op, state: 'uncertain' } }, { status: 409 }));
  await assert.rejects(failed.ask(rec.id, 'Next?'), error => {
    assert.equal(error.operationPresent, true); assert.equal(error.operation.id, op.id); assert.doesNotMatch(error.message, /private|signed token/); return true;
  });
});

test('malformed, oversized and non-JSON responses fail closed', async () => {
  for (const response of [
    new Response('not-json', { headers: { 'Content-Type': 'application/json' } }),
    new Response('<html>secret</html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': String(2 * 1024 * 1024 + 1) } }),
    new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }),
  ]) await assert.rejects(apiFor(async () => response).list(), /verified/);
});

test('an exposed redirect destination cannot supply recording content', async () => {
  const response = Response.json(rec);
  Object.defineProperty(response, 'url', { value: 'https://other.test/recording' });
  await assert.rejects(apiFor(async () => response).detail(rec.id), /verified/);
});

test('401 retires the account and disposal prevents later requests', async () => {
  let expired = 0, calls = 0;
  const api = createLibraryApi('https://backend.test', token, () => { expired++; }, async () => { calls++; return Response.json({}, { status: 401 }); });
  await assert.rejects(api.list(), /rejected/); assert.equal(expired, 1);
  api.dispose(); await assert.rejects(api.list(), /rejected/); assert.equal(calls, 1);
});
