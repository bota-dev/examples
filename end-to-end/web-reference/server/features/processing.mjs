import { AppError, assertProject, ensure, isId, object, operationView } from '../errors.mjs';
import { verifyRecording } from './recordings.mjs';

const statuses = new Set(['pending', 'processing', 'completed', 'failed']);
const template = 'tmpl_general_notes';

function checkJob(ctx, row, kind, sourceId, expectedId) {
  const prefix = kind === 'transcription' ? 'txn' : 'sum';
  const field = kind === 'transcription' ? 'recording_id' : 'transcription_id';
  ensure(object(row) && isId(row.id, prefix) && (!expectedId || row.id === expectedId) &&
    row[field] === sourceId && statuses.has(row.status), 502, 'invalid_job', 'The processing resource did not match its source.');
  assertProject(row, ctx);
  ensure(!('end_user_id' in row) || row.end_user_id === ctx.principal.endUserId,
    403, 'job_not_owned', 'The processing resource owner did not match.');
  return row;
}

// These internal verifiers also authorize notification pointers without trusting payload ownership.
export async function verifyTranscription(ctx, id, recordingId) {
  ensure(isId(id, 'txn'), 400, 'invalid_id', 'Choose a valid transcription.');
  const row = await ctx.request('GET', `/transcriptions/${id}`);
  ensure(object(row) && isId(row.recording_id, 'rec'), 502, 'invalid_job', 'The transcription has no valid recording source.');
  checkJob(ctx, row, 'transcription', recordingId ?? row.recording_id, id);
  await verifyRecording(ctx, row.recording_id);
  return row;
}

export async function verifySummary(ctx, id, transcriptionId) {
  ensure(isId(id, 'sum'), 400, 'invalid_id', 'Choose a valid summary.');
  const row = await ctx.request('GET', `/summaries/${id}`);
  ensure(object(row) && isId(row.transcription_id, 'txn'), 502, 'invalid_job', 'The summary has no valid transcription source.');
  checkJob(ctx, row, 'summary', transcriptionId ?? row.transcription_id, id);
  const source = await verifyTranscription(ctx, row.transcription_id);
  ensure(!('recording_id' in row) || row.recording_id === source.recording_id,
    502, 'invalid_job', 'The summary recording source did not match.');
  ensure(row.status !== 'completed' || source.status === 'completed',
    502, 'invalid_job', 'The completed summary has an incomplete transcription source.');
  return row;
}

async function directory(ctx, path, field, sourceId, kind) {
  const rows = [], ids = new Set(), cursors = new Set();
  let cursor;
  for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
    const query = new URLSearchParams({ [field]: sourceId, limit: '20' });
    if (cursor) query.set('cursor', cursor);
    const page = await ctx.request('GET', `${path}?${query}`);
    ensure(object(page) && Array.isArray(page.data) && page.data.length <= 20 &&
      typeof page.has_more === 'boolean', 502, 'invalid_page', 'The processing list was invalid.');
    for (const row of page.data) {
      checkJob(ctx, row, kind, sourceId);
      ensure(!ids.has(row.id), 502, 'invalid_page', 'The processing list repeated a resource.');
      ids.add(row.id);
      const exact = kind === 'transcription' ? await verifyTranscription(ctx, row.id, sourceId) :
        await verifySummary(ctx, row.id, sourceId);
      rows.push(exact);
    }
    if (!page.has_more) {
      ensure(page.next_cursor == null, 502, 'invalid_page', 'The processing list had an unexpected cursor.');
      return rows;
    }
    ensure(page.data.length > 0 && typeof page.next_cursor === 'string' &&
      page.next_cursor.length > 0 && page.next_cursor.length <= 2048 &&
      !/[\u0000-\u0020\u007f]/.test(page.next_cursor) && !cursors.has(page.next_cursor),
    502, 'invalid_page', 'The processing list cursor was invalid.');
    cursors.add(page.next_cursor);
    cursor = page.next_cursor;
  }
  throw new AppError(503, 'list_limit', 'The bounded processing list could not establish its end.');
}

function timestamp(value) {
  ensure(value == null || typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value)),
    502, 'invalid_job', 'The processing timestamp was invalid.');
  return value ?? null;
}

function transcriptionView(row) {
  const result = { id: row.id, recording_id: row.recording_id, status: row.status,
    created_at: timestamp(row.created_at) };
  if (row.status === 'completed') {
    ensure(typeof row.full_text === 'string' && row.full_text.length <= 1_000_000,
      502, 'invalid_transcript', 'The completed transcript text was invalid or too large.');
    result.full_text = row.full_text;
  }
  return result;
}

function notes(output) {
  ensure(object(output), 502, 'invalid_summary', 'The completed summary has no structured notes.');
  const text = (value) => {
    ensure(typeof value === 'string' && value.length <= 10_000, 502, 'invalid_summary', 'The summary notes were invalid or too large.');
    return value;
  };
  const result = { overview: text(output.overview) };
  for (const field of ['key_points', 'action_items', 'participants', 'decisions']) {
    ensure(Array.isArray(output[field]) && output[field].length <= 200,
      502, 'invalid_summary', 'The summary notes were invalid or too large.');
    result[field] = output[field].map(text);
  }
  return result;
}

function summaryView(row) {
  const result = { id: row.id, transcription_id: row.transcription_id, status: row.status,
    template_id: template, created_at: timestamp(row.created_at) };
  if (row.status === 'completed') result.output = notes(row.output);
  return result;
}

export async function listTranscriptions(ctx, recordingId) {
  await verifyRecording(ctx, recordingId);
  const rows = await directory(ctx, '/transcriptions', 'recording_id', recordingId, 'transcription');
  const data = rows.map(transcriptionView);
  await verifyRecording(ctx, recordingId);
  return { data };
}

