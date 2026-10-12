import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { AppError, ensure, isId, object } from '../errors.mjs';
import { verifyRecording } from './recordings.mjs';
import { verifySummary, verifyTranscription } from './processing.mjs';

const kinds = new Map([
  ...['created', 'uploaded', 'deleted', 'integrity_failure'].map((event) => [
    `recording.${event}`,
    'recording',
  ]),
  ...['started', 'completed', 'failed'].flatMap((event) => [
    [`transcription.${event}`, 'transcription'],
    [`summary.${event}`, 'summary'],
  ]),
]);
const prefixes = { recording: 'rec', transcription: 'txn', summary: 'sum' };
const isoDate = (value) =>
  typeof value === 'string' &&
  value.length <= 64 &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));

function header(headers, name) {
  if (typeof headers?.get === 'function') return headers.get(name);
  const values = Object.entries(headers ?? {}).filter(([key]) => key.toLowerCase() === name);
  return values.length === 1 ? values[0][1] : undefined;
}

function finiteJson(value) {
  const stack = [[value, 0]];
  let visits = 0;
  while (stack.length) {
    const [item, depth] = stack.pop();
    ensure(
      ++visits <= 65_536 && depth <= 128,
      400,
      'invalid_event',
      'The webhook JSON exceeded its structural bounds.',
    );
    if (typeof item === 'number')
      ensure(
        Number.isFinite(item),
        400,
        'invalid_event',
        'The webhook JSON contained a nonfinite number.',
      );
    else if (item && typeof item === 'object') {
      for (const child of Object.values(item)) stack.push([child, depth + 1]);
    }
  }
}

function checkProject(value, projectId) {
  ensure(
    !('project_id' in value) || value.project_id === projectId,
    400,
    'event_project_mismatch',
    'The webhook project marker did not match this receiver.',
  );
}

export async function receiveWebhook(ctx, bytes, headers) {
  ensure(
    typeof ctx.config.webhookSecret === 'string' && ctx.config.webhookSecret.length > 0,
    503,
    'webhooks_disabled',
    'The webhook receiver is disabled.',
  );
  ensure(
    Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 1024 * 1024,
    400,
    'invalid_event',
    'The webhook body must be bounded raw bytes.',
  );
  const timestamp = header(headers, 'x-bota-timestamp');
  const signature = header(headers, 'x-bota-signature');
  ensure(
    typeof timestamp === 'string' &&
      /^(?:0|[1-9]\d{0,11})$/.test(timestamp) &&
      Number.isSafeInteger(Number(timestamp)) &&
      Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) <= 300 &&
      typeof signature === 'string' &&
      /^v1=[0-9a-f]{64}$/i.test(signature),
    401,
    'invalid_signature',
    'The webhook signature or timestamp was invalid.',
  );
  const expected = createHmac('sha256', ctx.config.webhookSecret)
    .update(`${timestamp}.`, 'utf8')
    .update(bytes)
    .digest();
  ensure(
    timingSafeEqual(expected, Buffer.from(signature.slice(3), 'hex')),
    401,
    'invalid_signature',
    'The webhook signature or timestamp was invalid.',
  );
  let event;
  try {
    event = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new AppError(400, 'invalid_event', 'The webhook body was not valid UTF-8 JSON.');
  }
  finiteJson(event);
  ensure(
    object(event) &&
      isId(event.id, 'evt') &&
      typeof event.type === 'string' &&
      event.type.length <= 100 &&
      /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,3}$/.test(event.type) &&
      isoDate(event.created_at) &&
      object(event.data),
    400,
    'invalid_event',
    'The webhook envelope was invalid.',
  );
  const eventHeader = header(headers, 'x-bota-event-id');
  ensure(
    eventHeader === undefined || eventHeader === null || eventHeader === event.id,
    400,
    'event_id_mismatch',
    'The webhook event header did not match its envelope.',
  );
  checkProject(event, ctx.config.projectId);
  checkProject(event.data, ctx.config.projectId);
  const resourceKind = kinds.get(event.type) ?? null;
  let resourceId = null;
  if (resourceKind) {
    const resource = event.data[resourceKind];
    ensure(
      object(resource) && isId(resource.id, prefixes[resourceKind]),
      400,
      'invalid_event',
      'The webhook resource pointer was invalid.',
    );
    checkProject(resource, ctx.config.projectId);
    resourceId = resource.id;
  }
  // Only this durable metadata insert permits acknowledgement. No payload content or jobs are saved.
  await ctx.store.acceptEvent({
    id: event.id,
    type: event.type,
    createdAt: event.created_at,
    resourceKind,
    resourceId,
    bodyHash: createHash('sha256').update(bytes).digest('hex'),
  });
  return { accepted: true };
}

export async function listEvents(ctx) {
  const rows = await ctx.store.events();
  ensure(
    Array.isArray(rows) && rows.length <= 50,
    503,
    'invalid_events',
    'The event metadata store was invalid.',
  );
  const data = [];
  for (const row of rows) {
    if (
      !object(row) ||
      !kinds.has(row.type) ||
      kinds.get(row.type) !== row.resourceKind ||
      !isId(row.resourceId, prefixes[row.resourceKind])
    )
      continue;
    ensure(
      isId(row.id, 'evt') && isoDate(row.createdAt),
      503,
      'invalid_events',
      'The event metadata was invalid.',
    );
    try {
      if (row.resourceKind === 'recording') await verifyRecording(ctx, row.resourceId);
      else if (row.resourceKind === 'transcription') await verifyTranscription(ctx, row.resourceId);
      else await verifySummary(ctx, row.resourceId);
    } catch (error) {
      if (error instanceof AppError && [403, 404].includes(error.status)) continue;
      throw error;
    }
    data.push({ id: row.id, type: row.type, created_at: row.createdAt });
  }
  return { data };
}
