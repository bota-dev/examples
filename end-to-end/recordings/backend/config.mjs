import { lstatSync, opendirSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { configuration } from '../../web-reference/server/config.mjs';
import { readConfig } from '../../react-native-recording-sync/backend/service.mjs';
import { AppError, ensure } from './errors.mjs';

const reject = (condition, message) => ensure(condition, 500, 'integrated_configuration', message);
const sourceWebBase = fileURLToPath(new URL('../../web-reference/', import.meta.url));

function absolute(value, label) {
  reject(
    typeof value === 'string' &&
      value.length <= 4096 &&
      isAbsolute(value) &&
      !/[\x00-\x1f\x7f]/.test(value),
    `${label} must be an explicit absolute path.`,
  );
  return resolve(value);
}

function stat(path) {
  try {
    return lstatSync(path, { bigint: true });
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new AppError(
      500,
      'integrated_configuration',
      'A configured state path could not be inspected.',
    );
  }
}

function ownedPrivate(info) {
  // Node stat does not establish Windows ACL privacy; operators retain that setup gate.
  return (
    process.platform === 'win32' ||
    (info.uid === BigInt(process.getuid()) && (info.mode & 0o077n) === 0n)
  );
}

function directory(path, { privateParent = false } = {}) {
  let current = path;
  let first = true;
  for (;;) {
    const info = stat(current);
    reject(
      info?.isDirectory() && !info.isSymbolicLink(),
      'Configured path ancestors must be existing regular directories.',
    );
    if (process.platform !== 'win32') {
      const owned = info.uid === BigInt(process.getuid()) || info.uid === 0n;
      const sticky = (info.mode & 0o1000n) !== 0n;
      reject(
        owned && ((info.mode & 0o022n) === 0n || sticky),
        'Configured path ancestors must be trusted.',
      );
    }
    if (first && privateParent)
      reject(ownedPrivate(info), 'Journal parent directories must be private.');
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
    first = false;
  }
}

function file(path, { optional = false, privateParent = true } = {}) {
  directory(dirname(path), { privateParent });
  const info = stat(path);
  if (!info && optional) return null;
  reject(
    info?.isFile() && !info.isSymbolicLink() && ownedPrivate(info),
    'Configured account and journal files must be existing private regular files.',
  );
  return { path, info, physical: realpathSync.native(path) };
}

const journalSchemas = [
  {
    operations: {
      columns: 'id account scope kind anchor state resource_id details updated_at',
      primary: 'id',
      unique: ['account,kind,anchor'],
    },
    events: {
      columns: 'id type created_at resource_kind resource_id body_hash',
      primary: 'id',
      unique: [],
    },
  },
  {
    scope: { columns: 'id identity', primary: 'id', unique: [] },
    captures: {
      columns:
        'capture_key generation identity recording_id session_state session_id owner_revision session_fingerprint transcription_state transcription_id',
      primary: 'capture_key',
      unique: ['recording_id', 'transcription_id'],
    },
    contexts: {
      columns: 'context_key generation state context_id',
      primary: 'context_key',
      unique: ['context_id'],
    },
  },
  {
    library_scope: { columns: 'id identity', primary: 'id', unique: [] },
    library_operations: {
      columns: 'id kind anchor state resource_id details updated_at',
      primary: 'id',
      unique: ['kind,anchor'],
    },
  },
];

function schema(db, tables) {
  for (const [table, expected] of Object.entries(tables)) {
    const columns = db.prepare('SELECT name, pk FROM pragma_table_info(?) ORDER BY cid').all(table);
    const primary = columns
      .filter((row) => row.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((row) => row.name)
      .join(',');
    const indexes = db
      .prepare('SELECT name FROM pragma_index_list(?) WHERE "unique"=1 AND partial=0')
      .all(table);
    const unique = new Set(
      indexes.map((index) =>
        db
          .prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno')
          .all(index.name)
          .map((row) => row.name)
          .join(','),
      ),
    );
    // The original stores use positional INSERTs; column order and extras matter too.
    reject(
      columns.map((row) => row.name).join(' ') === expected.columns &&
        primary === expected.primary &&
        expected.unique.every((key) => unique.has(key)),
      'An existing journal does not have its original schema, columns or identity indexes.',
    );
  }
}

function existingJournals(rows, mobile) {
  const identities = new Set();
  const physical = new Set();
  for (const row of rows) {
    const identity = `${row.info.dev}:${row.info.ino}`;
    const path = row.physical.toLowerCase();
    reject(
      !identities.has(identity) && !physical.has(path),
      'Use distinct physical journal files.',
    );
    identities.add(identity);
    physical.add(path);
  }
  // Keep the original SyncService and LibraryService digest formulas exactly.
  const expectedScopes = [
    null,
    createHash('sha256')
      .update(JSON.stringify([mobile.apiBase, mobile.projectId, mobile.endUserId, mobile.deviceId]))
      .digest('hex'),
    createHash('sha256')
      .update(JSON.stringify([mobile.apiBase, mobile.projectId, mobile.endUserId, mobile.apiKey]))
      .digest('hex'),
  ];
  for (let index = 0; index < rows.length; index++) {
    let db;
    try {
      db = new DatabaseSync(rows[index].path, { readOnly: true });
      schema(db, journalSchemas[index]);
      if (index > 0) {
        const table = index === 1 ? 'scope' : 'library_scope';
        const scope = db.prepare(`SELECT identity FROM ${table} WHERE id=1`).get();
        reject(
          scope?.identity === expectedScopes[index],
          'Restore the original journal scope identity; no scope row is created or rekeyed.',
        );
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        500,
        'integrated_configuration',
        'An existing journal could not be read. Preserve it.',
      );
    } finally {
      db?.close();
    }
  }
}

function listener(web) {
  const origin = new URL(web.origin);
  if (origin.protocol === 'http:')
    reject(
      Number(origin.port || 80) === web.port,
      'Loopback HTTP APP_ORIGIN and PORT must refer to the same listener.',
    );
}

function privatePublicationPaths(webBase, stateDirectory, files) {
  const publicDirectory = join(webBase, 'dist');
  const info = stat(publicDirectory);
  reject(
    !info || (info.isDirectory() && !info.isSymbolicLink()),
    'The public build directory must not alias private state.',
  );
  const inside = (base, path) => {
    const name = relative(base.toLowerCase(), path.toLowerCase());
    return (
      name === '' ||
      (!isAbsolute(name) && name !== '..' && !name.startsWith('../') && !name.startsWith('..\\'))
    );
  };
  reject(
    !inside(stateDirectory, publicDirectory) &&
      [stateDirectory, ...files].every((path) => !inside(publicDirectory, path)),
    'Keep all private accounts and journal paths outside the public build directory.',
  );
  if (!info) return;
  const privateIdentities = new Set(
    files
      .flatMap((path) => [path, `${path}-wal`, `${path}-shm`, `${path}-journal`])
      .map(stat)
      .filter((entry) => entry?.isFile())
      .map((entry) => `${entry.dev}:${entry.ino}`),
  );
  let entries = 0;
  const inspect = (path, depth) => {
    reject(depth <= 32, 'The public build tree exceeds the inspection limit.');
    let directory;
    try {
      directory = opendirSync(path);
      let entry;
      while ((entry = directory.readSync())) {
        reject(++entries <= 10000, 'The public build tree exceeds the inspection limit.');
        const child = join(path, entry.name);
        const metadata = stat(child);
        reject(
          metadata && !metadata.isSymbolicLink() && (metadata.isDirectory() || metadata.isFile()),
          'The public build tree must contain only regular files and directories, without aliases.',
        );
        if (metadata.isDirectory()) inspect(child, depth + 1);
        else
          reject(
            !privateIdentities.has(`${metadata.dev}:${metadata.ino}`),
            'The public build tree must not contain hardlink aliases of private files.',
          );
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        500,
        'integrated_configuration',
        'The public build tree could not be inspected.',
      );
    } finally {
      directory?.closeSync();
    }
  };
  inspect(publicDirectory, 0);
}

/** Compose the existing validators without changing their auth or journal scope formulas. */
export function readIntegratedConfig(env, { demo = false, initialize = false } = {}) {
  reject(typeof initialize === 'boolean', 'Initialization must be an explicit boolean option.');
  const synthetic = demo || env.APP_MODE === 'demo';
  const webBase = absolute(
    env.WEB_LAUNCH_DIR ?? (synthetic ? sourceWebBase : undefined),
    'WEB_LAUNCH_DIR',
  );
  directory(webBase);
  if (synthetic) {
    privatePublicationPaths(webBase, join(webBase, '.state'), [
      join(webBase, 'accounts.json'),
      join(webBase, '.state', 'reference.sqlite'),
    ]);
    const web = configuration(
      { ...env, STATE_DIR: join(webBase, '.state'), ACCOUNTS_FILE: join(webBase, 'accounts.json') },
      { demo: true },
    );
    listener(web);
    return { web, mobile: null, mobileAccount: null, paths: { webBase, webDatabase: ':memory:' } };
  }
  const mobileBase = absolute(env.MOBILE_LAUNCH_DIR, 'MOBILE_LAUNCH_DIR');
  directory(mobileBase);
  const webAccountsFile = absolute(
    env.WEB_ACCOUNTS_FILE ?? join(webBase, 'accounts.json'),
    'WEB_ACCOUNTS_FILE',
  );
  const webStateDir = absolute(env.WEB_STATE_DIR ?? join(webBase, '.state'), 'WEB_STATE_DIR');
  file(webAccountsFile, { privateParent: false });
  directory(webStateDir, { privateParent: true });
  const webDatabase = join(webStateDir, 'reference.sqlite');
  const mobileDatabase = absolute(
    env.MOBILE_JOURNAL_PATH ?? join(mobileBase, 'data', 'recording-sync.sqlite'),
    'MOBILE_JOURNAL_PATH',
  );
  const mobileLibraryDatabase = absolute(
    env.MOBILE_LIBRARY_JOURNAL_PATH ?? `${mobileDatabase}.library.sqlite`,
    'MOBILE_LIBRARY_JOURNAL_PATH',
  );
  const databases = [webDatabase, mobileDatabase, mobileLibraryDatabase];
  privatePublicationPaths(webBase, webStateDir, [webAccountsFile, ...databases]);
  reject(
    new Set(databases.map((path) => path.toLowerCase())).size === databases.length,
    'Use distinct journal paths, including case-folded identities.',
  );
  const rows = databases.map((path) => file(path, { optional: true }));
  const locations = databases.map(
    (path, index) =>
      rows[index]?.physical ?? join(realpathSync.native(dirname(path)), basename(path)),
  );
  reject(
    new Set(locations.map((path) => path.toLowerCase())).size === locations.length,
    'Use distinct physical journal locations, including before initialization.',
  );
  if (initialize)
    reject(
      rows.every((row) => row === null),
      'Initialization requires all three journals to be absent; preserve any existing or partial set.',
    );
  else {
    reject(
      rows.every(Boolean),
      'All three original journals must exist on restart; no replacement database is created.',
    );
  }
  const web = configuration({ ...env, STATE_DIR: webStateDir, ACCOUNTS_FILE: webAccountsFile });
  listener(web);
  const mobile = readConfig(env);
  reject(
    web.apiBase === mobile.apiBase &&
      web.apiKey === mobile.apiKey &&
      web.projectId === mobile.projectId,
    'Web and mobile must use the same configured API endpoint, key and project.',
  );
  const matches = web.accounts.filter(
    (account) => account.principal.endUserId === mobile.endUserId,
  );
  const selected =
    env.MOBILE_ACCOUNT_USERNAME === undefined
      ? matches.length === 1
        ? matches[0]
        : null
      : matches.find((account) => account.username === env.MOBILE_ACCOUNT_USERNAME);
  reject(
    selected,
    'Map the fixed mobile end user to one authorized web account, or explicitly select an authorized matching username.',
  );
  if (!initialize) existingJournals(rows, mobile);
  return {
    web,
    mobile,
    mobileAccount: selected.principal,
    paths: {
      webBase,
      mobileBase,
      webAccountsFile,
      webStateDir,
      webDatabase,
      mobileDatabase,
      mobileLibraryDatabase,
    },
  };
}
