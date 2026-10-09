// Cloud status is a reported snapshot, not evidence of a current hardware connection.
class ExampleError extends Error {}
const fail = (message) => { throw new ExampleError(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value, prefix) => typeof value === 'string' &&
  new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);

function configuration() {
  let url;
  try { url = new URL(process.env.BOTA_API_ORIGIN ?? 'https://api.bota.dev'); }
  catch { fail('Invalid BOTA_API_ORIGIN.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback))) {
    fail('Use an HTTPS origin, or HTTP on explicit loopback, without paths or credentials.');
  }
  const key = process.env.BOTA_API_KEY;
  if (!key || !/^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) || key.includes('REPLACE_ME')) {
    fail('Configure a server-held project API key with devices:read.');
  }
  const endUser = process.env.BOTA_END_USER_ID;
  const device = process.env.BOTA_DEVICE_ID;
  if (!id(endUser, 'eu') || !id(device, 'dev') ||
      endUser.includes('REPLACE_ME') || device.includes('REPLACE_ME')) {
    fail('Configure fixed end-user and device identifiers.');
  }
  return { origin: url.origin, key, endUser, device };
}

function client(config) {
  const deadline = Date.now() + 30000;
  return async (path) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) fail('Status request deadline exceeded.');
    let response;
    try {
      response = await fetch(`${config.origin}/v1${path}`, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(remaining),
        headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json' },
      });
    } catch { fail('Device status transport failed.'); }
    if (response.status !== 200) {
      await response.body?.cancel();
      fail(`Device status returned HTTP ${response.status}.`);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel();
      fail('Expected a JSON device response.');
    }
    const reader = response.body?.getReader();
    if (!reader) fail('Empty device response.');
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 256 * 1024) {
          await reader.cancel();
          fail('Device response exceeded the 256 KiB example limit.');
        }
        chunks.push(value);
      }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    } catch (error) {
      if (error instanceof ExampleError) throw error;
      fail('Device response could not be read as bounded UTF-8 JSON.');
    } finally { reader.releaseLock(); }
  };
}

function generation(value) {
  if (value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 0) fail('Invalid binding generation.');
  return value;
}

function checkOwner(device, config) {
  if (!object(device) || device.id !== config.device ||
      device.end_user_id !== config.endUser || device.status !== 'bound') {
    fail('Device identity, binding or owner mismatch.');
  }
  return generation(device.binding_generation);
}

function number(value, field, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    fail(`Invalid reported ${field}.`);
  }
  return value;
}

function timestamp(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
      !Number.isFinite(Date.parse(value))) fail('Invalid reported timestamp.');
  return value;
}

function snapshot(state, config, now) {
  if (!object(state) || state.device_id !== config.device) fail('Device state identity mismatch.');
  const raw = state.recording_state;
  if (raw !== undefined && raw !== null && !object(raw)) fail('Invalid reported recording state.');
  const recording = raw ?? {};
  const lastHeartbeat = timestamp(state.last_heartbeat_at);
  const elapsed = lastHeartbeat === null ? null : now - Date.parse(lastHeartbeat);
  const reportAge = elapsed === null || elapsed < 0 ? null : Math.floor(elapsed / 1000);
  const freshness = elapsed === null ? 'not_reported' : elapsed < 0 ? 'future_timestamp' :
    elapsed < 15 * 60 * 1000 ? 'recent_report' : 'stale_report';
  const pending = number(recording.pending_recordings, 'pending recordings');
  if (pending !== null && !Number.isSafeInteger(pending)) fail('Invalid reported pending recordings.');
  const used = number(state.storage_used_mb, 'storage used');
  const total = number(state.storage_total_mb, 'storage total');
  if (used !== null && total !== null && used > total) fail('Reported storage used exceeds total.');
  const knownChannel = ['bluetooth', 'ble', 'wifi', 'cellular', '4g', 'lte'];
  return {
    device_id: config.device,
    observed_at: new Date(now).toISOString(),
    evidence: 'cloud_reported_snapshot',
    last_heartbeat_at: lastHeartbeat,
    heartbeat_age_seconds: reportAge,
    heartbeat_freshness: freshness,
    battery_percent: number(state.battery_percent, 'battery', 100),
    storage_used_mb: used,
    storage_total_mb: total,
    reported_device_state: ['idle', 'recording', 'syncing'].includes(recording.device_state) ?
      recording.device_state : 'unknown',
    reported_pending_recordings: pending,
    last_synced_at: timestamp(state.last_synced_at),
    last_seen_by: knownChannel.includes(state.last_seen_by) ? state.last_seen_by : null,
    last_synced_by: knownChannel.includes(state.last_synced_by) ? state.last_synced_by : null,
  };
}

async function main() {
  const config = configuration();
  const get = client(config);
  const before = checkOwner(await get(`/devices/${config.device}`), config);
  const state = await get(`/devices/${config.device}/state`);
  const selected = snapshot(state, config, Date.now());
  const stateGeneration = generation(state.binding_generation);
  const after = checkOwner(await get(`/devices/${config.device}`), config);
  if (before !== after ||
      (before !== null && stateGeneration !== null && before !== stateGeneration)) {
    fail('Device binding changed between reads.');
  }
  // Separate HTTP reads cannot guarantee atomic ownership; see the README.
  console.log(JSON.stringify(selected, null, 2));
}

main().catch((error) => {
  console.error(error instanceof ExampleError ? error.message : 'Local status operation failed.');
  process.exitCode = 1;
});
