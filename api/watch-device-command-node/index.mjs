import { setTimeout as delay } from 'node:timers/promises';

class ExampleError extends Error {}
class BudgetError extends ExampleError {}
const fail = (message) => { throw new ExampleError(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const types = new Set(['start_recording', 'stop_recording', 'trigger_upload']);
const statuses = new Set(['pending', 'delivered', 'executed', 'failed', 'expired', 'cancelled']);
const terminal = new Set(['executed', 'failed', 'expired', 'cancelled']);
const MAX_OBSERVATIONS = 30;
const INTERVAL_MS = 2000;
const BUDGET_MS = 90000;

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
    fail('Configure a server-held project key with devices:read.');
  }
  const config = { base: `${url.origin}/v1`, key };
  for (const [field, variable, prefix] of [
    ['project', 'BOTA_PROJECT_ID', 'proj'], ['endUser', 'BOTA_END_USER_ID', 'eu'],
    ['device', 'BOTA_DEVICE_ID', 'dev'], ['command', 'BOTA_COMMAND_ID', 'cmd'],
  ]) {
    const value = process.env[variable];
    if (typeof value !== 'string' || !new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value) ||
        /replace_me/i.test(value)) fail(`Configure the fixed expected ${variable}.`);
    config[field] = value;
  }
  return config;
}

function checkProject(row, config) {
  if (Object.hasOwn(row, 'project_id') && row.project_id !== config.project) {
    fail('Project identity mismatch.');
  }
  if (Object.hasOwn(row, 'deleted_at') && row.deleted_at !== null) fail('Unexpected deletion marker.');
}

function checkOwner(row, config) {
  if (!object(row) || row.id !== config.device || row.end_user_id !== config.endUser ||
      row.status !== 'bound') fail('Device identity, binding or owner mismatch.');
  checkProject(row, config);
  if (!Object.hasOwn(row, 'binding_generation')) return null;
  if (!Number.isSafeInteger(row.binding_generation) || row.binding_generation < 0) {
    fail('Invalid device binding generation.');
  }
  return row.binding_generation;
}

function selectCommand(row, config, originalType) {
  // The reviewed backend does not compare the route's device ID with the command.
  if (!object(row) || row.id !== config.command || row.device_id !== config.device) {
    fail('Command or target device identity mismatch.');
  }
  checkProject(row, config);
  if (!types.has(row.type) || !statuses.has(row.status)) fail('Unsupported command type or status.');
  if (originalType !== undefined && row.type !== originalType) fail('Command type changed.');
  return { id: row.id, device_id: row.device_id, type: row.type, status: row.status };
}

function checkBudget(deadline) {
  const remaining = deadline - performance.now();
  if (remaining <= 0) throw new BudgetError('Observation deadline reached.');
  return remaining;
}

async function getJson(config, path, deadline, budgetSignal) {
  const remaining = checkBudget(deadline);
  const signal = AbortSignal.any([
    budgetSignal, AbortSignal.timeout(Math.max(1, Math.ceil(Math.min(10000, remaining)))),
  ]);
  let response;
  try {
    response = await fetch(`${config.base}${path}`, {
      method: 'GET', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json', 'Accept-Encoding': 'identity' },
    });
  } catch {
    checkBudget(deadline);
    fail('Command observation transport failed; no automatic retry was made.');
  }
  if (response.status !== 200 ||
      !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') ||
      ![null, 'identity'].includes(response.headers.get('content-encoding'))) {
    await response.body?.cancel();
    fail(`Command observation rejected the HTTP ${response.status} response.`);
  }
  const reader = response.body?.getReader();
  if (!reader) fail('Empty command observation response.');
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024 * 1024) {
        await reader.cancel();
        fail('Command observation response exceeded 1 MiB.');
      }
      chunks.push(value);
    }
    checkBudget(deadline);
    const row = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    checkBudget(deadline);
    return row;
  } catch (error) {
    if (error instanceof ExampleError) throw error;
    checkBudget(deadline);
    fail('Command observation could not be read as bounded UTF-8 JSON.');
  } finally { reader.releaseLock(); }
}

function report(observation, reason) {
  console.log(JSON.stringify({
    data: observation?.data ?? null,
    observations: observation?.number ?? 0,
    observed_at: observation?.observedAt ?? null,
    stopped_by: reason,
    evidence: 'backend_command_report',
    historical_owner_verified: false,
    atomic_snapshot: false,
    physical_execution_verified: false,
    upload_completion_verified: false,
  }, null, 2));
}

async function main() {
  const config = configuration();
  const deadline = performance.now() + BUDGET_MS;
  const budgetSignal = AbortSignal.timeout(BUDGET_MS);
  const devicePath = `/devices/${config.device}`;
  let originalGeneration;
  let originalType;
  let observation;
  try {
    for (let number = 1; number <= MAX_OBSERVATIONS; number++) {
      checkBudget(deadline);
      const before = checkOwner(await getJson(config, devicePath, deadline, budgetSignal), config);
      if (number === 1) originalGeneration = before;
      if (before !== originalGeneration) fail('Device binding generation changed or became unavailable.');
      const selected = selectCommand(
        await getJson(config, `${devicePath}/commands/${config.command}`, deadline, budgetSignal),
        config, originalType,
      );
      const after = checkOwner(await getJson(config, devicePath, deadline, budgetSignal), config);
      if (after !== originalGeneration) fail('Device binding generation changed or became unavailable.');
      checkBudget(deadline);
      originalType = selected.type;
      observation = { data: selected, number, observedAt: new Date().toISOString() };
      if (terminal.has(selected.status)) {
        report(observation, 'terminal_status');
        process.exitCode = selected.status === 'executed' ? 0 : 2;
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
      // Only a previously completed owner-command-owner observation may be reported.
      report(observation, 'deadline');
      process.exitCode = 2;
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof ExampleError ? error.message : 'Local command observation failed.');
  process.exitCode = 1;
});
