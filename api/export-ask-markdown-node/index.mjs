import { randomUUID } from 'node:crypto';
import { link, lstat, open, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const PAGE_SIZE = 50;
const PAGE_CAP = 10;
const OUTPUT_CAP = 4 * 1024 * 1024;
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);

function configuration() {
  const raw = process.env.BOTA_API_BASE_URL;
  requireValue(typeof raw === 'string' && raw.length <= 2048 && !/[\\\s\x00-\x1f\x7f]/.test(raw),
    'Configure a trusted HTTPS API URL ending in /v1.');
  let base;
  try { base = new URL(raw); } catch { throw new SafeError('Invalid API URL.'); }
  requireValue(base.protocol === 'https:' && !base.username && !base.password && !base.search &&
    !base.hash && /^\/v1\/?$/.test(base.pathname), 'Use a trusted HTTPS origin, /v1 path and no URL credentials, query or fragment.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 && /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) &&
    !key.toLowerCase().includes('replace_me'), 'Configure a server-held project key permitted to read recordings and Ask history.');
  const project = process.env.BOTA_PROJECT_ID;
  const owner = process.env.BOTA_END_USER_ID;
  const recording = process.env.BOTA_RECORDING_ID;
  const session = process.env.BOTA_ASK_SESSION_ID;
  requireValue(id(project, 'proj') && id(owner, 'eu') && id(recording, 'rec') && id(session, 'as'),
    'Configure exact project, end-user, recording and Ask session IDs.');
  const output = process.env.OUTPUT_PATH;
  requireValue(typeof output === 'string' && output.length > 0 && output.length <= 2048 &&
    output.isWellFormed() && !/[\x00-\x1f\x7f]/.test(output) && output.endsWith('.md'),
  'Configure a new .md file in an existing private directory.');
  return { base: base.href.replace(/\/$/, ''), key, project, owner, recording, session, output: resolve(output) };
}

function apiClient(config) {
  const signal = AbortSignal.timeout(120_000);
  let totalBytes = 0;
  async function get(path) {
    signal.throwIfAborted();
    const response = await fetch(config.base + path, { method: 'GET', redirect: 'error',
      credentials: 'omit', referrerPolicy: 'no-referrer', signal,
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json' } });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new SafeError(`API read returned HTTP ${response.status}; no automatic retry was made.`);
    }
    if (!response.body || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel();
      throw new SafeError('Expected an API JSON response.');
    }
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      signal.throwIfAborted();
      bytes += chunk.length; totalBytes += chunk.length;
      requireValue(bytes <= 1024 * 1024 && totalBytes <= 16 * 1024 * 1024, 'Decoded API response byte limit exceeded.');
      chunks.push(chunk);
    }
    signal.throwIfAborted();
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new SafeError('The API returned invalid UTF-8 or JSON.'); }
  }
  return { get, signal };
}

function optionalIdentity(value, config) {
  requireValue(!Object.hasOwn(value, 'project_id') || value.project_id === config.project,
    'Returned project does not match.');
  requireValue(!Object.hasOwn(value, 'end_user_id') || value.end_user_id === config.owner,
    'Returned end user does not match.');
  requireValue(!Object.hasOwn(value, 'deleted_at') || value.deleted_at === null,
    'A returned resource has a deletion marker.');
}

async function recordingOwner(api, config) {
  const value = await api.get(`/recordings/${config.recording}`);
  requireValue(object(value) && value.id === config.recording && value.end_user_id === config.owner &&
    value.status !== 'deleted', 'Recording identity or configured ownership does not match.');
  optionalIdentity(value, config);
}

function sessionScope(value, config, exact) {
  requireValue(object(value) && id(value.id, 'as') && (!exact || value.id === config.session) &&
    value.status !== 'deleted' && object(value.scope) && value.scope.type === 'recording' &&
    Array.isArray(value.scope.recording_ids) && value.scope.recording_ids.length === 1 &&
    value.scope.recording_ids[0] === config.recording, 'Session identity or immutable single-recording scope does not match.');
  optionalIdentity(value, config);
}

