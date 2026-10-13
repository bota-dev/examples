import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ensure } from './errors.mjs';

export function privateDirectory(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true, mode: 0o700 });
  const info = lstatSync(path);
  ensure(
    info.isDirectory() && !info.isSymbolicLink(),
    500,
    'PRIVATE_STATE',
    'Use an existing trusted private state directory.',
  );
  if (process.platform !== 'win32')
    ensure(
      info.uid === process.getuid() && (info.mode & 0o077) === 0,
      500,
      'PRIVATE_STATE',
      'State directory must be owned by this user and private.',
    );
}

export function createStore(path = ':memory:') {
  if (path !== ':memory:') {
    privateDirectory(dirname(path));
    if (existsSync(path)) {
      const info = lstatSync(path);
      ensure(
        info.isFile() &&
          !info.isSymbolicLink() &&
          (process.platform === 'win32' ||
            (info.uid === process.getuid() && (info.mode & 0o077) === 0)),
        500,
        'PRIVATE_STATE',
        'Use a private regular database file.',
      );
    }
  }
  const db = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, account TEXT NOT NULL, scope TEXT NOT NULL,
      kind TEXT NOT NULL, anchor TEXT NOT NULL, state TEXT NOT NULL, resource_id TEXT, details TEXT NOT NULL,
      updated_at TEXT NOT NULL, UNIQUE(account,kind,anchor));
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, type TEXT NOT NULL, created_at TEXT NOT NULL,
      resource_kind TEXT, resource_id TEXT, body_hash TEXT NOT NULL);`);
  const op = (row) =>
    row && {
      id: row.id,
      kind: row.kind,
      anchor: row.anchor,
      state: row.state,
      resourceId: row.resource_id,
      details: JSON.parse(row.details),
      updatedAt: row.updated_at,
    };
  function owned(principal, id) {
    const row = db
      .prepare('SELECT * FROM operations WHERE id=? AND account=?')
      .get(id, principal.accountId);
    ensure(row && row.scope === principal.scopeId, 404, 'NOT_FOUND', 'Operation unavailable.');
    return row;
  }
  return {
    claim(principal, kind, anchor, details = {}) {
      const result = db
        .prepare(`INSERT OR IGNORE INTO operations VALUES(?,?,?,?,?,'claimed',NULL,?,?)`)
        .run(
          randomUUID(),
          principal.accountId,
          principal.scopeId,
          kind,
          anchor,
          JSON.stringify(details),
          new Date().toISOString(),
        );
      const row = db
        .prepare('SELECT * FROM operations WHERE account=? AND kind=? AND anchor=?')
        .get(principal.accountId, kind, anchor);
      ensure(
        row.scope === principal.scopeId,
        409,
        'SCOPE_CHANGED',
        'Saved intent belongs to an earlier account scope. Preserve it.',
      );
      return { fresh: result.changes === 1, operation: op(row) };
    },
    save(principal, id, changes) {
      const row = owned(principal, id);
      db.prepare(
        'UPDATE operations SET state=?,resource_id=?,details=?,updated_at=? WHERE id=?',
      ).run(
        changes.state ?? row.state,
        changes.resourceId === undefined ? row.resource_id : changes.resourceId,
        JSON.stringify({ ...JSON.parse(row.details), ...changes.details }),
        new Date().toISOString(),
        id,
      );
      return op(owned(principal, id));
    },
    get(principal, id) {
      return op(owned(principal, id));
    },
    find(principal, kind, anchor) {
      const row = db
        .prepare('SELECT * FROM operations WHERE account=? AND kind=? AND anchor=?')
        .get(principal.accountId, kind, anchor);
      if (!row) return null;
      ensure(
        row.scope === principal.scopeId,
        409,
        'SCOPE_CHANGED',
        'Saved intent belongs to an earlier account scope. Preserve it.',
      );
      return op(row);
    },
    findLegacyAsk(principal, recordingId) {
      // A hash cannot tell us which trimmed question an older intent meant.
      // Search the durable journal, including requests outside the UI's 50 rows.
      const row = db
        .prepare(
          `SELECT * FROM operations WHERE account=? AND kind='ask'
        AND state!='complete' AND json_extract(details,'$.recordingId')=?
        AND json_extract(details,'$.questionFormat') IS NOT 'trim-v1' LIMIT 1`,
        )
        .get(principal.accountId, recordingId);
      if (!row) return null;
      ensure(
        row.scope === principal.scopeId,
        409,
        'SCOPE_CHANGED',
        'Saved intent belongs to an earlier account scope. Preserve it.',
      );
      return op(row);
    },
    assertPeerIntent(kind, anchor, { principal, recordingId } = {}) {
      // This internal probe includes removed accounts, older scopes and intents
      // outside Activity's bounded list. Only the exact caller scope is exempt.
      const exclude = principal ? 'AND NOT (account=? AND scope=?)' : '';
      const owner = principal ? [principal.accountId, principal.scopeId] : [];
      let peer = db
        .prepare(`SELECT 1 FROM operations WHERE kind=? AND anchor=? ${exclude} LIMIT 1`)
        .get(kind, anchor, ...owner);
      if (!peer && kind === 'ask' && recordingId)
        peer = db
          .prepare(
            `SELECT 1 FROM operations WHERE kind='ask' AND state!='complete'
          AND json_extract(details,'$.recordingId')=?
          AND json_extract(details,'$.questionFormat') IS NOT 'trim-v1' ${exclude} LIMIT 1`,
          )
          .get(recordingId, ...owner);
      ensure(
        !peer,
        409,
        'cross_intent_reconciliation_required',
        'A retained request requires reconciliation before a new action.',
      );
      return true;
    },
    list(principal) {
      return db
        .prepare(
          'SELECT * FROM operations WHERE account=? AND scope=? ORDER BY updated_at DESC LIMIT 50',
        )
        .all(principal.accountId, principal.scopeId)
        .map(op);
    },
    acceptEvent(event) {
      db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?)').run(
        event.id,
        event.type,
        event.createdAt,
        event.resourceKind ?? null,
        event.resourceId ?? null,
        event.bodyHash,
      );
      const saved = db.prepare('SELECT body_hash FROM events WHERE id=?').get(event.id);
      ensure(saved.body_hash === event.bodyHash, 409, 'EVENT_CONFLICT', 'Event identity conflict.');
    },
    events() {
      return db
        .prepare('SELECT * FROM events ORDER BY rowid DESC LIMIT 50')
        .all()
        .map((row) => ({
          id: row.id,
          type: row.type,
          createdAt: row.created_at,
          resourceKind: row.resource_kind,
          resourceId: row.resource_id,
          bodyHash: row.body_hash,
        }));
    },
    close() {
      db.close();
    },
  };
}
