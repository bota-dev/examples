// Observe one end user's connection section between exact identity checks.
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function configuration() {
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  requireValue(major > 22 || (major === 22 && (minor > 23 || (minor === 23 && patch >= 2))),
    'Use Node.js 22.23.2 or newer.');
  const rawBase = process.env.BOTA_API_BASE_URL;
  let base;
  try { base = new URL(rawBase); }
  catch { throw new SafeError('Configure an explicit trusted HTTPS API destination ending in /v1.'); }
  requireValue(typeof rawBase === 'string' && rawBase.length <= 2048 &&
    !/[\x00-\x20\x7f\\?#]/.test(rawBase) && base.protocol === 'https:' &&
    !base.username && !base.password && !base.search && !base.hash && /^\/v1\/?$/.test(base.pathname),
  'Use trusted HTTPS /v1 without URL credentials, query, fragment or controls.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !/replace_me/i.test(key),
  'Configure a server-held project key with end_users:read and config:read.');
  const project = process.env.BOTA_PROJECT_ID;
  const endUser = process.env.BOTA_END_USER_ID;
  requireValue(typeof project === 'string' && /^proj_[A-Za-z0-9]{1,64}$/.test(project) && !/replace_me/i.test(project),
    'Configure the independently verified expected BOTA_PROJECT_ID.');
  requireValue(typeof endUser === 'string' && /^eu_[A-Za-z0-9]{1,64}$/.test(endUser) && !/replace_me/i.test(endUser),
    'Configure the exact authorized existing BOTA_END_USER_ID.');
  return { base: `${base.origin}/v1`, key, project, endUser };
}

function remaining(deadline) {
  const milliseconds = Math.floor(deadline - performance.now());
  requireValue(milliseconds > 0, 'End-user connection read exceeded its elapsed budget.');
  return milliseconds;
}

async function readJson(config, path, deadline) {
  const signal = AbortSignal.timeout(Math.min(10000, remaining(deadline)));
  try {
    const response = await fetch(`${config.base}${path}`, {
      method: 'GET', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', signal,
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json', 'Accept-Encoding': 'identity' },
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new SafeError(`Read returned HTTP ${response.status}; no settings were emitted.`);
    }
    if (!response.body || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') ||
        (response.headers.get('content-encoding') ?? 'identity').trim().toLowerCase() !== 'identity') {
      await response.body?.cancel();
      throw new SafeError('Expected an uncompressed JSON response.');
    }
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      signal.throwIfAborted();
      remaining(deadline);
      size += chunk.length;
      requireValue(size <= 1024 * 1024, 'Response exceeded the 1 MiB example limit.');
      chunks.push(chunk);
    }
    signal.throwIfAborted();
    remaining(deadline);
    let value;
    try {
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), (_key, entry) => {
        if (typeof entry === 'number' && !Number.isFinite(entry)) throw new Error('Non-finite number');
        return entry;
      });
    } catch { throw new SafeError('Response was not valid finite UTF-8 JSON.'); }
    signal.throwIfAborted();
    remaining(deadline);
    return value;
  } catch (error) {
    if (signal.aborted) throw new SafeError('Read exceeded its request budget.');
    if (error instanceof SafeError) throw error;
    throw new SafeError('Transport failed; no automatic retry was made.');
  }
}

function checkMarkers(row, config) {
  requireValue(!Object.hasOwn(row, 'project_id') || row.project_id === config.project,
    'Returned project marker does not match.');
  requireValue(!Object.hasOwn(row, 'deleted_at') || row.deleted_at === null, 'Unexpected deletion marker.');
}

function checkEndUser(row, config) {
  requireValue(object(row) && row.id === config.endUser, 'End-user identity check failed.');
  checkMarkers(row, config);
  const present = Object.hasOwn(row, 'project_assignment_generation');
  const value = present ? row.project_assignment_generation : null;
  requireValue(!present || (Number.isSafeInteger(value) && value >= 0),
    'End-user project assignment generation is invalid.');
  return { present, value };
}

function gates(value, field) {
  requireValue(object(value) && typeof value.wifi === 'boolean' && typeof value.cellular === 'boolean',
    `Resolved ${field} must contain WiFi and cellular booleans.`);
  return { wifi: value.wifi, cellular: value.cellular };
}

function idleTimeout(value, field) {
  requireValue(Number.isSafeInteger(value) && (value === -1 || value === 0 || (value >= 10 && value <= 2540)),
    `Resolved ${field} must be a canonical integer: -1, 0, or 10 through 2540.`);
  return value;
}

function selectConnection(section, config) {
  requireValue(object(section) && object(section.value) && object(section.definition),
    'Expected the direct connection section with value, source and definition.');
  checkMarkers(section, config);
  requireValue(!Object.hasOwn(section, 'end_user_id') || section.end_user_id === config.endUser,
    'Returned end-user marker does not match.');
  requireValue(['default', 'organization', 'project', 'end_user'].includes(section.source) &&
    section.definition.merge_strategy === 'merge_deep', 'Unsupported end-user section source or merge strategy.');
  requireValue((!Object.hasOwn(section, 'section') || section.section === 'connection') &&
    (!Object.hasOwn(section.definition, 'section') || section.definition.section === 'connection'),
  'Unexpected section identity marker.');
  const value = section.value;
  requireValue(Array.isArray(value.upload_network_preference) && value.upload_network_preference.length >= 1 &&
    value.upload_network_preference.length <= 3 &&
    value.upload_network_preference.every(entry => ['wifi', 'ble', 'cellular'].includes(entry)),
  'Resolved upload_network_preference must contain one to three documented connection types.');
  requireValue(object(value.power_management), 'Resolved power_management must be an object.');
  return { selected_connection: {
    enabled_connections: gates(value.enabled_connections, 'enabled_connections'),
    heartbeat_enabled_connections: gates(value.heartbeat_enabled_connections, 'heartbeat_enabled_connections'),
    upload_network_preference: [...value.upload_network_preference],
    power_management: {
      wifi_idle_timeout_seconds: idleTimeout(value.power_management.wifi_idle_timeout_seconds, 'wifi_idle_timeout_seconds'),
      cellular_idle_timeout_seconds: idleTimeout(value.power_management.cellular_idle_timeout_seconds, 'cellular_idle_timeout_seconds'),
    },
  }, source: section.source };
}

async function main() {
  const config = configuration();
  const deadline = performance.now() + 30000;
  const path = `/end-users/${config.endUser}`;
  const before = checkEndUser(await readJson(config, path, deadline), config);
  const selected = selectConnection(await readJson(config, `${path}/config/connection`, deadline), config);
  const after = checkEndUser(await readJson(config, path, deadline), config);
  requireValue(before.present === after.present && before.value === after.value,
    'End-user project assignment generation changed or appeared/disappeared between reads.');
  remaining(deadline);
  console.log(JSON.stringify({ ...selected, resolution_level: 'end_user',
    source_meaning: 'last_section_override_level; not per-field provenance',
    evidence: 'resolved_cloud_end_user_configuration', assignment_generation_observed: before.present,
    includes_device_overrides: false, atomic_snapshot: false,
    effective_device_configuration_verified: false, device_applied_state_verified: false,
    applied_generation_verified: false, physical_connection_availability_verified: false,
    heartbeat_delivery_verified: false, connection_policy_enforcement_verified: false,
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof SafeError ? error.message : 'End-user connection read failed; no settings were emitted.');
  process.exitCode = 1;
});
