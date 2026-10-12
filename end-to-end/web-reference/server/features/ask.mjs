import { createHash } from 'node:crypto';
import { AppError, assertProject, ensure, isId, object, operationView } from '../errors.mjs';
import { verifyRecording } from './recordings.mjs';

const hash = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

function checkSession(ctx, session, recordingId, expectedId) {
  ensure(
    object(session) &&
      isId(session.id, 'as') &&
      (!expectedId || session.id === expectedId) &&
      object(session.scope) &&
      session.scope.type === 'recording' &&
      Array.isArray(session.scope.recording_ids) &&
      session.scope.recording_ids.length === 1 &&
      session.scope.recording_ids[0] === recordingId &&
      (!('end_user_id' in session) || session.end_user_id === ctx.principal.endUserId) &&
      Number.isSafeInteger(session.message_count) &&
      session.message_count >= 0,
    502,
    'invalid_session',
    'The Ask session identity or recording scope did not match.',
  );
  assertProject(session, ctx);
  return session;
}

async function ownedSession(ctx, id, recordingId) {
  // Exact GET omits documented owner fields on some versions. Owner-filtered membership is required first.
  const cursors = new Set(),
    ids = new Set();
  let cursor,
    member = false,
    more = false;
  for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
    const query = new URLSearchParams({
      end_user_id: ctx.principal.endUserId,
      scope_type: 'recording',
      recording_id: recordingId,
      limit: '20',
    });
    if (cursor) query.set('cursor', cursor);
    const page = await ctx.request('GET', `/ask/sessions?${query}`);
    ensure(
      object(page) &&
        Array.isArray(page.data) &&
        page.data.length <= 20 &&
        typeof page.has_more === 'boolean',
      502,
      'invalid_page',
      'The Ask membership list was invalid.',
    );
    more = page.has_more;
    for (const row of page.data) {
      checkSession(ctx, row, recordingId);
      ensure(!ids.has(row.id), 502, 'invalid_page', 'The Ask membership list repeated a session.');
      ids.add(row.id);
      if (row.id === id) member = true;
    }
    if (member) break;
    if (!page.has_more) {
      ensure(
        page.next_cursor == null,
        502,
        'invalid_page',
        'The Ask membership list had an unexpected cursor.',
      );
      break;
    }
    ensure(
      page.data.length > 0 &&
        typeof page.next_cursor === 'string' &&
        page.next_cursor.length > 0 &&
        page.next_cursor.length <= 2048 &&
        !/[\u0000-\u0020\u007f]/.test(page.next_cursor) &&
        !cursors.has(page.next_cursor),
      502,
      'invalid_page',
      'The Ask membership cursor was invalid.',
    );
    cursors.add(page.next_cursor);
    cursor = page.next_cursor;
  }
  ensure(
    member || !more,
    503,
    'membership_limit',
    'The bounded Ask membership list could not establish this session.',
  );
  ensure(
    member,
    403,
    'session_not_owned',
    'The known Ask session was absent from the current owner-filtered membership.',
  );
  return checkSession(ctx, await ctx.request('GET', `/ask/sessions/${id}`), recordingId, id);
}

function answer(message, recordingId) {
  ensure(
    object(message) &&
      isId(message.id, 'msg') &&
      message.role === 'assistant' &&
      typeof message.content === 'string' &&
      message.content.trim().length > 0 &&
      message.content.length <= 1_000_000 &&
      message.finish_reason === 'stop' &&
      Array.isArray(message.parts) &&
      message.parts.length <= 1000,
    502,
    'invalid_answer',
    'Ask did not return a complete supported answer.',
  );
  const citations = [];
  for (const part of message.parts) {
    ensure(object(part), 502, 'invalid_answer', 'The Ask answer parts were invalid.');
    if (part.type === 'text') {
      ensure(
        typeof part.text === 'string' && part.text.length <= 1_000_000,
        502,
        'invalid_answer',
        'The Ask text part was invalid.',
      );
    } else {
      ensure(
        part.type === 'citation' &&
          part.recording_id === recordingId &&
          Number.isSafeInteger(part.start_ms) &&
          part.start_ms >= 0,
        502,
        'invalid_citation',
        'The Ask citation did not belong to the selected recording.',
      );
      citations.push({ recording_id: recordingId, start_ms: part.start_ms });
    }
    ensure(
      !('recording_id' in part) || part.recording_id === recordingId,
      502,
      'invalid_citation',
      'The Ask answer part referenced a different recording.',
    );
  }
  return { answer: message.content, citations };
}

