import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from '../../server/errors.mjs';
import { createStore } from '../../server/store.mjs';
import { listEvents, receiveWebhook } from '../../server/features/webhooks.mjs';

const secret = 'synthetic-webhook-secret';
const projectId = 'proj_test';
const createdAt = '2026-10-12T10:00:00Z';
const envelope = (
  id = 'evt_one',
  type = 'recording.uploaded',
  kind = 'recording',
  resourceId = 'rec_one',
) => ({
  id,
  type,
  created_at: createdAt,
  data: {
    [kind]: { id: resourceId, end_user_id: 'eu_alice', private_text: 'synthetic sensitive text' },
  },
});
const body = (event) => Buffer.from(JSON.stringify(event));
function signed(bytes, timestamp = String(Math.floor(Date.now() / 1000))) {
  return {
    'x-bota-timestamp': timestamp,
    'x-bota-signature': `v1=${createHmac('sha256', secret).update(`${timestamp}.`).update(bytes).digest('hex')}`,
  };
}
function fixture() {
  const saved = new Map(),
    calls = [];
  const ctx = {
    config: { webhookSecret: secret, projectId },
    principal: { accountId: 'alice', scopeId: 'scope-alice', endUserId: 'eu_alice', projectId },
    store: {
      acceptEvent(event) {
        if (saved.has(event.id) && saved.get(event.id).bodyHash !== event.bodyHash)
          throw new AppError(409, 'EVENT_CONFLICT', 'Event identity conflict.');
        if (!saved.has(event.id)) saved.set(event.id, structuredClone(event));
      },
      events() {
        return [...saved.values()];
      },
    },
    async request(method, path) {
      calls.push({ method, path });
      assert.equal(method, 'GET', 'notification display must not create jobs');
      if (path.startsWith('/recordings/'))
        return {
          id: path.slice('/recordings/'.length),
          project_id: projectId,
          end_user_id: path.endsWith('rec_foreign') ? 'eu_bob' : 'eu_alice',
          status: 'completed',
          created_at: createdAt,
        };
      if (path.startsWith('/transcriptions/'))
        return {
          id: path.slice('/transcriptions/'.length),
          recording_id: path.endsWith('txn_foreign') ? 'rec_foreign' : 'rec_one',
          status: 'completed',
        };
      if (path.startsWith('/summaries/'))
        return {
          id: path.slice('/summaries/'.length),
          transcription_id: 'txn_one',
          status: 'completed',
        };
      throw new Error('Unexpected synthetic request');
    },
  };
  return { ctx, saved, calls };
}

test('raw HMAC acceptance saves metadata before ACK and exact replay is durable dedupe', async () => {
  const { ctx, saved, calls } = fixture();
  const bytes = body(envelope());
  const result = await receiveWebhook(ctx, bytes, {
    ...signed(bytes),
    'x-bota-event-id': 'evt_one',
  });
  assert.deepEqual(result, { accepted: true });
  assert.equal(saved.size, 1);
  const event = saved.get('evt_one');
  assert.deepEqual(Object.keys(event).sort(), [
    'bodyHash',
    'createdAt',
    'id',
    'resourceId',
    'resourceKind',
    'type',
  ]);
  assert.ok(!JSON.stringify(event).includes('sensitive'));
  await receiveWebhook(ctx, bytes, signed(bytes));
  assert.equal(saved.size, 1);
  assert.equal(calls.length, 0);
});

test('stale/future timestamps, changed raw bytes and malformed signature fail before storage', async () => {
  for (const attack of ['stale', 'future', 'tampered', 'signature', 'timestamp']) {
    const { ctx, saved } = fixture();
    const bytes = body(envelope());
    const timestamp = String(
      Math.floor(Date.now() / 1000) + (attack === 'stale' ? -301 : attack === 'future' ? 301 : 0),
    );
    const headers = signed(bytes, timestamp);
    if (attack === 'signature') headers['x-bota-signature'] = 'v1=abcd';
    if (attack === 'timestamp') headers['x-bota-timestamp'] = `${timestamp}.0`;
    await assert.rejects(
      receiveWebhook(
        ctx,
        attack === 'tampered' ? Buffer.concat([bytes, Buffer.from(' ')]) : bytes,
        headers,
      ),
      { code: 'invalid_signature' },
    );
    assert.equal(saved.size, 0);
  }
});

test('valid signatures cannot admit invalid UTF8, nonfinite or excessively deep JSON', async () => {
  const badUtf8 = Buffer.concat([
    Buffer.from('{"text":"'),
    Buffer.from([0xc3, 0x28]),
    Buffer.from('"}'),
  ]);
  const nonfinite = Buffer.from(
    JSON.stringify(envelope()).replace('"data":{', '"number":1e999,"data":{'),
  );
  const deep = Buffer.from(
    `{"id":"evt_one","type":"recording.uploaded","created_at":"${createdAt}","data":{"deep":${'['.repeat(130)}0${']'.repeat(130)}}}`,
  );
  for (const bytes of [badUtf8, nonfinite, deep]) {
    const { ctx, saved } = fixture();
    await assert.rejects(receiveWebhook(ctx, bytes, signed(bytes)), { code: 'invalid_event' });
    assert.equal(saved.size, 0);
  }
});

