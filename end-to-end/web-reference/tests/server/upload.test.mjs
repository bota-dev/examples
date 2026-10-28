import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { refreshUpload, uploadAudio } from '../../server/features/upload.mjs';

const principal = {
  accountId: 'account-a',
  username: 'demo',
  scopeId: 'scope-a',
  endUserId: 'eu_a',
  projectId: 'proj_a',
};
const input = () => ({
  name: 'Synthetic.wav',
  contentType: 'audio/wav',
  bytes: Buffer.from('synthetic audio fixture'),
});
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function fixture({ lose, pending = false, modifyCreate, modifyRead, modifyComplete } = {}) {
  const operations = new Map();
  const byAnchor = new Map();
  const cloud = new Map();
  const writes = [];
  const reads = [];
  const journal = [];
  let putCount = 0;
  const store = {
    async claim(owner, kind, anchor, details) {
      const key = `${owner.accountId}:${kind}:${anchor}`;
      if (byAnchor.has(key)) {
        const existing = operations.get(byAnchor.get(key));
        if (existing.details.scopeId !== owner.scopeId)
          throw Object.assign(new Error('Saved intent belongs to an earlier account scope.'), {
            status: 409,
          });
        return { fresh: false, operation: structuredClone(existing) };
      }
      const id = randomUUID();
      const op = {
        id,
        kind,
        anchor,
        state: 'claimed',
        resourceId: null,
        details,
        updatedAt: '2026-10-12T00:00:00Z',
      };
      operations.set(id, op);
      byAnchor.set(key, id);
      journal.push(structuredClone(op));
      return { fresh: true, operation: structuredClone(op) };
    },
    async save(_owner, id, changes) {
      const old = operations.get(id);
      const op = { ...old, ...changes, details: { ...old.details, ...changes.details } };
      operations.set(id, op);
      journal.push(structuredClone(op));
      return structuredClone(op);
    },
    async get(owner, id) {
      const op = operations.get(id);
      if (!op || op.details.accountId !== owner.accountId || op.details.scopeId !== owner.scopeId)
        throw Object.assign(new Error('Operation unavailable.'), { status: 404 });
      return structuredClone(op);
    },
  };
  const active = () => [...operations.values()].at(-1);
  const ctx = {
    principal,
    store,
    config: {},
    async request(method, path, body, options) {
      if (method === 'GET') {
        reads.push(path);
        const row = structuredClone(cloud.get(path.split('/')[2]));
        return modifyRead ? modifyRead(row, { writes, putCount }) : row;
      }
      writes.push({ method, path, body, options, journal: structuredClone(active()) });
      if (path === '/recordings') {
        assert.equal(active().state, 'creating');
        const row = {
          id: `rec_${cloud.size + 1}`,
          end_user_id: body.end_user_id,
          project_id: 'proj_a',
          name: body.name,
          status: 'pending',
          created_at: '2026-10-12T00:00:00Z',
          duration_seconds: null,
          source: body.source,
          upload_method: body.upload_method,
          content_sha256: null,
          content_sha256_verified_at: null,
        };
        cloud.set(row.id, row);
        if (lose === 'create') throw new Error('lost create response');
        return modifyCreate ? modifyCreate(structuredClone(row)) : structuredClone(row);
      }
      const row = cloud.get(path.split('/')[2]);
      assert.equal(active().resourceId, row.id);
      if (path.endsWith('/upload-url')) {
        assert.equal(active().details.phase, 'upload_url');
        if (lose === 'url') throw new Error('lost URL response');
        return {
          upload_url: 'https://storage.example/object?signature=synthetic',
          content_type: body.content_type,
          upload_token: 'up_synthetic',
        };
      }
      assert.equal(path, `/recordings/${row.id}/upload-complete`);
      assert.equal(active().state, 'verifying');
      assert.equal(active().details.phase, 'completion');
      assert.deepEqual(options, { pending425: true });
      row.status = 'uploaded';
      row.content_sha256 = body.content_sha256;
      row.content_sha256_verified_at = pending ? null : '2026-10-12T00:01:00Z';
      if (lose === 'completion') throw new Error('lost completion response');
      if (pending) return null;
      return modifyComplete ? modifyComplete(structuredClone(row)) : structuredClone(row);
    },
    async storagePut(...args) {
      assert.equal(args.length, 3);
      const [url, bytes, contentType] = args;
      assert.equal(url, 'https://storage.example/object?signature=synthetic');
      assert.ok(Buffer.isBuffer(bytes));
      assert.equal(contentType, 'audio/wav');
      assert.equal(active().state, 'uploading');
      assert.equal(active().details.phase, 'storage_put');
      assert.equal(active().details.digest, sha(bytes));
      putCount++;
      if (lose === 'put') throw new Error('lost PUT response');
    },
  };
  return { ctx, cloud, writes, reads, journal, operations, active, putCount: () => putCount };
}

