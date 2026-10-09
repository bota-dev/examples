// Read only: retain fixed scope on every request and publish after all checks.
const PAGE_LIMIT = 50;
const MAX_PAGES = 10;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
class ExampleError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new ExampleError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value, prefix) => typeof value === 'string' &&
  new RegExp(`^${prefix}_[A-Za-z0-9-]{1,128}$`).test(value);

function configuration() {
  let url;
  try { url = new URL(process.env.BOTA_API_ORIGIN ?? 'https://api.bota.dev'); }
  catch { throw new ExampleError('Invalid BOTA_API_ORIGIN.'); }
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  requireValue((url.protocol === 'https:' || local) && !url.username && !url.password &&
    url.pathname === '/' && !url.search && !url.hash,
  'Use an HTTPS origin, or loopback HTTP, without paths, credentials, queries or fragments.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !key.toLowerCase().includes('replace_me'),
  'Configure a server-held project API key.');
  const project = process.env.BOTA_PROJECT_ID;
  requireValue(typeof project === 'string' && /^[A-Za-z0-9_-]{3,128}$/.test(project) &&
    !project.toLowerCase().includes('replace_me'), 'Configure the expected project ID.');
  const owner = process.env.BOTA_END_USER_ID;
  const recording = process.env.BOTA_RECORDING_ID;
  const session = process.env.BOTA_ASK_SESSION_ID;
  requireValue(validId(owner, 'eu') && validId(recording, 'rec') && validId(session, 'as') &&
    ![owner, recording, session].some(value => value.toLowerCase().includes('replace_me')),
  'Configure fixed end-user, recording and Ask session identifiers.');
  return { origin: url.origin, key, project, owner, recording, session };
}

function client(config) {
  const deadline = Date.now() + 120000;
  const signal = AbortSignal.timeout(120000);
  let total = 0;
  const request = async path => {
    requireValue(Date.now() < deadline, 'History read deadline exceeded.');
    signal.throwIfAborted();
    let response;
    try {
      response = await fetch(`${config.origin}/v1${path}`, {
        method: 'GET', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer',
        signal, headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json' },
      });
    } catch { throw new ExampleError('API read transport failed; no automatic retry was made.'); }
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new ExampleError(`API read returned HTTP ${response.status}; no automatic retry was made.`);
    }
    if (!response.body || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel();
      throw new ExampleError('Expected an API JSON response.');
    }
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of response.body) {
        signal.throwIfAborted();
        size += chunk.length;
        total += chunk.length;
        requireValue(size <= MAX_RESPONSE_BYTES && total <= MAX_TOTAL_BYTES, 'API response byte limit exceeded.');
        chunks.push(chunk);
      }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    } catch (error) {
      if (error instanceof ExampleError) throw error;
      throw new ExampleError('API response could not be read as bounded JSON.');
    }
  };
  request.checkDeadline = () => requireValue(Date.now() < deadline && !signal.aborted,
    'History read deadline exceeded.');
  return request;
}

function checkOptionalScope(value, config) {
  requireValue(!('project_id' in value) || value.project_id === config.project, 'Returned project does not match.');
  requireValue(!('end_user_id' in value) || value.end_user_id === config.owner, 'Returned end user does not match.');
}

async function checkRecording(request, config) {
  const recording = await request(`/recordings/${config.recording}`);
  requireValue(object(recording) && recording.id === config.recording &&
    recording.end_user_id === config.owner && recording.status !== 'deleted' &&
    (recording.deleted_at === undefined || recording.deleted_at === null),
  'Recording identity or configured ownership does not match.');
  checkOptionalScope(recording, config);
}

function checkSession(session, config, exact = true) {
  requireValue(object(session) && validId(session.id, 'as') && (!exact || session.id === config.session) &&
    object(session.scope) && session.scope.type === 'recording' &&
    Array.isArray(session.scope.recording_ids) && session.scope.recording_ids.length === 1 &&
    session.scope.recording_ids[0] === config.recording,
  'Session identity or single-recording scope does not match.');
  checkOptionalScope(session, config);
}

function pageCursor(page, cursors) {
  requireValue(object(page) && Array.isArray(page.data) && page.data.length <= PAGE_LIMIT &&
    typeof page.has_more === 'boolean', 'Invalid pagination response.');
  if (!page.has_more) {
    requireValue(page.next_cursor === undefined || page.next_cursor === null || page.next_cursor === '',
      'Unexpected cursor after the observed final page.');
    return null;
  }
  const cursor = page.next_cursor;
  requireValue(page.data.length > 0 && typeof cursor === 'string' && cursor.length > 0 &&
    cursor.length <= 4096 && !/[\x00-\x1f\x7f]/.test(cursor) && !cursors.has(cursor),
  'Pagination did not progress or returned an invalid cursor.');
  cursors.add(cursor);
  return cursor;
}

