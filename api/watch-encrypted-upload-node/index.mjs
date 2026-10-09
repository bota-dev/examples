import { setTimeout as delay } from 'node:timers/promises';

class ExampleError extends Error {}
class BudgetError extends ExampleError {}
const fail = (message) => { throw new ExampleError(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const states = new Set(['created', 'staging', 'staged', 'ready', 'processing', 'published', 'failed', 'cancelled', 'expired']);
const terminal = new Set(['published', 'failed', 'cancelled', 'expired']);
const channels = new Set(['ble', 'wifi', 'cellular']);
const policies = new Set(['legacy_allowed', 'v2_preferred', 'v2_required']);
const MAX_OBSERVATIONS = 30;
const BUDGET_MS = 90000;
const INTERVAL_MS = 2000;

function configuration() {
  const base = process.env.BOTA_API_BASE_URL ?? 'https://api.bota.dev/v1';
  if (/[\\\x00-\x20\x7f]/.test(base)) fail('Invalid API base characters.');
  let url;
  try { url = new URL(base); } catch { fail('Invalid BOTA_API_BASE_URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !['/v1', '/v1/'].includes(url.pathname)) {
    fail('Use a trusted HTTPS API base ending in /v1 without credentials, query or fragment.');
  }
  const key = process.env.BOTA_API_KEY;
  if (typeof key !== 'string' || key.length > 256 ||
      !/^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) || /replace_me/i.test(key)) {
    fail('Configure a server-held project key with the documented recording and device scopes.');
  }
  const config = { base: `${url.origin}/v1`, key };
  for (const [field, variable, prefix] of [
    ['project', 'BOTA_PROJECT_ID', 'proj'], ['endUser', 'BOTA_END_USER_ID', 'eu'],
    ['device', 'BOTA_DEVICE_ID', 'dev'], ['recording', 'BOTA_RECORDING_ID', 'rec'],
  ]) {
    const value = process.env[variable];
    if (typeof value !== 'string' || !new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value) ||
        /replace_me/i.test(value)) fail(`Configure the fixed expected ${variable}.`);
    config[field] = value;
  }
  const session = process.env.BOTA_UPLOAD_SESSION_ID;
  if (typeof session !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(session)) {
    fail('Configure the exact existing BOTA_UPLOAD_SESSION_ID as a canonical lowercase UUID.');
  }
  const revision = process.env.BOTA_UPLOAD_OWNER_REVISION;
  if (typeof revision !== 'string' || !/^[1-9][0-9]{0,9}$/.test(revision) || Number(revision) > 0xffffffff) {
    fail('Configure the known BOTA_UPLOAD_OWNER_REVISION between 1 and 4294967295.');
  }
  return { ...config, session, revision: Number(revision) };
}

function checkProject(row, config) {
  if (Object.hasOwn(row, 'project_id') && row.project_id !== config.project) fail('Project identity mismatch.');
  if (Object.hasOwn(row, 'deleted_at') && row.deleted_at !== null) fail('Unexpected deletion marker.');
}

function checkRecording(row, config) {
  if (!object(row) || row.id !== config.recording || row.device_id !== config.device ||
      row.end_user_id !== config.endUser || row.source !== 'device') fail('Recording source or owner identity mismatch.');
  checkProject(row, config);
}

function checkDevice(row, config) {
  if (!object(row) || row.id !== config.device || row.end_user_id !== config.endUser ||
      row.status !== 'bound') fail('Device identity, binding or owner mismatch.');
  checkProject(row, config);
  if (!Object.hasOwn(row, 'binding_generation')) return null;
  if (!Number.isSafeInteger(row.binding_generation) || row.binding_generation < 0) fail('Invalid device binding generation.');
  return row.binding_generation;
}

function selectSession(row, config, original) {
  if (!object(row) || row.profile !== 'encrypted_upload_v2' || row.session_id !== config.session ||
      !Number.isSafeInteger(row.owner_revision) || row.owner_revision !== config.revision) {
    fail('Session profile, identity or owner revision mismatch.');
  }
  checkProject(row, config);
  for (const [field, expected] of [['recording_id', config.recording], ['device_id', config.device], ['end_user_id', config.endUser]]) {
    if (Object.hasOwn(row, field) && row[field] !== expected) fail('Session scope identity mismatch.');
  }
  if (!states.has(row.state) || !channels.has(row.channel) || !policies.has(row.policy)) fail('Unsupported session state, channel or policy.');
  if (original && (row.channel !== original.channel || row.policy !== original.policy)) fail('Session channel or policy snapshot changed.');
  const selected = { profile: row.profile, session_id: row.session_id, owner_revision: row.owner_revision,
    state: row.state, channel: row.channel, policy: row.policy };
  for (const field of ['expires_at', 'published_at']) {
    if (!Object.hasOwn(row, field)) continue;
    const value = row[field];
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
        !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('Invalid session timestamp.');
    selected[field] = value;
  }
  return selected;
}

function checkBudget(deadline) {
  const remaining = deadline - performance.now();
  if (remaining <= 0) throw new BudgetError('Observation deadline reached.');
  return remaining;
}

function checkFiniteJson(root) {
  const pending = [root];
  while (pending.length) {
    const value = pending.pop();
    if (typeof value === 'number' && !Number.isFinite(value)) fail('Response contained a non-finite JSON number.');
    if (value !== null && typeof value === 'object') {
      for (const child of Object.values(value)) pending.push(child);
    }
  }
}

async function getJson(config, path, deadline, budgetSignal) {
  const remaining = checkBudget(deadline);
  const signal = AbortSignal.any([budgetSignal, AbortSignal.timeout(Math.max(1, Math.ceil(Math.min(10000, remaining))))]);
  let response;
  try {
    response = await fetch(`${config.base}${path}`, {
      method: 'GET', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json', 'Accept-Encoding': 'identity' },
    });
  } catch {
    checkBudget(deadline);
    fail('Upload observation transport failed; no automatic retry was made.');
  }
  if (response.status !== 200 || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') ||
      ![null, 'identity'].includes(response.headers.get('content-encoding'))) {
    await response.body?.cancel();
    fail(`Upload observation rejected the HTTP ${response.status} response.`);
  }
  const reader = response.body?.getReader();
  if (!reader) fail('Empty upload observation response.');
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024 * 1024) {
        await reader.cancel();
        fail('Upload observation response exceeded 1 MiB.');
      }
      chunks.push(value);
    }
    checkBudget(deadline);
    const row = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    checkFiniteJson(row);
    checkBudget(deadline);
    return row;
  } catch (error) {
    if (error instanceof ExampleError) throw error;
    checkBudget(deadline);
    fail('Upload observation could not be read as bounded UTF-8 JSON.');
  } finally { reader.releaseLock(); }
}