test('upload journals before each write, injects owner, isolates storage arguments and returns no credentials', async () => {
  const f = fixture();
  const audio = input();
  const result = await uploadAudio(f.ctx, audio);
  assert.equal(result.operation.state, 'complete');
  assert.equal(result.recording.upload_verified, true);
  assert.equal(f.putCount(), 1);
  assert.deepEqual(
    f.writes.map((write) => write.path),
    ['/recordings', '/recordings/rec_1/upload-url', '/recordings/rec_1/upload-complete'],
  );
  assert.deepEqual(f.writes[0].body, {
    name: audio.name,
    end_user_id: 'eu_a',
    source: 'api_upload',
    upload_method: 'import',
  });
  assert.deepEqual(f.writes[1].body, {
    content_type: audio.contentType,
    file_size_bytes: audio.bytes.length,
  });
  assert.deepEqual(f.writes[2].body, { content_sha256: sha(audio.bytes) });
  assert.equal(f.journal[0].state, 'claimed');
  assert.equal(JSON.stringify([result, f.journal]).includes('signature=synthetic'), false);
  assert.equal(JSON.stringify(result).includes('content_sha256'), false);
});

test('same file/name/type intent creates, PUTs and completes only once, including concurrent calls', async () => {
  const f = fixture();
  await Promise.all([uploadAudio(f.ctx, input()), uploadAudio(f.ctx, input())]);
  const result = await uploadAudio(f.ctx, input());
  assert.equal(result.operation.state, 'complete');
  assert.equal(f.operations.size, 1);
  assert.equal(f.writes.length, 3);
  assert.equal(f.putCount(), 1);
});

test('Web import preserves its omitted-project response compatibility', async () => {
  const f = fixture({
    modifyRead: (row) => {
      const { project_id: _project, ...rest } = row;
      return rest;
    },
  });
  assert.equal((await uploadAudio(f.ctx, input())).operation.state, 'complete');
  assert.equal((await refreshUpload(f.ctx, f.active().id)).operation.state, 'complete');
});

for (const lose of ['create', 'url', 'put'])
  test(`lost ${lose} outcome retains intent and never resends writes`, async () => {
    const f = fixture({ lose });
    await assert.rejects(
      uploadAudio(f.ctx, input()),
      new RegExp(`lost ${lose === 'put' ? 'PUT' : lose === 'url' ? 'URL' : lose}`),
    );
    assert.equal(f.active().state, 'uncertain');
    const priorWrites = f.writes.length;
    const priorPuts = f.putCount();
    const result = await uploadAudio(f.ctx, input());
    assert.equal(result.operation.state, 'uncertain');
    assert.equal(result.recording, undefined);
    assert.equal(f.writes.length, priorWrites);
    assert.equal(f.putCount(), priorPuts);
    assert.equal(f.cloud.size, 1);
  });

