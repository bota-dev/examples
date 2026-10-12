import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../server/errors.mjs';
import { listSummaries, listTranscriptions, refreshProcessing, startSummary, startTranscription } from '../../server/features/processing.mjs';

const principal = { accountId: 'alice', scopeId: 'scope-alice', endUserId: 'eu_alice', projectId: 'proj_test' };
const recording = { id: 'rec_one', end_user_id: principal.endUserId, project_id: principal.projectId,
  status: 'uploaded', created_at: '2026-10-12T10:00:00Z', content_sha256: 'a'.repeat(64),
  content_sha256_verified_at: '2026-10-12T10:00:01Z' };
const txn = { id: 'txn_one', recording_id: recording.id, status: 'completed', full_text: '<script>synthetic transcript</script>',
  created_at: recording.created_at, provider: 'private-provider', error_message: 'private-error' };
const summary = { id: 'sum_one', transcription_id: txn.id, status: 'completed', template_id: 'tmpl_general_notes',
  created_at: recording.created_at, custom_prompt: 'private-prompt', output: { overview: 'Synthetic overview',
    key_points: ['point'], action_items: [], participants: [], decisions: [], private_blob: 'never return' } };
const page = data => ({ data, has_more: false, next_cursor: null });

function fixture() {
  const operations = new Map(), calls = [], order = [];
  const ctx = { principal: { ...principal }, store: {
    get(owner, id) {
      const row = [...operations.entries()].find(([key, operation]) =>
        key.startsWith(`${owner.accountId}:${owner.scopeId}:`) && operation.id === id)?.[1];
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Operation unavailable.');
      return structuredClone(row);
    },
    claim(owner, kind, anchor, details) {
      order.push('claim');
      const key = `${owner.accountId}:${owner.scopeId}:${kind}:${anchor}`;
      if (operations.has(key)) return { fresh: false, operation: structuredClone(operations.get(key)) };
      const operation = { id: `op_${operations.size}`, kind, anchor, details, state: 'claimed', resourceId: null, updatedAt: recording.created_at };
      operations.set(key, operation);
      return { fresh: true, operation: structuredClone(operation) };
    },
    save(owner, id, changes) {
      order.push(`save:${changes.state}`);
      const operation = [...operations.values()].find(row => row.id === id);
      assert.ok(operation);
      Object.assign(operation, { ...changes, details: { ...operation.details, ...changes.details } });
      return structuredClone(operation);
    },
  }, async request(method, path, body) {
    calls.push({ method, path, body });
    order.push(`${method}:${path}`);
    if (method === 'POST') {
      assert.equal([...operations.values()].at(-1).state, 'starting', 'durable state must precede write');
      return structuredClone(path === '/transcriptions' ? txn : summary);
    }
    if (path === '/recordings/rec_one') return structuredClone(recording);
    if (path === '/transcriptions/txn_one') return structuredClone(txn);
    if (path === '/summaries/sum_one') return structuredClone(summary);
    if (path.startsWith('/transcriptions?')) return page([]);
    if (path.startsWith('/summaries?')) return page([]);
    throw new Error(`Unexpected synthetic request ${path}`);
  } };
  return { ctx, calls, operations, order };
}

test('transcripts and general notes project only authorized selected fields', async () => {
  const { ctx } = fixture();
  const request = ctx.request;
  ctx.request = (method, path, body) => path.startsWith('/transcriptions?') ? page([txn]) :
    path.startsWith('/summaries?') ? page([summary]) : request(method, path, body);
  assert.deepEqual(await listTranscriptions(ctx, recording.id), { data: [{ id: txn.id, recording_id: recording.id,
    status: 'completed', created_at: recording.created_at, full_text: txn.full_text }] });
  const result = await listSummaries(ctx, txn.id);
  assert.deepEqual(result.data[0].output, { overview: 'Synthetic overview', key_points: ['point'], action_items: [], participants: [], decisions: [] });
  assert.ok(!JSON.stringify(result).includes('private'));
});

test('wrong exact source, foreign project and foreign current owner block content', async () => {
  for (const attack of ['source', 'project', 'owner']) {
    const { ctx } = fixture();
    const request = ctx.request;
    ctx.request = (method, path, body) => {
      if (path.startsWith('/transcriptions?')) return page([txn]);
      if (path === '/transcriptions/txn_one' && attack === 'source') return { ...txn, recording_id: 'rec_foreign' };
      if (path === '/transcriptions/txn_one' && attack === 'project') return { ...txn, project_id: 'proj_foreign' };
      if (path === '/recordings/rec_one' && attack === 'owner') return { ...recording, end_user_id: 'eu_bob' };
      return request(method, path, body);
    };
    await assert.rejects(listTranscriptions(ctx, recording.id), AppError);
  }
});

test('a current-owner change at the final read suppresses the entire transcript output', async () => {
  const { ctx } = fixture();
  const request = ctx.request;
  let ownershipReads = 0;
  ctx.request = (method, path, body) => {
    if (path.startsWith('/transcriptions?')) return page([txn]);
    if (path === '/recordings/rec_one' && ++ownershipReads === 3) return { ...recording, end_user_id: 'eu_bob' };
    return request(method, path, body);
  };
  await assert.rejects(listTranscriptions(ctx, recording.id), { code: 'recording_forbidden' });
});

