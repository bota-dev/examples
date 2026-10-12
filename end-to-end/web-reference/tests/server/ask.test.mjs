import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../server/errors.mjs';
import { askRecording, refreshAsk } from '../../server/features/ask.mjs';

const principal = { accountId: 'alice', scopeId: 'scope-alice', endUserId: 'eu_alice', projectId: 'proj_test' };
const recording = { id: 'rec_one', end_user_id: principal.endUserId, project_id: principal.projectId,
  status: 'completed', created_at: '2026-10-12T10:00:00Z' };
const question = 'What did the synthetic speaker decide?';
const assistant = { id: 'msg_answer', role: 'assistant', content: '<b>Ship the synthetic fixture.</b>',
  parts: [{ type: 'text', text: 'Ship the synthetic fixture.' }, { type: 'citation', recording_id: recording.id, start_ms: 1200 }],
  finish_reason: 'stop', provider: 'private-provider', model: 'private-model', tokens: { input: 100 } };
const user = { id: 'msg_question', role: 'user', content: question };
const page = data => ({ data, has_more: false, next_cursor: null });

function fixture() {
  const calls = [], operations = new Map(), order = [];
  let messages = [];
  const session = () => ({ id: 'as_one', scope: { type: 'recording', recording_ids: [recording.id] },
    message_count: messages.length, title: 'private-title' });
  const ctx = { principal: { ...principal }, store: {
    get(owner, id) {
      const row = [...operations.entries()].find(([key, operation]) =>
        key.startsWith(`${owner.accountId}:${owner.scopeId}:`) && operation.id === id)?.[1];
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Operation unavailable.');
      return structuredClone(row);
    },
    claim(owner, kind, anchor, details) {
      order.push('claim');
      const key = `${owner.accountId}:${owner.scopeId}:${anchor}`;
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
    if (path === '/recordings/rec_one') return structuredClone(recording);
    if (method === 'POST' && path === '/ask/sessions') {
      assert.equal([...operations.values()].at(-1).state, 'creating');
      return session();
    }
    if (method === 'POST' && path === '/ask/sessions/as_one/messages') {
      const operation = [...operations.values()].at(-1);
      assert.equal(operation.state, 'sending');
      assert.equal(operation.resourceId, 'as_one', 'session ID must be durable before sending');
      messages = structuredClone([user, assistant]);
      return { session_id: 'as_one', message: structuredClone(assistant), sources: [] };
    }
    if (path.startsWith('/ask/sessions?')) {
      const query = new URL(path, 'https://fixture.test').searchParams;
      assert.equal(query.get('end_user_id'), ctx.principal.endUserId);
      assert.equal(query.get('scope_type'), 'recording');
      assert.equal(query.get('recording_id'), recording.id);
      return page([session()]);
    }
    if (path === '/ask/sessions/as_one') return session();
    if (path === '/ask/sessions/as_one/messages?limit=3') return page(structuredClone(messages));
    throw new Error(`Unexpected fixture request ${path}`);
  } };
  return { ctx, calls, operations, order, session, setMessages: value => { messages = structuredClone(value); } };
}

test('one empty-session create plus one send, then safe selected answer and GET-only repeated intent', async () => {
  const { ctx, calls, operations, order } = fixture();
  const first = await askRecording(ctx, recording.id, question);
  const second = await askRecording(ctx, recording.id, question);
  assert.equal(first.answer, assistant.content);
  assert.deepEqual(first.citations, [{ recording_id: recording.id, start_ms: 1200 }]);
  assert.equal(first.operation.state, 'complete');
  assert.deepEqual(second, first);
  assert.equal(calls.filter(row => row.method === 'POST').length, 2);
  assert.deepEqual(calls.find(row => row.method === 'POST' && row.path === '/ask/sessions').body,
    { scope: { type: 'recording', recording_id: recording.id }, end_user_id: principal.endUserId });
  assert.ok(order.indexOf('save:created') < order.indexOf('POST:/ask/sessions/as_one/messages'));
  assert.ok(!JSON.stringify(first).includes('private'));
  assert.ok(!JSON.stringify([...operations.values()]).includes(question), 'journal stores hash, not question text');
});

test('membership absence prevents exact session GET despite a saved known ID and optional owner fields', async () => {
  const { ctx, calls } = fixture();
  await askRecording(ctx, recording.id, question);
  calls.length = 0;
  const request = ctx.request;
  ctx.request = (method, path, body) => path.startsWith('/ask/sessions?') ? page([]) : request(method, path, body);
  await assert.rejects(askRecording(ctx, recording.id, question), { code: 'session_not_owned' });
  assert.equal(calls.filter(row => row.path === '/ask/sessions/as_one').length, 0);
  assert.equal(calls.filter(row => row.method === 'POST').length, 0);
});

test('owner and recording filters remain fixed across membership pagination', async () => {
  const { ctx, session } = fixture();
  const request = ctx.request;
  const paths = [];
  ctx.request = (method, path, body) => {
    if (path.startsWith('/ask/sessions?')) {
      paths.push(path);
      const query = new URL(path, 'https://fixture.test').searchParams;
      assert.equal(query.get('end_user_id'), principal.endUserId);
      assert.equal(query.get('recording_id'), recording.id);
      if (!query.has('cursor')) return { data: [{ ...session(), id: 'as_other' }], has_more: true, next_cursor: 'membership-cursor' };
    }
    return request(method, path, body);
  };
  await askRecording(ctx, recording.id, question);
  assert.ok(paths.some(path => path.includes('cursor=membership-cursor')));
});

test('unknown session creation never repeats and emits no upstream failure blob', async () => {
  const { ctx, operations } = fixture();
  const request = ctx.request;
  let writes = 0;
  ctx.request = (method, path, body) => {
    if (method === 'POST') { writes += 1; throw new Error('secret provider token'); }
    return request(method, path, body);
  };
  await assert.rejects(askRecording(ctx, recording.id, question), error => error.code === 'operation_uncertain' && !error.message.includes('secret'));
  const repeated = await askRecording(ctx, recording.id, question);
  assert.equal(writes, 1);
  assert.equal(repeated.operation.state, 'uncertain');
  assert.equal(repeated.operation.resource_id, null);
  assert.equal(operations.size, 1);
});

test('lost message response can recover a persisted exact pair through GET only', async () => {
  const { ctx, calls } = fixture();
  const request = ctx.request;
  ctx.request = async (method, path, body) => {
    const result = await request(method, path, body);
    if (method === 'POST' && path.endsWith('/messages')) throw new Error('connection lost after send');
    return result;
  };
  await assert.rejects(askRecording(ctx, recording.id, question), { code: 'operation_uncertain' });
  const count = calls.filter(row => row.method === 'POST').length;
  const recovered = await askRecording(ctx, recording.id, question);
  assert.equal(recovered.operation.state, 'complete');
  assert.equal(recovered.answer, assistant.content);
  assert.equal(calls.filter(row => row.method === 'POST').length, count);
});

test('unknown send with only a user message is retained without provider fallback or resend', async () => {
  const { ctx, setMessages, calls } = fixture();
  const request = ctx.request;
  let sends = 0;
  ctx.request = (method, path, body) => {
    if (method === 'POST' && path.endsWith('/messages')) { sends += 1; setMessages([user]); throw new Error('provider failed'); }
    return request(method, path, body);
  };
  await assert.rejects(askRecording(ctx, recording.id, question), { code: 'operation_uncertain' });
  const recovered = await askRecording(ctx, recording.id, question);
  assert.equal(sends, 1);
  assert.equal(recovered.operation.state, 'uncertain');
  assert.ok(!('answer' in recovered));
  assert.equal(calls.filter(row => row.method === 'POST').length, 1, 'only the initial session create was recorded');
});

test('session-ID persistence failure prevents message send and never recreates the session', async () => {
  const { ctx, calls } = fixture();
  const save = ctx.store.save;
  ctx.store.save = (owner, id, changes) => {
    if (changes.state === 'created') throw new Error('disk unavailable');
    return save(owner, id, changes);
  };
  await assert.rejects(askRecording(ctx, recording.id, question), { code: 'operation_uncertain' });
  await askRecording(ctx, recording.id, question);
  assert.equal(calls.filter(row => row.method === 'POST').length, 1);
});

test('foreign citations, wrong question hash and extra history never return answer content', async () => {
  for (const attack of ['citation', 'question', 'extra']) {
    const { ctx, setMessages } = fixture();
    await askRecording(ctx, recording.id, question);
    if (attack === 'citation') setMessages([user, { ...assistant, parts: [{ type: 'citation', recording_id: 'rec_foreign', start_ms: 0 }] }]);
    if (attack === 'question') setMessages([{ ...user, content: 'different question' }, assistant]);
    if (attack === 'extra') setMessages([user, assistant, { ...user, id: 'msg_extra' }]);
    await assert.rejects(askRecording(ctx, recording.id, question), AppError);
  }
});

test('a signed-in foreign owner cannot read another account recording or reuse its journal', async () => {
  const { ctx, operations, calls } = fixture();
  await askRecording(ctx, recording.id, question);
  ctx.principal = { ...principal, accountId: 'bob', scopeId: 'scope-bob', endUserId: 'eu_bob' };
  const count = calls.filter(row => row.method === 'POST').length;
  await assert.rejects(askRecording(ctx, recording.id, question), { code: 'recording_forbidden' });
  assert.equal(operations.size, 1);
  assert.equal(calls.filter(row => row.method === 'POST').length, count);
});

test('final recording owner change suppresses a successful provider response', async () => {
  const { ctx } = fixture();
  const request = ctx.request;
  let reads = 0;
  ctx.request = (method, path, body) => {
    if (path === '/recordings/rec_one' && ++reads === 3) return { ...recording, end_user_id: 'eu_bob' };
    return request(method, path, body);
  };
  await assert.rejects(askRecording(ctx, recording.id, question), { code: 'recording_forbidden' });
});

test('questions over the public bound are rejected before reads or claims', async () => {
  const { ctx, calls, operations } = fixture();
  await assert.rejects(askRecording(ctx, recording.id, 'x'.repeat(10_001)), { code: 'invalid_question' });
  assert.equal(calls.length, 0);
  assert.equal(operations.size, 0);
});

test('ill-formed Unicode cannot alias another question hash', async () => {
  const { ctx, calls, operations } = fixture();
  await assert.rejects(askRecording(ctx, recording.id, '\ud800'), { code: 'invalid_question' });
  assert.equal(calls.length, 0);
  assert.equal(operations.size, 0);
});

test('bounded membership cap cannot be reported as an observed owner absence', async () => {
  const { ctx, session } = fixture();
  const request = ctx.request;
  let pages = 0;
  ctx.request = (method, path, requestBody) => {
    if (path.startsWith('/ask/sessions?')) {
      pages += 1;
      return { data: [{ ...session(), id: `as_other${pages}` }], has_more: true, next_cursor: `cursor${pages}` };
    }
    return request(method, path, requestBody);
  };
  await assert.rejects(askRecording(ctx, recording.id, question), { code: 'membership_limit' });
  assert.equal(pages, 10);
});

test('unexpected context references or message session IDs block recovered answer', async () => {
  for (const history of [[{ ...user, context_refs: [{ type: 'recording', id: 'rec_foreign' }] }, assistant],
    [user, { ...assistant, session_id: 'as_foreign' }]]) {
    const { ctx, setMessages } = fixture();
    await askRecording(ctx, recording.id, question);
    setMessages(history);
    await assert.rejects(askRecording(ctx, recording.id, question), AppError);
  }
});

test('Ask refresh recovers a known answer through owner-filtered GETs without claiming or sending', async () => {
  const { ctx, calls, operations, order } = fixture();
  const initial = await askRecording(ctx, recording.id, question);
  [...operations.values()][0].state = 'uncertain';
  calls.length = 0;
  order.length = 0;
  const refreshed = await refreshAsk(ctx, initial.operation.id);
  assert.equal(refreshed.operation.state, 'complete');
  assert.equal(refreshed.answer, assistant.content);
  assert.deepEqual(refreshed.citations, [{ recording_id: recording.id, start_ms: 1200 }]);
  assert.ok(calls.every(row => row.method === 'GET'));
  assert.ok(!order.includes('claim'));
  assert.ok(calls.findIndex(row => row.path.startsWith('/ask/sessions?')) <
    calls.findIndex(row => row.path === '/ask/sessions/as_one'));
});

test('unknown Ask refresh returns the retained operation after a current owner check', async () => {
  const { ctx, operations, calls, order } = fixture();
  const request = ctx.request;
  ctx.request = (method, path, requestBody) => {
    if (method === 'POST') throw new Error('synthetic lost create');
    return request(method, path, requestBody);
  };
  await assert.rejects(askRecording(ctx, recording.id, question), { code: 'operation_uncertain' });
  const saved = [...operations.values()][0];
  calls.length = 0;
  order.length = 0;
  const refreshed = await refreshAsk(ctx, saved.id);
  assert.equal(refreshed.operation.state, 'uncertain');
  assert.equal(refreshed.operation.resource_id, null);
  assert.ok(!('answer' in refreshed));
  assert.deepEqual(calls.map(row => row.path), ['/recordings/rec_one']);
  assert.ok(!order.includes('claim'));
});

test('Ask refresh rejects foreign account, malformed question hash and current recording reassignment', async () => {
  for (const attack of ['account', 'hash', 'owner']) {
    const { ctx, operations, calls } = fixture();
    const initial = await askRecording(ctx, recording.id, question);
    calls.length = 0;
    if (attack === 'account') ctx.principal = { ...principal, accountId: 'bob', scopeId: 'scope-bob' };
    if (attack === 'hash') [...operations.values()][0].details.questionHash = 'invalid';
    if (attack === 'owner') {
      const request = ctx.request;
      ctx.request = (method, path, requestBody) => path === '/recordings/rec_one' ?
        { ...recording, end_user_id: 'eu_bob' } : request(method, path, requestBody);
    }
    await assert.rejects(refreshAsk(ctx, initial.operation.id), AppError);
    assert.ok(calls.every(row => row.method === 'GET'));
    assert.ok(!calls.some(row => row.path.startsWith('/ask/sessions')), 'initial owner fence precedes session reads');
  }
});
