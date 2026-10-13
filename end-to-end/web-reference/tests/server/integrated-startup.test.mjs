import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenHash } from '../../server/auth.mjs';
import { createStore } from '../../server/store.mjs';
import { demoFetch } from '../../server/demo.mjs';
import { SyncService } from '../../../react-native-recording-sync/backend/service.mjs';
import { LibraryService } from '../../../react-native-recording-sync/backend/library.mjs';
import { readIntegratedConfig } from '../../../recordings/backend/config.mjs';
import { startIntegratedServer, runMain } from '../../../recordings/backend/main.mjs';

const webDirectory = fileURLToPath(new URL('../../', import.meta.url));
const mainUrl = new URL('../../../recordings/backend/main.mjs', import.meta.url);
const configUrl = new URL('../../../recordings/backend/config.mjs', import.meta.url);
const accountToken = 'synthetic-account-token-012345678901234567890';
const forbiddenFetch = async () => {
  throw new Error('Startup fixtures must not call an external API.');
};

async function within(promise, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), 10000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'bota-integrated-startup-'));
  const webBase = join(root, 'old-web'),
    mobileBase = join(root, 'old-mobile');
  const state = join(webBase, '.state'),
    data = join(mobileBase, 'data');
  const otherCwd = join(root, 'different-cwd');
  for (const path of [webBase, mobileBase, state, data, otherCwd]) mkdirSync(path, { mode: 0o700 });
  const accountsFile = join(webBase, 'accounts.json');
  writeFileSync(
    accountsFile,
    JSON.stringify([
      { username: 'alice', tokenHash: tokenHash(accountToken), endUserId: 'eu_demo' },
    ]),
    { mode: 0o600 },
  );
  const port = await availablePort();
  const env = {
    APP_MODE: 'live',
    PORT: String(port),
    APP_ORIGIN: `http://127.0.0.1:${port}`,
    WEB_LAUNCH_DIR: webBase,
    MOBILE_LAUNCH_DIR: mobileBase,
    WEB_ACCOUNTS_FILE: accountsFile,
    WEB_STATE_DIR: state,
    MOBILE_JOURNAL_PATH: join(data, 'recording-sync.sqlite'),
    MOBILE_LIBRARY_JOURNAL_PATH: join(data, 'library.sqlite'),
    BOTA_API_BASE_URL: 'https://fixture.bota.invalid/v1',
    BOTA_API_KEY: 'sk_test_' + 's'.repeat(32),
    BOTA_PROJECT_ID: 'proj_demo',
    BOTA_END_USER_ID: 'eu_demo',
    BOTA_DEVICE_ID: 'dev_fixture',
    APP_ACCESS_TOKEN: 'synthetic-application-token-01234567890123456789',
    BOTA_STORAGE_HOSTS: 'storage.example.test',
    WEBHOOK_SECRET: '',
  };
  const config = readIntegratedConfig(env, { initialize: true });
  const hosts = [];
  t.after(async () => {
    for (const host of hosts) await host.close();
    const target = resolve(root),
      fromTemp = relative(resolve(tmpdir()), target);
    assert.ok(!isAbsolute(fromTemp) && !fromTemp.startsWith('..'));
    assert.ok(basename(target).startsWith('bota-integrated-startup-'));
    rmSync(target, { recursive: true, force: true });
  });
  return {
    root,
    env,
    config,
    hosts,
    otherCwd,
    paths: [
      config.paths.webDatabase,
      config.paths.mobileDatabase,
      config.paths.mobileLibraryDatabase,
    ],
  };
}

function providers(config) {
  const store = createStore(config.paths.webDatabase);
  const service = new SyncService(config.mobile, {
    database: config.paths.mobileDatabase,
    fetchImpl: forbiddenFetch,
  });
  chmodSync(config.paths.mobileDatabase, 0o600);
  const library = new LibraryService(config.mobile, {
    database: config.paths.mobileLibraryDatabase,
    request: forbiddenFetch,
  });
  return {
    store,
    service,
    library,
    close() {
      library.close();
      service.close();
      store.close();
    },
  };
}

function snapshots(paths) {
  const queries = [
    ['SELECT * FROM operations ORDER BY id'],
    ['SELECT * FROM scope ORDER BY id', 'SELECT * FROM captures ORDER BY capture_key'],
    ['SELECT * FROM library_scope ORDER BY id', 'SELECT * FROM library_operations ORDER BY id'],
  ];
  return paths.map((path, index) => {
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      return queries[index].map((sql) => db.prepare(sql).all());
    } finally {
      db.close();
    }
  });
}

function childProcess(args, { cwd = webDirectory, env = {}, input, ipc = false } = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe', ...(ipc ? ['ipc'] : [])],
  });
  let output = '';
  child.stdout.on('data', (bytes) => {
    output += bytes.toString();
  });
  child.stderr.on('data', (bytes) => {
    output += bytes.toString();
  });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  void exited.catch(() => {});
  child.stdin.end(input ?? '');
  return {
    child,
    exited,
    output: () => output,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await within(exited, 'The local startup child did not close.');
    },
  };
}