async function checkOwnerMembership(request, config) {
  const cursors = new Set();
  const ids = new Set();
  let cursor;
  for (let pages = 0; pages < MAX_PAGES; pages++) {
    const query = new URLSearchParams({ end_user_id: config.owner, recording_id: config.recording,
      scope_type: 'recording', limit: String(PAGE_LIMIT) });
    if (cursor) query.set('cursor', cursor);
    const page = await request(`/ask/sessions?${query}`);
    const next = pageCursor(page, cursors);
    let found = false;
    for (const session of page.data) {
      checkSession(session, config, false);
      requireValue(!ids.has(session.id), 'Session lookup returned a duplicate identifier.');
      ids.add(session.id);
      found ||= session.id === config.session;
    }
    if (found) return;
    requireValue(next !== null, 'Configured session was not found in the fixed-owner recording list.');
    cursor = next;
  }
  throw new ExampleError('Session lookup reached its page cap; ownership membership was not established.');
}

function selectMessage(message, config) {
  requireValue(object(message) && validId(message.id, 'msg') && ['user', 'assistant'].includes(message.role) &&
    typeof message.content === 'string' && message.content.length <= 1000000 &&
    Array.isArray(message.parts) && message.parts.length <= 1000,
  'Invalid or oversized history message.');
  checkOptionalScope(message, config);
  requireValue(!('session_id' in message) || message.session_id === config.session, 'Message session does not match.');
  const parts = message.parts.map(part => {
    requireValue(object(part), 'Invalid history part.');
    requireValue(!('recording_id' in part) || part.recording_id === config.recording,
      'History part refers to another recording.');
    if (part.type === 'text') {
      requireValue(typeof part.text === 'string' && part.text.length <= 1000000, 'Invalid or oversized text part.');
      return { type: 'text', text: part.text };
    }
    requireValue(part.type === 'citation' && message.role === 'assistant' &&
      part.recording_id === config.recording && Number.isSafeInteger(part.start_ms) && part.start_ms >= 0,
    'Invalid citation or citation outside the configured recording.');
    return { type: 'citation', recording_id: part.recording_id, start_ms: part.start_ms };
  });
  return { id: message.id, role: message.role, content: message.content, parts };
}

async function readMessages(request, config) {
  const cursors = new Set();
  const ids = new Set();
  const messages = [];
  let cursor;
  let outputBytes = 0;
  for (let pages = 1; pages <= MAX_PAGES; pages++) {
    const query = new URLSearchParams({ limit: String(PAGE_LIMIT) });
    if (cursor) query.set('cursor', cursor);
    const page = await request(`/ask/sessions/${config.session}/messages?${query}`);
    const next = pageCursor(page, cursors);
    for (const raw of page.data) {
      const message = selectMessage(raw, config);
      requireValue(!ids.has(message.id), 'Message history returned a duplicate identifier.');
      ids.add(message.id);
      outputBytes += Buffer.byteLength(JSON.stringify(message));
      requireValue(outputBytes <= 4 * 1024 * 1024, 'Selected history exceeds the output byte limit.');
      messages.push(message);
    }
    if (next === null || pages === MAX_PAGES) {
      return { messages, traversal: { status: next === null ? 'observed_end' : 'page_cap',
        pages, returned: messages.length, has_more: next !== null } };
    }
    cursor = next;
  }
}

async function main() {
  const config = configuration();
  const request = client(config);
  await checkRecording(request, config);
  await checkOwnerMembership(request, config);
  checkSession(await request(`/ask/sessions/${config.session}`), config);
  const result = await readMessages(request, config);
  await checkRecording(request, config);
  await checkOwnerMembership(request, config);
  checkSession(await request(`/ask/sessions/${config.session}`), config);
  const output = JSON.stringify({ session_id: config.session, recording_id: config.recording,
    order: 'api_response_order', atomic_snapshot: false, ...result });
  requireValue(Buffer.byteLength(output) + 1 <= 4 * 1024 * 1024, 'History output exceeds the byte limit.');
  request.checkDeadline();
  console.log(output);
  if (result.traversal.has_more) process.exitCode = 2;
}

main().catch(error => {
  // Never surface response bodies, headers, URLs, native errors or credentials.
  console.error(error instanceof ExampleError ? error.message : 'Local history read failed; inspect configuration.');
  process.exitCode = 1;
});
