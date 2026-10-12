import { assertProject, ensure, isId, object } from '../errors.mjs';

const statuses = new Set(['pending', 'streaming', 'uploaded', 'processing', 'completed', 'failed', 'integrity_failure']);
const timestamp = value => typeof value === 'string' && value.length <= 64 && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const cursorValid = value => typeof value === 'string' && value.length > 0 && value.length <= 1024 && !/[\x00-\x1f\x7f]/.test(value);

function validate(ctx, row, expectedId) {
  ensure(object(row) && isId(row.id, 'rec') && (!expectedId || row.id === expectedId), 502, 'invalid_recording', 'Invalid recording response.');
  assertProject(row, ctx);
  ensure(row.end_user_id === ctx.principal.endUserId, 403, 'recording_forbidden', 'Recording access denied.');
  ensure(statuses.has(row.status) && timestamp(row.created_at), 502, 'invalid_recording', 'Invalid recording response.');
  ensure(row.name == null || (typeof row.name === 'string' && row.name.length <= 255), 502, 'invalid_recording', 'Invalid recording response.');
  ensure(row.duration_seconds == null || (typeof row.duration_seconds === 'number' && Number.isFinite(row.duration_seconds) && row.duration_seconds >= 0), 502, 'invalid_recording', 'Invalid recording response.');
  ensure(row.content_sha256 == null || (typeof row.content_sha256 === 'string' && /^[0-9a-f]{64}$/.test(row.content_sha256)), 502, 'invalid_recording', 'Invalid recording response.');
  ensure(row.content_sha256_verified_at == null || timestamp(row.content_sha256_verified_at), 502, 'invalid_recording', 'Invalid recording response.');
  return row;
}

function view(row) {
  return {
    id: row.id, name: row.name ?? null, status: row.status, created_at: row.created_at,
    duration_seconds: row.duration_seconds ?? null,
    upload_verified: ['uploaded', 'processing', 'completed'].includes(row.status) && typeof row.content_sha256 === 'string' && timestamp(row.content_sha256_verified_at),
  };
}

export async function verifyRecording(ctx, id) {
  ensure(isId(id, 'rec'), 400, 'invalid_recording_id', 'Invalid recording ID.');
  return validate(ctx, await ctx.request('GET', `/recordings/${encodeURIComponent(id)}`), id);
}

export async function getRecording(ctx, id) {
  return view(await verifyRecording(ctx, id));
}

export async function listRecordings(ctx, cursor) {
  ensure(cursor === undefined || cursorValid(cursor), 400, 'invalid_cursor', 'Invalid recording cursor.');
  const query = new URLSearchParams({ end_user_id: ctx.principal.endUserId, limit: '20' });
  if (cursor !== undefined) query.set('cursor', cursor);
  const page = await ctx.request('GET', `/recordings?${query}`);
  ensure(object(page) && Array.isArray(page.data) && page.data.length <= 20 && typeof page.has_more === 'boolean', 502, 'invalid_recording_page', 'Invalid recording list response.');
  ensure(page.next_cursor == null || cursorValid(page.next_cursor), 502, 'invalid_recording_page', 'Invalid recording list response.');
  ensure(!page.has_more || (page.data.length > 0 && cursorValid(page.next_cursor) && page.next_cursor !== cursor), 502, 'invalid_recording_page', 'Invalid recording list response.');
  const seen = new Set();
  for (const row of page.data) {
    validate(ctx, row);
    ensure(!seen.has(row.id), 502, 'invalid_recording_page', 'Invalid recording list response.');
    seen.add(row.id);
  }
  const data = [];
  for (const row of page.data) data.push(view(await verifyRecording(ctx, row.id)));
  return { data, has_more: page.has_more, next_cursor: page.has_more ? page.next_cursor : null };
}
