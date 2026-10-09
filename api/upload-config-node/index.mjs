// Observe resolved cloud upload settings for one configured, currently owned device.
const MAX_RESPONSE_BYTES = 1024 * 1024;
const SOURCES = new Set(['default', 'organization', 'project', 'end_user', 'device']);
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
  catch { throw new SafeError('Configure an explicit HTTPS API destination ending in /v1.'); }
  requireValue(typeof rawBase === 'string' && !/[\x00-\x20\x7f\\]/.test(rawBase) &&
    base.protocol === 'https:' && !base.username && !base.password && !base.search &&
    !base.hash && /^\/v1\/?$/.test(base.pathname),
  'Use a fixed HTTPS API destination with path /v1 and no URL credentials/query/fragment.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    !/[\x00-\x20\x7f]/.test(key) && /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) &&
    !key.toLowerCase().includes('replace_me'),
  'Configure a server-held project key with devices:read and config:read.');
  const ids = {};
  for (const [name, prefix] of [['PROJECT', 'proj'], ['END_USER', 'eu'], ['DEVICE', 'dev']]) {
    const value = process.env[`BOTA_${name}_ID`];
    requireValue(typeof value === 'string' && !/[\x00-\x20\x7f]/.test(value) &&
      new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value) &&
      !value.toLowerCase().includes('replace_me'), `Configure the exact authorized BOTA_${name}_ID.`);
    ids[name] = value;
  }
  return { base: base.href.replace(/\/$/, ''), key, ...ids };
}

function remaining(deadline) {
  const milliseconds = Math.floor(deadline - performance.now());
  requireValue(milliseconds > 0, 'Upload configuration read exceeded its elapsed-time budget.');
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
      throw new SafeError(`API read returned HTTP ${response.status}; no configuration was emitted.`);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') ||
      !response.body || (response.headers.get('content-encoding') ?? 'identity').trim().toLowerCase() !== 'identity') {
      await response.body?.cancel();
      throw new SafeError('Expected an uncompressed JSON API response.');
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
    if (signal.aborted) throw new SafeError('API read timed out; no configuration was emitted.');
    if (error instanceof SafeError) throw error;
    throw new SafeError('API transport failed; no automatic retry was made.');
  }
}

function checkProject(row, config) {
  requireValue(!('project_id' in row) || row.project_id === config.PROJECT,
    'Returned project identity does not match the configured project.');
}

function checkOwner(row, config) {
  requireValue(object(row) && row.id === config.DEVICE && row.end_user_id === config.END_USER &&
    row.status === 'bound' && (!('deleted_at' in row) || row.deleted_at === null),
  'Device identity, binding, deletion or configured ownership does not match.');
  checkProject(row, config);
  if (!('binding_generation' in row)) return null;
  requireValue(Number.isSafeInteger(row.binding_generation) && row.binding_generation >= 0,
    'Returned binding generation is invalid.');
  return row.binding_generation;
}

function boolean(value, field) {
  requireValue(typeof value === 'boolean', `Resolved ${field} must be a boolean.`);
  return value;
}

function integer(value, field, minimum, maximum) {
  requireValue(Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    `Resolved ${field} must be an integer in the documented range.`);
  return value;
}

function offPeak(value) {
  if (value === null) return null;
  requireValue(object(value), 'Resolved off_peak_hours must be an object or null.');
  const time = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  requireValue(typeof value.start === 'string' && value.start.length === 5 && time.test(value.start) &&
    typeof value.end === 'string' && value.end.length === 5 && time.test(value.end),
  'Resolved off-peak times must use valid HH:MM values.');
  requireValue(typeof value.timezone === 'string' && value.timezone.length <= 64 &&
    !/[\x00-\x20\x7f]/.test(value.timezone) &&
    /^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/.test(value.timezone),
  'Resolved timezone must be a bounded ASCII identifier for safe metadata output.');
  return { enabled: boolean(value.enabled, 'off_peak_hours.enabled'),
    start: value.start, end: value.end, timezone: value.timezone };
}

function selectUpload(section, config) {
  requireValue(object(section) && object(section.value) && object(section.definition),
    'The resolved upload section response is invalid.');
  checkProject(section, config);
  requireValue(SOURCES.has(section.source) && section.definition.merge_strategy === 'merge_deep',
    'The upload section source or merge strategy is unsupported.');
  const value = section.value;
  return {
    selected_upload: {
      streaming_enabled: boolean(value.streaming_enabled, 'streaming_enabled'),
      streaming_chunk_kb: integer(value.streaming_chunk_kb, 'streaming_chunk_kb', 64, 1024),
      streaming_flush_interval_seconds: integer(value.streaming_flush_interval_seconds, 'streaming_flush_interval_seconds', 0, 255),
      daily_data_limit_mb: integer(value.daily_data_limit_mb, 'daily_data_limit_mb', 0, 10000),
      allow_roaming: boolean(value.allow_roaming, 'allow_roaming'),
      pause_on_low_battery: boolean(value.pause_on_low_battery, 'pause_on_low_battery'),
      off_peak_hours: offPeak(value.off_peak_hours),
    },
    source: section.source,
    source_meaning: 'last_section_override_level; not per-field provenance',
  };
}

async function main() {
  const config = configuration();
  const deadline = performance.now() + 30_000;
  const path = `/devices/${config.DEVICE}`;
  const before = checkOwner(await api(config, path, deadline), config);
  const selected = selectUpload(await api(config, `${path}/config/upload`, deadline), config);
  const after = checkOwner(await api(config, path, deadline), config);
  requireValue(before === after, 'Device binding generation changed between reads.');
  remaining(deadline);
  console.log(JSON.stringify({ device_id: config.DEVICE, ...selected,
    evidence: 'resolved_cloud_configuration', atomic_snapshot: false,
    device_applied_state_verified: false, upload_execution_verified: false }, null, 2));
}

main().catch(error => {
  console.error(error instanceof SafeError ? error.message : 'Upload configuration read failed; no configuration was emitted.');
  process.exitCode = 1;
});