async function reconcile(ctx, operation, recordingId, questionHash) {
  ensure(
    operation.details.recordingId === recordingId &&
      operation.details.questionHash === questionHash,
    409,
    'intent_conflict',
    'The retained Ask intent did not match this question and recording.',
  );
  if (!operation.resourceId) return { operation: operationView(operation) };
  ensure(
    isId(operation.resourceId, 'as'),
    409,
    'intent_conflict',
    'The retained Ask session identifier was invalid.',
  );
  const session = await ownedSession(ctx, operation.resourceId, recordingId);
  const page = await ctx.request('GET', `/ask/sessions/${operation.resourceId}/messages?limit=3`);
  ensure(
    object(page) &&
      Array.isArray(page.data) &&
      page.data.length <= 3 &&
      page.has_more === false &&
      page.next_cursor == null &&
      page.data.length === session.message_count,
    502,
    'invalid_history',
    'Ask history changed or exceeds this single-question example.',
  );
  const users = page.data.filter((row) => row?.role === 'user');
  const assistants = page.data.filter((row) => row?.role === 'assistant');
  ensure(
    page.data.length <= 2 &&
      users.length <= 1 &&
      assistants.length <= 1 &&
      users.length + assistants.length === page.data.length,
    502,
    'invalid_history',
    'Ask history did not match a single question and answer.',
  );
  if (users.length) {
    const user = users[0];
    ensure(
      object(user) &&
        isId(user.id, 'msg') &&
        typeof user.content === 'string' &&
        user.content.length <= 10_000 &&
        user.content.isWellFormed() &&
        hash(user.content) === questionHash &&
        (!('session_id' in user) || user.session_id === operation.resourceId) &&
        (!('context_refs' in user) ||
          (Array.isArray(user.context_refs) && user.context_refs.length === 0)),
      502,
      'question_mismatch',
      'Ask history did not match the retained question.',
    );
    assertProject(user, ctx);
  }
  ensure(
    !assistants.length || users.length === 1,
    502,
    'invalid_history',
    'Ask history has no matching question.',
  );
  if (users.length !== 1 || assistants.length !== 1) {
    await verifyRecording(ctx, recordingId);
    return { operation: operationView(operation) };
  }
  ensure(
    !operation.details.answerId || operation.details.answerId === assistants[0].id,
    502,
    'invalid_answer',
    'The persisted Ask answer identifier changed.',
  );
  ensure(
    !('session_id' in assistants[0]) || assistants[0].session_id === operation.resourceId,
    502,
    'invalid_answer',
    'The persisted Ask answer session changed.',
  );
  assertProject(assistants[0], ctx);
  const result = answer(assistants[0], recordingId);
  const finalSession = await ownedSession(ctx, operation.resourceId, recordingId);
  ensure(
    finalSession.message_count === 2,
    502,
    'invalid_history',
    'Ask history changed during the read.',
  );
  await verifyRecording(ctx, recordingId);
  const saved = await ctx.store.save(ctx.principal, operation.id, {
    state: 'complete',
    details: { answerId: assistants[0].id },
  });
  return { operation: operationView(saved), ...result };
}

