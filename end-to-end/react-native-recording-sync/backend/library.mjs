import { createHash } from 'node:crypto';
import { createStore } from './library/store.mjs';
import { AppError, ensure, isId, object, operationView } from './library/errors.mjs';
import { RequestError } from './service.mjs';
import { getRecording, listRecordings } from './library/recordings.mjs';
import { listSummaries, listTranscriptions, refreshProcessing, startSummary, startTranscription } from './library/processing.mjs';
import { askRecording, refreshAsk } from './library/ask.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Cloud ownership is independent from device connection and upload cleanup authority. */
export class LibraryService {
  constructor(config, { database = ':memory:', request } = {}) {
    ensure(typeof request === 'function', 500, 'configuration', 'A bounded public API client is required.');
    const scopeId = createHash('sha256').update(JSON.stringify([
      config.apiBase, config.projectId, config.endUserId, config.apiKey,
    ])).digest('hex');
    this.principal = { projectId: config.projectId, endUserId: config.endUserId, scopeId };
    this.store = createStore(database, scopeId);
    // Trusted host hooks only; request fields never select coordination or claim policy.
    this.beforeClaim = () => {};
    this.coordinateTranscription = (_id, work) => work();
    this.coordinateSummary = (_id, work) => work();
    this.coordinateAsk = (_id, _question, work) => work();
    this.context = { principal: this.principal, store: {
      ...this.store,
      claim: (principal, kind, anchor, details) => {
        // A retained own intent must still reconcile by GET if a peer is blocked.
        if (!this.store.find(principal, kind, anchor)) {
          const result = this.beforeClaim(kind, anchor, details);
          if (result && typeof result.then === 'function') {
            void Promise.resolve(result).catch(() => {});
            ensure(false, 500, 'configuration', 'Claim guards must complete synchronously.');
          }
        }
        return this.store.claim(principal, kind, anchor, details);
      },
    }, request: async (...args) => {
      try { return await request(...args); }
      catch (error) {
        if (error instanceof RequestError && !(error instanceof AppError)) throw new AppError(error.status, error.code, error.message);
        throw error;
      }
    } };
  }
  close() { this.store.close(); }
  assertPeerIntent(kind, anchor, recordingId) {
    const code = 'cross_intent_reconciliation_required';
    const message = 'A retained operation needs reconciliation in its original adapter. No replacement is allowed.';
    ensure(['transcription', 'summary', 'ask'].includes(kind) && typeof anchor === 'string' && anchor.length > 0,
      409, code, message);
    ensure(kind !== 'ask' || isId(recordingId, 'rec'), 409, code, message);
    const known = this.store.find(this.principal, kind, anchor);
    const legacy = kind === 'ask' && this.store.findLegacyAsk(this.principal, recordingId);
    ensure(!known && !legacy, 409, code, message);
  }
  assertNativeTranscription(recordingId, existingId) {
    const known = this.store.find(this.principal, 'transcription', recordingId);
    ensure(!known || (existingId && known.resourceId === existingId), 409,
      'library_transcription_reconciliation_required', 'The library transcription intent needs GET reconciliation. No native replacement is allowed.');
  }
  async route(method, raw, body = {}) {
    const url = new URL(raw, 'http://127.0.0.1');
    const path = url.pathname;
    const ctx = this.context;
    // Only the list accepts a query. Do not decode arbitrary resource paths or become a proxy.
    const list = method === 'GET' && path === '/api/library/recordings';
    ensure(!url.search || list, 400, 'invalid_query', 'Only the recordings list accepts a cursor.');
    ensure([...url.searchParams.keys()].every(key => key === 'cursor') && url.searchParams.getAll('cursor').length <= 1,
      400, 'invalid_query', 'Supply at most one recording cursor.');
    ensure(object(body), 400, 'invalid_request', 'Supply a JSON object.');
    if (method === 'GET') ensure(Object.keys(body).length === 0, 400, 'invalid_request', 'GET requests accept no body.');
    if (list) return listRecordings(ctx, url.searchParams.get('cursor') ?? undefined);
    let match = path.match(/^\/api\/library\/recordings\/(rec_[A-Za-z0-9_-]+)$/);
    if (match && method === 'GET') return getRecording(ctx, match[1]);
    match = path.match(/^\/api\/library\/recordings\/(rec_[A-Za-z0-9_-]+)\/transcriptions$/);
    if (match && ['GET', 'POST'].includes(method)) {
      ensure(Object.keys(body).length === 0, 400, 'invalid_request', 'This action accepts an empty object.');
      return method === 'GET' ? listTranscriptions(ctx, match[1])
        : this.coordinateTranscription(match[1], knownNativeId => startTranscription(ctx, match[1], knownNativeId));
    }
    match = path.match(/^\/api\/library\/transcriptions\/(txn_[A-Za-z0-9_-]+)\/summaries$/);
    if (match && ['GET', 'POST'].includes(method)) {
      ensure(Object.keys(body).length === 0, 400, 'invalid_request', 'This action accepts an empty object.');
      return method === 'GET' ? listSummaries(ctx, match[1])
        : this.coordinateSummary(match[1], () => startSummary(ctx, match[1]));
    }
    match = path.match(/^\/api\/library\/recordings\/(rec_[A-Za-z0-9_-]+)\/ask$/);
    if (match && method === 'POST') {
      ensure(Object.keys(body).length === 1 && typeof body.question === 'string', 400, 'invalid_question', 'Supply one question.');
      return this.coordinateAsk(match[1], body.question, () => askRecording(ctx, match[1], body.question));
    }
    if (method === 'GET' && path === '/api/library/operations') return { data: this.store.list(this.principal).map(operationView) };
    match = path.match(/^\/api\/library\/operations\/([0-9a-f-]+)$/);
    if (match && method === 'GET') {
      ensure(UUID.test(match[1]), 400, 'invalid_operation', 'Choose a valid operation.');
      const operation = this.store.get(this.principal, match[1]);
      return operation.kind === 'ask' ? refreshAsk(ctx, operation.id) : refreshProcessing(ctx, operation.id);
    }
    ensure(false, 404, 'route_not_found', 'Route unavailable.');
  }
}
