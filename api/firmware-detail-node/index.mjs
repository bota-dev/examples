const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_BUDGET_MS = 10_000;
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function configuration() {
  const rawBase = process.env.BOTA_API_BASE_URL;
  let base;
  try { base = new URL(rawBase); }
  catch { throw new SafeError('Configure an explicit trusted HTTPS API origin ending in /v1.'); }
  requireValue(typeof rawBase === 'string' && rawBase.length <= 2048 &&
    !/[\\\x00-\x20\x7f]/.test(rawBase) && base.protocol === 'https:' && !base.username &&
    !base.password && !base.search && !base.hash && /^\/v1\/?$/.test(base.pathname),
  'Use a fixed HTTPS API origin, path /v1 and no URL credentials/query/fragment.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !key.toLowerCase().includes('replace_me'),
  'Configure a server-held key for the intended project with devices:read.');
  const ids = {};
  for (const [name, prefix] of [['PROJECT', 'proj'], ['FIRMWARE_RELEASE', 'fw']]) {
    const value = process.env[`BOTA_${name}_ID`];
    requireValue(typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value),
      `Configure the exact authorized BOTA_${name}_ID.`);
    ids[name] = value;
  }
  return { base: base.href.replace(/\/$/, ''), key, ...ids };
}

async function readRelease(config) {
  const signal = AbortSignal.timeout(REQUEST_BUDGET_MS);
  let reader;
  try {
    const response = await fetch(`${config.base}/firmware-releases/${config.FIRMWARE_RELEASE}`, {
      method: 'GET', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', signal,
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json', 'Accept-Encoding': 'identity' },
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new SafeError(`API read returned HTTP ${response.status}; no metadata emitted.`);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') ||
      !response.body || (response.headers.get('content-encoding') ?? 'identity').trim().toLowerCase() !== 'identity') {
      await response.body?.cancel();
      throw new SafeError('Expected an uncompressed JSON API response.');
    }
    reader = response.body.getReader();
    const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.length;
      requireValue(size <= MAX_RESPONSE_BYTES, 'API response exceeds the 1 MiB example limit.');
      chunks.push(value);
    }
    let row;
    try { row = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new SafeError('The API returned invalid UTF-8 JSON.'); }
    signal.throwIfAborted();
    return row;
  } catch (error) {
    if (signal.aborted) throw new SafeError('API read timed out; no metadata emitted.');
    if (error instanceof SafeError) throw error;
    throw new SafeError('API transport failed; no metadata emitted or automatic retry made.');
  } finally {
    if (reader) {
      try { await reader.cancel(); } catch {}
      reader.releaseLock();
    }
  }
}

function selectedMetadata(row, config) {
  requireValue(object(row) && row.id === config.FIRMWARE_RELEASE && row.is_released === true &&
    (!('project_id' in row) || row.project_id === config.PROJECT),
  'Release identity, published status or configured project mismatch.');
  requireValue(typeof row.version === 'string' && row.version.length >= 1 && row.version.length <= 128 &&
    !/[\x00-\x1f\x7f-\x9f]/.test(row.version), 'The release contains an invalid version string.');
  const selected = { id: row.id, version: row.version, is_released: true };
  for (const artifact of ['bin', 'ufw']) {
    const hashField = `${artifact}_sha256`;
    const sizeField = `${artifact}_file_size_bytes`;
    requireValue(typeof row[hashField] === 'string' && /^[a-f0-9]{64}$/i.test(row[hashField]) &&
      Number.isSafeInteger(row[sizeField]) && row[sizeField] > 0,
    'The release contains invalid declared artifact metadata.');
    selected[hashField] = row[hashField];
    selected[sizeField] = row[sizeField];
  }
  if ('release_sequence' in row) {
    requireValue(Number.isSafeInteger(row.release_sequence) && row.release_sequence > 0 &&
      typeof row.allow_downgrade === 'boolean', 'The release contains invalid sequence/downgrade metadata.');
    selected.release_sequence = row.release_sequence;
    selected.allow_downgrade = row.allow_downgrade;
  } else {
    requireValue(!('allow_downgrade' in row), 'Downgrade metadata has no release sequence.');
  }
  return selected;
}

try {
  const config = configuration();
  const release = selectedMetadata(await readRelease(config), config);
  console.log(JSON.stringify({ release, declared_metadata_only: true }, null, 2));
} catch (error) {
  console.error(error instanceof SafeError ? error.message : 'Firmware detail read failed; no metadata emitted.');
  process.exitCode = 1;
}