test('normal combined configuration refuses missing journals or launch bases without creating state', async (t) => {
  const f = await fixture(t);
  assert.throws(() => readIntegratedConfig(f.env), /original journals must exist/);
  for (const field of ['WEB_LAUNCH_DIR', 'MOBILE_LAUNCH_DIR']) {
    const env = { ...f.env };
    delete env[field];
    assert.throws(() => readIntegratedConfig(env), /explicit absolute path/);
  }
  assert.deepEqual(f.paths.map(existsSync), [false, false, false]);
  assert.deepEqual(readdirSync(f.otherCwd), []);
});

test(
  'explicit initialization opens the real original journals and a different-CWD restart retains their identities',
  { timeout: 20000 },
  async (t) => {
    const f = await fixture(t);
    const host = await startIntegratedServer(f.config, {
      initialize: true,
      fetchImpl: forbiddenFetch,
    });
    f.hosts.push(host);
    await host.close();
    assert.deepEqual(f.paths.map(existsSync), [true, true, true]);
    const existing = readIntegratedConfig(f.env);
    const p = providers(existing);
    try {
      const operation = p.store.claim(existing.mobileAccount, 'transcription', 'rec_keep', {
        recordingId: 'rec_keep',
      }).operation;
      p.store.save(existing.mobileAccount, operation.id, {
        state: 'uncertain',
        resourceId: 'txn_keep',
      });
      p.service.db
        .prepare(
          `INSERT INTO captures(capture_key,generation,identity,recording_id,transcription_state)
      VALUES('synthetic-capture',3,?,'rec_keep','uncertain')`,
        )
        .run(
          JSON.stringify({
            device_id: 'dev_fixture',
            binding_generation: 3,
            recording_uuid: '12345678-1234-4234-9234-123456789abc',
            recording_generation: 1,
            ciphertext_length: 32,
            ciphertext_sha256: 'a'.repeat(64),
          }),
        );
      const summary = p.library.store.claim(
        p.library.principal,
        'summary',
        'txn_keep:tmpl_general_notes',
        {
          recordingId: 'rec_keep',
          transcriptionId: 'txn_keep',
          templateId: 'tmpl_general_notes',
        },
      ).operation;
      p.library.store.save(p.library.principal, summary.id, {
        state: 'uncertain',
        resourceId: 'sum_keep',
      });
    } finally {
      p.close();
    }
    const before = snapshots(f.paths);
    const child = childProcess(['--input-type=module', '-'], {
      cwd: f.otherCwd,
      env: f.env,
      input: `import { readIntegratedConfig } from ${JSON.stringify(configUrl.href)};
      import { startIntegratedServer } from ${JSON.stringify(mainUrl.href)};
      const config = readIntegratedConfig(process.env);
      const host = await startIntegratedServer(config, { fetchImpl: async () => { throw new Error('No external request'); } });
      await host.close(); console.log(JSON.stringify(config.paths));`,
    });
    try {
      assert.deepEqual(await within(child.exited, 'Combined restart retained open handles.'), {
        code: 0,
        signal: null,
      });
      const pathsLine = child
        .output()
        .split(/\r?\n/)
        .find((line) => line.startsWith('{'));
      assert.deepEqual(JSON.parse(pathsLine), existing.paths);
      assert.deepEqual(snapshots(f.paths), before);
      assert.deepEqual(readdirSync(f.otherCwd), [], 'the new CWD gets no replacement database');
    } finally {
      await child.stop();
    }
  },
);

for (const index of [0, 1, 2])
  test(`partial journal ${index + 1} refuses normal or explicit initialization without modifying files`, async (t) => {
    const f = await fixture(t),
      path = f.paths[index];
    if (index === 0) createStore(path).close();
    else if (index === 1) {
      new SyncService(f.config.mobile, { database: path, fetchImpl: forbiddenFetch }).close();
      chmodSync(path, 0o600);
    } else new LibraryService(f.config.mobile, { database: path, request: forbiddenFetch }).close();
    const before = readFileSync(path);
    assert.throws(() => readIntegratedConfig(f.env), /original journals must exist/);
    assert.throws(
      () => readIntegratedConfig(f.env, { initialize: true }),
      /all three journals to be absent/,
    );
    // The config was validated before this file appeared: the opener must still refuse.
    await assert.rejects(
      startIntegratedServer(f.config, { initialize: true, fetchImpl: forbiddenFetch }),
      /Initialization cannot open an existing journal/,
    );
    assert.deepEqual(readFileSync(path), before);
    assert.deepEqual(
      f.paths.map(existsSync),
      f.paths.map((_, position) => position === index),
    );
  });

