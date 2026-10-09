import { setTimeout as wait } from 'node:timers/promises';

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_POLLS = 20;
const POLL_DELAY_MS = 2_000;
const TOTAL_BUDGET_MS = 60_000;
const FINAL_CHECK_RESERVE_MS = 20_000;
const STATUSES = new Set(['pending', 'processing', 'completed', 'failed']);
class SafeError extends Error {}
class DeadlineExpired extends SafeError {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function configuration() {
  const rawBase = process.env.BOTA_API_BASE_URL;
  let base;
  try { base = new URL(rawBase); }
  catch { throw new SafeError('Configure an explicit HTTPS API origin ending in /v1.'); }
  requireValue(typeof rawBase === 'string' && !/[\x00-\x20\x7f]/.test(rawBase) &&
    base.protocol === 'https:' && !base.username && !base.password && !base.search &&
    !base.hash && /^\/v1\/?$/.test(base.pathname),
  'Use a fixed HTTPS API origin, path /v1 and no URL credentials/query/fragment.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !key.toLowerCase().includes('replace_me'),
  'Configure a server-held key with recordings:read, transcriptions:read and summaries:read.');
  const ids = {};
  for (const [name, prefix] of [['PROJECT', 'proj'], ['END_USER', 'eu'], ['RECORDING', 'rec'],
    ['TRANSCRIPTION', 'txn'], ['SUMMARY', 'sum']]) {
    const value = process.env[`BOTA_${name}_ID`];
    requireValue(typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value) &&
      !value.toLowerCase().includes('replace_me'), `Configure the exact authorized BOTA_${name}_ID.`);
    ids[name] = value;
  }
  return { base: base.href.replace(/\/$/, ''), key, ...ids };
}

function remaining(deadline) {
  const milliseconds = Math.floor(deadline - performance.now());
  if (milliseconds <= 0) throw new DeadlineExpired('Inconclusive: observation deadline expired.');
  return milliseconds;
}

async function api(config, path, deadline) {
  const signal = AbortSignal.timeout(Math.min(10_000, remaining(deadline)));
  try {
    const response = await fetch(config.base + path, { method: 'GET', redirect: 'error',
      credentials: 'omit', referrerPolicy: 'no-referrer', signal,
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json', 'Accept-Encoding': 'identity' } });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new SafeError(`API read returned HTTP ${response.status}; observation is inconclusive.`);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') ||
      !response.body || (response.headers.get('content-encoding') ?? 'identity').trim().toLowerCase() !== 'identity') {
      await response.body?.cancel();
      throw new SafeError('Expected an uncompressed JSON API response; observation is inconclusive.');
    }
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      signal.throwIfAborted();
      remaining(deadline);
      size += chunk.length;
      requireValue(size <= MAX_RESPONSE_BYTES, 'API response exceeds the 1 MiB example limit.');
      chunks.push(chunk);
    }
    signal.throwIfAborted();
    remaining(deadline);
    let row;
    try { row = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new SafeError('The API returned invalid UTF-8 JSON.'); }
    remaining(deadline);
    return row;
  } catch (error) {
    if (signal.aborted || error instanceof DeadlineExpired) throw new DeadlineExpired('Inconclusive: API read timed out.');
    if (error instanceof SafeError) throw error;
    throw new SafeError('API transport failed; observation is inconclusive and no retry was made.');
  }
}

async function verifyOwner(config, deadline) {
  const row = await api(config, `/recordings/${config.RECORDING}`, deadline);
  requireValue(object(row) && row.id === config.RECORDING && row.end_user_id === config.END_USER &&
    row.deleted_at == null && (!('project_id' in row) || row.project_id === config.PROJECT),
  'Recording identity, project or configured owner mismatch; no metadata emitted.');
}

async function verifyTranscription(config, deadline) {
  const row = await api(config, `/transcriptions/${config.TRANSCRIPTION}`, deadline);
  requireValue(object(row) && row.id === config.TRANSCRIPTION && row.recording_id === config.RECORDING &&
    row.status === 'completed' && (!('project_id' in row) || row.project_id === config.PROJECT),
  'The configured transcription must be completed and match its exact recording/project; no metadata emitted.');
}

function selectSummary(row, config) {
  requireValue(object(row) && row.id === config.SUMMARY && row.project_id === config.PROJECT &&
    row.transcription_id === config.TRANSCRIPTION,
  'Summary identity, project or transcription mismatch; no replacement job is followed.');
  requireValue(typeof row.status === 'string' && STATUSES.has(row.status),
    'Summary status is outside the selected public contract.');
  return { id: row.id, project_id: row.project_id, transcription_id: row.transcription_id, status: row.status };
}

async function watch(config) {
  const deadline = performance.now() + TOTAL_BUDGET_MS;
  const pollDeadline = deadline - FINAL_CHECK_RESERVE_MS;
  await verifyOwner(config, pollDeadline);
  await verifyTranscription(config, pollDeadline);
  let last = null; let reads = 0; let stopReason = 'poll_cap';
  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    try {
      const row = await api(config, `/summaries/${config.SUMMARY}`, pollDeadline);
      last = selectSummary(row, config);
      reads++;
      if (last.status === 'completed' || last.status === 'failed') {
        stopReason = 'terminal_status';
        break;
      }
      if (reads === MAX_POLLS) break;
      if (remaining(pollDeadline) <= POLL_DELAY_MS) throw new DeadlineExpired();
      await wait(POLL_DELAY_MS, undefined, { signal: AbortSignal.timeout(remaining(pollDeadline)) });
    } catch (error) {
      if (!(error instanceof DeadlineExpired) && error.name !== 'AbortError') throw error;
      stopReason = 'elapsed_budget';
      break;
    }
  }
  // Recheck the exact source and then its current owner before releasing metadata.
  await verifyTranscription(config, deadline);
  await verifyOwner(config, deadline);
  remaining(deadline);
  const outcome = last?.status === 'completed' ? 'completed' : 'inconclusive';
  console.log(JSON.stringify({ summary: last, outcome, stop_reason: stopReason, successful_polls: reads }, null, 2));
  return outcome === 'completed' ? 0 : 2;
}

try { process.exitCode = await watch(configuration()); }
catch (error) {
  console.error(error instanceof SafeError ? error.message : 'Watcher failed; no conclusive result or metadata was emitted.');
  console.error('No cloud changes were made. Continue GET-only observation with the same IDs; this result does not authorize regeneration.');
  process.exitCode = error instanceof DeadlineExpired ? 2 : 1;
}
