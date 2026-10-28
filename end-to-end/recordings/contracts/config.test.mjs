import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { configuration } from '../../web-reference/server/config.mjs';
import { readConfig, SyncService } from '../../react-native-recording-sync/backend/service.mjs';
import { LibraryService } from '../../react-native-recording-sync/backend/library.mjs';
import { createStore } from '../../web-reference/server/store.mjs';
import { readIntegratedConfig } from '../backend/config.mjs';

const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

for (const [variable, sourceIndex] of [
  ['WEB_ACCOUNTS_FILE', null],
  ['MOBILE_JOURNAL_PATH', 1],
  ['MOBILE_LIBRARY_JOURNAL_PATH', 2],
]) {
  test(`private ${variable} cannot be published from the Web build directory`, (t) => {
    const f = fixture(t);
    const directory = join(f.webBase, 'dist');
    mkdirSync(directory, { mode: 0o700 });
    const path = join(directory, 'private.data');
    copyFileSync(sourceIndex === null ? f.accountsFile : f.databases[sourceIndex], path);
    const before = digest(path);
    assert.throws(
      () => readIntegratedConfig({ ...f.env, [variable]: path }),
      /outside the public build directory/,
    );
    assert.equal(digest(path), before);
  });
}

test('Web journal directory cannot overlap the public build tree in either direction', (t) => {
  const f = fixture(t);
  const directory = join(f.webBase, 'dist');
  mkdirSync(directory, { mode: 0o700 });
  for (const state of [directory, f.webBase])
    assert.throws(
      () => readIntegratedConfig({ ...f.env, WEB_STATE_DIR: state }),
      /outside the public build directory/,
    );
});