test(
  'combined CLI occupied demo port closes Vite watchers and fails promptly',
  { timeout: 15000 },
  async () => {
    const occupied = createServer();
    await new Promise((resolve, reject) => {
      occupied.once('error', reject);
      occupied.listen(0, '127.0.0.1', resolve);
    });
    const port = String(occupied.address().port);
    const child = childProcess([fileURLToPath(mainUrl), '--demo', '--dev'], {
      env: {
        APP_MODE: 'demo',
        WEB_LAUNCH_DIR: webDirectory,
        PORT: port,
        APP_ORIGIN: `http://127.0.0.1:${port}`,
      },
    });
    try {
      assert.deepEqual(await within(child.exited, 'Combined startup retained Vite watchers.'), {
        code: 1,
        signal: null,
      });
      assert.match(child.output(), /Application port is already in use/);
      assert.doesNotMatch(child.output(), /Bota Recordings combined \(demo\):/);
    } finally {
      await child.stop();
      await new Promise((resolve) => occupied.close(resolve));
    }
  },
);

test(
  'combined runMain signal shutdown closes an active HMR socket and exits',
  { timeout: 30000 },
  async () => {
    const port = await availablePort(),
      origin = `http://127.0.0.1:${port}`;
    const child = childProcess(['--input-type=module', '-'], {
      ipc: true,
      env: {
        APP_MODE: 'demo',
        WEB_LAUNCH_DIR: webDirectory,
        PORT: String(port),
        APP_ORIGIN: origin,
      },
      input: `import { ${runMain.name} } from ${JSON.stringify(mainUrl.href)};
      process.on('message', () => { process.disconnect(); process.emit('SIGTERM'); });
      await ${runMain.name}(['--demo', '--dev'], process.env);`,
    });
    let socket;
    try {
      await within(
        new Promise((resolve, reject) => {
          child.child.once('error', reject);
          child.child.stdout.on('data', () => {
            if (child.output().includes('Bota Recordings combined (demo):')) resolve();
          });
        }),
        'The combined demo listener did not start.',
      );
      const response = await fetch(`${origin}/@vite/client`);
      assert.equal(response.status, 200);
      const token = /const wsToken = ("[^"]+")/.exec(await response.text())?.[1];
      assert.ok(token, 'Read the actual local Vite HMR token.');
      socket = new WebSocket(`ws://127.0.0.1:${port}/?token=${JSON.parse(token)}`, 'vite-hmr');
      await within(
        new Promise((resolve, reject) => {
          socket.addEventListener('open', resolve, { once: true });
          socket.addEventListener('error', () => reject(new Error('Local HMR failed.')), {
            once: true,
          });
        }),
        'The local HMR socket did not open.',
      );
      const hmrClosed = new Promise((resolve) =>
        socket.addEventListener('close', resolve, { once: true }),
      );
      child.child.send('shutdown');
      const [, exit] = await within(
        Promise.all([hmrClosed, child.exited]),
        'Combined shutdown retained HMR or its process.',
      );
      assert.equal(socket.readyState, WebSocket.CLOSED);
      assert.deepEqual(exit, { code: 0, signal: null });
    } finally {
      socket?.close();
      await child.stop();
    }
  },
);

test(
  'combined shutdown drains a pending HTTP write before closing its SQLite store',
  { timeout: 20000 },
  async (t) => {
    const f = await fixture(t),
      upstream = demoFetch();
    let started, release;
    const entered = new Promise((resolve) => {
      started = resolve;
    });
    const resume = new Promise((resolve) => {
      release = resolve;
    });
    const host = await startIntegratedServer(f.config, {
      initialize: true,
      fetchImpl: async (url, options) => {
        if (options.method === 'POST' && new URL(url).pathname === '/v1/transcriptions') {
          started();
          await resume;
        }
        return upstream(url, options);
      },
    });
    f.hosts.push(host);
    const origin = f.config.web.origin;
    const login = await fetch(`${origin}/api/login`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', token: accountToken }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    await login.body?.cancel();
    const pending = fetch(`${origin}/api/recordings/rec_demo002/transcriptions`, {
      method: 'POST',
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      body: '{}',
    });
    void pending.catch(() => {});
    let closed = false;
    try {
      await within(entered, 'The fixture processing write did not begin.');
      const closing = host.close().then(() => {
        closed = true;
      });
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(host.server.listening, false);
      assert.equal(closed, false, 'close waits for the active HTTP request');
      release();
      const response = await within(pending, 'The pending HTTP write did not drain.');
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.operation.state, 'complete');
      await within(closing, 'The combined stores did not close after HTTP drain.');
      assert.equal(closed, true);
      const [rows] = snapshots(f.paths)[0];
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, result.operation.id);
      assert.equal(rows[0].resource_id, result.operation.resource_id);
      assert.equal(
        rows[0].state,
        'complete',
        'the post-await durable save completes before store close',
      );
    } finally {
      release();
      await host.close();
    }
  },
);