function report(observation, reason) {
  console.log(JSON.stringify({
    data: observation?.data ?? null,
    observations: observation?.number ?? 0,
    observed_at: observation?.observedAt ?? null,
    stopped_by: reason,
    evidence: 'backend_encrypted_upload_session_report',
    historical_owner_verified: false,
    atomic_snapshot: false,
    independent_integrity_verified: false,
    signed_receipt_verified: false,
    device_cleanup_authorized: false,
    device_cleanup_verified: false,
  }, null, 2));
}

async function main() {
  const config = configuration();
  const deadline = performance.now() + BUDGET_MS;
  const budgetSignal = AbortSignal.timeout(BUDGET_MS);
  const recordingPath = `/recordings/${config.recording}`;
  const devicePath = `/devices/${config.device}`;
  let originalGeneration;
  let originalSession;
  let observation;
  try {
    for (let number = 1; number <= MAX_OBSERVATIONS; number++) {
      checkBudget(deadline);
      checkRecording(await getJson(config, recordingPath, deadline, budgetSignal), config);
      const before = checkDevice(await getJson(config, devicePath, deadline, budgetSignal), config);
      if (number === 1) originalGeneration = before;
      if (before !== originalGeneration) fail('Device binding generation changed or became unavailable.');
      const selected = selectSession(await getJson(config,
        `${recordingPath}/encrypted-upload-v2/sessions/${config.session}`, deadline, budgetSignal), config, originalSession);
      const after = checkDevice(await getJson(config, devicePath, deadline, budgetSignal), config);
      if (after !== originalGeneration) fail('Device binding generation changed or became unavailable.');
      checkRecording(await getJson(config, recordingPath, deadline, budgetSignal), config);
      checkBudget(deadline);
      originalSession ??= selected;
      observation = { data: selected, number, observedAt: new Date().toISOString() };
      if (terminal.has(selected.state)) {
        report(observation, 'terminal_state');
        process.exitCode = selected.state === 'published' ? 0 : 2;
        return;
      }
      if (number === MAX_OBSERVATIONS) {
        report(observation, 'observation_cap');
        process.exitCode = 2;
        return;
      }
      await delay(Math.min(INTERVAL_MS, checkBudget(deadline)), undefined, { signal: budgetSignal });
    }
  } catch (error) {
    if (error instanceof BudgetError || (budgetSignal.aborted && error?.name === 'AbortError')) {
      // Emit only a complete observation whose session read had both owner gates.
      report(observation, 'deadline');
      process.exitCode = 2;
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof ExampleError ? error.message : 'Local upload observation failed.');
  process.exitCode = 1;
});
