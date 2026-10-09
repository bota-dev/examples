// Observe project-level resolution only; enabled intent is not job execution.
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const FEATURES = ['auto_transcription', 'auto_summary', 'auto_embedding', 'auto_enhancement'];

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
  'Use a trusted HTTPS /v1 destination without URL credentials, query or fragment.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !key.toLowerCase().includes('replace_me'),
  'Configure a server-held project key with config:read.');
  const project = process.env.BOTA_PROJECT_ID;
  requireValue(typeof project === 'string' && /^proj_[A-Za-z0-9]{1,64}$/.test(project) &&
    !project.toLowerCase().includes('replace_me'), 'Configure the expected BOTA_PROJECT_ID.');
  return { base: base.href.replace(/\/$/, ''), key, project };
}

async function readProcessing(config) {
  const signal = AbortSignal.timeout(10_000);
  try {
    const response = await fetch(`${config.base}/config/processing`, {
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
      size += chunk.length;
      requireValue(size <= 1024 * 1024, 'Configuration response exceeded the 1 MiB example limit.');
      chunks.push(chunk);
    }
    signal.throwIfAborted();
    let section;
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
      section = JSON.parse(text, (_key, value) => {
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite number');
        return value;
      });
    } catch { throw new SafeError('Configuration response was not valid finite UTF-8 JSON.'); }
    signal.throwIfAborted();
    return section;
  } catch (error) {
    if (signal.aborted) throw new SafeError('Configuration read exceeded its 10-second budget.');
    if (error instanceof SafeError) throw error;
    throw new SafeError('Configuration transport failed; no automatic retry was made.');
  }
}

function selectProcessing(section, config) {
  requireValue(object(section) && object(section.value) && object(section.definition),
    'Expected the direct processing section with value, source and definition.');
  requireValue(['default', 'organization', 'project'].includes(section.source) &&
    section.definition.merge_strategy === 'merge_deep', 'Unsupported project section source or merge strategy.');
  requireValue(!('project_id' in section) || section.project_id === config.project,
    'Returned project marker does not match the configured project.');
  requireValue(!('deleted_at' in section) || section.deleted_at === null,
    'Configuration response has a deletion marker.');
  const selected = {};
  for (const feature of FEATURES) {
    requireValue(object(section.value[feature]) && typeof section.value[feature].enabled === 'boolean',
      `Resolved ${feature}.enabled must be a boolean.`);
    selected[feature] = { enabled: section.value[feature].enabled };
  }
  return { selected_processing: selected, source: section.source,
    source_meaning: 'last_section_override_level; not per-field provenance',
    resolution_level: 'project', evidence: 'resolved_cloud_configuration', atomic_snapshot: false,
    expected_project_marker_present: 'project_id' in section,
    provider_approval_verified: false, provider_credentials_verified: false,
    job_creation_verified: false, job_completion_verified: false,
    effective_device_configuration_verified: false, device_applied_state_verified: false };
}

async function main() {
  const config = configuration();
  console.log(JSON.stringify(selectProcessing(await readProcessing(config), config), null, 2));
}

main().catch(error => {
  console.error(error instanceof SafeError ? error.message : 'Project configuration read failed; no settings were emitted.');
  process.exitCode = 1;
});