function nextCursor(page, cursors, config) {
  requireValue(object(page) && Array.isArray(page.data) && page.data.length <= PAGE_SIZE &&
    typeof page.has_more === 'boolean', 'Invalid pagination envelope.');
  optionalIdentity(page, config);
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

async function ownerMembership(api, config) {
  const cursors = new Set(); const ids = new Set(); let cursor;
  for (let pageNumber = 1; pageNumber <= PAGE_CAP; pageNumber++) {
    const query = new URLSearchParams({ end_user_id: config.owner, recording_id: config.recording,
      scope_type: 'recording', limit: String(PAGE_SIZE) });
    if (cursor) query.set('cursor', cursor);
    const page = await api.get(`/ask/sessions?${query}`);
    const next = nextCursor(page, cursors, config); let found = false;
    for (const session of page.data) {
      sessionScope(session, config, false);
      requireValue(!ids.has(session.id), 'Session lookup returned a duplicate ID.');
      ids.add(session.id); found ||= session.id === config.session;
    }
    if (found) return;
    requireValue(next !== null, 'Configured session was not found in the fixed-owner list.');
    cursor = next;
  }
  throw new SafeError('Session membership page cap reached; no export was published.');
}

function safeText(value) {
  requireValue(typeof value === 'string' && value.length <= 250_000 && value.isWellFormed(),
    'Invalid Unicode, invalid text or oversized history text.');
  // Flatten layout/control characters; encode every ASCII punctuation character so
  // user text cannot introduce Markdown, HTML, links, entities or renderer autolinks.
  return value.replace(/[\x00-\x20\x7f-\x9f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/g, ' ')
    .replace(/[!-/:-@\[-`{-~]/g, character => `&#${character.charCodeAt(0)};`);
}

function messageMarkdown(value, config) {
  requireValue(object(value) && id(value.id, 'msg') && ['user', 'assistant'].includes(value.role) &&
    Array.isArray(value.parts) && value.parts.length <= 1000, 'Invalid or oversized history message.');
  optionalIdentity(value, config);
  requireValue(!Object.hasOwn(value, 'session_id') || value.session_id === config.session,
    'Message belongs to another session.');
  const lines = [`## ${value.role === 'user' ? 'User' : 'Assistant'}`, '', 'Content:', '', safeText(value.content), '', 'Parts:', ''];
  for (const part of value.parts) {
    requireValue(object(part) && (!Object.hasOwn(part, 'recording_id') || part.recording_id === config.recording),
      'Invalid history part or cross-recording reference.');
    if (part.type === 'text') lines.push(safeText(part.text), '');
    else {
      requireValue(part.type === 'citation' && value.role === 'assistant' && part.recording_id === config.recording &&
        Number.isSafeInteger(part.start_ms) && part.start_ms >= 0, 'Invalid citation or citation outside the configured recording.');
      // A citation is plain text, never a link or playback instruction.
      lines.push(`Citation: ${safeText(part.recording_id)} at ${safeText(String(part.start_ms))} ms.`, '');
    }
  }
  return lines.join('\n');
}

async function historyMarkdown(api, config) {
  const cursors = new Set(); const ids = new Set(); let cursor;
  const blocks = ['# Ask history\n\nOrder: API response order.\n\nTraversal: observed end required.\n\nAtomic snapshot: false.\n'];
  let bytes = Buffer.byteLength(blocks[0]);
  for (let pageNumber = 1; pageNumber <= PAGE_CAP; pageNumber++) {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) query.set('cursor', cursor);
    const page = await api.get(`/ask/sessions/${config.session}/messages?${query}`);
    const next = nextCursor(page, cursors, config);
    for (const message of page.data) {
      const block = messageMarkdown(message, config);
      requireValue(!ids.has(message.id), 'History returned a duplicate message ID.');
      ids.add(message.id); bytes += Buffer.byteLength(block) + 1;
      requireValue(bytes <= OUTPUT_CAP, 'Rendered Markdown exceeds the 4 MiB limit.');
      blocks.push(block);
    }
    if (next === null) return Buffer.from(blocks.join('\n'), 'utf8');
    cursor = next;
  }
  throw new SafeError('History page cap reached; no incomplete export was published.');
}

async function privateParent(output) {
  const parent = dirname(output);
  for (let path = parent; ; path = dirname(path)) {
    const value = await lstat(path);
    requireValue(value.isDirectory() && !value.isSymbolicLink(), 'Output ancestry must contain only trusted existing directories.');
    if (path === parent && process.platform !== 'win32') {
      requireValue(value.uid === process.getuid() && (value.mode & 0o077) === 0,
        'Output parent must be owned by this process user and private, for example mode 0700.');
    }
    if (dirname(path) === path) break;
  }
  return lstat(parent);
}

async function exportHistory(config) {
  const originalParent = await privateParent(config.output);
  try { await lstat(config.output); throw new SafeError('Output already exists; no file was overwritten.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const api = apiClient(config);
  let partial; let file;
  try {
    await recordingOwner(api, config);
    await ownerMembership(api, config);
    sessionScope(await api.get(`/ask/sessions/${config.session}`), config, true);
    const bytes = await historyMarkdown(api, config);
    await ownerMembership(api, config);
    sessionScope(await api.get(`/ask/sessions/${config.session}`), config, true);
    api.signal.throwIfAborted();
    const candidate = join(dirname(config.output), `.${basename(config.output)}.${randomUUID()}.partial`);
    file = await open(candidate, 'wx', 0o600);
    partial = candidate; // Only this invocation's successfully created partial may be removed.
    await file.writeFile(bytes, { signal: api.signal });
    await file.sync();
    await file.close(); file = undefined;
    const currentParent = await privateParent(config.output);
    requireValue(currentParent.dev === originalParent.dev && currentParent.ino === originalParent.ino,
      'The private output parent changed; no export was published.');
    await recordingOwner(api, config); // Final fresh owner observation, still not a transaction.
    api.signal.throwIfAborted();
    await link(partial, config.output); // Fails if any destination, including a symlink, exists.
  } finally {
    await file?.close().catch(() => {});
    if (partial) {
      try { await unlink(partial); }
      catch { throw new SafeError('Partial cleanup failed; inspect the private directory. A completed output may exist.'); }
    }
  }
}

try {
  await exportHistory(configuration());
  console.log('Exported selected Ask history as private Markdown.');
} catch (error) {
  console.error(error instanceof SafeError ? error.message :
    'Export failed or its deadline expired. Inspect configuration, API access and the private output directory.');
  process.exitCode = 1;
}
