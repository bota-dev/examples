import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecording, listRecordings, verifyRecording } from '../../server/features/recordings.mjs';

const principal = { accountId: 'account-a', scopeId: 'scope-a', endUserId: 'eu_a', projectId: 'proj_a' };
const recording = overrides => ({ id: 'rec_a', end_user_id: 'eu_a', project_id: 'proj_a', name: 'Synthetic.wav',
  status: 'uploaded', created_at: '2026-10-12T00:00:00Z', duration_seconds: 5,
  content_sha256: 'a'.repeat(64), content_sha256_verified_at: '2026-10-12T00:01:00Z',
  audio_url: 'https://storage.example/private?token=secret', metadata: { private: 'hidden' }, ...overrides });
const context = request => ({ principal, request });

test('exact reads reject forged IDs, foreign owners, foreign projects and deleted resources', async () => {
  let calls = 0;
  await assert.rejects(verifyRecording(context(async () => { calls++; }), 'rec_a/other'), { status: 400 });
  assert.equal(calls, 0);
  for (const overrides of [
    { id: 'rec_other' }, { end_user_id: 'eu_other' }, { end_user_id: null },
    { project_id: 'proj_other' }, { deleted_at: '2026-10-12T00:00:00Z' },
  ]) {
    await assert.rejects(verifyRecording(context(async () => recording(overrides)), 'rec_a'));
  }
});

test('detail returns selected metadata and requires hash evidence for upload_verified', async () => {
  const row = recording();
  const output = await getRecording(context(async () => row), row.id);
  assert.deepEqual(output, { id: 'rec_a', name: 'Synthetic.wav', status: 'uploaded',
    created_at: row.created_at, duration_seconds: 5, upload_verified: true });
  assert.equal((await getRecording(context(async () => recording({ content_sha256_verified_at: null })), row.id)).upload_verified, false);
  assert.equal((await getRecording(context(async () => recording({ status: 'integrity_failure' })), row.id)).upload_verified, false);
  assert.equal((await getRecording(context(async () => recording({ content_sha256: null })), row.id)).upload_verified, false);
});

test('fractional duration is valid but nonfinite, negative or nonnumeric duration is rejected', async () => {
  const output = await getRecording(context(async () => recording({ duration_seconds: 1.25 })), 'rec_a');
  assert.equal(output.duration_seconds, 1.25);
  for (const duration_seconds of [Infinity, NaN, -0.5, '1.25']) {
    await assert.rejects(getRecording(context(async () => recording({ duration_seconds })), 'rec_a'), { status: 502 });
  }
});

test('each bounded page keeps the server owner filter and rechecks exact current resources', async () => {
  const calls = [];
  const ctx = context(async (method, path) => {
    calls.push([method, path]);
    if (path.startsWith('/recordings?')) {
      const query = new URL(path, 'https://api.example').searchParams;
      assert.equal(query.get('end_user_id'), principal.endUserId);
      assert.equal(query.get('limit'), '20');
      const first = !query.has('cursor');
      return { data: [recording({ id: first ? 'rec_a' : 'rec_b' })], has_more: first,
        next_cursor: first ? 'opaque&end_user_id=eu_other' : null };
    }
    return recording({ id: path.endsWith('rec_a') ? 'rec_a' : 'rec_b', name: 'Current name' });
  });
  const first = await listRecordings(ctx);
  const second = await listRecordings(ctx, first.next_cursor);
  assert.equal(first.data[0].name, 'Current name');
  assert.equal(second.data[0].id, 'rec_b');
  assert.equal(second.has_more, false);
  assert.deepEqual(calls.filter(([, path]) => !path.includes('?')), [['GET', '/recordings/rec_a'], ['GET', '/recordings/rec_b']]);
  assert.equal(JSON.stringify([first, second]).includes('secret'), false);
});

test('foreign page rows and ownership changes during the final GET fail before returning a list', async () => {
  let reads = 0;
  await assert.rejects(listRecordings(context(async () => {
    reads++;
    return { data: [recording({ end_user_id: 'eu_other' })], has_more: false };
  })), { status: 403 });
  assert.equal(reads, 1);
  await assert.rejects(listRecordings(context(async (_method, path) => path.includes('?')
    ? { data: [recording()], has_more: false }
    : recording({ end_user_id: 'eu_other' }))), { status: 403 });
});

test('invalid cursors, malformed pagination, duplicate rows and overlarge pages are rejected', async () => {
  let reads = 0;
  await assert.rejects(listRecordings(context(async () => { reads++; }), 'x'.repeat(1025)), { status: 400 });
  assert.equal(reads, 0);
  for (const page of [
    { data: [recording()], has_more: true, next_cursor: null },
    { data: [], has_more: true, next_cursor: 'next' },
    { data: [recording(), recording()], has_more: false },
    { data: Array.from({ length: 21 }, () => recording()), has_more: false },
    { data: [recording({ duration_seconds: -1 })], has_more: false },
  ]) await assert.rejects(listRecordings(context(async () => page)), { status: 502 });
});
