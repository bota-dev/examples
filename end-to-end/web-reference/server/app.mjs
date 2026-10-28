import express from 'express';
import { createAuth } from './auth.mjs';
import { createClient, audioTypes } from './client.mjs';
import { AppError, ensure, object, operationView } from './errors.mjs';
import { listRecordings, getRecording } from './features/recordings.mjs';
import { uploadAudio, refreshUpload } from './features/upload.mjs';
import {
  listTranscriptions,
  startTranscription,
  listSummaries,
  startSummary,
  refreshProcessing,
} from './features/processing.mjs';
import { askRecording, refreshAsk } from './features/ask.mjs';
import { receiveWebhook, listEvents } from './features/webhooks.mjs';
import { playbackAudio } from './features/playback.mjs';

export function createApp({
  config,
  store,
  fetchImpl,
  now,
  staticDirectory,
  beforeClaim = () => {},
  coordinateTranscription = (_recordingId, work) => work(),
  coordinateSummary = (_transcriptionId, work) => work(),
  coordinateAsk = (_recordingId, _question, work) => work(),
  trackWork = (work) => work(),
}) {
  const app = express();
  const auth = createAuth(config, { now });
  // Socket closure does not mean an upstream write and its durable save have
  // settled. A composed host can drain these promises before closing journals.
  const tracked = (handler) => (req, res, next) => trackWork(() => handler(req, res, next));
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
    });
    if (staticDirectory)
      res.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      );
    ensure(
      req.headers.host === new URL(config.origin).host,
      400,
      'INVALID_HOST',
      'Use the configured application origin.',
    );
    next();
  });
  app.post(
    '/webhooks/bota',
    express.raw({ type: 'application/json', limit: '1mb', inflate: false }),
    tracked(async (req, res) => {
      ensure(config.webhookSecret, 503, 'WEBHOOK_DISABLED', 'Webhook endpoint is not configured.');
      ensure(Buffer.isBuffer(req.body), 415, 'CONTENT_TYPE', 'Expected JSON bytes.');
      await receiveWebhook({ config, store }, req.body, req.headers);
      res.json({ accepted: true });
    }),
  );
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD'].includes(req.method))
      ensure(
        req.headers.origin === config.origin,
        403,
        'INVALID_ORIGIN',
        'Use the same application origin.',
      );
    req.principal = auth.principal(req.headers.cookie);
    if (!['/me', '/login'].includes(req.path))
      ensure(req.principal, 401, 'UNAUTHENTICATED', 'Sign in to continue.');
    next();
  });
  const me = (principal) => ({
    user: principal ? { username: principal.username } : null,
    mode: config.mode,
  });
  app.get('/api/me', (req, res) => res.json(me(req.principal)));
  app.post('/api/login', express.json({ limit: '4kb' }), (req, res) => {
    ensure(
      object(req.body) && Object.keys(req.body).every((key) => ['username', 'token'].includes(key)),
      400,
      'INVALID_LOGIN',
      'Supply application sign-in details.',
    );
    const result = auth.login(req.body, req.socket.remoteAddress);
    if (req.principal) auth.logout(req.headers.cookie);
    res.set('Set-Cookie', result.cookie).json(me(result.principal));
  });
  app.post('/api/logout', (_req, res) =>
    res.set('Set-Cookie', auth.logout(_req.headers.cookie)).json({ ok: true }),
  );
  const context = (req, signal) => ({
    principal: req.principal,
    config,
    store: {
      ...store,
      claim(principal, kind, anchor, details = {}) {
        // A retained own intent keeps its existing GET-only recovery path.
        // The trusted host guard is synchronous with a genuinely new claim.
        if (!store.find(principal, kind, anchor)) {
          const guard = beforeClaim(principal, kind, anchor, details);
          if (guard && typeof guard.then === 'function') {
            void Promise.resolve(guard).catch(() => {});
            ensure(false, 500, 'configuration', 'Claim guards must complete synchronously.');
          }
        }
        const result = store.claim(principal, kind, anchor, details);
        req.operation = result.operation;
        return result;
      },
      save(...args) {
        const result = store.save(...args);
        req.operation = result;
        return result;
      },
    },
    ...createClient(config, { fetchImpl, signal }),
  });
  const noBody = (req) =>
    ensure(
      !req.body || (object(req.body) && Object.keys(req.body).length === 0),
      400,
      'INVALID_REQUEST',
      'This action accepts no resource scope or provider parameters.',
    );
  app.post(
    '/api/uploads',
    express.raw({
      type: (req) => audioTypes.has(req.headers['content-type']),
      limit: '25mb',
      inflate: false,
    }),
    tracked(async (req, res) => {
      let name;
      try {
        name = decodeURIComponent(req.headers['x-file-name'] ?? '');
      } catch {
        throw new AppError(400, 'INVALID_FILE_NAME', 'Choose a valid audio filename.');
      }
      res.json(
        await uploadAudio(context(req), {
          name,
          contentType: req.headers['content-type'],
          bytes: req.body,
        }),
      );
    }),
  );
  app.use('/api', express.json({ limit: '64kb' }));
  app.get(
    '/api/recordings',
    tracked(async (req, res) => {
      ensure(
        Object.keys(req.query).every((key) => key === 'cursor') &&
          (req.query.cursor === undefined || typeof req.query.cursor === 'string'),
        400,
        'INVALID_QUERY',
        'Only a recording cursor is accepted.',
      );
      res.json(await listRecordings(context(req), req.query.cursor));
    }),
  );
  app.get(
    '/api/recordings/:id',
    tracked(async (req, res) => res.json(await getRecording(context(req), req.params.id))),
  );
  app.get(
    '/api/recordings/:id/audio',
    tracked(async (req, res) => {
      ensure(
        req.method === 'GET' && Object.keys(req.query).length === 0 && !req.headers.range,
        400,
        'INVALID_REQUEST',
        'Load the complete recording audio without query or range parameters.',
      );
      const abort = new AbortController();
      const disconnected = () => {
        if (!res.writableEnded) abort.abort();
      };
      req.once('aborted', disconnected);
      res.once('close', disconnected);
      try {
        const bytes = await playbackAudio(context(req, abort.signal), req.params.id);
        if (req.aborted || res.destroyed) return;
        ensure(
          auth.principal(req.headers.cookie) === req.principal,
          401,
          'UNAUTHENTICATED',
          'Sign in again to load recording audio.',
        );
        res.set('Content-Type', 'audio/wav').send(bytes);
      } catch (error) {
        if (!req.aborted && !res.destroyed) throw error;
      } finally {
        req.off('aborted', disconnected);
        res.off('close', disconnected);
      }
    }),
  );
  app.get(
    '/api/recordings/:id/transcriptions',
    tracked(async (req, res) => res.json(await listTranscriptions(context(req), req.params.id))),
  );
  app.post(
    '/api/recordings/:id/transcriptions',
    tracked(async (req, res) => {
      noBody(req);
      res.json(
        await coordinateTranscription(req.params.id, () =>
          startTranscription(context(req), req.params.id),
        ),
      );
    }),
  );
  app.get(
    '/api/transcriptions/:id/summaries',
    tracked(async (req, res) => res.json(await listSummaries(context(req), req.params.id))),
  );
  app.post(
    '/api/transcriptions/:id/summaries',
    tracked(async (req, res) => {
      noBody(req);
      res.json(
        await coordinateSummary(req.params.id, () => startSummary(context(req), req.params.id)),
      );
    }),
  );
  app.post(
    '/api/recordings/:id/ask',
    tracked(async (req, res) => {
      ensure(
        object(req.body) &&
          Object.keys(req.body).length === 1 &&
          typeof req.body.question === 'string',
        400,
        'INVALID_QUESTION',
        'Supply one question.',
      );
      res.json(
        await coordinateAsk(req.params.id, req.body.question.trim(), () =>
          askRecording(context(req), req.params.id, req.body.question),
        ),
      );
    }),
  );
  app.get(
    '/api/events',
    tracked(async (req, res) => res.json(await listEvents(context(req)))),
  );
  app.get('/api/operations', (req, res) =>
    res.json({ data: store.list(req.principal).map(operationView) }),
  );
  app.get(
    '/api/operations/:id',
    tracked(async (req, res) => {
      const op = store.get(req.principal, req.params.id);
      req.operation = op;
      const ctx = context(req);
      res.json(
        await (op.kind === 'upload'
          ? refreshUpload(ctx, op.id)
          : op.kind === 'ask'
            ? refreshAsk(ctx, op.id)
            : refreshProcessing(ctx, op.id)),
      );
    }),
  );
  app.use('/api', (_req, _res) => {
    throw new AppError(404, 'NOT_FOUND', 'Route unavailable.');
  });
  if (staticDirectory)
    app.use(express.static(staticDirectory, { dotfiles: 'deny', index: 'index.html' }));
  app.use((error, req, res, _next) => {
    const status =
      error instanceof AppError
        ? error.status
        : error.type === 'entity.too.large'
          ? 413
          : error.type === 'entity.parse.failed'
            ? 400
            : error.type === 'encoding.unsupported'
              ? 415
              : 500;
    res.status(status).json({
      error: {
        code: error instanceof AppError ? error.code : 'REQUEST_FAILED',
        message: error instanceof AppError ? error.message : 'Request could not be completed.',
      },
      ...(req.principal && req.operation && ![401, 403, 404].includes(status)
        ? { operation: operationView(req.operation) }
        : {}),
    });
  });
  return app;
}