test('lost completion reconciles verified exact ownership/hash by GET without another completion', async () => {
  const f = fixture({ lose: 'completion' });
  await assert.rejects(uploadAudio(f.ctx, input()), /lost completion/);
  assert.equal(f.active().state, 'uncertain');
  const result = await uploadAudio(f.ctx, input());
  assert.equal(result.operation.state, 'complete');
  assert.equal(f.writes.length, 3);
  assert.equal(f.putCount(), 1);
});

test('manual refresh closes a known lost completion with GET-only exact verification', async () => {
  const f = fixture({ lose: 'completion' });
  await assert.rejects(uploadAudio(f.ctx, input()), /lost completion/);
  const priorReads = f.reads.length;
  const result = await refreshUpload(f.ctx, f.active().id);
  assert.equal(result.operation.state, 'complete');
  assert.equal(result.recording.id, 'rec_1');
  assert.equal(f.reads.length, priorReads + 1);
  assert.equal(f.writes.length, 3);
  assert.equal(f.putCount(), 1);
});

test('manual refresh keeps unknown create outcomes unchanged and never calls Bota', async () => {
  const f = fixture({ lose: 'create' });
  await assert.rejects(uploadAudio(f.ctx, input()), /lost create/);
  const result = await refreshUpload(f.ctx, f.active().id);
  assert.equal(result.operation.state, 'uncertain');
  assert.equal(result.operation.resource_id, null);
  assert.equal(f.writes.length, 1);
  assert.equal(f.reads.length, 0);
  assert.equal(f.putCount(), 0);
});

test('manual refresh rejects foreign operations, wrong kinds and invalid saved upload intent before reads', async () => {
  const f = fixture({ lose: 'create' });
  await assert.rejects(uploadAudio(f.ctx, input()));
  const operationId = f.active().id;
  await assert.rejects(
    refreshUpload({ ...f.ctx, principal: { ...principal, scopeId: 'scope-other' } }, operationId),
    { status: 404 },
  );
  f.active().kind = 'summary';
  await assert.rejects(refreshUpload(f.ctx, operationId), { status: 404 });
  f.active().kind = 'upload';
  f.active().details.digest = 'forged';
  await assert.rejects(refreshUpload(f.ctx, operationId), { status: 409 });
  assert.equal(f.reads.length, 0);
  assert.equal(f.writes.length, 1);
});

test('manual refresh cannot close a pending, foreign or hash-conflicting recording', async () => {
  const f = fixture({ pending: true });
  await uploadAudio(f.ctx, input());
  const operationId = f.active().id;
  assert.equal((await refreshUpload(f.ctx, operationId)).operation.state, 'verification_pending');
  const row = f.cloud.get('rec_1');
  row.end_user_id = 'eu_other';
  await assert.rejects(refreshUpload(f.ctx, operationId), { status: 403 });
  row.end_user_id = 'eu_a';
  row.content_sha256 = 'b'.repeat(64);
  await assert.rejects(refreshUpload(f.ctx, operationId), { status: 409 });
  assert.equal(f.writes.length, 3);
  assert.equal(f.putCount(), 1);
});

test('425 remains pending without a completion loop and only verified GET evidence closes it', async () => {
  const f = fixture({ pending: true });
  assert.equal((await uploadAudio(f.ctx, input())).operation.state, 'verification_pending');
  assert.equal((await uploadAudio(f.ctx, input())).operation.state, 'verification_pending');
  f.cloud.get('rec_1').content_sha256_verified_at = '2026-10-12T00:01:00Z';
  assert.equal((await uploadAudio(f.ctx, input())).operation.state, 'complete');
  assert.equal(f.writes.length, 3);
  assert.equal(f.putCount(), 1);
});

