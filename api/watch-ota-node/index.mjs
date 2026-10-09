import { setTimeout as delay } from 'node:timers/promises';

class ExampleError extends Error {}
const fail = (message) => { throw new ExampleError(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const statuses = new Set(['pending', 'delivered', 'applied', 'failed', 'cancelled']);
const terminal = new Set(['applied', 'failed', 'cancelled']);

function configuration() {
  const base = process.env.BOTA_API_BASE_URL ?? 'https://api.bota.dev/v1';
  let url;
  try { url = new URL(base); } catch { fail('Invalid BOTA_API_BASE_URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !['/v1', '/v1/'].includes(url.pathname) || /[\x00-\x20\x7f]/.test(base)) {
    fail('Use a trusted HTTPS API base ending in /v1 without credentials, query or fragment.');
  }
  const key = process.env.BOTA_API_KEY;
  if (typeof key !== 'string' || key.length > 256 ||
      !/^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) || /replace_me/i.test(key)) {
    fail('Configure a server-held project API key with devices:read.');
  }
  const config = { base: `${url.origin}/v1`, key };
  for (const [field, variable, prefix] of [
    ['project', 'BOTA_PROJECT_ID', 'proj'], ['endUser', 'BOTA_END_USER_ID', 'eu'],
    ['device', 'BOTA_DEVICE_ID', 'dev'], ['assignment', 'BOTA_OTA_ASSIGNMENT_ID', 'ota'],
    ['release', 'BOTA_FIRMWARE_RELEASE_ID', 'fw'],
  ]) {
    const value = process.env[variable];
    if (typeof value !== 'string' || !new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value) ||
        /replace_me/i.test(value)) fail(`Configure the fixed expected ${variable}.`);
    config[field] = value;
  }
  return config;
}

function checkProject(value, config) {
  if ('project_id' in value && value.project_id !== config.project) fail('Project identity mismatch.');
}

function checkOwner(device, config) {
  if (!object(device) || device.id !== config.device || device.end_user_id !== config.endUser ||
      device.status !== 'bound' || device.deleted_at != null) fail('Device identity, binding or owner mismatch.');
  checkProject(device, config);
  if (device.binding_generation === undefined) return null;
  if (!Number.isSafeInteger(device.binding_generation) || device.binding_generation < 0) {
    fail('Invalid device binding generation.');
  }
  return device.binding_generation;
}

function timestamp(value) {
  if (typeof value !== 'string' || value.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) ||
      !Number.isFinite(Date.parse(value))) fail('Invalid OTA timestamp.');
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const monthEnd = new Date(0);
  monthEnd.setUTCFullYear(year, month, 0);
  if (month < 1 || month > 12 || day < 1 || day > monthEnd.getUTCDate()) fail('Invalid OTA calendar date.');
  return value;
}

function selectAssignment(response, config) {
  if (!object(response) || !Object.hasOwn(response, 'data')) fail('Invalid latest OTA response.');
  checkProject(response, config);
  if (response.data === null) fail('The expected OTA assignment is missing; stopped without following another assignment.');
  const row = response.data;
  if (!object(row) || row.id !== config.assignment || row.device_id !== config.device ||
      row.firmware_release_id !== config.release) fail('OTA assignment, device or release identity mismatch.');
  checkProject(row, config);
  if (!statuses.has(row.status)) fail('Unknown OTA assignment status.');
  const selected = {
    id: row.id, device_id: row.device_id, firmware_release_id: row.firmware_release_id,
    status: row.status, assigned_at: timestamp(row.assigned_at),
  };
  for (const field of ['delivered_at', 'applied_at']) {
    if (!Object.hasOwn(row, field)) fail('An OTA timestamp field is missing.');
    selected[field] = row[field] === null ? null : timestamp(row[field]);
  }
  return selected;
}

async function getJson(config, path, deadline) {
  const remaining = deadline - performance.now();
  if (remaining <= 0) fail('OTA observation exceeded its five-minute budget.');
  let response;
  try {
    response = await fetch(`${config.base}${path}`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(Math.max(1, Math.ceil(Math.min(10000, remaining)))),
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json', 'Accept-Encoding': 'identity' },
    });
  } catch { fail('OTA observation transport failed; no automatic retry was made.'); }
  if (response.status !== 200 ||
      !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') ||
      !['identity', null].includes(response.headers.get('content-encoding'))) {
    await response.body?.cancel();
    fail(`OTA observation rejected the HTTP ${response.status} response.`);
  }
  const reader = response.body?.getReader();
  if (!reader) fail('Empty OTA observation response.');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256 * 1024) {
        await reader.cancel();
        fail('OTA observation response exceeded the 256 KiB limit.');
      }
      chunks.push(value);
    }
    if (performance.now() >= deadline) fail('OTA observation exceeded its five-minute budget.');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    if (error instanceof ExampleError) throw error;
    fail('OTA observation could not be read as bounded UTF-8 JSON.');
  } finally { reader.releaseLock(); }
}

async function main() {
  const config = configuration();
  const deadline = performance.now() + 5 * 60 * 1000;
  const devicePath = `/devices/${config.device}`;
  const originalGeneration = checkOwner(await getJson(config, devicePath, deadline), config);
  for (let observations = 1; observations <= 150; observations++) {
    const before = checkOwner(await getJson(config, devicePath, deadline), config);
    if (before !== originalGeneration) fail('Device binding changed between observations.');
    const selected = selectAssignment(await getJson(config, `${devicePath}/ota`, deadline), config);
    const after = checkOwner(await getJson(config, devicePath, deadline), config);
    if (after !== originalGeneration) fail('Device binding changed between observations.');
    if (performance.now() >= deadline) fail('OTA observation exceeded its five-minute budget.');
    if (terminal.has(selected.status)) {
      // These separate owner reads cannot prove historical authorization or atomic ownership.
      console.log(JSON.stringify({
        data: selected, evidence: 'backend_assignment_report', observations,
        observed_at: new Date().toISOString(), historical_owner_verified: false,
        atomic_snapshot: false, physical_installation_verified: false,
      }, null, 2));
      if (selected.status !== 'applied') {
        console.error('The expected OTA assignment has a backend-reported failed or cancelled outcome.');
        process.exitCode = 1;
      }
      return;
    }
    if (observations === 150 || deadline - performance.now() <= 2000) {
      fail('The expected OTA assignment did not reach a terminal status within the observation bounds.');
    }
    await delay(2000);
  }
}

main().catch((error) => {
  console.error(error instanceof ExampleError ? error.message : 'Local OTA observation failed.');
  process.exitCode = 1;
});
