import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { configuration } from './config.mjs';
import { createStore } from './store.mjs';
import { createApp } from './app.mjs';
import { demoFetch } from './demo.mjs';

try {
  const dev = process.argv.includes('--dev');
  const config = configuration(process.env, { demo: process.argv.includes('--demo') });
  const store = createStore(config.mode === 'demo' ? ':memory:' : resolve(config.stateDir, 'reference.sqlite'));
  const app = createApp({ config, store, fetchImpl: config.mode === 'demo' ? demoFetch({ onEvent: event => store.acceptEvent(event) }) : undefined,
    staticDirectory: dev ? undefined : resolve('dist') });
  const server = createServer(app);
  let vite;
  if (dev) {
    const { createServer: createVite } = await import('vite');
    vite = await createVite({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  server.requestTimeout = 180000; server.headersTimeout = 15000;
  server.listen(config.port, '127.0.0.1', () => console.log(`Recording workbench (${config.mode}): ${config.origin}`));
  server.on('error', () => { console.error('Application listener failed.'); process.exitCode = 1; });
  for (const name of ['SIGINT', 'SIGTERM']) process.once(name, () => {
    server.close(async () => { await vite?.close(); store.close(); });
    server.closeIdleConnections();
  });
} catch {
  console.error('Startup failed. Check private configuration and documented setup.');
  process.exitCode = 1;
}
