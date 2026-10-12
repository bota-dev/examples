import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ensure } from './errors.mjs';

// This separate database holds intent metadata only: no audio, answers, keys or signed material.
export function createStore(path, scopeId) {
  const existed = path !== ':memory:' && existsSync(path);
  if (path !== ':memory:') {
    const directory = dirname(path);
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true, mode: 0o700 });
    const info = lstatSync(directory);
    ensure(info.isDirectory() && !info.isSymbolicLink() &&
      (process.platform === 'win32' || (info.uid === process.getuid() && (info.mode & 0o077) === 0)),
    500, 'private_state', 'Use a trusted private state directory.');
    if (existsSync(path)) {
      const file = lstatSync(path);
      ensure(file.isFile() && !file.isSymbolicLink() &&
        (process.platform === 'win32' || (file.uid === process.getuid() && (file.mode & 0o077) === 0)),
      500, 'private_state', 'Use a private regular library database.');
    }
  }
  const db = new DatabaseSync(path);
  if (existed) {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
    if (!tables.includes('library_scope') || !tables.includes('library_operations')) {
      db.close();
      ensure(false, 409, 'library_journal_invalid', 'This is not a library journal. Preserve the original file.');
    }
  }
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS library_scope (id INTEGER PRIMARY KEY CHECK(id=1), identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS library_operations (id TEXT PRIMARY KEY, kind TEXT NOT NULL,
      anchor TEXT NOT NULL, state TEXT NOT NULL, resource_id TEXT, details TEXT NOT NULL,
      updated_at TEXT NOT NULL, UNIQUE(kind,anchor));`);
  db.prepare('INSERT OR IGNORE INTO library_scope VALUES(1,?)').run(scopeId);
  if (db.prepare('SELECT identity FROM library_scope WHERE id=1').get().identity !== scopeId) {
    db.close();
    ensure(false, 409, 'library_scope_changed', 'Restore the original API endpoint, key, project and end user. Preserve this journal.');
  }
  const view = (row) => row && ({
    id: row.id, kind: row.kind, anchor: row.anchor, state: row.state,
    resourceId: row.resource_id, details: JSON.parse(row.details), updatedAt: row.updated_at,
  });
  const owned = (principal, id) => {
    ensure(principal.scopeId === scopeId, 409, 'library_scope_changed', 'Library scope changed.');
    const row = db.prepare('SELECT * FROM library_operations WHERE id=?').get(id);
    ensure(row, 404, 'operation_not_found', 'Operation unavailable.');
    return row;
  };
  return {
    claim(principal, kind, anchor, details) {
      ensure(principal.scopeId === scopeId, 409, 'library_scope_changed', 'Library scope changed.');
      const inserted = db.prepare("INSERT OR IGNORE INTO library_operations VALUES(?,?,?,'claimed',NULL,?,?)")
        .run(randomUUID(), kind, anchor, JSON.stringify(details), new Date().toISOString());
      const row = db.prepare('SELECT * FROM library_operations WHERE kind=? AND anchor=?').get(kind, anchor);
      return { fresh: inserted.changes === 1, operation: view(row) };
    },
    save(principal, id, changes) {
      const row = owned(principal, id);
      ensure(changes.resourceId === undefined || row.resource_id === null || changes.resourceId === row.resource_id,
        409, 'intent_conflict', 'A known resource cannot be replaced.');
      db.prepare('UPDATE library_operations SET state=?,resource_id=?,details=?,updated_at=? WHERE id=?')
        .run(changes.state ?? row.state, changes.resourceId === undefined ? row.resource_id : changes.resourceId,
          JSON.stringify({ ...JSON.parse(row.details), ...changes.details }), new Date().toISOString(), id);
      return view(owned(principal, id));
    },
    get(principal, id) { return view(owned(principal, id)); },
    find(principal, kind, anchor) {
      ensure(principal.scopeId === scopeId, 409, 'library_scope_changed', 'Library scope changed.');
      return view(db.prepare('SELECT * FROM library_operations WHERE kind=? AND anchor=?').get(kind, anchor));
    },
    findLegacyAsk(principal, recordingId) {
      ensure(principal.scopeId === scopeId, 409, 'library_scope_changed', 'Library scope changed.');
      return view(db.prepare(`SELECT * FROM library_operations WHERE kind='ask' AND state!='complete'
        AND json_extract(details,'$.recordingId')=?
        AND json_extract(details,'$.questionFormat') IS NOT 'trim-v1' LIMIT 1`).get(recordingId));
    },
    list(principal) {
      ensure(principal.scopeId === scopeId, 409, 'library_scope_changed', 'Library scope changed.');
      return db.prepare('SELECT * FROM library_operations ORDER BY updated_at DESC LIMIT 50').all().map(view);
    },
    close() { db.close(); },
  };
}
