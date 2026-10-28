import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { tokenHash } from '../../server/auth.mjs';
import { createStore } from '../../server/store.mjs';
import { demoFetch } from '../../server/demo.mjs';
import { readIntegratedConfig } from '../../../recordings/backend/config.mjs';
import { startIntegratedServer } from '../../../recordings/backend/main.mjs';
import { LibraryService } from '../../../react-native-recording-sync/backend/library.mjs';

// A lost client socket does not cancel an upstream mutation or its durable save.
for (const adapter of ['Web', 'Mobile'])
  test(
    `shutdown drains an aborted ${adapter} mutation before closing journals and retains its returned identity`,
    { timeout: 10000 },
    async (t) => {
      const root = mkdtempSync(join(tmpdir(), 'bota-aborted-mutation-'));
      const webBase = join(root, 'web'),
        mobileBase = join(root, 'mobile');
      const webState = join(webBase, '.state'),
        mobileState = join(mobileBase, 'data');
      for (const path of [webBase, mobileBase, webState, mobileState])
        mkdirSync(path, { mode: 0o700 });
      const token = 'synthetic-account-token-012345678901234567890';
      writeFileSync(
        join(webBase, 'accounts.json'),
        JSON.stringify([{ username: 'alice', tokenHash: tokenHash(token), endUserId: 'eu_demo' }]),
        { mode: 0o600 },
      );
      const listener = createServer();
      await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
      const port = listener.address().port;
      await new Promise((resolve) => listener.close(resolve));
      const env = {
        APP_MODE: 'live',
        PORT: String(port),
        WEB_LAUNCH_DIR: webBase,
        MOBILE_LAUNCH_DIR: mobileBase,
        BOTA_API_BASE_URL: 'https://fixture.bota.invalid/v1',
        BOTA_API_KEY: 'sk_test_' + 's'.repeat(32),
        BOTA_PROJECT_ID: 'proj_demo',
        BOTA_END_USER_ID: 'eu_demo',
        APP_ACCESS_TOKEN: 'synthetic-mobile-application-token-01234567890123456789',
      };
      const config = readIntegratedConfig(env, { initialize: true });
      let enter,
        release,
        host,
        createdId,
        writes = 0;
      const entered = new Promise((resolve) => {
        enter = resolve;
      });
      const held = new Promise((resolve) => {
        release = resolve;
      });
      const upstream = demoFetch();
      const fetchImpl = async (url, options) => {
        const path = new URL(url).pathname;
        if (options.method === 'POST') writes += 1;
        if (options.method === 'POST' && path === '/v1/transcriptions') {
          enter();
          await held;
          const response = await upstream(url, options);
          createdId = (await response.clone().json()).id;
          return response;
        }
        return upstream(url, options);
      };
      t.after(async () => {
        release();
        await host?.close();
        const target = resolve(root),
          fromTemp = relative(resolve(tmpdir()), target);
        assert.ok(!isAbsolute(fromTemp) && !fromTemp.startsWith('..'));
        assert.ok(basename(target).startsWith('bota-aborted-mutation-'));
        rmSync(target, { recursive: true, force: true });
      });
      host = await startIntegratedServer(config, { initialize: true, fetchImpl });
      const credentials = async () => {
        if (adapter === 'Mobile') return { Authorization: `Bearer ${config.mobile.appToken}` };
        const login = await fetch(config.web.origin + '/api/login', {
          method: 'POST',
          headers: { Origin: config.web.origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'alice', token }),
        });
        assert.equal(login.status, 200);
        return { Cookie: login.headers.get('set-cookie').split(';')[0], Origin: config.web.origin };
      };
      const path =
        adapter === 'Web'
          ? '/api/recordings/rec_demo002/transcriptions'
          : '/api/library/recordings/rec_demo002/transcriptions';
      const request = httpRequest(config.web.origin + path, {
        method: 'POST',
        headers: { ...(await credentials()), 'Content-Type': 'application/json' },
      });
      request.on('error', () => {});
      const disconnected = new Promise((resolve) => request.once('close', resolve));
      request.end('{}');
      await entered;
      request.destroy();
      await disconnected;
      let closed = false;
      const closing = host.close().then(() => {
        closed = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(
        closed,
        false,
        'SQLite must remain open while the disconnected mutation is pending',
      );
      release();
      await closing;
      const retained =
        adapter === 'Web'
          ? createStore(config.paths.webDatabase)
          : new LibraryService(config.mobile, {
              database: config.paths.mobileLibraryDatabase,
              request: async () => {
                throw new Error('Journal reopen does not call an external API.');
              },
            });
      const store = adapter === 'Web' ? retained : retained.store;
      const principal = adapter === 'Web' ? config.web.accounts[0].principal : retained.principal;
      try {
        const operation = store.find(principal, 'transcription', 'rec_demo002');
        assert.equal(operation.resourceId, createdId);
        assert.match(operation.resourceId, /^txn_/);
        assert.equal(operation.state, 'complete');
        assert.equal(writes, 1);
      } finally {
        retained.close();
      }
      // Restarting the host must recover this ID with GETs rather than repeat POST.
      host = await startIntegratedServer(readIntegratedConfig(env), { fetchImpl });
      const recovered = await fetch(config.web.origin + path, {
        method: 'POST',
        headers: {
          ...(await credentials()),
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      assert.equal(recovered.status, 200);
      assert.equal((await recovered.json()).operation.resource_id, createdId);
      assert.equal(writes, 1);
    },
  );
