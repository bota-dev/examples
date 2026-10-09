// One owned-device inventory selection. Pagination compatibility is documented in README.
class ExampleError extends Error {}
const fail = (message) => { throw new ExampleError(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value, prefix) => typeof value === 'string' &&
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
  if (!key || key.length > 256 || !/^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) ||
      key.toLowerCase().includes('replace_me')) fail('Configure a server-held project key with devices:read.');
  const owner = process.env.BOTA_END_USER_ID;
  if (!identifier(owner, 'eu')) fail('Configure the fixed authorized end-user identifier.');
  const limit = process.env.BOTA_LIMIT ?? '25';
  if (!/^[1-9][0-9]{0,2}$/.test(limit) || Number(limit) > 100) {
    fail('BOTA_LIMIT must be an integer from 1 to 100.');
  }
  return { origin: url.origin, key, owner, limit: Number(limit) };
}

async function inventory(config) {
  const query = new URLSearchParams({ end_user_id: config.owner, limit: String(config.limit) });
  let response;
  try {
    response = await fetch(`${config.origin}/v1/devices?${query}`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json' },
    });
  } catch { fail('Inventory transport failed; no automatic retry was made.'); }
  if (response.status !== 200) {
    await response.body?.cancel();
    fail(`Inventory request returned HTTP ${response.status}.`);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
    await response.body?.cancel();
    fail('Expected a JSON inventory response.');
  }
  const reader = response.body?.getReader();
  if (!reader) fail('Empty inventory response.');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) {
        await reader.cancel();
        fail('Inventory response exceeded the 1 MiB example limit.');
      }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    if (error instanceof ExampleError) throw error;
    fail('Inventory response could not be read as bounded UTF-8 JSON.');
  } finally { reader.releaseLock(); }
}

function timestamp(value) {
  if (typeof value !== 'string' || value.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
      !Number.isFinite(Date.parse(value))) fail('Invalid inventory lifecycle timestamp.');
  return value;
}

function selectedDevice(device, config) {
  if (!object(device) || !identifier(device.id, 'dev') || device.end_user_id !== config.owner ||
      device.status !== 'bound' || device.deleted_at) fail('Inventory device identity, binding or owner mismatch.');
  if (typeof device.model !== 'string' || !device.model || device.model.length > 64) {
    fail('Invalid inventory model.');
  }
  if (!(device.firmware_version === null || (typeof device.firmware_version === 'string' &&
      device.firmware_version.length <= 64))) fail('Invalid inventory firmware version.');
  return {
    id: device.id,
    model: ['bota_pin', 'bota_note', 'bota_pin_pro'].includes(device.model) ? device.model : 'unknown',
    firmware_version: device.firmware_version,
    status: 'bound',
    end_user_id: config.owner,
    created_at: timestamp(device.created_at),
    updated_at: timestamp(device.updated_at),
  };
}

async function main() {
  const config = configuration();
  const deadline = Date.now() + 30000;
  const page = await inventory(config);
  if (!object(page) || !Array.isArray(page.data) || page.data.length > config.limit ||
      typeof page.has_more !== 'boolean') fail('Invalid inventory response envelope or count.');
  const selected = page.data.map((device) => selectedDevice(device, config));
  if (new Set(selected.map((device) => device.id)).size !== selected.length) {
    fail('Inventory contains duplicate device IDs; no inventory was emitted.');
  }
  if (Date.now() >= deadline) fail('Inventory deadline exceeded; no inventory was emitted.');
  // has_more is the API's observation, never a permission to guess a pagination mode.
  console.log(JSON.stringify({
    data: selected, requested_limit: config.limit, has_more: page.has_more,
    pagination_attempted: false, inventory_complete: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof ExampleError ? error.message : 'Local inventory operation failed.');
  process.exitCode = 1;
});
