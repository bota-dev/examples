import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const MAX_RESPONSE_BYTES = 1024 * 1024;
class SafeError extends Error {}
const fail = message => { throw new SafeError(message); };
const id = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);

export function readConfig(env) {
  let base;
  try { base = new URL(env.BOTA_API_BASE_URL); } catch { fail('Set BOTA_API_BASE_URL to the intended API origin with /v1.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) || base.username || base.password ||
      base.search || base.hash || base.pathname.replace(/\/$/, '') !== '/v1') {
    fail('Use an HTTPS API origin with /v1 and no credentials, query or fragment; HTTP is allowed only on loopback.');
  }
  if (typeof env.BOTA_API_KEY !== 'string' || !/^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(env.BOTA_API_KEY)) {
    fail('Set a server-side project API key with recordings:read.');
  }
  if (!id(env.BOTA_END_USER_ID, 'eu')) fail('Set BOTA_END_USER_ID to the fixed authorized end user.');
  const query = typeof env.BOTA_QUERY === 'string' ? env.BOTA_QUERY.trim() : '';
  if (query.length < 1 || query.length > 1000) fail('BOTA_QUERY must contain 1–1000 characters after trimming.');
  const limit = env.BOTA_LIMIT ?? '8';
  if (!/^[1-9][0-9]*$/.test(limit) || Number(limit) > 50) fail('BOTA_LIMIT must be an integer from 1 to 50.');
  const recordingIds = env.BOTA_RECORDING_IDS?.trim() ? env.BOTA_RECORDING_IDS.split(',').map(value => value.trim()) : undefined;
  if (recordingIds && (recordingIds.length > 500 || recordingIds.some(value => !id(value, 'rec')) ||
      new Set(recordingIds).size !== recordingIds.length)) {
    fail('BOTA_RECORDING_IDS must be blank or contain 1–500 distinct comma-separated recording IDs.');
  }
  return {base: base.href.replace(/\/$/, ''), key: env.BOTA_API_KEY, endUserId: env.BOTA_END_USER_ID,
    query, limit: Number(limit), recordingIds};
}

async function document(response) {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
    await response.body?.cancel();
    fail('The API returned an unexpected content type.');
  }
  const reader = response.body?.getReader();
  if (!reader) fail('The API returned an empty response.');
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) { await reader.cancel(); fail('The API response exceeded this example’s 1 MiB limit.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks))); }
  catch { fail('The API returned invalid JSON.'); }
}

function excerpt(value) {
  if (!value || !id(value.chunk_id, 'chk') || !id(value.recording_id, 'rec') || !id(value.transcription_id, 'txn') ||
      typeof value.chunk_text !== 'string' || value.chunk_text.length < 1 || value.chunk_text.length > 32_768 ||
      !(value.speaker === null || (typeof value.speaker === 'string' && value.speaker.length <= 128)) ||
      !Number.isSafeInteger(value.start_ms) || value.start_ms < 0 || !Number.isSafeInteger(value.end_ms) || value.end_ms < value.start_ms ||
      typeof value.score !== 'number' || !Number.isFinite(value.score) || value.score < 0) {
    fail('The API returned invalid excerpt metadata.');
  }
  if (value.recorded_at !== null && (typeof value.recorded_at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.recorded_at) ||
      !Number.isFinite(Date.parse(value.recorded_at)))) fail('The API returned an invalid recording timestamp.');
  // Only documented citation fields; never spread upstream objects into CLI output.
  return {chunk_id: value.chunk_id, recording_id: value.recording_id, transcription_id: value.transcription_id,
    chunk_text: value.chunk_text, speaker: value.speaker, start_ms: value.start_ms, end_ms: value.end_ms,
    recorded_at: value.recorded_at, score: value.score};
}

export async function searchTranscripts(config, {fetchImpl = fetch, timeoutMs = 30_000} = {}) {
  const signal = AbortSignal.timeout(timeoutMs);
  async function request(path, body) {
    try {
      const response = await fetchImpl(`${config.base}${path}`, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal,
        headers: {Authorization: `Bearer ${config.key}`, Accept: 'application/json', ...(body ? {'Content-Type': 'application/json'} : {})},
        ...(body ? {body: JSON.stringify(body)} : {}),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401 || response.status === 403) fail('Authorization rejected. Check the project key, end user and recordings:read scope.');
        if (response.status === 429) fail('API rate limit reached. No automatic retry was made.');
        fail(`API request failed (HTTP ${response.status}). No automatic retry was made.`);
      }
      return await document(response);
    } catch (error) {
      if (error instanceof SafeError) throw error;
      fail(signal.aborted ? 'Search exceeded its deadline. No partial excerpts were printed; the provider request may already have incurred cost.'
        : 'API request interrupted or redirected. No partial excerpts were printed and no retry was made.');
    }
  }
  const response = await request('/recordings/search', {query: config.query, end_user_id: config.endUserId,
    limit: config.limit, ...(config.recordingIds ? {recording_ids: config.recordingIds} : {})});
  if (!response || !Array.isArray(response.results) || response.results.length > config.limit) fail('The API returned an invalid search response.');
  const results = response.results.map(excerpt);
  if (new Set(results.map(row => row.chunk_id)).size !== results.length) fail('The API returned duplicate chunks.');
  if (config.recordingIds && results.some(row => !config.recordingIds.includes(row.recording_id))) fail('Search returned a recording outside the configured allowlist.');
  // Search rows omit owner identity. Verify each unique recording before printing any text.
  for (const recordingId of new Set(results.map(row => row.recording_id))) {
    const recording = await request(`/recordings/${encodeURIComponent(recordingId)}`);
    if (recording?.id !== recordingId || recording.end_user_id !== config.endUserId) fail('A returned recording did not match the configured end-user scope.');
  }
  return {results};
}

export async function main(env = process.env, {fetchImpl = fetch, output = console.log, errorOutput = console.error} = {}) {
  try {
    output(JSON.stringify(await searchTranscripts(readConfig(env), {fetchImpl}), null, 2));
    return 0;
  } catch (error) {
    errorOutput(error instanceof SafeError ? error.message : 'Search failed. No response data or credentials were printed.');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
