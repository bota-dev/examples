class ExampleError extends Error {}
const fail = message => { throw new ExampleError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value, prefix) => typeof value === 'string' &&
  new RegExp(`^${prefix}_[A-Za-z0-9-]{1,128}$`).test(value);
const MAX_PAGE_BYTES = 2 * 1024 * 1024;

function integer(value, fallback, maximum, label) {
  const text = value === undefined ? String(fallback) : value;
  if (!/^[1-9][0-9]*$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) > maximum) {
    fail(`${label} must be an integer from 1 to ${maximum}.`);
  }
  return Number(text);
}

function configuration() {
  let origin;
  try { origin = new URL(process.env.BOTA_API_ORIGIN ?? 'https://api.bota.dev'); }
  catch { fail('Invalid BOTA_API_ORIGIN.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
      !(origin.protocol === 'https:' || (origin.protocol === 'http:' && local))) {
    fail('Use a trusted HTTPS origin, or explicit loopback HTTP, with no path or credentials.');
  }
  const key = process.env.BOTA_API_KEY;
  if (!/^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key ?? '') || key.includes('REPLACE_ME')) {
    fail('Configure a server-held project API key with end_users:read.');
  }
  const project = process.env.BOTA_PROJECT_ID;
  if (!validId(project, 'proj') || project.includes('REPLACE_ME')) fail('Configure the expected project ID.');
  return { origin: origin.origin, key, project,
    limit: integer(process.env.BOTA_LIMIT, 20, 100, 'BOTA_LIMIT'),
    maxPages: integer(process.env.BOTA_MAX_PAGES, 5, 50, 'BOTA_MAX_PAGES') };
}

function timestamp(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) ||
      !Number.isFinite(Date.parse(value))) fail('Invalid end-user timestamp.');
  const day = value.slice(0, 10);
  const calendar = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day) {
    fail('Invalid end-user calendar date.');
  }
  return new Date(value).toISOString();
}

function selectedEndUser(value, config) {
  if (!object(value) || !validId(value.id, 'eu') ||
      !(value.external_id === null || (typeof value.external_id === 'string' && value.external_id.length <= 255)) ||
      ('project_id' in value && value.project_id !== config.project) ||
      ('deleted_at' in value && value.deleted_at !== null) ||
      ('metadata' in value && value.metadata !== null && !object(value.metadata))) {
    fail('Invalid end-user metadata, project or active state.');
  }
  for (const field of ['name', 'email']) {
    if (field in value && !(value[field] === null ||
        (typeof value[field] === 'string' && value[field].length <= 255))) fail('Invalid end-user metadata.');
  }
  if ('updated_at' in value) timestamp(value.updated_at);
  // Project/name/email/arbitrary metadata are deliberately excluded from output.
  return { id: value.id, external_id: value.external_id, created_at: timestamp(value.created_at) };
}

async function getPage(url, config, deadline) {
  let response;
  try {
    response = await fetch(url, { method: 'GET', redirect: 'error',
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json' },
      signal: AbortSignal.any([deadline, AbortSignal.timeout(10_000)]) });
    if (response.status !== 200) {
      await response.body?.cancel();
      fail(`End-user list returned HTTP ${response.status}. No automatic retry was made.`);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body) {
      await response.body?.cancel();
      fail('Expected a JSON end-user list.');
    }
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_PAGE_BYTES) {
          await reader.cancel();
          fail('End-user page exceeded the example response limit.');
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { fail('End-user list returned invalid JSON or UTF-8.'); }
  } catch (error) {
    if (error instanceof ExampleError) throw error;
    fail(deadline.aborted ? 'Directory traversal exceeded its 60-second deadline.' :
      'End-user request interrupted, timed out or redirected. No automatic retry was made.');
  }
}

async function main() {
  const config = configuration();
  const deadline = AbortSignal.timeout(60_000);
  const endUsers = []; const seenIds = new Set(); const seenCursors = new Set();
  let cursor;
  for (let pages = 1; pages <= config.maxPages; pages++) {
    const url = new URL('/v1/end-users', config.origin);
    url.searchParams.set('limit', String(config.limit));
    if (cursor !== undefined) url.searchParams.set('cursor', cursor);
    const page = await getPage(url, config, deadline);
    if (!object(page) || !Array.isArray(page.data) || page.data.length > config.limit ||
        typeof page.has_more !== 'boolean' ||
        ('total' in page && (!Number.isSafeInteger(page.total) || page.total < 0))) {
      fail('Invalid end-user pagination response.');
    }
    if (page.has_more) {
      if (page.data.length === 0 || typeof page.next_cursor !== 'string' ||
          page.next_cursor.length < 1 || page.next_cursor.length > 2048 ||
          /[\u0000-\u001f\u007f]/.test(page.next_cursor) || seenCursors.has(page.next_cursor)) {
        fail('Missing, invalid or nonprogressing continuation cursor.');
      }
    } else if ('next_cursor' in page && page.next_cursor !== null) {
      fail('Unexpected continuation cursor on a terminal page.');
    }
    for (const value of page.data) {
      const selected = selectedEndUser(value, config);
      if (seenIds.has(selected.id)) fail('Directory traversal repeated an end-user ID.');
      seenIds.add(selected.id);
      endUsers.push(selected);
    }
    if (!page.has_more || pages === config.maxPages) {
      if (deadline.aborted) fail('Directory traversal exceeded its 60-second deadline.');
      console.log(JSON.stringify({ end_users: endUsers, pages,
        traversal_ended: !page.has_more,
        stopped_reason: page.has_more ? 'page_limit' : 'observed_end' }, null, 2));
      process.exitCode = page.has_more ? 2 : 0;
      return;
    }
    cursor = page.next_cursor;
    seenCursors.add(cursor);
  }
}

main().catch(error => {
  console.error(error instanceof ExampleError ? error.message :
    'Directory traversal failed. No raw response, error or credential was printed.');
  process.exitCode = 1;
});
