import { createHash } from 'node:crypto';
import { chmodSync, closeSync, constants, fstatSync, lstatSync, openSync, readSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PAGE_LIMIT = 50;
const MAX_PAGES = 10;
class ExampleError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new ExampleError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value, prefix) => typeof value === 'string' &&
  new RegExp(`^${prefix}_[A-Za-z0-9-]{1,128}$`).test(value);

function configuration() {
  const rawOrigin = process.env.BOTA_API_ORIGIN ?? 'https://api.bota.dev';
  requireValue(typeof rawOrigin === 'string' && rawOrigin.length <= 2048 &&
    !/[\\\x00-\x20\x7f]/.test(rawOrigin), 'Invalid BOTA_API_ORIGIN.');
  let url;
  try { url = new URL(rawOrigin); }
  catch { throw new ExampleError('Invalid BOTA_API_ORIGIN.'); }
  requireValue(url.protocol === 'https:' && !url.username && !url.password &&
    url.pathname === '/' && !url.search && !url.hash, 'Configure a trusted HTTPS origin without path or credentials.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !key.toLowerCase().includes('replace_me'),
  'Configure a server-held project API key.');
  const project = process.env.BOTA_PROJECT_ID;
  const owner = process.env.BOTA_END_USER_ID;
  const recording = process.env.BOTA_RECORDING_ID;
  const session = process.env.BOTA_ASK_SESSION_ID;
  requireValue(validId(project, 'proj') && validId(owner, 'eu') && validId(recording, 'rec') &&
    validId(session, 'as') && ![project, owner, recording, session].some(value => value.toLowerCase().includes('replace_me')),
  'Configure fixed project, end-user, recording and Ask session identifiers.');
  requireValue(process.env.TITLE_FILE && process.env.JOURNAL_FILE,
    'Configure a private TITLE_FILE and durable JOURNAL_FILE with an existing private parent directory.');
  return { origin: url.origin, key, project, owner, recording, session,
    titleFile: resolve(process.env.TITLE_FILE), journalFile: resolve(process.env.JOURNAL_FILE) };
}

function privateStat(stat, kind) {
  requireValue(kind === 'directory' ? stat.isDirectory() : stat.isFile(), 'Private local path has an invalid type.');
  if (process.platform !== 'win32') {
    requireValue((stat.mode & 0o077) === 0 && stat.uid === process.getuid(),
      'Private local path must be owned by this user without group or other permissions.');
  }
}

function checkParent(path) {
  let directory = dirname(path);
  privateStat(lstatSync(directory), 'directory');
  // Reject symlinked ancestors; the configured directories must remain trusted and stable.
  for (;;) {
    const stat = lstatSync(directory);
    requireValue(stat.isDirectory() && !stat.isSymbolicLink(), 'Local path ancestry must contain real directories.');
    if (directory === parse(directory).root) break;
    directory = dirname(directory);
  }
}

function readTitle(path) {
  checkParent(path);
  const before = lstatSync(path);
  privateStat(before, 'file');
  requireValue(!before.isSymbolicLink() && before.nlink === 1 && before.size <= 4096,
    'TITLE_FILE must be one private regular file, at most 4096 bytes.');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    privateStat(opened, 'file');
    requireValue(opened.dev === before.dev && opened.ino === before.ino && opened.nlink === 1,
      'TITLE_FILE changed while opening.');
    const bytes = Buffer.alloc(4097);
    let size = 0;
    for (;;) {
      const count = readSync(fd, bytes, size, bytes.length - size, null);
      if (count === 0) break;
      size += count;
      requireValue(size <= 4096, 'TITLE_FILE exceeds the byte limit.');
    }
    const after = fstatSync(fd);
    requireValue(after.size === opened.size && after.mtimeMs === opened.mtimeMs && after.ctimeMs === opened.ctimeMs &&
      size === after.size, 'TITLE_FILE changed during reading.');
    let title;
    try { title = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)).trim(); }
    catch { throw new ExampleError('TITLE_FILE must contain valid UTF-8.'); }
    // Matches the tracked Zod trim/min/max contract: JavaScript UTF-16 code units.
    requireValue(title.length >= 1 && title.length <= 200, 'Trimmed title must contain 1–200 UTF-16 code units.');
    return title;
  } finally { closeSync(fd); }
}

