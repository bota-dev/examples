import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';

class ExampleError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new ExampleError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value, prefix) => typeof value === 'string' &&
  new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);

function configuration() {
  const base = process.env.BOTA_API_BASE_URL ?? 'https://api.bota.dev/v1';
  requireValue(typeof base === 'string' && base.length <= 2048 && !/[\\\x00-\x20\x7f]/.test(base),
    'Configure a trusted HTTPS API base ending in /v1.');
  let url;
  try { url = new URL(base); }
  catch { throw new ExampleError('Invalid API base.'); }
  requireValue(url.protocol === 'https:' && !url.username && !url.password &&
    url.pathname === '/v1' && !url.search && !url.hash, 'Configure a trusted HTTPS API base ending in /v1.');
  const key = process.env.BOTA_API_KEY;
  const project = process.env.BOTA_PROJECT_ID;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !key.toLowerCase().includes('replace_me'),
    'Configure a server-held project API key with end_users:read.');
  requireValue(validId(project, 'proj') && !project.toLowerCase().includes('replace'),
    'Configure the independently verified expected project.');
  requireValue(typeof process.env.EXTERNAL_ID_FILE === 'string' && process.env.EXTERNAL_ID_FILE.length > 0,
    'Configure EXTERNAL_ID_FILE in an existing private directory.');
  return { base: url.href, key, project, file: resolve(process.env.EXTERNAL_ID_FILE) };
}

function privateStat(stat, directory = false) {
  requireValue(directory ? stat.isDirectory() : stat.isFile(), 'Private local path has an invalid type.');
  if (process.platform !== 'win32') {
    requireValue(stat.uid === process.getuid() && (stat.mode & 0o077) === 0,
      'Private local path must be owned by this user without group or other permissions.');
  }
}

function readExternalId(path) {
  let directory = dirname(path);
  privateStat(lstatSync(directory), true);
  for (;;) {
    const stat = lstatSync(directory);
    requireValue(stat.isDirectory() && !stat.isSymbolicLink(), 'Local path ancestry must contain real directories.');
    if (directory === parse(directory).root) break;
    directory = dirname(directory);
  }
  const before = lstatSync(path);
  privateStat(before);
  requireValue(!before.isSymbolicLink() && before.nlink === 1 && before.size > 0 && before.size <= 1020,
    'External ID must be in one private regular file within the byte limit.');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    privateStat(opened);
    requireValue(opened.dev === before.dev && opened.ino === before.ino && opened.nlink === 1,
      'External ID file changed while opening.');
    const bytes = Buffer.alloc(1021);
    let size = 0;
    for (;;) {
      const count = readSync(fd, bytes, size, bytes.length - size, null);
      if (count === 0) break;
      size += count;
      requireValue(size <= 1020, 'External ID file exceeds the byte limit.');
    }
    const after = fstatSync(fd);
    requireValue(size === opened.size && after.size === opened.size && after.nlink === 1 &&
      after.mtimeMs === opened.mtimeMs && after.ctimeMs === opened.ctimeMs,
      'External ID file changed during reading.');
    let value;
    try { value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, size)); }
    catch { throw new ExampleError('External ID file must contain valid UTF-8.'); }
    // Zod's max(255) counts UTF-16 code units; preserve exact bytes' decoded value, including whitespace/BOM.
    // Empty strings select the directory path in current source, and PostgreSQL text cannot store NUL.
    requireValue(value.length >= 1 && value.length <= 255 && !value.includes('\0'),
      'External ID must contain 1–255 UTF-16 code units without NUL.');
    return value;
  } finally { closeSync(fd); }
}

function activeProject(value, config) {
  requireValue(object(value) && (!('project_id' in value) || value.project_id === config.project) &&
    (!('deleted_at' in value) || value.deleted_at === null), 'Unexpected project or deleted-resource state.');
}

function endUser(value, config, externalId, expectedId) {
  activeProject(value, config);
  requireValue(validId(value.id, 'eu') && value.external_id === externalId &&
    (expectedId === undefined || value.id === expectedId), 'End-user mapping changed or is invalid.');
  return value.id;
}

async function get(url, config, deadline) {
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'error',
      headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json' },
      signal: AbortSignal.any([deadline, AbortSignal.timeout(10_000)]) });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new ExampleError(`Lookup returned HTTP ${response.status}. No retry was made.`);
    }
    if (!response.body || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel();
      throw new ExampleError('Expected a JSON lookup response.');
    }
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1024 * 1024) {
          await reader.cancel();
          throw new ExampleError('Lookup response exceeds the decoded byte limit.');
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new ExampleError('Lookup response has invalid JSON or UTF-8.'); }
  } catch (error) {
    if (error instanceof ExampleError) throw error;
    throw new ExampleError(deadline.aborted ? 'Lookup exceeded its overall deadline.' :
      'Lookup request interrupted, timed out or redirected. No retry was made.');
  }
}

async function main() {
  const config = configuration();
  const deadline = AbortSignal.timeout(30_000);
  const externalId = readExternalId(config.file);
  const url = new URL(`${config.base}/end-users`);
  url.searchParams.set('external_id', externalId);
  const page = await get(url, config, deadline);
  activeProject(page, config);
  requireValue(Array.isArray(page.data) && page.data.length <= 1 && page.has_more === false &&
    (!('next_cursor' in page) || page.next_cursor === null), 'Expected a terminal exact external-ID lookup.');
  let id;
  if (page.data.length === 1) {
    id = endUser(page.data[0], config, externalId);
    const current = await get(new URL(`${config.base}/end-users/${id}`), config, deadline);
    endUser(current, config, externalId, id);
  }
  requireValue(!deadline.aborted, 'Lookup exceeded its overall deadline.');
  console.log(JSON.stringify({ status: id === undefined ? 'not_found' : 'found',
    ...(id === undefined ? {} : { end_user_id: id }), atomic_snapshot: false,
    persistent_identity_verified: false }, null, 2));
}

main().catch(error => {
  console.error(error instanceof ExampleError ? error.message :
    'Lookup failed. No private file, identifier, profile or raw error was printed.');
  process.exitCode = 1;
});