export async function listSummaries(ctx, transcriptionId) {
  const source = await verifyTranscription(ctx, transcriptionId);
  const rows = await directory(ctx, '/summaries', 'transcription_id', transcriptionId, 'summary');
  const data = rows.filter(row => row.template_id === template).map(row => {
    ensure(source.status === 'completed' || row.status !== 'completed',
      502, 'invalid_job', 'The completed summary has an incomplete transcription source.');
    return summaryView(row);
  });
  const finalSource = await verifyTranscription(ctx, transcriptionId, source.recording_id);
  ensure(!data.some(row => row.status === 'completed') || finalSource.status === 'completed',
    502, 'invalid_job', 'The summary source changed during the read.');
  await verifyRecording(ctx, source.recording_id);
  return { data };
}

async function reconcile(ctx, operation, kind, sourceId) {
  if (!operation.resourceId) return { operation: operationView(operation) };
  const row = kind === 'transcription' ? await verifyTranscription(ctx, operation.resourceId, sourceId) :
    await verifySummary(ctx, operation.resourceId, sourceId);
  if (kind === 'summary') ensure(row.template_id === template,
    502, 'invalid_job', 'The known summary template changed.');
  const saved = await ctx.store.save(ctx.principal, operation.id, {
    state: row.status === 'completed' ? 'complete' : 'submitted',
  });
  return { operation: operationView(saved) };
}

function ready(source, kind) {
  if (kind === 'summary') {
    ensure(source.status === 'completed' && typeof source.full_text === 'string',
      409, 'transcription_incomplete', 'Complete the source transcription before requesting notes.');
  } else {
    ensure(['uploaded', 'completed'].includes(source.status) &&
      typeof source.content_sha256 === 'string' && /^[0-9a-f]{64}$/.test(source.content_sha256) &&
      typeof source.content_sha256_verified_at === 'string' && Number.isFinite(Date.parse(source.content_sha256_verified_at)),
    409, 'upload_unverified', 'Refresh the recording after server integrity verification before starting transcription.');
  }
}

async function start(ctx, kind, sourceId) {
  const source = kind === 'transcription' ? await verifyRecording(ctx, sourceId) : await verifyTranscription(ctx, sourceId);
  const existing = await directory(ctx, kind === 'transcription' ? '/transcriptions' : '/summaries',
    kind === 'transcription' ? 'recording_id' : 'transcription_id', sourceId, kind);
  const found = existing.find(row => kind === 'transcription' || row.template_id === template);
  // Failed preconditions consume no durable intent. A processing source can still reuse its existing result.
  if (!found) ready(source, kind);
  else if (kind === 'transcription') transcriptionView(found);
  else summaryView(found);
  const details = kind === 'transcription' ? { recordingId: sourceId } :
    { transcriptionId: sourceId, recordingId: source.recording_id, templateId: template };
  const anchor = kind === 'transcription' ? sourceId : `${sourceId}:${template}`;
  const claim = await ctx.store.claim(ctx.principal, kind, anchor, details);
  if (!claim.fresh) return reconcile(ctx, claim.operation, kind, sourceId);
  const operation = claim.operation;
  try {
    if (found) {
      const saved = await ctx.store.save(ctx.principal, operation.id, { resourceId: found.id, state: 'submitted' });
      return reconcile(ctx, saved, kind, sourceId);
    }
    if (kind === 'transcription') ready(await verifyRecording(ctx, sourceId), kind);
    else {
      const freshSource = await verifyTranscription(ctx, sourceId, source.recording_id);
      ready(freshSource, kind);
    }
    await ctx.store.save(ctx.principal, operation.id, { state: 'starting' });
    const body = kind === 'transcription' ? { recording_id: sourceId } :
      { transcription_id: sourceId, template_id: template };
    const created = checkJob(ctx, await ctx.request('POST', kind === 'transcription' ? '/transcriptions' : '/summaries', body),
      kind, sourceId);
    if (kind === 'summary') ensure(created.template_id === template, 502, 'invalid_job', 'The created summary template did not match.');
    const saved = await ctx.store.save(ctx.principal, operation.id, { resourceId: created.id, state: 'submitted' });
    return reconcile(ctx, saved, kind, sourceId);
  } catch (error) {
    await ctx.store.save(ctx.principal, operation.id, { state: 'uncertain' });
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'operation_uncertain', 'The processing intent is retained. Refresh reads; no replacement write will be sent.');
  }
}

export const startTranscription = (ctx, recordingId) => start(ctx, 'transcription', recordingId);
export const startSummary = (ctx, transcriptionId) => start(ctx, 'summary', transcriptionId);

export async function refreshProcessing(ctx, operationId) {
  const operation = await ctx.store.get(ctx.principal, operationId);
  ensure(object(operation) && ['transcription', 'summary'].includes(operation.kind) &&
    object(operation.details) && isId(operation.details.recordingId, 'rec'),
  409, 'intent_conflict', 'The retained processing intent was invalid.');
  const { kind, details } = operation;
  const sourceId = kind === 'transcription' ? details.recordingId : details.transcriptionId;
  ensure(kind === 'transcription' ? operation.anchor === sourceId :
    isId(sourceId, 'txn') && details.templateId === template && operation.anchor === `${sourceId}:${template}`,
  409, 'intent_conflict', 'The retained processing source did not match its intent.');
  await verifyRecording(ctx, details.recordingId);
  if (kind === 'summary') await verifyTranscription(ctx, sourceId, details.recordingId);
  const result = await reconcile(ctx, operation, kind, sourceId);
  if (kind === 'summary' && operation.resourceId) await verifyTranscription(ctx, sourceId, details.recordingId);
  return result;
}
