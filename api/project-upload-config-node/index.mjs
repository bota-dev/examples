// Observe project-level upload intent only; do not apply child overrides locally.
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
    !/[\x00-\x20\x7f\\]/.test(rawBase) && base.protocol === 'https:' &&
    !base.username && !base.password && !base.search && !base.hash && /^\/v1\/?$/.test(base.pathname),
  'Use trusted HTTPS /v1 without URL credentials, query, fragment or controls.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !/replace_me/i.test(key),
  'Configure a server-held project key with config:read.');
  const project = process.env.BOTA_PROJECT_ID;
  requireValue(typeof project === 'string' && /^proj_[A-Za-z0-9]{1,64}$/.test(project) && !/replace_me/i.test(project),
    'Configure the independently verified expected BOTA_PROJECT_ID.');
  return { base: `${base.origin}/v1`, key, project };
}

function remaining(deadline) {
  const milliseconds = Math.floor(deadline - performance.now());
  requireValue(milliseconds > 0, 'Project upload read exceeded its elapsed budget.');
  return milliseconds;
}

async function readUpload(config, deadline) {
  const signal = AbortSignal.timeout(Math.min(10000, remaining(deadline)));
  try {
    const response = await fetch(`${config.base}/config/upload`, {
      method: 'GET', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', signal,
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json', 'Accept-Encoding': 'identity' },
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new SafeError(`Configuration read returned HTTP ${response.status}; no settings were emitted.`);
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
      requireValue(size <= 1024 * 1024, 'Configuration response exceeded the 1 MiB example limit.');
      chunks.push(chunk);
    }
    signal.throwIfAborted();
    remaining(deadline);
    let section;
    try {
      section = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), (_key, value) => {
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite number');
        return value;
      });
    } catch { throw new SafeError('Configuration response was not valid finite UTF-8 JSON.'); }
    signal.throwIfAborted();
    remaining(deadline);
    return section;
  } catch (error) {
    if (signal.aborted) throw new SafeError('Configuration read exceeded its request budget.');
    if (error instanceof SafeError) throw error;
    throw new SafeError('Configuration transport failed; no automatic retry was made.');
  }
}

function integer(value, field, minimum, maximum) {
  requireValue(Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    `Resolved ${field} must be an integer in the documented range.`);
  return value;
}

function selectUpload(section, config) {
  requireValue(object(section) && object(section.value) && object(section.definition),
    'Expected the direct upload section with value, source and definition.');
  requireValue(['default', 'organization', 'project'].includes(section.source) &&
    section.definition.merge_strategy === 'merge_deep', 'Unsupported project section source or merge strategy.');
  requireValue(!Object.hasOwn(section, 'project_id') || section.project_id === config.project,
    'Returned project marker does not match.');
  requireValue(!Object.hasOwn(section, 'deleted_at') || section.deleted_at === null, 'Unexpected deletion marker.');
  requireValue((!Object.hasOwn(section, 'section') || section.section === 'upload') &&
    (!Object.hasOwn(section.definition, 'section') || section.definition.section === 'upload'),
  'Unexpected section identity marker.');
  const value = section.value;
  requireValue(typeof value.streaming_enabled === 'boolean', 'Resolved streaming_enabled must be a boolean.');
  return { selected_upload: {
    streaming_enabled: value.streaming_enabled,
    streaming_chunk_kb: integer(value.streaming_chunk_kb, 'streaming_chunk_kb', 64, 1024),
    streaming_flush_interval_seconds: integer(value.streaming_flush_interval_seconds, 'streaming_flush_interval_seconds', 0, 255),
    daily_data_limit_mb: integer(value.daily_data_limit_mb, 'daily_data_limit_mb', 0, 10000),
  }, source: section.source, resolution_level: 'project',
  source_meaning: 'last_section_override_level; not per-field provenance',
  evidence: 'resolved_cloud_configuration', expected_project_marker_present: Object.hasOwn(section, 'project_id'),
  effective_device_configuration_verified: false, device_applied_state_verified: false,
  upload_execution_verified: false, upload_timing_verified: false, data_limit_enforcement_verified: false };
}

async function main() {
  const config = configuration();
  const deadline = performance.now() + 30000;
  const selected = selectUpload(await readUpload(config, deadline), config);
  remaining(deadline);
  console.log(JSON.stringify(selected, null, 2));
}

main().catch(error => {
  console.error(error instanceof SafeError ? error.message : 'Project upload read failed; no settings were emitted.');
  process.exitCode = 1;
});
