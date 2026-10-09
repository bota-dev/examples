import { randomUUID } from 'node:crypto';
import { link, lstat, open, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const MAX_SEGMENTS = 5000;
const MAX_SECONDS = 168 * 60 * 60;
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);

function configuration() {
  const rawBase = process.env.BOTA_API_BASE_URL;
  requireValue(typeof rawBase === 'string' && rawBase.length <= 2048 &&
    !/[\\\s\x00-\x1f\x7f]/.test(rawBase), 'Configure a trusted API URL without whitespace, controls or backslashes.');
  let base;
  try { base = new URL(rawBase); }
  catch { throw new SafeError('Configure the trusted HTTPS API origin ending in /v1.'); }
  requireValue(base.protocol === 'https:' && !base.username && !base.password && !base.search &&
    !base.hash && /^\/v1\/?$/.test(base.pathname), 'Use a trusted HTTPS API origin with path /v1 and no credentials, query or fragment.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !key.toLowerCase().includes('replace_me'),
  'Configure a server-held project key with recordings:read and transcriptions:read.');
  const project = process.env.BOTA_PROJECT_ID;
  requireValue(validId(project, 'proj'), 'Configure the exact expected project ID.');
  const owner = process.env.BOTA_END_USER_ID;
  const recording = process.env.BOTA_RECORDING_ID;
  const transcription = process.env.BOTA_TRANSCRIPTION_ID;
  requireValue(validId(owner, 'eu') && validId(recording, 'rec') && validId(transcription, 'txn'),
    'Configure the exact authorized end-user, recording and transcription IDs.');
  const output = process.env.OUTPUT_PATH;
  requireValue(typeof output === 'string' && output.length > 0 && output.length <= 2048 &&
    !/[\x00-\x1f\x7f]/.test(output) && output.isWellFormed() && output.endsWith('.json'),
  'Configure a new .json file in an existing trusted private directory.');
  return { base: base.href.replace(/\/$/, ''), key, project, owner, recording,
    transcription, output: resolve(output) };
}

function checkRecording(recording, config) {
  requireValue(object(recording) && recording.id === config.recording && recording.end_user_id === config.owner &&
    recording.status !== 'deleted' && (!Object.hasOwn(recording, 'deleted_at') || recording.deleted_at === null) &&
    (!Object.hasOwn(recording, 'project_id') || recording.project_id === config.project),
  'Recording identity, project, deletion state or configured ownership does not match.');
}

function text(value, limit) {
  requireValue(typeof value === 'string' && value.length <= limit && value.isWellFormed(),
    'Transcript contains invalid Unicode, invalid text or oversized text.');
  return value;
}

function jsonPayload(transcription, config) {
  requireValue(object(transcription) && transcription.id === config.transcription &&
    transcription.recording_id === config.recording && transcription.status === 'completed' &&
    (!Object.hasOwn(transcription, 'deleted_at') || transcription.deleted_at === null) &&
    (!Object.hasOwn(transcription, 'project_id') || transcription.project_id === config.project),
  'Transcription must match the exact completed source and expected project.');
  const fullText = text(transcription.full_text, 500_000);
  requireValue(transcription.segments === null || (Array.isArray(transcription.segments) &&
    transcription.segments.length <= MAX_SEGMENTS), 'Segments must be null or an array of at most 5000 entries.');
  const segments = transcription.segments === null ? null : transcription.segments.map(segment => {
    requireValue(object(segment) && typeof segment.start === 'number' && typeof segment.end === 'number' &&
      Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.start >= 0 &&
      segment.end >= segment.start && segment.end <= MAX_SECONDS,
    'Segments require finite timestamps in seconds, from 0 through 168 hours, with end at least start.');
    const selected = { start: segment.start, end: segment.end, text: text(segment.text, 10_000) };
    if (Object.hasOwn(segment, 'speaker')) selected.speaker = text(segment.speaker, 256);
    return selected;
  });
  const bytes = Buffer.from(JSON.stringify({ id: config.transcription, recording_id: config.recording,
    status: 'completed', full_text: fullText, segments }, null, 2) + '\n', 'utf8');
  requireValue(bytes.length <= MAX_OUTPUT_BYTES, 'Selected JSON exceeds this example\'s 4 MiB output limit.');
  return bytes;
}

async function exportTranscription(config) {
  const signal = AbortSignal.timeout(30_000);
  let partial; let file;
  try {
    const parent = dirname(config.output);
    const directory = await lstat(parent);
    requireValue(directory.isDirectory() && !directory.isSymbolicLink(), 'Output parent must be an existing directory without a symlink.');
    if (process.platform !== 'win32') {
      requireValue((directory.mode & 0o077) === 0 && directory.uid === process.getuid(),
        'Output parent must be owned by this process user and private (for example mode 0700).');
    }
    try {
      await lstat(config.output);
      throw new SafeError('Output already exists; no file was overwritten.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    async function api(path) {
      const response = await fetch(config.base + path, { method: 'GET', redirect: 'error',
        credentials: 'omit', referrerPolicy: 'no-referrer', signal,
        headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json' } });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new SafeError(`API read returned HTTP ${response.status}; no retry was made.`);
      }
      if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body) {
        await response.body?.cancel();
        throw new SafeError('Expected a JSON API response.');
      }
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        signal.throwIfAborted();
        size += chunk.length;
        requireValue(size <= MAX_RESPONSE_BYTES, 'API response exceeds this example\'s 2 MiB limit.');
        chunks.push(chunk);
      }
      signal.throwIfAborted();
      try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { throw new SafeError('The API returned invalid UTF-8 or JSON.'); }
    }
    checkRecording(await api(`/recordings/${config.recording}`), config);
    const payload = jsonPayload(await api(`/transcriptions/${config.transcription}`), config);
    signal.throwIfAborted();
    const candidate = join(parent, `.${basename(config.output)}.${randomUUID()}.partial`);
    file = await open(candidate, 'wx', 0o600);
    partial = candidate; // Cleanup only the file this invocation exclusively created.
    await file.writeFile(payload, { signal });
    await file.sync();
    await file.close(); file = undefined;
    // Fresh owner observation immediately before publication; these reads are still non-atomic.
    checkRecording(await api(`/recordings/${config.recording}`), config);
    signal.throwIfAborted();
    await link(partial, config.output); // Fails for any existing destination, including a dangling symlink.
  } finally {
    await file?.close().catch(() => {});
    if (partial) {
      try { await unlink(partial); }
      catch { throw new SafeError('Partial cleanup failed; inspect the private directory. A completed output may exist.'); }
    }
  }
}

try {
  await exportTranscription(configuration());
  console.log('Exported completed transcription JSON.');
} catch (error) {
  console.error(error instanceof SafeError ? error.message :
    'Export failed or its deadline expired. Inspect configuration, API access and the private output directory before retrying.');
  process.exitCode = 1;
}