test('the public build directory cannot alias a private directory', (t) => {
  const f = fixture(t);
  symlinkSync(f.state, join(f.webBase, 'dist'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => readIntegratedConfig(f.env), /public build directory must not alias/);
  assert.throws(
    () => readIntegratedConfig(f.env, { demo: true }),
    /public build directory must not alias/,
  );
});

for (const demo of [false, true]) {
  test(`nested private directory aliases are refused in ${demo ? 'demo' : 'live'} mode`, (t) => {
    const f = fixture(t),
      before = f.databases.map(digest);
    const publicDirectory = join(f.webBase, 'dist');
    mkdirSync(publicDirectory);
    symlinkSync(
      f.state,
      join(publicDirectory, 'assets'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    assert.throws(() => readIntegratedConfig(f.env, { demo }), /without aliases/);
    assert.deepEqual(f.databases.map(digest), before);
  });
  for (const source of ['accounts', 'journal', 'sidecar']) {
    test(`public hardlinks to private ${source} are refused in ${demo ? 'demo' : 'live'} mode`, (t) => {
      const f = fixture(t),
        before = f.databases.map(digest);
      const publicDirectory = join(f.webBase, 'dist');
      mkdirSync(publicDirectory);
      const original =
        source === 'accounts'
          ? f.accountsFile
          : source === 'journal'
            ? f.databases[0]
            : `${f.databases[0]}-journal`;
      if (source === 'sidecar')
        writeFileSync(original, 'synthetic-private-sidecar', { mode: 0o600 });
      const originalDigest = digest(original);
      linkSync(original, join(publicDirectory, 'operators.data'));
      assert.throws(() => readIntegratedConfig(f.env, { demo }), /hardlink aliases/);
      assert.equal(digest(original), originalDigest);
      assert.deepEqual(f.databases.map(digest), before);
    });
  }
  test(`ordinary public build files are accepted in ${demo ? 'demo' : 'live'} mode`, (t) => {
    const f = fixture(t),
      publicDirectory = join(f.webBase, 'dist');
    mkdirSync(join(publicDirectory, 'assets'), { recursive: true });
    for (const name of ['index.html', 'assets/app.js', 'assets/app.css'])
      writeFileSync(join(publicDirectory, name), 'synthetic-public-content');
    assert.equal(readIntegratedConfig(f.env, { demo }).web.mode, demo ? 'demo' : 'live');
  });
}

function fixture(t, { existing = true, deviceId } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'bota-integrated-config-'));
  const webBase = join(root, 'old-web'),
    mobileBase = join(root, 'old-mobile');
  const state = join(webBase, '.state'),
    data = join(mobileBase, 'data');
  for (const path of [webBase, mobileBase, state, data]) mkdirSync(path, { mode: 0o700 });
  const accountsFile = join(webBase, 'accounts.json');
  const accounts = [{ username: 'alice', tokenHash: 'a'.repeat(64), endUserId: 'eu_test' }];
  const saveAccounts = (rows) => writeFileSync(accountsFile, JSON.stringify(rows), { mode: 0o600 });
  saveAccounts(accounts);
  const databases = [
    join(state, 'reference.sqlite'),
    join(data, 'recording-sync.sqlite'),
    join(data, 'recording-sync.sqlite.library.sqlite'),
  ];
  t.after(() => {
    const target = resolve(root),
      fromTemp = relative(resolve(tmpdir()), target);
    assert.ok(!isAbsolute(fromTemp) && !fromTemp.startsWith('..'));
    assert.ok(basename(target).startsWith('bota-integrated-config-'));
    rmSync(target, { recursive: true, force: true });
  });
  const env = {
    APP_MODE: 'live',
    WEB_LAUNCH_DIR: webBase,
    MOBILE_LAUNCH_DIR: mobileBase,
    BOTA_API_BASE_URL: 'https://api.example.test/v1/',
    BOTA_API_KEY: 'sk_test_' + 's'.repeat(32),
    BOTA_PROJECT_ID: 'proj_test',
    BOTA_END_USER_ID: 'eu_test',
    APP_ACCESS_TOKEN: 'synthetic-application-token-01234567890123456789',
    ...(deviceId ? { BOTA_DEVICE_ID: deviceId } : {}),
  };
  if (existing) {
    createStore(databases[0]).close();
    const config = readConfig(env);
    new SyncService(config, {
      database: databases[1],
      fetchImpl: async () => {
        throw new Error('Configuration fixtures must not call the API.');
      },
    }).close();
    new LibraryService(config, {
      database: databases[2],
      request: async () => {
        throw new Error('Configuration fixtures must not call the API.');
      },
    }).close();
    databases.forEach((path) => chmodSync(path, 0o600));
  }
  return { root, env, webBase, mobileBase, state, accountsFile, accounts, databases, saveAccounts };
}

test('explicit old launch bases preserve default paths, validators and account scope without modifying journals', (t) => {
  const f = fixture(t),
    before = f.databases.map(digest);
  const result = readIntegratedConfig(f.env);
  assert.deepEqual(result.mobile, readConfig(f.env));
  assert.deepEqual(
    result.web,
    configuration({ ...f.env, STATE_DIR: f.state, ACCOUNTS_FILE: f.accountsFile }),
  );
  assert.deepEqual(result.paths, {
    webBase: f.webBase,
    mobileBase: f.mobileBase,
    webAccountsFile: f.accountsFile,
    webStateDir: f.state,
    webDatabase: f.databases[0],
    mobileDatabase: f.databases[1],
    mobileLibraryDatabase: f.databases[2],
  });
  assert.deepEqual(result.mobileAccount, result.web.accounts[0].principal);
  assert.equal(
    result.mobileAccount.scopeId,
    createHash('sha256')
      .update(JSON.stringify(['alice', 'eu_test', f.env.BOTA_PROJECT_ID, f.env.BOTA_API_KEY]))
      .digest('hex'),
  );
  assert.equal(result.mobile.deviceId, null);
  assert.deepEqual(f.databases.map(digest), before);
});

test('live mode never chooses old launch directories from the new launcher CWD', (t) => {
  const f = fixture(t);
  delete f.env.WEB_LAUNCH_DIR;
  assert.throws(() => readIntegratedConfig(f.env), /WEB_LAUNCH_DIR/);
  f.env.WEB_LAUNCH_DIR = f.webBase;
  delete f.env.MOBILE_LAUNCH_DIR;
  assert.throws(() => readIntegratedConfig(f.env), /MOBILE_LAUNCH_DIR/);
});

test('explicit absolute existing locations override the defaults without creating replacement state', (t) => {
  const f = fixture(t),
    alternate = join(f.root, 'private-explicit');
  mkdirSync(alternate, { mode: 0o700 });
  const accounts = join(alternate, 'accounts.json');
  copyFileSync(f.accountsFile, accounts);
  const journals = [
    join(alternate, 'reference.sqlite'),
    join(alternate, 'native.sqlite'),
    join(alternate, 'library.sqlite'),
  ];
  journals.forEach((path, i) => copyFileSync(f.databases[i], path));
  const result = readIntegratedConfig({
    ...f.env,
    WEB_ACCOUNTS_FILE: accounts,
    WEB_STATE_DIR: alternate,
    MOBILE_JOURNAL_PATH: journals[1],
    MOBILE_LIBRARY_JOURNAL_PATH: journals[2],
  });
  assert.equal(result.paths.webDatabase, journals[0]);
  assert.equal(result.paths.mobileDatabase, journals[1]);
  assert.equal(result.paths.mobileLibraryDatabase, journals[2]);
  assert.equal(result.web.accountsFile, accounts);
});

for (const name of [
  'WEB_LAUNCH_DIR',
  'MOBILE_LAUNCH_DIR',
  'WEB_ACCOUNTS_FILE',
  'WEB_STATE_DIR',
  'MOBILE_JOURNAL_PATH',
  'MOBILE_LIBRARY_JOURNAL_PATH',
]) {
  test(`${name} refuses a relative path`, (t) => {
    const f = fixture(t);
    assert.throws(() => readIntegratedConfig({ ...f.env, [name]: './relative' }), /absolute path/);
  });
}

for (const index of [0, 1, 2]) {
  test(`a missing original journal ${index + 1} is not replaced on normal startup`, (t) => {
    const f = fixture(t);
    rmSync(f.databases[index]);
    assert.throws(() => readIntegratedConfig(f.env), /original journals must exist/);
    assert.equal(existsSync(f.databases[index]), false);
  });
  test(`initialization refuses a partial set containing journal ${index + 1}`, (t) => {
    const f = fixture(t);
    for (let i = 0; i < f.databases.length; i++) if (i !== index) rmSync(f.databases[i]);
    const before = digest(f.databases[index]);
    assert.throws(
      () => readIntegratedConfig(f.env, { initialize: true }),
      /all three journals to be absent/,
    );
    assert.equal(digest(f.databases[index]), before);
    assert.equal(f.databases.filter(existsSync).length, 1);
  });
}

test('explicit first-use initialization admits all-missing journals but only with existing accounts and private parents', (t) => {
  const f = fixture(t, { existing: false });
  assert.throws(() => readIntegratedConfig(f.env), /original journals must exist/);
  const result = readIntegratedConfig(f.env, { initialize: true });
  assert.equal(result.paths.webDatabase, f.databases[0]);
  assert.equal(
    f.databases.some(existsSync),
    false,
    'configuration itself never creates a database',
  );
  rmSync(f.accountsFile);
  assert.throws(
    () => readIntegratedConfig(f.env, { initialize: true }),
    /existing private regular files/,
  );
});

test('initialization cannot overwrite an existing complete set or accept an implicit flag', (t) => {
  const f = fixture(t),
    before = f.databases.map(digest);
  assert.throws(
    () => readIntegratedConfig(f.env, { initialize: true }),
    /all three journals to be absent/,
  );
  assert.throws(() => readIntegratedConfig(f.env, { initialize: 'true' }), /explicit boolean/);
  assert.deepEqual(f.databases.map(digest), before);
});

test('initialization cannot silently create missing private state directories', (t) => {
  const f = fixture(t, { existing: false }),
    path = join(f.root, 'not-created', 'native.sqlite');
  assert.throws(
    () => readIntegratedConfig({ ...f.env, MOBILE_JOURNAL_PATH: path }, { initialize: true }),
    /existing regular directories/,
  );
  assert.equal(existsSync(dirname(path)), false);
});

test('identical and case-folded journal paths are rejected before initialization', (t) => {
  const f = fixture(t);
  assert.throws(
    () => readIntegratedConfig({ ...f.env, MOBILE_JOURNAL_PATH: f.databases[0] }),
    /distinct journal paths/,
  );
  const alias = join(dirname(f.databases[1]), basename(f.databases[1]).toUpperCase());
  if (process.platform !== 'win32') copyFileSync(f.databases[2], alias);
  assert.throws(
    () => readIntegratedConfig({ ...f.env, MOBILE_LIBRARY_JOURNAL_PATH: alias }),
    /case-folded/,
  );
});

test('hardlinked journal files cannot masquerade as separate durable stores', (t) => {
  const f = fixture(t);
  rmSync(f.databases[2]);
  linkSync(f.databases[1], f.databases[2]);
  assert.throws(() => readIntegratedConfig(f.env), /distinct physical journal/);
});

for (const kind of ['state directory', 'launch directory']) {
  test(`a symlink or Windows junction in the ${kind} is rejected`, (t) => {
    const f = fixture(t),
      link = join(f.root, 'linked');
    symlinkSync(
      kind === 'state directory' ? f.state : f.mobileBase,
      link,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const env =
      kind === 'state directory'
        ? { ...f.env, WEB_STATE_DIR: link }
        : { ...f.env, MOBILE_LAUNCH_DIR: link };
    assert.throws(() => readIntegratedConfig(env), /existing regular directories/);
  });
}

test('an empty existing placeholder is not initialized during a restart', (t) => {
  const f = fixture(t);
  writeFileSync(f.databases[0], '');
  assert.throws(() => readIntegratedConfig(f.env), /original schema/);
  assert.equal(readFileSync(f.databases[0]).length, 0);
});

function changeJournal(path, work) {
  const db = new DatabaseSync(path);
  try {
    work(db);
  } finally {
    db.close();
  }
}

function withoutConstraint(db, table, expression) {
  const sql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
    .get(table).sql;
  const replacement = sql.replace(expression, '');
  assert.notEqual(replacement, sql, 'the fixture removes a real original constraint');
  db.exec(`ALTER TABLE ${table} RENAME TO retired_${table}`);
  db.exec(replacement);
  db.exec(`INSERT INTO ${table} SELECT * FROM retired_${table}; DROP TABLE retired_${table}`);
}

for (const [index, table, column] of [
  [0, 'operations', 'details'],
  [1, 'captures', 'session_fingerprint'],
  [2, 'library_operations', 'details'],
]) {
  test(`journal ${index + 1} with missing required columns is refused without modification`, (t) => {
    const f = fixture(t);
    changeJournal(f.databases[index], (db) =>
      db.exec(`ALTER TABLE ${table} RENAME COLUMN ${column} TO unknown_column`),
    );
    const before = f.databases.map(digest);
    assert.throws(
      () => readIntegratedConfig(f.env),
      /original schema, columns or identity indexes/,
    );
    assert.deepEqual(f.databases.map(digest), before);
  });
}

for (const [index, table, expression] of [
  [0, 'operations', /,\s*UNIQUE\(account,kind,anchor\)/i],
  [1, 'captures', /\bUNIQUE\b/i],
  [2, 'library_operations', /,\s*UNIQUE\(kind,anchor\)/i],
]) {
  test(`journal ${index + 1} without its original unique intent/resource index is refused unchanged`, (t) => {
    const f = fixture(t);
    changeJournal(f.databases[index], (db) => withoutConstraint(db, table, expression));
    const before = f.databases.map(digest);
    assert.throws(() => readIntegratedConfig(f.env), /identity indexes/);
    assert.deepEqual(f.databases.map(digest), before);
  });
}

test('a missing primary key is refused before writable host construction', (t) => {
  const f = fixture(t);
  changeJournal(f.databases[0], (db) => withoutConstraint(db, 'events', /\bPRIMARY\s+KEY\b/i));
  const before = f.databases.map(digest);
  assert.throws(() => readIntegratedConfig(f.env), /identity indexes/);
  assert.deepEqual(f.databases.map(digest), before);
});

test('extra positional columns and missing tables cannot masquerade as the original schema', (t) => {
  const f = fixture(t);
  changeJournal(f.databases[0], (db) => db.exec('ALTER TABLE operations ADD COLUMN extra TEXT'));
  const before = f.databases.map(digest);
  assert.throws(() => readIntegratedConfig(f.env), /original schema/);
  assert.deepEqual(f.databases.map(digest), before);
  changeJournal(f.databases[0], (db) => db.exec('ALTER TABLE operations DROP COLUMN extra'));
  changeJournal(f.databases[1], (db) => db.exec('DROP TABLE contexts'));
  const missing = f.databases.map(digest);
  assert.throws(() => readIntegratedConfig(f.env), /original schema/);
  assert.deepEqual(f.databases.map(digest), missing);
});

for (const [index, table] of [
  [1, 'scope'],
  [2, 'library_scope'],
]) {
  for (const missing of [true, false]) {
    test(`${table} ${missing ? 'missing row 1' : 'wrong identity'} is refused without creating or rekeying it`, (t) => {
      const f = fixture(t);
      changeJournal(f.databases[index], (db) =>
        missing
          ? db.exec(`DELETE FROM ${table} WHERE id=1`)
          : db.prepare(`UPDATE ${table} SET identity=? WHERE id=1`).run('0'.repeat(64)),
      );
      const before = f.databases.map(digest);
      assert.throws(() => readIntegratedConfig(f.env), /original journal scope identity/);
      assert.deepEqual(f.databases.map(digest), before);
    });
  }
}

for (const [key, value] of [
  ['BOTA_API_BASE_URL', 'https://other-api.example.test/v1'],
  ['BOTA_API_KEY', 'sk_test_' + 'x'.repeat(32)],
]) {
  test(`restoring ${key} is required by the original scope digest rather than replacing journals`, (t) => {
    const f = fixture(t),
      before = f.databases.map(digest);
    assert.throws(
      () => readIntegratedConfig({ ...f.env, [key]: value }),
      /original journal scope identity/,
    );
    assert.deepEqual(f.databases.map(digest), before);
  });
}

test('POSIX private accounts under a trusted 0755 launch directory retain legacy Web compatibility', (t) => {
  if (process.platform === 'win32')
    return t.skip('POSIX mode compatibility is exercised on the Linux CI runner.');
  const f = fixture(t);
  chmodSync(f.webBase, 0o755);
  assert.equal(readIntegratedConfig(f.env).mobileAccount.username, 'alice');
  chmodSync(f.webBase, 0o777);
  assert.throws(() => readIntegratedConfig(f.env), /ancestors must be trusted/);
});

test('POSIX account files and journal parents must remain owned and private', (t) => {
  if (process.platform === 'win32')
    return t.skip('Windows ACL privacy is an operator gate, not a Node stat claim.');
  const f = fixture(t);
  chmodSync(f.accountsFile, 0o644);
  assert.throws(() => readIntegratedConfig(f.env), /private regular files/);
  chmodSync(f.accountsFile, 0o600);
  chmodSync(f.state, 0o755);
  assert.throws(() => readIntegratedConfig(f.env), /parent directories must be private/);
});

test('mobile authorization is restored only from an exact server-owned end-user account mapping', (t) => {
  const f = fixture(t);
  f.saveAccounts([
    ...f.accounts,
    { username: 'bob', tokenHash: 'b'.repeat(64), endUserId: 'eu_test' },
    { username: 'foreign', tokenHash: 'c'.repeat(64), endUserId: 'eu_other' },
  ]);
  assert.throws(() => readIntegratedConfig(f.env), /authorized web account/);
  const result = readIntegratedConfig({ ...f.env, MOBILE_ACCOUNT_USERNAME: 'bob' });
  assert.equal(result.mobileAccount.username, 'bob');
  assert.equal(result.mobileAccount.endUserId, f.env.BOTA_END_USER_ID);
  assert.throws(
    () => readIntegratedConfig({ ...f.env, MOBILE_ACCOUNT_USERNAME: 'foreign' }),
    /authorized web account/,
  );
  assert.throws(
    () => readIntegratedConfig({ ...f.env, MOBILE_ACCOUNT_USERNAME: 'missing' }),
    /authorized web account/,
  );
});

test('a fixed mobile end user without a configured web account is refused', (t) => {
  const f = fixture(t);
  assert.throws(
    () => readIntegratedConfig({ ...f.env, BOTA_END_USER_ID: 'eu_missing' }),
    /authorized web account/,
  );
});

test('optional configured device and original proxy-origin validation are preserved', (t) => {
  const f = fixture(t, { deviceId: 'dev_test' });
  const result = readIntegratedConfig({
    ...f.env,
    BOTA_DEVICE_ID: 'dev_test',
    APP_ORIGIN: 'https://sample.example.test',
  });
  assert.equal(result.mobile.deviceId, 'dev_test');
  assert.equal(result.web.origin, 'https://sample.example.test');
  assert.throws(
    () => readIntegratedConfig({ ...f.env, APP_ORIGIN: 'http://127.0.0.1:9999' }),
    /same listener/,
  );
});

test('demo is Web-only in-memory and has no mobile, device or Bearer authority', () => {
  const result = readIntegratedConfig(
    { APP_ACCESS_TOKEN: 'ignored-private-token', BOTA_DEVICE_ID: 'dev_ignored' },
    { demo: true },
  );
  assert.equal(result.mobile, null);
  assert.equal(result.mobileAccount, null);
  assert.equal(result.paths.webDatabase, ':memory:');
  assert.equal(result.web.mode, 'demo');
  assert.ok(isAbsolute(result.paths.webBase));
  assert.ok(!JSON.stringify(result).includes('ignored-private-token'));
  assert.equal(result.paths.mobileDatabase, undefined);
});
