import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { configuration } from './config.mjs';
import { createStore } from './store.mjs';
import { createApp } from './app.mjs';
import { demoFetch } from './demo.mjs';

let store;
let server;
let vite;
let closing;

function closeResources() {
  // Startup failures and signals share one cleanup path. Vite's watchers must
  // also close when the HTTP listener never acquired its port.
  closing ??= (async () => {
    const drained =
      server &&
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeIdleConnections();
      });
    try {
      // Upgraded HMR sockets keep HTTP close pending. Stop accepting first,
      // then close Vite's sockets/watchers before awaiting the HTTP drain.
      await vite?.close();
    } finally {
      await drained;
      store?.close();
    }
  })();
  return closing;
}

function stop() {
  void closeResources().catch(() => {
    process.exitCode = 1;
  });
}

try {
  const dev = process.argv.includes('--dev');
  const config = configuration(process.env, { demo: process.argv.includes('--demo') });
  store = createStore(
    config.mode === 'demo' ? ':memory:' : resolve(config.stateDir, 'reference.sqlite'),
  );
  const app = createApp({
    config,
    store,
    fetchImpl:
      config.mode === 'demo'
        ? demoFetch({ onEvent: (event) => store.acceptEvent(event) })
        : undefined,
    staticDirectory: dev ? undefined : resolve('dist'),
  });
  server = createServer(app);
  if (dev) {
    const { createServer: createVite } = await import('vite');
    vite = await createVite({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  server.requestTimeout = 180000;
  server.headersTimeout = 15000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  console.log(`Bota Recordings (${config.mode}): ${config.origin}`);
  server.on('error', () => {
    console.error('Application listener failed.');
    process.exitCode = 1;
    stop();
  });
  for (const name of ['SIGINT', 'SIGTERM']) process.once(name, stop);
} catch (error) {
  console.error(
    error?.code === 'EADDRINUSE'
      ? 'Application port is already in use. Stop the other listener or change PORT and APP_ORIGIN together.'
      : 'Startup failed. Check private configuration and documented setup.',
  );
  process.exitCode = 1;
  await closeResources().catch(() => {
    console.error('Application shutdown failed.');
  });
}
