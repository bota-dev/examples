import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, open, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_JSON_BYTES = 256 * 1024;
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const validId = (prefix, value) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);

function httpsUrl(value, label) {
  requireValue(typeof value === 'string' && value.length <= 8192, `${label} is invalid.`);
  let url;
  try { url = new URL(value); } catch { throw new SafeError(`${label} is invalid.`); }
  requireValue(url.protocol === 'https:' && !url.username && !url.password && !url.hash,
    `${label} must use HTTPS without URL credentials or a fragment.`);
  return url;
}

export function readConfig(env) {
  const base = httpsUrl(env.BOTA_API_BASE_URL, 'BOTA_API_BASE_URL');
  requireValue(!base.search && /^\/v1\/?$/.test(base.pathname), 'BOTA_API_BASE_URL must end in /v1 without a query.');
  requireValue(typeof env.BOTA_API_KEY === 'string' && env.BOTA_API_KEY.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(env.BOTA_API_KEY) && !env.BOTA_API_KEY.includes('replace_me'),
  'Set a server-side project key with recordings:read.');
  requireValue(typeof env.BOTA_PROJECT_ID === 'string' && /^[A-Za-z0-9_-]{3,128}$/.test(env.BOTA_PROJECT_ID) &&
    env.BOTA_PROJECT_ID !== 'replace_me', 'Set BOTA_PROJECT_ID to the expected project.');
  requireValue(validId('rec', env.BOTA_RECORDING_ID), 'Set BOTA_RECORDING_ID to the selected recording.');
  const endUserId = env.BOTA_END_USER_ID || undefined;
  requireValue(!endUserId || validId('eu', endUserId), 'BOTA_END_USER_ID must be an end-user ID or blank.');
  requireValue(typeof env.OUTPUT_PATH === 'string' && env.OUTPUT_PATH.length > 0 && env.OUTPUT_PATH.length <= 2048 &&
    !/[\x00-\x1f]/.test(env.OUTPUT_PATH), 'Set OUTPUT_PATH to a new file in an existing directory.');
  const expectedHash = env.EXPECTED_SHA256 || undefined;
  requireValue(!expectedHash || /^[a-fA-F0-9]{64}$/.test(expectedHash), 'EXPECTED_SHA256 must be a SHA-256 hex digest or blank.');
  return { base: base.href.replace(/\/$/, ''), key: env.BOTA_API_KEY, projectId: env.BOTA_PROJECT_ID,
    recordingId: env.BOTA_RECORDING_ID, endUserId, outputPath: resolve(env.OUTPUT_PATH),
    expectedHash: expectedHash?.toLowerCase() };
}

function byteCount(value) {
  // PostgreSQL bigint values can arrive as decimal strings. Never round them.
  const number = typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$/.test(value) ? Number(value) : value;
  requireValue(Number.isSafeInteger(number) && number >= 0, 'A response contains an invalid byte count.');
  requireValue(number <= MAX_BYTES, 'Download exceeds this example\'s 25 MiB limit.');
  return number;
}