function journal(config, title) {
  const path = config.journalFile;
  requireValue(path !== config.titleFile, 'Title and journal paths must differ.');
  checkParent(path);
  let fresh = false;
  try { closeSync(openSync(path, 'wx', 0o600)); fresh = true; }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const stat = lstatSync(path);
  privateStat(stat, 'file');
  requireValue(!stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 1024 * 1024,
    'Journal must be one private regular file within the example size limit.');
  chmodSync(path, 0o600);
  const db = new DatabaseSync(path);
  const scope = JSON.stringify({ origin: config.origin, project: config.project, owner: config.owner,
    recording: config.recording, session: config.session,
    titleSha256: createHash('sha256').update(title).digest('hex') });
  try {
    db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');
    const schema = `CREATE TABLE operation (
      singleton INTEGER PRIMARY KEY CHECK(singleton=1), scope TEXT NOT NULL,
      phase TEXT NOT NULL CHECK(phase IN ('uncertain','acknowledged'))
    )`;
    if (fresh) db.exec(schema);
    // Never initialize or repair an existing malformed/corrupt file.
    const entries = db.prepare('SELECT name, type, sql FROM sqlite_schema').all();
    requireValue(entries.length === 1 && entries[0].name === 'operation' && entries[0].type === 'table' &&
      entries[0].sql === schema, 'Invalid retained journal schema. Preserve it.');
    const read = () => {
      const rows = db.prepare('SELECT * FROM operation').all();
      requireValue(rows.length <= 1, 'Invalid retained journal rows. Preserve them.');
      const row = rows[0];
      if (row) requireValue(row.singleton === 1 && row.scope === scope &&
        ['uncertain', 'acknowledged'].includes(row.phase), 'Journal scope or retained state differs. Preserve it.');
      return row;
    };
    return {
      row: read(),
      claim() {
        db.exec('BEGIN IMMEDIATE');
        try {
          let row = read();
          const inserted = !row;
          if (inserted) {
            db.prepare("INSERT INTO operation VALUES (1, ?, 'uncertain')").run(scope);
            row = read();
          }
          // FULL-synchronous commit consumes the one local attempt before PATCH.
          db.exec('COMMIT');
          return { inserted, row };
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      },
      acknowledge() {
        const result = db.prepare("UPDATE operation SET phase='acknowledged' WHERE singleton=1 AND scope=? AND phase='uncertain'").run(scope);
        requireValue(result.changes === 1, 'Journal acknowledgment could not be retained. Preserve it.');
      },
      close() { db.close(); },
    };
  } catch (error) { db.close(); throw error; }
}

function client(config) {
  const deadline = Date.now() + 120000;
  const signal = AbortSignal.timeout(120000);
  let total = 0;
  const request = async (method, path, body) => {
    requireValue(Date.now() < deadline && !signal.aborted, 'Operation deadline exceeded. Preserve the journal.');
    let response;
    try {
      response = await fetch(`${config.origin}/v1${path}`, {
        method, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', signal,
        headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new ExampleError('API transport failed. Preserve the journal; no automatic retry is performed.'); }
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new ExampleError(`API returned HTTP ${response.status}. Preserve the journal; no automatic retry is performed.`);
    }
    if (!response.body || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel();
      throw new ExampleError('Expected API JSON. Preserve the journal.');
    }
    const chunks = []; let size = 0;
    try {
      for await (const chunk of response.body) {
        signal.throwIfAborted();
        size += chunk.length; total += chunk.length;
        requireValue(size <= 1024 * 1024 && total <= 16 * 1024 * 1024, 'API response byte limit exceeded.');
        chunks.push(chunk);
      }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    } catch (error) {
      if (error instanceof ExampleError) throw error;
      throw new ExampleError('API response could not be read as bounded JSON. Preserve the journal.');
    }
  };
  request.checkDeadline = () => requireValue(Date.now() < deadline && !signal.aborted, 'Operation deadline exceeded.');
  return request;
}

function checkOptionalScope(value, config) {
  requireValue(!('project_id' in value) || value.project_id === config.project, 'Returned project does not match.');
  requireValue(!('end_user_id' in value) || value.end_user_id === config.owner, 'Returned owner does not match.');
  requireValue(!('deleted_at' in value) || value.deleted_at === null, 'Returned resource is not active.');
}

async function checkOwnerAndRecording(request, config) {
  const owner = await request('GET', `/end-users/${config.owner}`);
  requireValue(object(owner) && owner.id === config.owner, 'Configured end-user identity does not match.');
  checkOptionalScope(owner, config);
  const recording = await request('GET', `/recordings/${config.recording}`);
  requireValue(object(recording) && recording.id === config.recording && recording.end_user_id === config.owner &&
    recording.status !== 'deleted', 'Recording identity or configured ownership does not match.');
  checkOptionalScope(recording, config);
}

function checkSession(value, config, exact = true) {
  requireValue(object(value) && validId(value.id, 'as') && (!exact || value.id === config.session) &&
    object(value.scope) && value.scope.type === 'recording' && Array.isArray(value.scope.recording_ids) &&
    value.scope.recording_ids.length === 1 && value.scope.recording_ids[0] === config.recording &&
    typeof value.title === 'string' && value.title.length >= 1 && value.title.length <= 200,
  'Session identity, title shape or exact recording scope does not match.');
  checkOptionalScope(value, config);
  return value;
}

async function checkMembership(request, config) {
  const cursors = new Set();
  const ids = new Set();
  let cursor;
  for (let pages = 0; pages < MAX_PAGES; pages++) {
    const query = new URLSearchParams({ end_user_id: config.owner, recording_id: config.recording,
      scope_type: 'recording', limit: String(PAGE_LIMIT) });
    if (cursor) query.set('cursor', cursor);
    const page = await request('GET', `/ask/sessions?${query}`);
    requireValue(object(page) && Array.isArray(page.data) && page.data.length <= PAGE_LIMIT &&
      typeof page.has_more === 'boolean', 'Invalid session membership page.');
    checkOptionalScope(page, config);
    let next = null;
    if (page.has_more) {
      next = page.next_cursor;
      requireValue(page.data.length > 0 && typeof next === 'string' && next.length > 0 && next.length <= 4096 &&
        !/[\x00-\x1f\x7f]/.test(next) && !cursors.has(next), 'Session membership pagination did not progress.');
      cursors.add(next);
    } else requireValue(page.next_cursor === undefined || page.next_cursor === null || page.next_cursor === '',
      'Unexpected cursor after the final membership page.');
    let found = false;
    for (const session of page.data) {
      checkSession(session, config, false);
      requireValue(!ids.has(session.id), 'Session membership returned a duplicate ID.');
      ids.add(session.id);
      found ||= session.id === config.session;
    }
    if (found) return;
    requireValue(next !== null, 'Session not found in the fixed-owner recording list.');
    cursor = next;
  }
  throw new ExampleError('Membership page cap reached; ownership was not established.');
}

async function observe(request, config) {
  await checkOwnerAndRecording(request, config);
  await checkMembership(request, config);
  return checkSession(await request('GET', `/ask/sessions/${config.session}`), config);
}

async function main() {
  const config = configuration();
  const title = readTitle(config.titleFile); // One immutable in-memory input; never overwrite the file.
  const state = journal(config, title);
  try {
    const request = client(config);
    await observe(request, config);
    let phase = state.row?.phase;
    if (!state.row) {
      const claim = state.claim();
      phase = claim.row.phase;
      if (claim.inserted) {
        const response = checkSession(await request('PATCH', `/ask/sessions/${config.session}`, { title }), config);
        requireValue(response.title === title, 'PATCH response did not acknowledge the intended title. Preserve the journal.');
        state.acknowledge();
        phase = 'acknowledged';
      }
    }
    // Every retained intent, including uncertain failures, reaches here using GETs only.
    const final = await observe(request, config);
    await checkOwnerAndRecording(request, config);
    request.checkDeadline();
    console.log(JSON.stringify({ session_id: config.session, recording_id: config.recording,
      patch_acknowledged: phase === 'acknowledged', observed_title_match: final.title === title,
      observation: phase === 'uncertain' ? 'uncertain_outcome' : 'acknowledged_outcome', atomic_snapshot: false }));
    if (phase === 'uncertain' || final.title !== title) process.exitCode = 2;
  } finally { state.close(); }
}

main().catch(error => {
  // Never print titles, title digests, API bodies, URLs, credentials or native errors.
  console.error(error instanceof ExampleError ? error.message : 'Local operation failed. Preserve the title and journal; inspect trusted configuration.');
  process.exitCode = 1;
});
