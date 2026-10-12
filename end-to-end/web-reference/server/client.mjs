import { AppError, ensure } from './errors.mjs';

export const audioTypes = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4',
  'audio/ogg', 'audio/opus', 'audio/webm', 'audio/flac']);

export function parseJson(bytes) {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes), (key, value) => {
      if (!key.isWellFormed() || (typeof value === 'string' && !value.isWellFormed()) ||
          (typeof value === 'number' && !Number.isFinite(value))) throw new Error();
      return value;
    });
  } catch { throw new AppError(502, 'INVALID_RESPONSE', 'Unsupported JSON response.'); }
}

export function createClient(config, { fetchImpl = fetch, deadline = performance.now() + 180000 } = {}) {
  const signal = seconds => {
    const left = Math.floor(deadline - performance.now());
    ensure(left > 0, 504, 'TIMEOUT', 'Operation time budget expired. Refresh existing state.');
    return AbortSignal.timeout(Math.min(seconds * 1000, left));
  };
  async function request(method, path, body, options = {}) {
    ensure(['GET', 'POST'].includes(method) && /^\/[a-z]/.test(path) &&
      !/[\x00-\x20\x7f\\#]/.test(path) && !path.includes('..') && !path.startsWith('//'),
    400, 'INVALID_REQUEST', 'Unsupported cloud request.');
    const abort = signal(10);
    try {
      const response = await fetchImpl(config.apiBase + path, {
        method, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', signal: abort,
        headers: { Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json',
          'Accept-Encoding': 'identity', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const pending = options.pending425 && response.status === 425;
      if (method === 'GET' && [403, 404].includes(response.status)) {
        await response.body?.cancel();
        throw new AppError(response.status, 'NOT_FOUND', 'Resource unavailable.');
      }
      if ((!pending && !(method === 'GET' ? response.status === 200 : [200, 201, 202].includes(response.status))) ||
          !response.body || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' ||
          (response.headers.get('content-encoding') ?? 'identity').toLowerCase() !== 'identity') {
        await response.body?.cancel();
        throw new AppError(502, 'UPSTREAM_FAILURE', 'Cloud request did not return a supported response.');
      }
      const chunks = []; let length = 0;
      for await (const chunk of response.body) {
        abort.throwIfAborted(); length += chunk.length;
        ensure(length <= 8 * 1024 * 1024, 502, 'RESPONSE_LIMIT', 'Cloud response exceeds the example limit.');
        chunks.push(chunk);
      }
      abort.throwIfAborted();
      const result = parseJson(Buffer.concat(chunks));
      if (pending) {
        ensure((result?.error?.code ?? result?.code) === 'upload_verification_pending',
          502, 'UPSTREAM_FAILURE', 'Unsupported upload verification response.');
        return null;
      }
      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'UPSTREAM_FAILURE', 'Cloud request failed. Its write outcome may be unknown.');
    }
  }
  async function storagePut(raw, bytes, contentType) {
    let url;
    try { url = new URL(raw); } catch { throw new AppError(502, 'INVALID_STORAGE', 'Unsupported storage destination.'); }
    ensure(typeof raw === 'string' && raw.length <= 8192 && !/[\x00-\x20\x7f\\#]/.test(raw) &&
      url.protocol === 'https:' && !url.username && !url.password && !url.hash &&
      (!url.port || url.port === '443') && config.storageHosts.includes(url.hostname) &&
      audioTypes.has(contentType) && Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 25 * 1024 * 1024,
    502, 'INVALID_STORAGE', 'Storage destination, media type or bytes are unsupported.');
    try {
      const response = await fetchImpl(url.href, { method: 'PUT', redirect: 'error', credentials: 'omit',
        referrerPolicy: 'no-referrer', headers: { 'Content-Type': contentType }, body: bytes, signal: signal(120) });
      await response.body?.cancel();
      ensure([200, 201, 204].includes(response.status), 502, 'STORAGE_FAILURE', 'Storage upload was not acknowledged.');
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'STORAGE_FAILURE', 'Storage upload outcome is unknown. Do not resend automatically.');
    }
  }
  return { request, storagePut };
}
