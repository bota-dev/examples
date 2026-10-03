import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const statuses = new Set(['pending', 'streaming', 'uploaded', 'processing', 'completed', 'failed', 'integrity_failure']);
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
class SafeError extends Error {}
const fail = message => { throw new SafeError(message); };

function integer(value, fallback, maximum, label) {
  const text = value === undefined ? String(fallback) : value;
  if (!/^[1-9][0-9]*$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) > maximum) {
    fail(`${label} must be an integer from 1 to ${maximum}.`);
  }
  return Number(text);
}

export function readConfig(env) {
  let base;
  try { base = new URL(env.BOTA_API_BASE_URL); } catch { fail('Set BOTA_API_BASE_URL to the intended API origin with /v1.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) ||
      base.username || base.password || base.search || base.hash || base.pathname.replace(/\/$/, '') !== '/v1') {
    fail('BOTA_API_BASE_URL must use HTTPS and /v1, without credentials, query or fragment; HTTP is allowed only on loopback.');
  }
  if (typeof env.BOTA_API_KEY !== 'string' || !/^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(env.BOTA_API_KEY)) {
    fail('Set a server-side project API key with recordings:read.');
  }
  const endUserId = env.BOTA_END_USER_ID || undefined;
  if (endUserId && !/^eu_[A-Za-z0-9]{1,64}$/.test(endUserId)) fail('BOTA_END_USER_ID must be an end-user ID or blank.');
  return {
    base: base.href.replace(/\/$/, ''), key: env.BOTA_API_KEY, endUserId,
    limit: integer(env.BOTA_LIMIT, 20, 100, 'BOTA_LIMIT'),
    maxPages: integer(env.BOTA_MAX_PAGES, 5, 50, 'BOTA_MAX_PAGES'),
  };
}

function date(value, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    fail('The API returned invalid recording metadata.');
  }
  return new Date(value).toISOString();
}

function metadata(recording) {
  if (!recording || !/^rec_[A-Za-z0-9]{1,64}$/.test(recording.id ?? '') || !statuses.has(recording.status) ||
      !(recording.duration_seconds === null || (Number.isSafeInteger(recording.duration_seconds) && recording.duration_seconds >= 0))) {
    fail('The API returned invalid recording metadata.');
  }
  // Deliberate projection: never emit names, arbitrary metadata, URLs or storage fields.
  return { id: recording.id, status: recording.status, duration_seconds: recording.duration_seconds,
    recorded_at: date(recording.recorded_at, true), created_at: date(recording.created_at) };
}

async function pageDocument(response) {
  const reader = response.body?.getReader();
  if (!reader) fail('The API returned an empty response.');
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_PAGE_BYTES) { await reader.cancel(); fail('The API page exceeded this example’s 2 MiB response limit.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail('The API returned invalid JSON.'); }
}

/** GET-only listing; cursors stay opaque and are never printed or decoded. */
export async function listRecordings(config, {fetchImpl = fetch} = {}) {
  const recordings = []; const seen = new Set();
  const deadline = AbortSignal.timeout(60_000);
  let cursor;
  for (let pages = 1; pages <= config.maxPages; pages++) {
    const url = new URL(`${config.base}/recordings`);
    url.searchParams.set('limit', String(config.limit));
    if (config.endUserId) url.searchParams.set('end_user_id', config.endUserId);
    if (cursor !== undefined) url.searchParams.set('cursor', cursor);
    let response; let page;
    try {
      response = await fetchImpl(url, {method: 'GET', redirect: 'error',
        headers: {Authorization: `Bearer ${config.key}`, Accept: 'application/json'},
        signal: AbortSignal.any([deadline, AbortSignal.timeout(10_000)]),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401 || response.status === 403) fail('Authorization rejected. Check the selected project key and recordings:read scope.');
        if (response.status === 429) fail('API rate limit reached. Wait before running the listing again.');
        fail(`Recordings request failed (HTTP ${response.status}). No automatic retry was made.`);
      }
      page = await pageDocument(response);
    } catch (error) {
      if (error instanceof SafeError) throw error;
      if (deadline.aborted) fail('Listing exceeded its 60-second deadline. No partial output was written.');
      fail('Recordings request interrupted, timed out or redirected. No partial output was written.');
    }
    if (!page || !Array.isArray(page.data) || page.data.length > config.limit || typeof page.has_more !== 'boolean') {
      fail('The API returned an invalid pagination response.');
    }
    if (page.has_more && (page.data.length === 0 || typeof page.next_cursor !== 'string' ||
        page.next_cursor.length < 1 || page.next_cursor.length > 2048 || seen.has(page.next_cursor))) {
      fail('The API returned a missing or repeated pagination cursor.');
    }
    recordings.push(...page.data.map(metadata));
    if (!page.has_more) return {recordings, pages, complete: true, stopped_reason: 'end_of_list'};
    cursor = page.next_cursor;
    seen.add(cursor);
    if (pages === config.maxPages) return {recordings, pages, complete: false, stopped_reason: 'page_limit'};
  }
}

export async function main(env = process.env, {fetchImpl = fetch, output = console.log, errorOutput = console.error} = {}) {
  try {
    const result = await listRecordings(readConfig(env), {fetchImpl});
    output(JSON.stringify(result, null, 2));
    return result.complete ? 0 : 2;
  } catch (error) {
    errorOutput(error instanceof SafeError ? error.message : 'Listing failed. No response data or credentials were printed.');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