async function jsonBody(response) {
  const chunks = []; let length = 0;
  requireValue(response.body, 'The API returned no response body.');
  for await (const chunk of response.body) {
    length += chunk.length;
    requireValue(length <= MAX_JSON_BYTES, 'API response exceeds the 256 KiB metadata limit.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new SafeError('The API returned invalid JSON.'); }
}

/** Downloads opaque original bytes, with no decryption or upload-completion claim. */
export async function downloadRecording(config, { fetchImpl = fetch, signal,
  requestTimeoutMs = 10_000, totalTimeoutMs = 120_000 } = {}) {
  const deadline = AbortSignal.timeout(totalTimeoutMs);
  const operationSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let temporaryPath; let file;
  try {
    operationSignal.throwIfAborted();
    try {
      await lstat(config.outputPath);
      throw new SafeError('OUTPUT_PATH already exists; no file was overwritten.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    requireValue((await lstat(dirname(config.outputPath))).isDirectory(), 'The output directory must already exist.');
    async function api(path) {
      const response = await fetchImpl(config.base + path, {
        method: 'GET', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json' },
        signal: AbortSignal.any([operationSignal, AbortSignal.timeout(requestTimeoutMs)]),
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new SafeError(`API request failed (HTTP ${response.status}); no automatic retry was made.`);
      }
      return jsonBody(response);
    }
    const recording = await api(`/recordings/${config.recordingId}`);
    requireValue(recording?.id === config.recordingId && recording.project_id === config.projectId &&
      !recording.deleted_at && (!config.endUserId || recording.end_user_id === config.endUserId),
    'Recording identity or configured ownership does not match.');
    requireValue(['uploaded', 'processing', 'completed'].includes(recording.status),
      'This example requires recording status uploaded, processing or completed.');

    const target = await api(`/recordings/${config.recordingId}/download-url`);
    requireValue(target && Number.isSafeInteger(target.expires_in) && target.expires_in > 0 &&
      (target.content_type === null || (typeof target.content_type === 'string' && target.content_type.length <= 256)),
    'The API returned an invalid download descriptor.');
    const expectedBytes = target.file_size_bytes === null ? null : byteCount(target.file_size_bytes);
    const url = httpsUrl(target.download_url, 'Storage URL');
    operationSignal.throwIfAborted();

    const candidate = join(dirname(config.outputPath), `.${basename(config.outputPath)}.${randomUUID()}.partial`);
    file = await open(candidate, 'wx', 0o600);
    temporaryPath = candidate; // Never remove a file we did not create.
    const response = await fetchImpl(url.href, {
      method: 'GET', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Accept-Encoding': 'identity' }, signal: operationSignal,
    });
    try {
      requireValue(response.status === 200, `Storage download failed (HTTP ${response.status}); request a fresh URL on a new invocation.`);
      requireValue(!response.headers.get('content-range'), 'Partial storage responses are not supported.');
      const encoding = response.headers.get('content-encoding');
      requireValue(!encoding || encoding.toLowerCase() === 'identity', 'Encoded HTTP bodies are not supported; original bytes are required.');
      const lengthHeader = response.headers.get('content-length');
      const declaredBytes = lengthHeader === null ? null : byteCount(lengthHeader);
      requireValue(expectedBytes === null || declaredBytes === null || expectedBytes === declaredBytes,
        'Storage length differs from the download descriptor.');
      requireValue(response.body, 'Storage returned no response body.');
      const hash = createHash('sha256'); let bytes = 0;
      for await (const chunk of response.body) {
        operationSignal.throwIfAborted();
        bytes += chunk.length;
        requireValue(bytes <= MAX_BYTES, 'Download exceeds this example\'s 25 MiB limit.');
        requireValue(expectedBytes === null || bytes <= expectedBytes, 'Downloaded length differs from the descriptor.');
        hash.update(chunk);
        let offset = 0;
        while (offset < chunk.length) {
          const written = await file.write(chunk, offset, chunk.length - offset);
          requireValue(written.bytesWritten > 0, 'Could not write the downloaded bytes.');
          offset += written.bytesWritten;
        }
      }
      operationSignal.throwIfAborted();
      requireValue(bytes > 0 && (expectedBytes === null || bytes === expectedBytes) &&
        (declaredBytes === null || bytes === declaredBytes), 'Downloaded length is empty or incomplete.');
      const sha256 = hash.digest('hex');
      requireValue(!config.expectedHash || sha256 === config.expectedHash, 'Downloaded bytes do not match EXPECTED_SHA256.');
      await file.sync(); await file.close(); file = undefined;
      operationSignal.throwIfAborted();
      // Same-filesystem hard linking publishes the completed bytes without replacing any path.
      await link(temporaryPath, config.outputPath);
      return { recording_id: config.recordingId, bytes_written: bytes, sha256,
        expected_sha256_matched: config.expectedHash ? true : null };
    } finally {
      if (response.body && !response.body.locked) await response.body.cancel().catch(() => {});
    }
  } catch (error) {
    if (error instanceof SafeError) throw error;
    if (error.code === 'EEXIST') throw new SafeError('OUTPUT_PATH or the temporary path already exists; no file was overwritten.');
    if (operationSignal.aborted) throw new SafeError('Download cancelled or exceeded its total deadline; no partial file was published.');
    throw new SafeError('Download failed during a request or local file operation; no automatic retry was made.');
  } finally {
    try { await file?.close(); }
    finally {
      if (temporaryPath) {
        try { await unlink(temporaryPath); }
        catch { throw new SafeError('Temporary-file cleanup failed. Inspect the selected output directory before retrying; a completed output may exist.'); }
      }
    }
  }
}

export async function main(env = process.env, { args = process.argv.slice(2), fetchImpl = fetch,
  output = console.log, errorOutput = console.error } = {}) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    if (args.length === 1 && args[0] === '--help') {
      output('Download one original recording to a new local file. Set BOTA_API_BASE_URL, BOTA_API_KEY, BOTA_PROJECT_ID, BOTA_RECORDING_ID and OUTPUT_PATH. Optional BOTA_END_USER_ID and EXPECTED_SHA256. HTTPS only; 25 MiB maximum; no overwrite, decryption or automatic retries.');
      return 0;
    }
    requireValue(args.length === 0, 'No positional arguments are accepted. Run npm start -- --help.');
    output(JSON.stringify(await downloadRecording(readConfig(env), { fetchImpl, signal: controller.signal }), null, 2));
    return 0;
  } catch (error) {
    errorOutput(error instanceof SafeError ? error.message : 'Download failed; no credentials or response data were printed.');
    return 1;
  } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
