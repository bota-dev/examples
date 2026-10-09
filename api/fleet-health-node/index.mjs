const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function configuration() {
  const rawBase = process.env.BOTA_API_BASE_URL;
  let base;
  try { base = new URL(rawBase); }
  catch { throw new SafeError('Configure an explicit trusted HTTPS API origin ending in /v1.'); }
  requireValue(typeof rawBase === 'string' && !/[\x00-\x20\x7f]/.test(rawBase) &&
    base.protocol === 'https:' && !base.username && !base.password && !base.search &&
    !base.hash && /^\/v1\/?$/.test(base.pathname),
  'Use a fixed trusted HTTPS API origin, path /v1 and no URL credentials/query/fragment.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !key.toLowerCase().includes('replace_me'),
  'Configure a server-held project key with devices:read.');
  const project = process.env.BOTA_PROJECT_ID;
  requireValue(typeof project === 'string' && /^proj_[A-Za-z0-9]{1,64}$/.test(project) &&
    !project.toLowerCase().includes('replace_me'), 'Configure the exact authorized BOTA_PROJECT_ID.');
  return { base: base.href.replace(/\/$/, ''), key, project };
}

async function readStats(config) {
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.base}/devices/stats`, {
      method: 'GET', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', signal,
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json', 'Accept-Encoding': 'identity' },
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new SafeError(`Fleet read returned HTTP ${response.status}; no counts emitted.`);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') ||
      !response.body || (response.headers.get('content-encoding') ?? 'identity').trim().toLowerCase() !== 'identity') {
      await response.body?.cancel();
      throw new SafeError('Expected an uncompressed JSON fleet response.');
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      signal.throwIfAborted();
      size += chunk.length;
      requireValue(size <= MAX_RESPONSE_BYTES, 'Fleet response exceeds the 1 MiB example limit.');
      chunks.push(chunk);
    }
    signal.throwIfAborted();
    let row;
    try { row = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new SafeError('Fleet response is not valid UTF-8 JSON.'); }
    signal.throwIfAborted();
    return row;
  } catch (error) {
    if (signal.aborted) throw new SafeError('Fleet read timed out; no counts emitted and no retry made.');
    if (error instanceof SafeError) throw error;
    throw new SafeError('Fleet read transport failed; no counts emitted and no retry made.');
  }
}

function selectCounts(row, config) {
  requireValue(object(row) && (!('project_id' in row) || row.project_id === config.project),
    'Fleet response has an invalid shape or contradicts the expected project.');
  const counts = {};
  for (const field of ['online_count', 'low_battery_count', 'storage_full_count']) {
    requireValue(Number.isSafeInteger(row[field]) && row[field] >= 0,
      `Fleet ${field} must be a finite nonnegative safe integer.`);
    counts[field] = row[field];
  }
  // Device rows and arbitrary API fields are deliberately excluded from output.
  return {
    expected_project_id: config.project,
    observed_at: new Date().toISOString(),
    evidence: 'backend_reported_counts',
    project_scope_evidence: 'project_id' in row ? 'authenticated_key_and_matching_response' : 'authenticated_project_key',
    physical_reachability_evidence: 'not_verified',
    atomic_fleet_audit_evidence: 'not_established',
    counts,
  };
}

try {
  const config = configuration();
  const selected = selectCounts(await readStats(config), config);
  console.log(JSON.stringify(selected, null, 2));
} catch (error) {
  console.error(error instanceof SafeError ? error.message : 'Fleet read failed; no counts emitted.');
  process.exitCode = 1;
}
