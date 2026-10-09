const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_ITEMS = 200;
const STATUSES = new Set(['pending', 'processing', 'completed', 'failed']);
const PROVIDERS = new Set(['whisper', 'deepgram', 'assemblyai', 'elevenlabs']);
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value, prefix) => typeof value === 'string' &&
  new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value) && !value.toLowerCase().includes('replace_me');

function integer(value, fallback, maximum, label) {
  const text = value === undefined ? String(fallback) : value;
  requireValue(/^[1-9][0-9]*$/.test(text) && Number.isSafeInteger(Number(text)) && Number(text) <= maximum,
    `${label} must be an integer from 1 to ${maximum}.`);
  return Number(text);
}

function configuration() {
  const rawBase = process.env.BOTA_API_BASE_URL;
  let base;
  try { base = new URL(rawBase); }
  catch { throw new SafeError('Configure an explicit HTTPS API origin ending in /v1.'); }
  requireValue(typeof rawBase === 'string' && !/[\x00-\x20\x7f]/.test(rawBase) &&
    base.protocol === 'https:' && !base.username && !base.password && !base.search &&
    !base.hash && /^\/v1\/?$/.test(base.pathname),
  'Use a fixed HTTPS API origin, path /v1 and no URL credentials/query/fragment.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !key.toLowerCase().includes('replace_me'),
  'Configure a server-held project key with recordings:read and transcriptions:read.');
  const ids = {};
  for (const [name, prefix] of [['PROJECT', 'proj'], ['END_USER', 'eu'], ['RECORDING', 'rec']]) {
    const value = process.env[`BOTA_${name}_ID`];
    requireValue(validId(value, prefix), `Configure the exact authorized BOTA_${name}_ID.`);
    ids[name] = value;
  }
  return { base: base.href.replace(/\/$/, ''), key, ...ids,
    limit: integer(process.env.BOTA_LIMIT, 20, 20, 'BOTA_LIMIT'),
    maxPages: integer(process.env.BOTA_MAX_PAGES, 5, 10, 'BOTA_MAX_PAGES') };
}

function remaining(deadline) {
  const milliseconds = Math.floor(deadline - performance.now());
  requireValue(milliseconds > 0, 'Directory observation exceeded its time budget; no metadata emitted.');
  return milliseconds;
}

async function api(config, path, deadline) {
  const signal = AbortSignal.timeout(Math.min(10_000, remaining(deadline)));
  try {
    const response = await fetch(config.base + path, { method: 'GET', redirect: 'error',
      credentials: 'omit', referrerPolicy: 'no-referrer', signal,
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json', 'Accept-Encoding': 'identity' } });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new SafeError(`API read returned HTTP ${response.status}; no automatic retry was made.`);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') ||
        !response.body || (response.headers.get('content-encoding') ?? 'identity').trim().toLowerCase() !== 'identity') {
      await response.body?.cancel();
      throw new SafeError('Expected an uncompressed JSON API response.');
    }
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      signal.throwIfAborted();
      remaining(deadline);
      size += chunk.length;
      requireValue(size <= MAX_RESPONSE_BYTES, 'API response exceeds the 1 MiB example limit.');
      chunks.push(chunk);
    }
    signal.throwIfAborted();
    remaining(deadline);
    let row;
    try { row = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new SafeError('The API returned invalid UTF-8 JSON.'); }
    remaining(deadline);
    return row;
  } catch (error) {
    if (signal.aborted) throw new SafeError('API read timed out; no metadata emitted or automatic retry made.');
    if (error instanceof SafeError) throw error;
    throw new SafeError('API transport failed or redirected; no automatic retry was made.');
  }
}

async function verifyOwner(config, deadline) {
  const row = await api(config, `/recordings/${config.RECORDING}`, deadline);
  requireValue(object(row) && row.id === config.RECORDING && row.end_user_id === config.END_USER &&
    (!('deleted_at' in row) || row.deleted_at === null) &&
    (!('project_id' in row) || row.project_id === config.PROJECT),
  'Recording identity, configured owner, project or active-state mismatch; no metadata emitted.');
}

