import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import {
  linkSync,
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { tokenHash } from '../../server/auth.mjs';
import { readIntegratedConfig } from '../../../recordings/backend/config.mjs';
import { startIntegratedServer } from '../../../recordings/backend/main.mjs';

const marker = 'SYNTHETIC_PRIVATE_CONTENT';

async function fixture(
  t,
  { custom = false, demo = false, publicPaths = false, aliases = false } = {},
) {
  const root = mkdtempSync(join(tmpdir(), 'bota-private-development-'));
  const webBase = join(root, 'web');
  const publicBase = publicPaths ? join(webBase, 'public') : webBase;
  const mobileBase = join(publicBase, 'mobile');
  const webState = join(publicBase, custom ? 'secure[state]' : '.state');
  const mobileState = join(mobileBase, 'data');
  for (const path of new Set([webBase, publicBase, mobileBase, webState, mobileState]))
    mkdirSync(path, { mode: 0o700 });
  writeFileSync(join(webBase, 'index.html'), '<html><body>Public synthetic sample</body></html>');
  const accounts = join(publicBase, custom ? 'operators[private].json' : 'accounts.json');
  writeFileSync(
    accounts,
    JSON.stringify([
      {
        username: marker,
        tokenHash: tokenHash('synthetic-application-account-token-0123456789'),
        endUserId: 'eu_demo',
      },
    ]),
    { mode: 0o600 },
  );
  writeFileSync(join(webBase, '.env'), marker, { mode: 0o600 });
  writeFileSync(join(webBase, 'private.pem'), marker, { mode: 0o600 });
  if (aliases) {
    linkSync(accounts, join(webBase, 'public-account-alias.json'));
    linkSync(join(webBase, '.env'), join(webBase, 'public-env-alias.txt'));
    symlinkSync(
      webState,
      join(webBase, 'public-state-alias'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  }
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const config = readIntegratedConfig(
    {
      APP_MODE: demo ? 'demo' : 'live',
      PORT: String(port),
      WEB_LAUNCH_DIR: webBase,
      MOBILE_LAUNCH_DIR: mobileBase,
      WEB_ACCOUNTS_FILE: accounts,
      WEB_STATE_DIR: webState,
      MOBILE_JOURNAL_PATH: join(
        mobileState,
        custom ? 'capture[private].db' : 'recording-sync.sqlite',
      ),
      MOBILE_LIBRARY_JOURNAL_PATH: join(
        mobileState,
        custom ? 'cloud[private].db' : 'library.sqlite',
      ),
      BOTA_API_BASE_URL: 'https://fixture.bota.invalid/v1',
      BOTA_API_KEY: 'sk_test_' + 's'.repeat(32),
      BOTA_PROJECT_ID: 'proj_demo',
      BOTA_END_USER_ID: 'eu_demo',
      APP_ACCESS_TOKEN: 'synthetic-mobile-application-token-01234567890123456789',
    },
    { demo, initialize: !demo },
  );
  let upstreamCalls = 0;
  let host;
  t.after(async () => {
    await host?.close();
    const target = resolve(root),
      fromTemp = relative(resolve(tmpdir()), target);
    assert.ok(!isAbsolute(fromTemp) && !fromTemp.startsWith('..'));
    assert.ok(basename(target).startsWith('bota-private-development-'));
    rmSync(target, { recursive: true, force: true });
  });
  host = await startIntegratedServer(config, {
    dev: true,
    initialize: !demo,
    fetchImpl: async () => {
      upstreamCalls += 1;
      throw new Error('Private-file fixtures never call an external API.');
    },
  });
  const journals = demo
    ? [join(webState, 'reference.sqlite')]
    : [config.paths.webDatabase, config.paths.mobileDatabase, config.paths.mobileLibraryDatabase];
  if (demo) writeFileSync(journals[0], marker, { mode: 0o600 });
  else
    for (const [index, path] of journals.entries()) {
      const db = new DatabaseSync(path);
      try {
        if (index === 0)
          db.prepare(
            `INSERT INTO operations VALUES('synthetic-private-operation',?,?,
        'transcription','rec_private','uncertain',NULL,?,'2026-10-12T10:00:00Z')`,
          ).run(marker, 'synthetic-scope', JSON.stringify({ marker }));
        else if (index === 1)
          db.prepare("INSERT INTO contexts VALUES(?,1,'uncertain',NULL)").run(marker);
        else
          db.prepare(
            `INSERT INTO library_operations VALUES('synthetic-private-operation','transcription',
        'rec_private','uncertain',NULL,?,'2026-10-12T10:00:00Z')`,
          ).run(JSON.stringify({ marker }));
      } finally {
        db.close();
      }
    }
  const sidecars = journals.map((path) => `${path}-journal`);
  for (const path of sidecars) writeFileSync(path, marker, { mode: 0o600 });
  return {
    config,
    accounts,
    journals,
    sidecars,
    webBase,
    publicBase,
    get upstreamCalls() {
      return upstreamCalls;
    },
  };
}

for (const options of [
  {},
  { custom: true },
  { demo: true },
  { custom: true, publicPaths: true },
  { aliases: true },
]) {
  test(`development refuses private files with ${options.demo ? 'in-memory demo' : options.publicPaths ? 'private paths under public directory' : options.custom ? 'custom literal paths' : options.aliases ? 'physical aliases' : 'standard paths'}`, async (t) => {
    const f = await fixture(t, options);
    const accountsPath = '/' + relative(f.webBase, f.accounts).replaceAll('\\', '/');
    const paths = [
      accountsPath,
      accountsPath + '?raw',
      accountsPath + '?url',
      '/' + relative(f.webBase, f.accounts).split(/[\\/]/).map(encodeURIComponent).join('/'),
      '/.env',
      '/private.pem',
      '/@fs/relative-file',
      '/invalid-%ZZ',
    ];
    if (process.platform === 'win32') paths.push('/@fs//unreachable.invalid/private-share/file');
    if (options.aliases)
      paths.push(
        '/public-account-alias.json',
        '/public-env-alias.txt',
        '/public-state-alias/reference.sqlite',
      );
    for (const file of [f.accounts, ...f.journals, ...f.sidecars]) {
      const absolute = file.replaceAll('\\', '/');
      paths.push('/@fs/' + absolute, '/@fs/' + absolute + '?raw');
      paths.push('/@fs/' + realpathSync.native(file).replaceAll('\\', '/'));
      const local = relative(f.webBase, file);
      if (!local.startsWith('..')) {
        paths.push('/' + local.replaceAll('\\', '/'));
        paths.push('/' + local.split(/[\\/]/).map(encodeURIComponent).join('/'));
      }
      if (process.platform === 'win32') paths.push('/@fs/' + absolute.toUpperCase());
    }
    if (
      process.platform === 'win32' &&
      options.aliases &&
      resolve()[0].toLowerCase() === f.webBase[0].toLowerCase()
    ) {
      const alias = join(f.webBase, 'public-account-alias.json').replaceAll('\\', '/');
      const otherDrive = alias[0].toLowerCase() === 'c' ? 'D' : 'C';
      paths.push('/@fs/' + otherDrive + alias.slice(1));
    }
    for (const path of new Set(paths)) {
      const response = await fetch(f.config.web.origin + path);
      const content = await response.text();
      assert.equal(response.status, 403, path);
      assert.ok(!content.includes(marker), path);
      assert.ok(!content.includes('SQLite format 3'), path);
    }
    if (options.publicPaths)
      for (const file of [f.accounts, ...f.journals]) {
        const publicAlias = '/' + relative(f.publicBase, file).replaceAll('\\', '/');
        const response = await fetch(f.config.web.origin + publicAlias);
        const content = await response.text();
        assert.ok(!content.includes(marker), publicAlias);
        assert.ok(!content.includes('SQLite format 3'), publicAlias);
      }
    const client = await fetch(f.config.web.origin + '/@vite/client');
    assert.equal(client.status, 200);
    assert.ok((await client.text()).includes('createHotContext'));
    assert.equal(f.upstreamCalls, 0);
  });
}
