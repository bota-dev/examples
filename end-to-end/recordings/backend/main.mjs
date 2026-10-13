import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { chmodSync, existsSync } from 'node:fs';
import { readIntegratedConfig } from './config.mjs';
import { createIntegratedServer } from './server.mjs';
import { createStore } from '../../web-reference/server/store.mjs';
import { demoFetch } from '../../web-reference/server/demo.mjs';
import { SyncService } from '../../react-native-recording-sync/backend/service.mjs';
import { LibraryService } from '../../react-native-recording-sync/backend/library.mjs';

const webRequire = createRequire(new URL('../../web-reference/package.json', import.meta.url));

function privateFiles(config, normalizePath) {
  const literal = (path) => normalizePath(resolve(path)).replace(/[?*[\]{}()!+@]/g, '\\$&');
  const files = [
    config.web.accountsFile,
    config.paths.webDatabase,
    config.paths.mobileDatabase,
    config.paths.mobileLibraryDatabase,
  ].filter((path) => path && path !== ':memory:');
  return [
    // Preserve the exact defaults of the qualified Vite 8.3.4 dependency.
    '.env',
    '.env.*',
    '*.{crt,pem,key,p12,pfx,cer,der}',
    '.npmrc',
    '.yarnrc.yml',
    '**/.git/**',
    '**/accounts.json',
    '**/.state/**',
    '**/*.sqlite',
    '**/*.sqlite-*',
    ...files.flatMap((path) =>
      ['', '-wal', '-shm', '-journal'].map((suffix) => literal(path + suffix)),
    ),
    `${literal(config.web.stateDir)}/**`,
  ];
}

/** Open only the validated original stores; closing never deletes their files. */
export async function startIntegratedServer(
  config,
  { dev = false, fetchImpl, initialize = false } = {},
) {
  let store, service, library, server, vite, closing, drainWork;
  const close = () => {
    closing ??= (async () => {
      const drained =
        server &&
        server.listening &&
        new Promise((resolve) => {
          server.close(resolve);
          server.closeIdleConnections();
        });
      let failure;
      try {
        await vite?.close();
      } catch (error) {
        failure = error;
      }
      try {
        await drained;
      } catch (error) {
        failure ??= error;
      }
      // Aborting a response closes its socket, not its upstream work. Keep every
      // journal open until that work has saved its returned ID or uncertainty.
      try {
        await drainWork?.();
      } catch (error) {
        failure ??= error;
      }
      for (const resource of [library, service, store]) {
        try {
          resource?.close();
        } catch (error) {
          failure ??= error;
        }
      }
      if (failure) throw failure;
    })();
    return closing;
  };
  try {
    if (
      initialize &&
      config.mobile &&
      [
        config.paths.webDatabase,
        config.paths.mobileDatabase,
        config.paths.mobileLibraryDatabase,
      ].some(existsSync)
    )
      throw new Error('Initialization cannot open an existing journal.');
    store = createStore(config.paths.webDatabase);
    if (config.mobile) {
      service = new SyncService(config.mobile, {
        database: config.paths.mobileDatabase,
        fetchImpl,
      });
      // Initialization creates the native file inside an already-private parent.
      // Do not normalize permissions on a retained journal during ordinary recovery.
      if (initialize) chmodSync(config.paths.mobileDatabase, 0o600);
      library = new LibraryService(config.mobile, {
        database: config.paths.mobileLibraryDatabase,
        request: (method, path, body) =>
          service.upstream(path, method, body, path.startsWith('/ask/') ? 180_000 : 25_000),
      });
    }
    const host = createIntegratedServer({
      config,
      store,
      service,
      library,
      fetchImpl:
        config.web.mode === 'demo'
          ? demoFetch({ onEvent: (event) => store.acceptEvent(event) })
          : fetchImpl,
      staticDirectory: dev ? undefined : resolve(config.paths.webBase, 'dist'),
    });
    server = host.server;
    drainWork = host.drainWork;
    if (dev) {
      const { createServer, normalizePath } = await import(
        pathToFileURL(webRequire.resolve('vite')).href
      );
      vite = await createServer({
        root: config.paths.webBase,
        // This sample imports its assets; Vite's public middleware bypasses
        // filesystem denies and must not publish an operator's private files.
        publicDir: false,
        server: {
          middlewareMode: true,
          hmr: { server },
          fs: { deny: privateFiles(config, normalizePath) },
        },
        appType: 'spa',
      });
      host.webApp.use(vite.middlewares);
    }
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.web.port, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    server.on('error', () => {
      console.error('Combined application listener failed.');
      process.exitCode = 1;
      void close().catch(() => {
        process.exitCode = 1;
      });
    });
    return { ...host, close };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function runMain(args = process.argv.slice(2), env = process.env) {
  try {
    if (args.some((arg) => !['--demo', '--dev', '--initialize'].includes(arg)))
      throw new Error('Unknown launcher option.');
    const config = readIntegratedConfig(env, {
      demo: args.includes('--demo'),
      initialize: args.includes('--initialize'),
    });
    const host = await startIntegratedServer(config, {
      dev: args.includes('--dev'),
      initialize: args.includes('--initialize'),
    });
    const stop = () => {
      void host.close().catch(() => {
        process.exitCode = 1;
      });
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    console.log(`Bota Recordings combined (${config.web.mode}): ${config.web.origin}`);
    return host;
  } catch (error) {
    console.error(
      error?.code === 'EADDRINUSE'
        ? 'Application port is already in use. Stop the old listener or change PORT and APP_ORIGIN together.'
        : 'Combined startup failed. Check configuration, installed Web dependencies and original private journals.',
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await runMain();
