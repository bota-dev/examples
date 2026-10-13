import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createApp as createWebApp } from '../../web-reference/server/app.mjs';
import {
  createRequestHandler,
  configureMobileCoordination,
} from '../../react-native-recording-sync/backend/server.mjs';
import { AppError, RequestError, ensure } from './errors.mjs';

const kinds = new Set(['transcription', 'summary', 'ask']);
const questionKey = (recordingId, question) =>
  `ask:${recordingId}:${createHash('sha256').update(question.trim()).digest('hex')}`;

// All probes are private, synchronous reads of the original journals. The lock
// prevents overlap in this process; retained rows refuse replacement on restart.
function coordinateWrites(store, service, library) {
  configureMobileCoordination(service, library);
  const nativeGuard = service.beforeTranscriptionCreate;
  service.beforeTranscriptionCreate = (recordingId, existingId) => {
    nativeGuard(recordingId, existingId);
    store.assertPeerIntent('transcription', recordingId);
  };
  library.beforeClaim = (kind, anchor, details) => {
    if (kinds.has(kind)) store.assertPeerIntent(kind, anchor, { recordingId: details.recordingId });
  };
  library.coordinateSummary = (id, work) =>
    service.exclusive(`summary:${id}:tmpl_general_notes`, work);
  library.coordinateAsk = (id, question, work) =>
    service.exclusive(questionKey(id, question), work);

  const webRun = async (key, work) => {
    try {
      return await service.exclusive(key, work);
    } catch (error) {
      if (error instanceof RequestError && !(error instanceof AppError))
        throw new AppError(error.status, error.code, error.message);
      throw error;
    }
  };

  return {
    beforeClaim(principal, kind, anchor, details) {
      if (!kinds.has(kind)) return;
      store.assertPeerIntent(kind, anchor, { principal, recordingId: details.recordingId });
      library.assertPeerIntent(kind, anchor, details.recordingId);
      if (kind === 'transcription') {
        let known;
        try {
          known = service.assertLibraryTranscription(details.recordingId);
        } catch (error) {
          if (error instanceof RequestError)
            throw new AppError(
              409,
              'cross_intent_reconciliation_required',
              'A retained request needs reconciliation. No replacement request was sent.',
            );
          throw error;
        }
        ensure(
          !known,
          409,
          'cross_intent_reconciliation_required',
          'A retained request needs reconciliation. No replacement request was sent.',
        );
      }
    },
    coordinateTranscription: (id, work) => webRun(`recording:${id}`, work),
    coordinateSummary: (id, work) => webRun(`summary:${id}:tmpl_general_notes`, work),
    coordinateAsk: (id, question, work) => webRun(questionKey(id, question), work),
  };
}

function refuse(response) {
  response.writeHead(401, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(
    JSON.stringify({ error: { code: 'unauthorized', message: 'Use one application credential.' } }),
  );
}

/** One listener, with the original credential-specific HTTP and DTO adapters. */
export function createIntegratedServer({
  config,
  store,
  service,
  library,
  fetchImpl,
  staticDirectory,
}) {
  const pending = new Set();
  const trackWork = (work) => {
    const promise = Promise.resolve()
      .then(work)
      .finally(() => pending.delete(promise));
    pending.add(promise);
    return promise;
  };
  const drainWork = async () => {
    while (pending.size) await Promise.allSettled([...pending]);
  };
  ensure(
    config.mobile ? service && library : !service && !library,
    500,
    'configuration',
    'Configure both mobile services or use the Web-only demo.',
  );
  const webApp = createWebApp({
    config: config.web,
    store,
    fetchImpl,
    staticDirectory,
    trackWork,
    ...(service ? coordinateWrites(store, service, library) : {}),
  });
  const mobile = service
    ? createRequestHandler(service, config.mobile.appToken, library, { coordinate: false })
    : null;
  const server = createServer((request, response) => {
    // Header presence chooses the adapter, including invalid credentials. Never
    // retry authorization through the other adapter or parse a body globally.
    const authorization = request.headers.authorization !== undefined;
    const cookie = request.headers.cookie !== undefined;
    const count = (name) =>
      request.rawHeaders.filter(
        (_, index) => index % 2 === 0 && request.rawHeaders[index].toLowerCase() === name,
      ).length;
    if ((authorization && cookie) || count('authorization') > 1 || count('cookie') > 1)
      return refuse(response);
    if (request.url?.split('?')[0] === '/webhooks/bota') return webApp(request, response);
    if (authorization || request.url?.startsWith('/api/library/')) {
      if (!mobile) return refuse(response);
      void trackWork(() => mobile(request, response)).catch(() => {
        if (!response.destroyed) response.destroy();
      });
      return;
    }
    return webApp(request, response);
  });
  // Conservative common input budgets. Upstream processing timeouts are unchanged.
  server.headersTimeout = 10_000;
  server.requestTimeout = 30_000;
  return { server, webApp, drainWork };
}
