import { randomUUID } from 'node:crypto';
import { link, lstat, open, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_SEGMENTS = 5000;
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const validId = (prefix, value) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);

function readConfig(env) {
  let base;
  try { base = new URL(env.BOTA_API_BASE_URL); }
  catch { throw new SafeError('Set BOTA_API_BASE_URL to an explicit API origin ending in /v1.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  requireValue((base.protocol === 'https:' || (base.protocol === 'http:' && loopback)) &&
    !base.username && !base.password && !base.search && !base.hash && /^\/v1\/?$/.test(base.pathname),
  'API URL must use HTTPS (or loopback HTTP), end in /v1, and have no URL credentials, query or fragment.');
  requireValue(typeof env.BOTA_API_KEY === 'string' && env.BOTA_API_KEY.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(env.BOTA_API_KEY) && !env.BOTA_API_KEY.includes('replace_me'),
  'Set a server-side project key with recordings:read and transcriptions:read.');
  requireValue(validId('eu', env.BOTA_END_USER_ID), 'Set BOTA_END_USER_ID to the fixed authorized end user.');
  requireValue(validId('rec', env.BOTA_RECORDING_ID), 'Set BOTA_RECORDING_ID to the expected source recording.');
  requireValue(validId('txn', env.BOTA_TRANSCRIPTION_ID), 'Set BOTA_TRANSCRIPTION_ID to the existing transcription.');
  requireValue(typeof env.OUTPUT_PATH === 'string' && env.OUTPUT_PATH.length > 0 && env.OUTPUT_PATH.length <= 2048 &&
    !/[\x00-\x1f]/.test(env.OUTPUT_PATH), 'Set OUTPUT_PATH to a new file in an existing directory.');
  return { base: base.href.replace(/\/$/, ''), key: env.BOTA_API_KEY, endUserId: env.BOTA_END_USER_ID,
    recordingId: env.BOTA_RECORDING_ID, transcriptionId: env.BOTA_TRANSCRIPTION_ID,
    outputPath: resolve(env.OUTPUT_PATH) };
}

async function readJson(response, signal) {
  requireValue(response.body, 'The API returned no response body.');
  const chunks = []; let length = 0;
  for await (const chunk of response.body) {
    signal.throwIfAborted();
    length += chunk.length;
    requireValue(length <= MAX_RESPONSE_BYTES, 'API response exceeds this example\'s 1 MiB limit.');
    chunks.push(chunk);
  }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks))); }
  catch { throw new SafeError('The API returned invalid JSON.'); }
}

function milliseconds(seconds) {
  requireValue(typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0,
    'Transcript segments must contain finite, nonnegative timestamps in seconds.');
  const value = Math.round(seconds * 1000);
  requireValue(Number.isSafeInteger(value), 'A segment timestamp is too large to export safely.');
  return value;
}

function timestamp(value) {
  const hours = Math.floor(value / 3_600_000);
  const minutes = Math.floor(value / 60_000) % 60;
  const seconds = Math.floor(value / 1000) % 60;
  const pad = (number, width = 2) => String(number).padStart(width, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(value % 1000, 3)}`;
}

function subtitleText(value) {
  requireValue(typeof value === 'string' && value.length <= 10_000, 'A segment contains invalid or oversized text.');
  // One plain-text line per cue: upstream newlines cannot introduce cue boundaries.
  const plain = value.replace(/[\x00-\x1f\x7f-\x9f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim();
  requireValue(plain.length > 0, 'A segment contains no printable subtitle text.');
  return plain.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderSrt(transcription, config) {
  requireValue(transcription?.id === config.transcriptionId && transcription.recording_id === config.recordingId,
    'Transcription identity or source recording does not match.');
  requireValue(transcription.status === 'completed', 'The transcription must already be completed; this example does not poll.');
  requireValue(Array.isArray(transcription.segments) && transcription.segments.length > 0 &&
    transcription.segments.length <= MAX_SEGMENTS, 'A completed transcription must contain 1–5000 timed segments.');
  return transcription.segments.map((segment, index) => {
    requireValue(segment && typeof segment === 'object' && !Array.isArray(segment), 'A transcript segment is invalid.');
    const start = milliseconds(segment.start);
    const end = milliseconds(segment.end);
    requireValue(segment.end >= segment.start, 'A segment ends before it starts.');
    requireValue(segment.speaker === undefined || segment.speaker === null ||
      (typeof segment.speaker === 'string' && segment.speaker.length <= 256), 'A segment speaker is invalid.');
    return `${index + 1}\n${timestamp(start)} --> ${timestamp(end)}\n${subtitleText(segment.text)}\n`;
  }).join('\n') + '\n';
}

async function exportTranscription(config) {
  const signal = AbortSignal.timeout(30_000);
  let temporaryPath; let file;
  try {
    try {
      await lstat(config.outputPath);
      throw new SafeError('OUTPUT_PATH already exists; no file was overwritten.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    requireValue((await lstat(dirname(config.outputPath))).isDirectory(), 'The output directory must already exist.');
    async function api(path) {
      const response = await fetch(config.base + path, {
        method: 'GET', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json' }, signal,
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new SafeError(`API read failed (HTTP ${response.status}); no automatic retry was made.`);
      }
      return readJson(response, signal);
    }
    const recording = await api(`/recordings/${config.recordingId}`);
    requireValue(recording?.id === config.recordingId && recording.end_user_id === config.endUserId &&
      !recording.deleted_at, 'Recording identity or configured end-user ownership does not match.');
    const transcription = await api(`/transcriptions/${config.transcriptionId}`);
    const content = renderSrt(transcription, config);
    signal.throwIfAborted();
    const candidate = join(dirname(config.outputPath), `.${basename(config.outputPath)}.${randomUUID()}.partial`);
    file = await open(candidate, 'wx', 0o600);
    temporaryPath = candidate; // Only remove a partial file successfully created by this invocation.
    await file.writeFile(content, { encoding: 'utf8', signal });
    await file.sync();
    await file.close(); file = undefined;
    signal.throwIfAborted();
    // Same-directory hard link publishes complete bytes and refuses an existing destination.
    await link(temporaryPath, config.outputPath);
    return transcription.segments.length;
  } finally {
    await file?.close().catch(() => {});
    if (temporaryPath) {
      try { await unlink(temporaryPath); }
      catch { throw new SafeError('Could not remove this invocation\'s partial file; inspect the output directory.'); }
    }
  }
}

try {
  const cues = await exportTranscription(readConfig(process.env));
  console.log(`Exported ${cues} subtitle cues to OUTPUT_PATH.`);
}
catch (error) {
  console.error(error instanceof SafeError ? error.message :
    'Export failed or its deadline expired. Check configuration, API access and the local filesystem; no automatic retry was made.');
  process.exitCode = 1;
}
