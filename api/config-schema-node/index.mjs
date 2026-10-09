// Discover registry metadata; schema availability is not device/worker support.
class ExampleError extends Error {}
const fail = message => { throw new ExampleError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const LEVELS = ['organization', 'project', 'end_user', 'device'];
const STRATEGIES = ['override', 'merge_deep', 'append', 'min', 'max', 'ordered_max'];

function configuration() {
  let origin;
  try { origin = new URL(process.env.BOTA_API_ORIGIN ?? 'https://api.bota.dev'); }
  catch { fail('Invalid BOTA_API_ORIGIN.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
      !(origin.protocol === 'https:' || (origin.protocol === 'http:' && local))) {
    fail('Use a trusted HTTPS origin, or explicit loopback HTTP, without paths or credentials.');
  }
  const key = process.env.BOTA_API_KEY;
  if (!/^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key ?? '') || key.includes('REPLACE_ME')) {
    fail('Configure a server-held project API key with config:read.');
  }
  const project = process.env.BOTA_PROJECT_ID;
  if (!/^proj_[A-Za-z0-9-]{1,128}$/.test(project ?? '') || project.includes('REPLACE_ME')) {
    fail('Configure the expected project ID.');
  }
  return { origin: origin.origin, key, project };
}

async function getSchema(config) {
  let reader;
  try {
    const response = await fetch(`${config.origin}/v1/config/schema`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json' },
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      fail(`Schema discovery returned HTTP ${response.status}. No automatic retry was made.`);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body) {
      await response.body?.cancel();
      fail('Expected a JSON schema response.');
    }
    reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 256 * 1024) {
        await reader.cancel();
        fail('Schema response exceeded the 256 KiB example limit.');
      }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    if (error instanceof ExampleError) throw error;
    fail('Schema request failed or the bounded UTF-8 JSON response was invalid.');
  } finally { reader?.releaseLock(); }
}

function checkProject(value, config) {
  if ('project_id' in value && value.project_id !== config.project) {
    fail('Schema response project mismatch.');
  }
}

function metadata(response, config) {
  if (!object(response) || !Array.isArray(response.data) || response.data.length > 64) {
    fail('Expected a schema list of at most 64 sections.');
  }
  checkProject(response, config);
  const sections = new Set();
  return response.data.map(value => {
    if (!object(value) || typeof value.section !== 'string' ||
        !/^[a-z][a-z0-9_]{0,63}$/.test(value.section) || sections.has(value.section) ||
        typeof value.description !== 'string' || value.description.length > 2048 ||
        !Array.isArray(value.levels) || value.levels.length < 1 || value.levels.length > LEVELS.length ||
        value.levels.some(level => !LEVELS.includes(level)) ||
        new Set(value.levels).size !== value.levels.length || !STRATEGIES.includes(value.merge_strategy)) {
      fail('Invalid or duplicate schema metadata.');
    }
    checkProject(value, config);
    sections.add(value.section);
    // Defaults and arbitrary response properties never enter the output.
    return { section: value.section, description: value.description,
      levels: value.levels, merge_strategy: value.merge_strategy };
  });
}

async function main() {
  const config = configuration();
  const data = metadata(await getSchema(config), config);
  // JSON escaping keeps untrusted descriptions as data, including control characters.
  console.log(JSON.stringify({ data }, null, 2));
  console.error('One schema response received in full; no pagination or deployment-wide completeness proof.');
}

main().catch(error => {
  console.error(error instanceof ExampleError ? error.message : 'Local schema discovery failed.');
  process.exitCode = 1;
});
