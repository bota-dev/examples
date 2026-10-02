import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readConfig, RequestError, SyncService } from './service.mjs';

export function createApp(service, appToken) {
  const expected = Buffer.from(`Bearer ${appToken}`);
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      // No browser access/CORS, credential forwarding, or arbitrary proxy paths.
      const auth = Buffer.from(request.headers.authorization ?? '');
      if (request.headers.origin || auth.length !== expected.length || !timingSafeEqual(auth, expected)) throw new RequestError(401, 'unauthorized');
      if (!request.url?.startsWith('/api/') || request.url.includes('?') || request.url.includes('%') || request.url.includes('..')) throw new RequestError(404, 'route_not_found');
      const chunks = []; let length = 0;
      for await (const chunk of request) {
        length += chunk.length;
        if (length > 32 * 1024) throw new RequestError(413, 'request_too_large');
        chunks.push(chunk);
      }
      let body = {};
      if (length) {
        if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) throw new RequestError(415, 'json_required');
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RequestError(400, 'invalid_json'); }
      }
      const result = await service.route(request.method, request.url, body, request.headers['x-bota-binding-generation']);
      response.statusCode = result === null ? 204 : 200;
      response.end(result === null ? undefined : JSON.stringify(result));
    } catch (error) {
      const known = error instanceof RequestError;
      response.statusCode = known ? error.status : 500;
      response.end(JSON.stringify({ error: { code: known ? error.code : 'internal_error', message: known ? error.message : 'The operation could not complete. Preserve its journal.' } }));
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const config = readConfig(process.env);
    const database = resolve(process.env.JOURNAL_PATH ?? './data/recording-sync.sqlite');
    mkdirSync(dirname(database), { recursive: true, mode: 0o700 });
    const service = new SyncService(config, { database });
    const port = Number(process.env.PORT ?? 8787);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
    const server = createApp(service, config.appToken);
    server.listen(port, '127.0.0.1', () => console.log(`Recording-sync backend listening at http://127.0.0.1:${port}`));
    const stop = () => server.close(() => { service.close(); process.exit(0); });
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  } catch { console.error('Backend startup failed. Check configuration and the original journal scope.'); process.exitCode = 1; }
}
