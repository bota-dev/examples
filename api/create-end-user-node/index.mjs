import { createHash } from 'node:crypto';
import { chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

class ExampleError extends Error {}
const fail = (message) => { throw new ExampleError(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value, prefix) => typeof value === 'string' &&
  new RegExp(`^${prefix}_[A-Za-z0-9-]{1,128}$`).test(value);

function configuration() {
  let url;
  try { url = new URL(process.env.BOTA_API_ORIGIN ?? 'https://api.bota.dev'); }
  catch { fail('Invalid BOTA_API_ORIGIN.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) {
    fail('Use an HTTPS origin, or explicit loopback HTTP, with no path or credentials.');
  }
  const key = process.env.BOTA_API_KEY;
  if (!/^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key ?? '') || key.includes('REPLACE_ME')) {
    fail('Configure a server-held project API key.');
  }
  const project = process.env.BOTA_PROJECT_ID;
  if (!validId(project, 'proj') || project.includes('REPLACE_ME')) fail('Configure the expected project ID.');
  const externalId = process.env.BOTA_EXTERNAL_ID;
  if (!externalId || externalId.length > 255 || externalId.trim() !== externalId ||
      /[\u0000-\u001f\u007f]/.test(externalId) || externalId.includes('REPLACE_ME')) {
    fail('Configure one exact application external ID, 1–255 characters without surrounding whitespace or controls.');
  }
  return { origin: url.origin, key, project, externalId };
}

function journal(config) {
  const directory = resolve('.state');
  if (existsSync(directory) && (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink())) {
    fail('Journal directory must be a real local directory.');
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, 'end-user.sqlite');
  // Exclusive creation preserves an existing journal and applies private mode before SQLite opens it.
  try { closeSync(openSync(path, 'wx', 0o600)); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) fail('Journal must be a real local file.');
  chmodSync(path, 0o600);
  const db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA busy_timeout=5000;
      PRAGMA journal_mode=DELETE;
      PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS operation (
        singleton INTEGER PRIMARY KEY CHECK(singleton=1),
        scope TEXT NOT NULL,
        phase TEXT NOT NULL CHECK(phase IN ('ready','uncertain','known')),
        end_user_id TEXT
      );`);
    const scope = JSON.stringify({ origin: config.origin, project: config.project,
      externalIdHash: createHash('sha256').update(config.externalId).digest('hex') });
    db.prepare(`INSERT OR IGNORE INTO operation VALUES (1, ?, 'ready', NULL)`).run(scope);
    const row = db.prepare('SELECT * FROM operation WHERE singleton=1').get();
    if (row.scope !== scope) fail('Journal scope differs. Restore its origin, project and external ID; preserve the journal.');
    if (!['ready', 'uncertain', 'known'].includes(row.phase) ||
        (row.end_user_id !== null && !validId(row.end_user_id, 'eu')) ||
        (row.phase === 'known') !== (row.end_user_id !== null)) fail('Invalid retained journal state. Preserve it.');
    return {
      row,
      claim() {
        // This FULL-synchronous commit occurs before the only POST, including across local callers.
        const update = db.prepare(`UPDATE operation SET phase='uncertain'
          WHERE singleton=1 AND phase='ready' AND end_user_id IS NULL`).run();
        if (update.changes !== 1) fail('Another local invocation claimed creation. Rerun for GET-only reconciliation.');
      },
      remember(id) {
        const update = db.prepare(`UPDATE operation SET phase='known', end_user_id=?
          WHERE singleton=1 AND (end_user_id IS NULL OR end_user_id=?)`).run(id, id);
        if (update.changes !== 1) fail('Journal owns a different end-user ID. Preserve it and reconcile manually.');
      },
      close() { db.close(); },
    };
  } catch (error) { db.close(); throw error; }
}

function client(config) {
  const deadline = Date.now() + 120000;
  return async (method, path, body, expected = 200) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) fail('Operation deadline exceeded. Preserve the journal.');
    let response;
    try {
      response = await fetch(`${config.origin}/v1${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(remaining),
        headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { fail(`${method} transport failed. Preserve the journal; no automatic retry is performed.`); }
    if (response.status !== expected) {
      await response.body?.cancel();
      fail(`${method} returned HTTP ${response.status}. Preserve the journal; reconcile with GETs after creation intent.`);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel();
      fail('Expected JSON. Preserve the journal.');
    }
    const chunks = []; let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 1024 * 1024) fail('Response exceeds the example size limit.');
        chunks.push(chunk);
      }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    } catch { fail('Response could not be read as bounded JSON. Preserve the journal.'); }
  };
}

function checkEndUser(value, config, expectedId) {
  if (!object(value) || !validId(value.id, 'eu') || value.external_id !== config.externalId ||
      (expectedId && value.id !== expectedId) ||
      ('project_id' in value && value.project_id !== config.project) ||
      ('deleted_at' in value && value.deleted_at !== null)) {
    fail('End-user identity, project or active state mismatch. Preserve the journal.');
  }
  return value.id;
}

async function main() {
  const config = configuration();
  const state = journal(config);
  try {
    const request = client(config);
    const query = new URLSearchParams({ external_id: config.externalId });
    const page = await request('GET', `/end-users?${query}`);
    if (!object(page) || !Array.isArray(page.data) || page.data.length > 1 || page.has_more !== false) {
      fail('Expected at most one exact active external-ID match without pagination. No creation was attempted.');
    }
    let endUserId;
    let resolution;
    if (page.data.length === 1) {
      endUserId = checkEndUser(page.data[0], config, state.row.end_user_id);
      state.remember(endUserId);
      resolution = state.row.phase === 'uncertain' ? 'reconciled' : 'existing';
    } else {
      if (state.row.phase !== 'ready') {
        fail('No active match for retained creation intent or known ID. This run sends no POST; reconcile manually.');
      }
      state.claim();
      const created = await request('POST', '/end-users', { external_id: config.externalId }, 201);
      endUserId = checkEndUser(created, config);
      state.remember(endUserId);
      resolution = 'created';
    }
    const fresh = await request('GET', `/end-users/${endUserId}`);
    checkEndUser(fresh, config, endUserId);
    console.log(JSON.stringify({ end_user_id: endUserId, external_id: config.externalId, resolution }, null, 2));
  } finally { state.close(); }
}

main().catch((error) => {
  console.error(error instanceof ExampleError ? error.message :
    'Local operation failed. Preserve .state and inspect configuration; no raw error or API body is printed.');
  process.exitCode = 1;
});