function timestamp(value, nullable = false) {
  if (nullable && value === null) return null;
  requireValue(typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) &&
    Number.isFinite(Date.parse(value)), 'Invalid transcription timestamp.');
  const day = value.slice(0, 10);
  const calendar = new Date(`${day}T00:00:00Z`);
  requireValue(Number.isFinite(calendar.getTime()) && calendar.toISOString().slice(0, 10) === day,
    'Invalid transcription calendar date.');
  return new Date(value).toISOString();
}

function selectTranscription(row, config) {
  requireValue(object(row) && validId(row.id, 'txn') && row.recording_id === config.RECORDING &&
    (!('project_id' in row) || row.project_id === config.PROJECT) &&
    (!('deleted_at' in row) || row.deleted_at === null) && STATUSES.has(row.status),
  'Transcription identity, recording, project, active state or status mismatch.');
  requireValue(row.provider === null || (typeof row.provider === 'string' && row.provider.length <= 64),
    'Invalid transcription provider metadata.');
  requireValue(row.language === null || (typeof row.language === 'string' &&
    /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,3}$/.test(row.language)),
  'Invalid transcription language metadata.');
  const selected = { id: row.id, recording_id: row.recording_id, status: row.status,
    language: row.language, started_at: timestamp(row.started_at, true),
    completed_at: timestamp(row.completed_at, true), created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at) };
  // Public provider is an open string; emit only the recognized provider labels.
  if (row.provider === null || PROVIDERS.has(row.provider)) selected.provider = row.provider;
  return selected;
}

async function list(config) {
  const deadline = performance.now() + 60_000;
  const listDeadline = deadline - 10_000;
  await verifyOwner(config, listDeadline);
  const transcriptions = []; const seenIds = new Set(); const seenCursors = new Set();
  let cursor; let pages = 0; let complete = false;
  for (pages = 1; pages <= config.maxPages; pages++) {
    const query = new URLSearchParams({ recording_id: config.RECORDING, limit: String(config.limit) });
    if (cursor !== undefined) query.set('cursor', cursor);
    const page = await api(config, `/transcriptions?${query}`, listDeadline);
    requireValue(object(page) && Array.isArray(page.data) && page.data.length <= config.limit &&
      typeof page.has_more === 'boolean' &&
      (!('project_id' in page) || page.project_id === config.PROJECT) &&
      (!('total' in page) || (Number.isSafeInteger(page.total) && page.total >= 0)),
    'Invalid transcription pagination response.');
    if (page.has_more) {
      requireValue(page.data.length > 0 && typeof page.next_cursor === 'string' &&
        page.next_cursor.length >= 1 && page.next_cursor.length <= 2048 &&
        !/[\u0000-\u001f\u007f]/.test(page.next_cursor) && !seenCursors.has(page.next_cursor),
      'Missing, invalid or nonprogressing continuation cursor.');
    } else {
      requireValue(!('next_cursor' in page) || page.next_cursor === null,
        'Unexpected continuation cursor on a terminal page.');
    }
    for (const row of page.data) {
      const selected = selectTranscription(row, config);
      requireValue(!seenIds.has(selected.id), 'Directory traversal repeated a transcription ID.');
      requireValue(transcriptions.length < MAX_ITEMS, 'Directory exceeded the 200-item example limit.');
      seenIds.add(selected.id);
      transcriptions.push(selected);
    }
    if (!page.has_more || pages === config.maxPages) {
      complete = !page.has_more;
      break;
    }
    cursor = page.next_cursor;
    seenCursors.add(cursor);
  }
  // Release only selected metadata after a fresh read of the same recording owner.
  await verifyOwner(config, deadline);
  remaining(deadline);
  console.log(JSON.stringify({ recording_id: config.RECORDING, transcriptions, pages, complete,
    stopped_reason: complete ? 'observed_end' : 'page_limit', snapshot: false }, null, 2));
  return complete ? 0 : 2;
}

try { process.exitCode = await list(configuration()); }
catch (error) {
  console.error(error instanceof SafeError ? error.message : 'Directory failed; no raw response or credential was printed.');
  process.exitCode = 1;
}