test('forged create owner and changed ownership before storage prevent the next privileged write', async () => {
  const created = fixture({ modifyCreate: (row) => ({ ...row, end_user_id: 'eu_other' }) });
  await assert.rejects(uploadAudio(created.ctx, input()), { status: 403 });
  assert.equal(created.writes.length, 1);
  assert.equal(created.active().resourceId, 'rec_1');
  assert.equal(created.active().state, 'uncertain');
  assert.equal(
    (await refreshUpload(created.ctx, created.active().id)).operation.state,
    'uncertain',
  );
  assert.equal(created.writes.length, 1);
  const changed = fixture({
    modifyRead: (row, { writes }) =>
      writes.length >= 2 ? { ...row, end_user_id: 'eu_other' } : row,
  });
  await assert.rejects(uploadAudio(changed.ctx, input()), { status: 403 });
  assert.equal(changed.writes.length, 2);
  assert.equal(changed.putCount(), 0);
});

test('completion refuses a forged ID, owner, project, digest, missing verification or incompatible status', async () => {
  for (const overrides of [
    { id: 'rec_forged' },
    { end_user_id: 'eu_other' },
    { project_id: 'proj_other' },
    { content_sha256: 'b'.repeat(64) },
    { content_sha256_verified_at: null },
    { status: 'pending' },
  ]) {
    const f = fixture({ modifyComplete: (row) => ({ ...row, ...overrides }) });
    await assert.rejects(uploadAudio(f.ctx, input()));
    assert.equal(f.active().state, 'uncertain');
    assert.equal(f.writes.length, 3);
  }
});

test('duplicate reconciliation cannot return a now foreign recording or accept a different stored hash', async () => {
  const f = fixture({ pending: true });
  await uploadAudio(f.ctx, input());
  const row = f.cloud.get('rec_1');
  row.end_user_id = 'eu_other';
  await assert.rejects(uploadAudio(f.ctx, input()), { status: 403 });
  row.end_user_id = 'eu_a';
  row.content_sha256 = 'b'.repeat(64);
  await assert.rejects(uploadAudio(f.ctx, input()), { status: 409 });
  assert.equal(f.writes.length, 3);
  assert.equal(f.putCount(), 1);
});

test('invalid filename, empty/oversized file and unapproved content types never claim or write', async () => {
  const f = fixture();
  for (const overrides of [
    { name: '\nforged' },
    { name: 'x'.repeat(256) },
    { bytes: Buffer.alloc(0) },
    { bytes: Buffer.alloc(25 * 1024 * 1024 + 1) },
    { contentType: 'text/html' },
    { contentType: 'audio/wav; charset=utf-8' },
  ])
    await assert.rejects(uploadAudio(f.ctx, { ...input(), ...overrides }));
  assert.equal(f.operations.size, 0);
  assert.equal(f.writes.length, 0);
});

test('intent binds bytes, filename, type and server account scope and rejects tampered details', async () => {
  const f = fixture({ lose: 'create' });
  await assert.rejects(uploadAudio(f.ctx, input()));
  const original = f.active();
  original.details.digest = 'b'.repeat(64);
  await assert.rejects(uploadAudio(f.ctx, input()), { status: 409 });
  assert.equal(f.writes.length, 1);
  f.ctx.principal = { ...principal, accountId: 'account-b', scopeId: 'scope-b' };
  await assert.rejects(uploadAudio(f.ctx, input()));
  assert.equal(f.operations.size, 2);
  assert.notEqual(original.anchor, f.active().anchor);
});

test('API-key scope rotation cannot create a fresh upload claim or resend an unknown create', async () => {
  const f = fixture({ lose: 'create' });
  await assert.rejects(uploadAudio(f.ctx, input()), /lost create/);
  const savedAnchor = f.active().anchor;
  f.ctx.config.apiKey = 'sk_test_rotated_synthetic_key';
  f.ctx.principal = { ...principal, scopeId: 'scope-after-key-rotation' };
  await assert.rejects(uploadAudio(f.ctx, input()), { status: 409 });
  assert.equal(f.operations.size, 1);
  assert.equal(f.active().anchor, savedAnchor);
  assert.equal(f.active().state, 'uncertain');
  assert.equal(f.writes.length, 1);
  assert.equal(f.putCount(), 0);
});