test('pagination retains fixed source filter and rejects repeated cursors', async () => {
  const { ctx } = fixture();
  const request = ctx.request;
  const paths = [];
  ctx.request = (method, path, body) => {
    if (path.startsWith('/transcriptions?')) {
      paths.push(path);
      const id = paths.length === 1 ? 'txn_one' : 'txn_two';
      return { data: [{ ...txn, id }], has_more: true, next_cursor: 'cursor-one' };
    }
    if (path === '/transcriptions/txn_two') return { ...txn, id: 'txn_two' };
    return request(method, path, body);
  };
  await assert.rejects(listTranscriptions(ctx, recording.id), { code: 'invalid_page' });
  assert.equal(paths.length, 2);
  for (const path of paths) assert.equal(new URL(path, 'https://fixture.test').searchParams.get('recording_id'), recording.id);
});

test('single durable create and repeated intent reconciles known job by GET only', async () => {
  for (const kind of ['transcription', 'summary']) {
    const { ctx, calls, order } = fixture();
    const start = kind === 'transcription' ? startTranscription : startSummary;
    const source = kind === 'transcription' ? recording.id : txn.id;
    const first = await start(ctx, source);
    const second = await start(ctx, source);
    assert.equal(first.operation.resource_id, kind === 'transcription' ? txn.id : summary.id);
    assert.equal(second.operation.id, first.operation.id);
    assert.equal(calls.filter(row => row.method === 'POST').length, 1);
    const post = calls.find(row => row.method === 'POST');
    assert.deepEqual(post.body, kind === 'transcription' ? { recording_id: recording.id } :
      { transcription_id: txn.id, template_id: 'tmpl_general_notes' });
    assert.ok(order.indexOf('save:starting') < order.indexOf(`POST:${post.path}`));
  }
});

test('existing source job is reused without a replacement POST', async () => {
  const { ctx, calls } = fixture();
  const request = ctx.request;
  ctx.request = (method, path, body) => path.startsWith('/transcriptions?') ? page([txn]) : request(method, path, body);
  const result = await startTranscription(ctx, recording.id);
  assert.equal(result.operation.resource_id, txn.id);
  assert.equal(calls.filter(row => row.method === 'POST').length, 0);
});

test('lost create response retains uncertain intent and never replaces or repeats its POST', async () => {
  const { ctx, calls, operations } = fixture();
  const request = ctx.request;
  let writes = 0;
  ctx.request = (method, path, body) => {
    if (method === 'POST') { writes += 1; throw new Error('secret upstream body'); }
    return request(method, path, body);
  };
  await assert.rejects(startTranscription(ctx, recording.id), error => error.code === 'operation_uncertain' && !error.message.includes('secret'));
  const second = await startTranscription(ctx, recording.id);
  assert.equal(writes, 1);
  assert.equal(second.operation.state, 'uncertain');
  assert.equal(second.operation.resource_id, null);
  assert.equal([...operations.values()].length, 1);
  assert.equal(calls.filter(row => row.path.startsWith('/transcriptions?')).length, 2);
});

test('a failed durable starting save prevents the provider write', async () => {
  const { ctx, calls } = fixture();
  const save = ctx.store.save;
  ctx.store.save = (owner, id, changes) => {
    if (changes.state === 'starting') throw new Error('disk failed');
    return save(owner, id, changes);
  };
  await assert.rejects(startSummary(ctx, txn.id), { code: 'operation_uncertain' });
  assert.equal(calls.filter(row => row.method === 'POST').length, 0);
});

test('uploaded alone and incomplete source never start processing', async () => {
  const { ctx, calls } = fixture();
  const request = ctx.request;
  ctx.request = (method, path, body) => path === '/recordings/rec_one' ? { ...recording, content_sha256_verified_at: null } : request(method, path, body);
  await assert.rejects(startTranscription(ctx, recording.id), { code: 'upload_unverified' });
  ctx.request = (method, path, body) => path === '/transcriptions/txn_one' ? { ...txn, status: 'pending', full_text: null } : request(method, path, body);
  await assert.rejects(startSummary(ctx, txn.id), { code: 'transcription_incomplete' });
  assert.equal(calls.filter(row => row.method === 'POST').length, 0);
});

test('premature source readiness failures consume no intent and later eligibility permits one create', async () => {
  for (const kind of ['transcription', 'summary']) {
    const { ctx, calls, operations } = fixture();
    const request = ctx.request;
    let eligible = false;
    ctx.request = (method, path, body) => {
      if (!eligible && kind === 'transcription' && path === '/recordings/rec_one') return { ...recording, content_sha256_verified_at: null };
      if (!eligible && kind === 'summary' && path === '/transcriptions/txn_one') return { ...txn, status: 'pending', full_text: null };
      return request(method, path, body);
    };
    const start = kind === 'transcription' ? startTranscription : startSummary;
    const source = kind === 'transcription' ? recording.id : txn.id;
    await assert.rejects(start(ctx, source), AppError);
    assert.equal(operations.size, 0);
    eligible = true;
    const result = await start(ctx, source);
    assert.equal(result.operation.state, 'complete');
    await start(ctx, source);
    assert.equal(calls.filter(row => row.method === 'POST').length, 1);
  }
});