test('event header, project markers and resource envelope must match exactly', async () => {
  const wrongEvent = body(envelope());
  const wrongProject = body({ ...envelope(), project_id: 'proj_other' });
  const wrongResourceProject = body({
    ...envelope(),
    data: { recording: { id: 'rec_one', project_id: 'proj_other' } },
  });
  const wrongPointer = body({ ...envelope(), data: { resource: { id: 'rec_one' } } });
  for (const [bytes, extra] of [
    [wrongEvent, { 'x-bota-event-id': 'evt_other' }],
    [wrongProject, {}],
    [wrongResourceProject, {}],
    [wrongPointer, {}],
  ]) {
    const { ctx, saved } = fixture();
    await assert.rejects(receiveWebhook(ctx, bytes, { ...signed(bytes), ...extra }), AppError);
    assert.equal(saved.size, 0);
  }
});

test('same event ID with different signed content is a conflict and cannot overwrite metadata', async () => {
  const { ctx, saved } = fixture();
  const first = body(envelope());
  await receiveWebhook(ctx, first, signed(first));
  const second = body({ ...envelope(), created_at: '2026-10-12T10:00:01Z' });
  await assert.rejects(receiveWebhook(ctx, second, signed(second)), {
    status: 409,
    code: 'EVENT_CONFLICT',
  });
  assert.equal(saved.get('evt_one').createdAt, createdAt);
});

test('failed durable metadata save never returns acknowledgement', async () => {
  const { ctx } = fixture();
  ctx.store.acceptEvent = async () => {
    throw new AppError(503, 'storage_unavailable', 'Metadata persistence failed.');
  };
  const bytes = body(envelope());
  await assert.rejects(receiveWebhook(ctx, bytes, signed(bytes)), { code: 'storage_unavailable' });
});

test('SQLite restart preserves event dedupe, conflicts and metadata-only storage', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bota-reference-events-'));
  const path = join(directory, 'events.sqlite');
  const bytes = body(envelope());
  let store;
  try {
    store = createStore(path);
    const ctx = { config: { webhookSecret: secret, projectId }, store };
    await receiveWebhook(ctx, bytes, signed(bytes));
    store.close();
    store = createStore(path);
    ctx.store = store;
    await receiveWebhook(ctx, bytes, signed(bytes));
    assert.equal(store.events().length, 1);
    assert.ok(!JSON.stringify(store.events()).includes('sensitive'));
    const conflict = body({ ...envelope(), type: 'recording.created' });
    await assert.rejects(receiveWebhook(ctx, conflict, signed(conflict)), { status: 409 });
  } finally {
    store?.close();
    unlinkSync(path);
    rmdirSync(directory);
  }
});

test('UI notifications resolve current exact source chains and ignore signed payload ownership', async () => {
  const { ctx, calls } = fixture();
  for (const event of [
    envelope(),
    envelope('evt_txn', 'transcription.completed', 'transcription', 'txn_one'),
    envelope('evt_sum', 'summary.completed', 'summary', 'sum_one'),
    envelope('evt_foreign', 'transcription.completed', 'transcription', 'txn_foreign'),
    envelope('evt_unsupported', 'device.online', 'device', 'dev_one'),
  ]) {
    const bytes = body(event);
    await receiveWebhook(ctx, bytes, signed(bytes));
  }
  const result = await listEvents(ctx);
  assert.deepEqual(
    result.data.map((row) => row.id),
    ['evt_one', 'evt_txn', 'evt_sum'],
  );
  for (const row of result.data)
    assert.deepEqual(Object.keys(row).sort(), ['created_at', 'id', 'type']);
  assert.ok(calls.some((row) => row.path === '/recordings/rec_foreign'));
  assert.ok(calls.every((row) => row.method === 'GET'));
});

test('deleted resources are hidden and upstream failures remain explicit', async () => {
  const { ctx } = fixture();
  const bytes = body(envelope());
  await receiveWebhook(ctx, bytes, signed(bytes));
  ctx.request = async () => {
    throw new AppError(404, 'not_found', 'Resource unavailable.');
  };
  assert.deepEqual(await listEvents(ctx), { data: [] });
  ctx.request = async () => {
    throw new AppError(502, 'upstream_failed', 'Upstream unavailable.');
  };
  await assert.rejects(listEvents(ctx), { code: 'upstream_failed' });
});

test('current summary source mismatch blocks metadata rather than falling back to payload pointers', async () => {
  const { ctx } = fixture();
  const bytes = body(envelope('evt_sum', 'summary.completed', 'summary', 'sum_one'));
  await receiveWebhook(ctx, bytes, signed(bytes));
  const request = ctx.request;
  ctx.request = (method, path) =>
    path === '/summaries/sum_one'
      ? { id: 'sum_other', transcription_id: 'txn_one', status: 'completed' }
      : request(method, path);
  await assert.rejects(listEvents(ctx), { code: 'invalid_job' });
});

test('missing secret disables signed webhook reception', async () => {
  const { ctx } = fixture();
  ctx.config.webhookSecret = '';
  const bytes = body(envelope());
  await assert.rejects(receiveWebhook(ctx, bytes, signed(bytes)), { code: 'webhooks_disabled' });
});
