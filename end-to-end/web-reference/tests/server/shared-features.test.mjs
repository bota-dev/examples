import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { createApp } from '../../server/app.mjs';
import { configuration } from '../../server/config.mjs';
import { demoFetch } from '../../server/demo.mjs';
import { AppError } from '../../server/errors.mjs';
import { createStore } from '../../server/store.mjs';

const recordingId = 'rec_demo002';
const transcription = {
  id: 'txn_shared',
  recording_id: recordingId,
  status: 'completed',
  created_at: '2026-10-12T10:00:00.000Z',
  full_text: 'Synthetic selected recording transcript.',
};
const json = (value) =>
  new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const createPath = `/api/recordings/${recordingId}/transcriptions`;
const writes = (calls) => calls.filter((call) => call.method === 'POST');

// Use the real cookie adapter, local HTTP listener and existing SQLite store.
// The upstream remains the repository's in-process synthetic API.
async function fixture(t, intercept = (_call, next) => next(), database = ':memory:') {
  const config = configuration({}, { demo: true });
  const principal = config.accounts[0].principal;
  const store = createStore(database);
  const upstream = demoFetch();
  const calls = [];
  const app = createApp({
    config,
    store,
    fetchImpl(url, options) {
      const call = { method: options.method, path: new URL(url).pathname.replace(/^\/v1/, '') };
      calls.push(call);
      return intercept(call, () => upstream(url, options));
    },
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  config.origin = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    store.close();
  };
  t.after(close);
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(config.origin + path, {
      method,
      headers: {
        Cookie: cookie,
        Origin: config.origin,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: response.status, value: await response.json() };
  };
  assert.equal((await request('/api/login', 'POST', { username: 'demo' })).status, 200);
  return { request, store, principal, calls, close };
}

for (const [kind, altered, status] of [
  ['source', { recording_id: 'rec_foreign' }, 502],
  ['owner', { end_user_id: 'eu_foreign' }, 403],
  ['project', { project_id: 'proj_foreign' }, 404],
]) {
  test(`web retains a valid created identity when its ${kind} is rejected, without a replacement POST`, async (t) => {
    const row = { ...transcription, ...altered, full_text: 'PRIVATE_FOREIGN_CONTENT' };
    const f = await fixture(t, (call, next) =>
      call.method === 'POST' || call.path === `/transcriptions/${row.id}` ? json(row) : next(),
    );
    const failed = await f.request(createPath, 'POST', {});
    assert.equal(failed.status, status);
    assert.ok(!JSON.stringify(failed.value).includes(row.full_text));
    if ([401, 403, 404].includes(status)) assert.equal(failed.value.operation, undefined);
    const [saved] = f.store.list(f.principal);
    assert.equal(saved.resourceId, row.id);
    assert.equal(saved.state, 'uncertain');
    assert.equal(saved.details.recordingId, recordingId);
    assert.equal((await f.request(createPath, 'POST', {})).status, status);
    assert.equal((await f.request(`/api/operations/${saved.id}`)).status, status);
    assert.equal(writes(f.calls).length, 1);
    assert.equal(f.store.list(f.principal).length, 1);
    assert.equal(f.store.get(f.principal, saved.id).resourceId, row.id);
  });
}

test('web awaits the post-create GET so a rejected observation marks the saved identity uncertain', async (t) => {
  let available = false;
  const f = await fixture(t, (call, next) => {
    if (call.method === 'POST') return json(transcription);
    if (call.path === `/transcriptions/${transcription.id}`) {
      if (!available) throw new Error('PRIVATE_UPSTREAM_FAILURE');
      return json(transcription);
    }
    return next();
  });
  const failed = await f.request(createPath, 'POST', {});
  assert.equal(failed.status, 502);
  assert.equal(failed.value.operation.state, 'uncertain');
  assert.equal(failed.value.operation.resource_id, transcription.id);
  assert.ok(!JSON.stringify(failed.value).includes('PRIVATE_UPSTREAM_FAILURE'));
  const saved = f.store.get(f.principal, failed.value.operation.id);
  assert.equal(saved.state, 'uncertain', 'asynchronous reconciliation must remain inside catch');
  available = true;
  const recovered = await f.request(`/api/operations/${saved.id}`);
  assert.equal(recovered.status, 200);
  assert.deepEqual(Object.keys(recovered.value), ['operation']);
  assert.equal(recovered.value.operation.id, saved.id);
  assert.equal(recovered.value.operation.resource_id, transcription.id);
  assert.equal(recovered.value.operation.state, 'complete');
  assert.equal(writes(f.calls).length, 1);
});

for (const status of [401, 403, 404]) {
  test(`web ${status} denial after create keeps the private journal and omits operation response metadata`, async (t) => {
    const f = await fixture(t, (call, next) => {
      if (call.method === 'POST') return json(transcription);
      if (call.path === `/transcriptions/${transcription.id}`)
        throw new AppError(status, 'RESOURCE_UNAVAILABLE', 'Resource unavailable.');
      return next();
    });
    const failed = await f.request(createPath, 'POST', {});
    assert.equal(failed.status, status);
    assert.equal(failed.value.operation, undefined);
    const [saved] = f.store.list(f.principal);
    assert.equal(saved.resourceId, transcription.id);
    assert.equal(saved.state, 'uncertain');
    const refreshed = await f.request(`/api/operations/${saved.id}`);
    assert.equal(refreshed.status, status);
    assert.equal(refreshed.value.operation, undefined);
    const repeated = await f.request(createPath, 'POST', {});
    assert.equal(repeated.status, status);
    assert.equal(repeated.value.operation, undefined);
    assert.equal(writes(f.calls).length, 1);
    assert.equal(f.store.get(f.principal, saved.id).resourceId, transcription.id);
  });
}

test('web preserves operation-only mutation/recovery and its existing summary DTO', async (t) => {
  const f = await fixture(t);
  const created = await f.request(createPath, 'POST', {});
  assert.equal(created.status, 200);
  assert.deepEqual(Object.keys(created.value), ['operation']);
  const transcripts = await f.request('/api/recordings/rec_demo001/transcriptions');
  const source = transcripts.value.data[0].id;
  const summary = await f.request(`/api/transcriptions/${source}/summaries`, 'POST', {});
  assert.equal(summary.status, 200);
  assert.deepEqual(Object.keys(summary.value), ['operation']);
  const refreshed = await f.request(`/api/operations/${summary.value.operation.id}`);
  assert.deepEqual(Object.keys(refreshed.value), ['operation']);
  const notes = await f.request(`/api/transcriptions/${source}/summaries`);
  assert.equal(notes.status, 200);
  assert.deepEqual(Object.keys(notes.value.data[0]).sort(), [
    'created_at',
    'id',
    'output',
    'status',
    'template_id',
    'transcription_id',
  ]);
  assert.equal(notes.value.data[0].transcription_id, source);
  assert.equal(notes.value.data[0].recording_id, undefined);
});

test('web explicit compatibility policy permits omitted transcription project only through an owned source chain', async (t) => {
  let owned = true;
  const f = await fixture(t, async (call, next) => {
    if (call.method === 'POST' || call.path === `/transcriptions/${transcription.id}`)
      return json(transcription);
    if (call.path === `/recordings/${recordingId}` && !owned) {
      const row = await (await next()).json();
      return json({ ...row, end_user_id: 'eu_foreign' });
    }
    return next();
  });
  const created = await f.request(createPath, 'POST', {});
  assert.equal(created.status, 200);
  assert.equal(created.value.operation.state, 'complete');
  owned = false;
  const denied = await f.request(`/api/operations/${created.value.operation.id}`);
  assert.equal(denied.status, 403);
  assert.equal(denied.value.operation, undefined);
  assert.equal(writes(f.calls).length, 1);
});

for (const known of [true, false]) {
  test(`web existing SQLite ${known ? 'known identity' : 'unknown locked intent'} survives restart with GET-only recovery`, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'bota-shared-features-'));
    const database = join(directory, 'existing-state.sqlite');
    let first, second;
    t.after(async () => {
      await second?.close();
      await first?.close();
      const target = resolve(directory);
      const fromTemp = relative(resolve(tmpdir()), target);
      assert.ok(!isAbsolute(fromTemp) && !fromTemp.startsWith('..'));
      assert.ok(basename(target).startsWith('bota-shared-features-'));
      rmSync(target, { recursive: true, force: true });
    });
    first = await fixture(
      t,
      (call, next) => {
        if (call.method === 'POST') {
          if (!known) throw new Error('Synthetic lost creation response.');
          return json(transcription);
        }
        if (call.path === `/transcriptions/${transcription.id}`)
          throw new Error('Synthetic unavailable observation.');
        return next();
      },
      database,
    );
    const failed = await first.request(createPath, 'POST', {});
    assert.equal(failed.status, 502);
    const [before] = first.store.list(first.principal);
    assert.equal(before.state, 'uncertain');
    assert.equal(before.resourceId, known ? transcription.id : null);
    await first.close();
    second = await fixture(
      t,
      (call, next) => {
        assert.equal(call.method, 'GET', 'restart recovery must never send another POST');
        return call.path === `/transcriptions/${transcription.id}` ? json(transcription) : next();
      },
      database,
    );
    const [reopened] = second.store.list(second.principal);
    assert.deepEqual(reopened, before, 'the existing journal is reopened, not migrated');
    const recovered = await second.request(`/api/operations/${before.id}`);
    assert.equal(recovered.status, 200);
    assert.equal(recovered.value.operation.id, before.id);
    assert.equal(recovered.value.operation.resource_id, before.resourceId);
    assert.equal(recovered.value.operation.state, known ? 'complete' : 'uncertain');
    const retried = await second.request(createPath, 'POST', {});
    assert.equal(retried.status, 200);
    assert.equal(retried.value.operation.id, before.id);
    assert.equal(retried.value.operation.resource_id, before.resourceId);
    assert.equal(second.store.list(second.principal).length, 1);
    assert.equal(writes(first.calls).length, 1);
    assert.equal(writes(second.calls).length, 0);
  });
}