test('a known existing transcription on a processing recording is reused with no POST', async () => {
  const { ctx, calls } = fixture();
  const request = ctx.request;
  ctx.request = (method, path, body) => path === '/recordings/rec_one' ? { ...recording, status: 'processing' } :
    path.startsWith('/transcriptions?') ? page([txn]) : request(method, path, body);
  const result = await startTranscription(ctx, recording.id);
  assert.equal(result.operation.resource_id, txn.id);
  assert.equal(calls.filter(row => row.method === 'POST').length, 0);
});

test('summary rejects wrong recording links and malformed notes rather than printing arbitrary output', async () => {
  for (const altered of [{ ...summary, recording_id: 'rec_foreign' }, { ...summary, output: { arbitrary: 'private' } }]) {
    const { ctx } = fixture();
    const request = ctx.request;
    ctx.request = (method, path, body) => path.startsWith('/summaries?') ? page([summary]) :
      path === '/summaries/sum_one' ? altered : request(method, path, body);
    await assert.rejects(listSummaries(ctx, txn.id), AppError);
  }
});

test('known saved ID survives a failed observation and resumes through GET only', async () => {
  const { ctx, calls, operations } = fixture();
  const request = ctx.request;
  let failed = true;
  ctx.request = (method, path, body) => {
    if (path === '/transcriptions/txn_one' && failed) throw new AppError(502, 'upstream_failed', 'Synthetic unavailable read.');
    return request(method, path, body);
  };
  await assert.rejects(startTranscription(ctx, recording.id), { code: 'upstream_failed' });
  assert.equal([...operations.values()][0].resourceId, txn.id);
  failed = false;
  const result = await startTranscription(ctx, recording.id);
  assert.equal(result.operation.resource_id, txn.id);
  assert.equal(result.operation.state, 'complete');
  assert.equal(calls.filter(row => row.method === 'POST').length, 1);
});

test('explicit foreign job end-user markers never grant access through an owned source', async () => {
  const { ctx } = fixture();
  const request = ctx.request;
  ctx.request = (method, path, body) => path.startsWith('/transcriptions?') ? page([{ ...txn, end_user_id: 'eu_bob' }]) :
    request(method, path, body);
  await assert.rejects(listTranscriptions(ctx, recording.id), { code: 'job_not_owned' });
});

test('processing refresh observes known jobs without claiming or writing upstream', async () => {
  for (const kind of ['transcription', 'summary']) {
    const { ctx, calls, order } = fixture();
    const result = await (kind === 'transcription' ? startTranscription(ctx, recording.id) : startSummary(ctx, txn.id));
    calls.length = 0;
    order.length = 0;
    const refreshed = await refreshProcessing(ctx, result.operation.id);
    assert.equal(refreshed.operation.resource_id, result.operation.resource_id);
    assert.equal(refreshed.operation.state, 'complete');
    assert.ok(calls.every(row => row.method === 'GET'));
    assert.ok(!order.includes('claim'));
    assert.ok(!calls.some(row => row.path.includes('?')), 'refresh does not discover a replacement job');
  }
});

test('unknown processing refresh retains the same intent and only checks its current owner/source', async () => {
  const { ctx, calls, order } = fixture();
  const claim = ctx.store.claim(ctx.principal, 'transcription', recording.id, { recordingId: recording.id });
  ctx.store.save(ctx.principal, claim.operation.id, { state: 'uncertain' });
  order.length = 0;
  const refreshed = await refreshProcessing(ctx, claim.operation.id);
  assert.equal(refreshed.operation.state, 'uncertain');
  assert.equal(refreshed.operation.resource_id, null);
  assert.deepEqual(calls.map(row => row.path), ['/recordings/rec_one']);
  assert.ok(!order.includes('claim'));
});

test('processing refresh rejects wrong kinds, altered stored source and foreign account ownership', async () => {
  for (const attack of ['kind', 'source', 'account']) {
    const { ctx, calls, operations } = fixture();
    const result = await startSummary(ctx, txn.id);
    calls.length = 0;
    if (attack === 'kind') [...operations.values()][0].kind = 'ask';
    if (attack === 'source') {
      [...operations.values()][0].details.recordingId = 'rec_other';
      const request = ctx.request;
      ctx.request = (method, path, body) => path === '/recordings/rec_other' ?
        { ...recording, id: 'rec_other' } : request(method, path, body);
    }
    if (attack === 'account') ctx.principal = { ...principal, accountId: 'bob', scopeId: 'scope-bob' };
    await assert.rejects(refreshProcessing(ctx, result.operation.id), AppError);
    assert.ok(calls.every(row => row.method === 'GET'));
  }
});
