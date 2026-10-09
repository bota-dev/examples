import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const MAX_RESPONSE_BYTES = 1024 * 1024;
const JOB_STATUSES = ['pending', 'processing', 'completed', 'failed'];
const RECORDING_STATUSES = ['pending', 'streaming', 'uploaded', 'processing', 'completed', 'failed', 'integrity_failure'];
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value, prefix) => typeof value === 'string' &&
  new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);

function configuration() {
  let base;
  try { base = new URL(process.env.BOTA_API_BASE_URL); }
  catch { throw new SafeError('Configure a trusted API origin ending in /v1.'); }
  const local = base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  requireValue((base.protocol === 'https:' || local) && !base.username && !base.password &&
    !base.search && !base.hash && /^\/v1\/?$/.test(base.pathname),
  'Use HTTPS (or explicit loopback HTTP), path /v1 and no URL credentials/query/fragment.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !key.toLowerCase().includes('replace_me'),
  'Configure a server-held key with recordings:read, transcriptions:read and summaries:read.');
  const project = process.env.BOTA_PROJECT_ID;
  requireValue(typeof project === 'string' && /^[A-Za-z0-9_-]{3,128}$/.test(project) &&
    !project.toLowerCase().includes('replace_me'), 'Configure the exact expected project ID.');
  const owner = process.env.BOTA_END_USER_ID;
  const recording = process.env.BOTA_RECORDING_ID;
  const transcription = process.env.BOTA_TRANSCRIPTION_ID;
  const summary = process.env.BOTA_SUMMARY_ID;
  requireValue(validId(owner, 'eu') && validId(recording, 'rec') &&
    validId(transcription, 'txn') && validId(summary, 'sum'),
  'Configure the exact authorized end-user, recording, transcription and summary IDs.');
  return { base: base.href.replace(/\/$/, ''), key, project, owner, recording, transcription, summary };
}

function client(config, signal) {
  return async path => {
    signal.throwIfAborted();
    const url = new URL(config.base + path);
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    // Core HTTP requests connect directly: no environment proxy or global fetch dispatcher.
    const response = await new Promise((resolve, reject) => {
      const operation = request(url, { method: 'GET', agent: false, signal,
        headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json' } }, resolve);
      operation.on('error', reject);
      operation.end();
    });
    try {
      requireValue(response.statusCode === 200,
        `API read returned HTTP ${response.statusCode}; no retry was made.`);
      requireValue(/^application\/json(?:\s*;|$)/i.test(response.headers['content-type'] ?? ''),
        'Expected a JSON API response.');
      const chunks = []; let size = 0;
      for await (const chunk of response) {
        signal.throwIfAborted();
        size += chunk.length;
        requireValue(size <= MAX_RESPONSE_BYTES, 'API response exceeded the 1 MiB example limit.');
        chunks.push(chunk);
      }
      signal.throwIfAborted();
      try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { throw new SafeError('API response was not valid UTF-8 JSON.'); }
    } finally { response.destroy(); }
  };
}

function timestamp(value, required = false) {
  if (!required && (value === null || value === undefined)) return null;
  requireValue(typeof value === 'string' && value.length <= 40 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value)), 'Invalid reported timestamp.');
  return value;
}

function timestamps(resource, job = false) {
  return {
    ...(job ? { started_at: timestamp(resource.started_at), completed_at: timestamp(resource.completed_at) } : {}),
    created_at: timestamp(resource.created_at, true),
    updated_at: timestamp(resource.updated_at, true),
  };
}

function optionalProject(resource, config) {
  requireValue(!('project_id' in resource) || resource.project_id === config.project,
    'Returned resource project did not match the configured project.');
}

function recordingSnapshot(resource, config) {
  requireValue(object(resource) && resource.id === config.recording && resource.end_user_id === config.owner &&
    (resource.deleted_at === undefined || resource.deleted_at === null),
  'Recording identity, configured owner or deletion state mismatch.');
  optionalProject(resource, config);
  requireValue(RECORDING_STATUSES.includes(resource.status), 'Unknown recording status.');
  const verified = timestamp(resource.content_sha256_verified_at);
  return { id: config.recording, end_user_id: config.owner, status: resource.status,
    content_sha256_verified_at: verified,
    server_hash_verification_timestamp_present: verified !== null,
    ...timestamps(resource) };
}

function transcriptionSnapshot(resource, config) {
  requireValue(object(resource) && resource.id === config.transcription && resource.recording_id === config.recording,
    'Transcription identity or recording link mismatch.');
  optionalProject(resource, config);
  requireValue(JOB_STATUSES.includes(resource.status), 'Unknown transcription status.');
  return { id: config.transcription, recording_id: config.recording, status: resource.status,
    ...timestamps(resource, true) };
}

function summarySnapshot(resource, config) {
  requireValue(object(resource) && resource.id === config.summary && resource.project_id === config.project &&
    resource.transcription_id === config.transcription, 'Summary identity, project or transcription link mismatch.');
  requireValue(JOB_STATUSES.includes(resource.status), 'Unknown summary status.');
  return { id: config.summary, project_id: config.project, transcription_id: config.transcription,
    status: resource.status, ...timestamps(resource, true) };
}

async function main() {
  const config = configuration();
  const signal = AbortSignal.timeout(30_000);
  const get = client(config, signal);
  recordingSnapshot(await get(`/recordings/${config.recording}`), config);
  const transcription = transcriptionSnapshot(await get(`/transcriptions/${config.transcription}`), config);
  const summary = summarySnapshot(await get(`/summaries/${config.summary}`), config);
  const recording = recordingSnapshot(await get(`/recordings/${config.recording}`), config);
  signal.throwIfAborted();
  // The final owner check cannot establish continuous ownership or atomic status reads.
  console.log(JSON.stringify({ observed_at: new Date().toISOString(), atomic_snapshot: false,
    project_id: config.project, recording, transcription, summary }, null, 2));
}

main().catch(error => {
  console.error(error instanceof SafeError ? error.message :
    'Snapshot failed or its deadline expired; inspect configuration and API access before another observation.');
  process.exitCode = 1;
});