export async function askRecording(ctx, recordingId, question) {
  ensure(
    typeof question === 'string' && question.isWellFormed(),
    400,
    'invalid_question',
    'The question must contain valid Unicode text.',
  );
  // The public message API trims before validation and persistence. Hash/send
  // that same canonical text so GET recovery can match the retained question.
  const rawQuestionHash = hash(question);
  question = question.trim();
  ensure(
    question.length > 0 && question.length <= 10_000,
    400,
    'invalid_question',
    'Enter a nonempty question of at most 10000 characters.',
  );
  await verifyRecording(ctx, recordingId);
  const questionHash = hash(question);
  // Preserve exact pre-upgrade intent before choosing a canonical anchor. An
  // older pending hash cannot be reverse-normalized, so another question on
  // that recording is blocked until the retained request is reconciled.
  if (rawQuestionHash !== questionHash) {
    const rawIntent = await ctx.store.find(
      ctx.principal,
      'ask',
      `${recordingId}:${rawQuestionHash}`,
    );
    if (rawIntent) return reconcile(ctx, rawIntent, recordingId, rawQuestionHash);
  }
  const known = await ctx.store.find(ctx.principal, 'ask', `${recordingId}:${questionHash}`);
  if (known) return reconcile(ctx, known, recordingId, questionHash);
  ensure(
    !(await ctx.store.findLegacyAsk(ctx.principal, recordingId)),
    409,
    'legacy_ask_intent',
    'An earlier Ask request for this recording needs operator reconciliation. No new request was sent.',
  );
  const { fresh, operation } = await ctx.store.claim(
    ctx.principal,
    'ask',
    `${recordingId}:${questionHash}`,
    { recordingId, questionHash, questionFormat: 'trim-v1' },
  );
  if (!fresh) return reconcile(ctx, operation, recordingId, questionHash);
  try {
    await ctx.store.save(ctx.principal, operation.id, { state: 'creating' });
    const created = await ctx.request('POST', '/ask/sessions', {
      scope: { type: 'recording', recording_id: recordingId },
      end_user_id: ctx.principal.endUserId,
    });
    ensure(
      object(created) && isId(created.id, 'as'),
      502,
      'invalid_session',
      'The created Ask session identifier was invalid.',
    );
    // Retain the exact ID even if later scope/owner checks fail. It must never be replaced.
    await ctx.store.save(ctx.principal, operation.id, { state: 'created', resourceId: created.id });
    checkSession(ctx, created, recordingId);
    ensure(
      created.message_count === 0,
      502,
      'invalid_session',
      'Expected an empty new Ask session.',
    );
    const session = await ownedSession(ctx, created.id, recordingId);
    ensure(
      session.message_count === 0,
      409,
      'session_changed',
      'The new Ask session already contains messages.',
    );
    await verifyRecording(ctx, recordingId);
    await ctx.store.save(ctx.principal, operation.id, { state: 'sending' });
    const response = await ctx.request('POST', `/ask/sessions/${created.id}/messages`, {
      content: question,
    });
    ensure(
      object(response) &&
        response.session_id === created.id &&
        Array.isArray(response.sources) &&
        response.sources.length === 0,
      502,
      'invalid_answer',
      'The Ask response session or recording retrieval scope did not match.',
    );
    answer(response.message, recordingId);
    const saved = await ctx.store.save(ctx.principal, operation.id, {
      state: 'submitted',
      details: { answerId: response.message.id },
    });
    return reconcile(ctx, saved, recordingId, questionHash);
  } catch (error) {
    await ctx.store.save(ctx.principal, operation.id, { state: 'uncertain' });
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      'operation_uncertain',
      'The Ask intent is retained. Refresh reads; the question will not be resent.',
    );
  }
}

export async function refreshAsk(ctx, operationId) {
  const operation = await ctx.store.get(ctx.principal, operationId);
  ensure(
    object(operation) &&
      operation.kind === 'ask' &&
      object(operation.details) &&
      isId(operation.details.recordingId, 'rec') &&
      typeof operation.details.questionHash === 'string' &&
      /^[0-9a-f]{64}$/.test(operation.details.questionHash) &&
      operation.anchor === `${operation.details.recordingId}:${operation.details.questionHash}`,
    409,
    'intent_conflict',
    'The retained Ask question or recording intent was invalid.',
  );
  await verifyRecording(ctx, operation.details.recordingId);
  return reconcile(ctx, operation, operation.details.recordingId, operation.details.questionHash);
}
