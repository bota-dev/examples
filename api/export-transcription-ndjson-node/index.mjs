import { randomUUID } from 'node:crypto';
import { link, lstat, open, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const MAX_METADATA_BYTES = 1024 * 1024;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_BYTES = 4 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_SEGMENTS = 20_000;
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value, prefix) => typeof value === 'string' &&
  new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value) && !value.toLowerCase().includes('replace_me');
const sameFile = (left, right) => right && left.dev === right.dev && left.ino === right.ino;

function remainingTime(deadline) {
  const remaining = deadline - performance.now();
  requireValue(remaining > 0, 'Export time budget expired; no automatic retry was made.');
  return remaining;
}

function configuration() {
  requireValue(process.argv.length === 2, 'Configure environment variables; no CLI arguments are accepted.');
  const rawBase = process.env.BOTA_API_BASE_URL;
  requireValue(typeof rawBase === 'string' && rawBase.length > 0 && rawBase.length <= 2048 &&
    rawBase.isWellFormed() && !/[\\\s?#\x00-\x1f\x7f]/.test(rawBase),
  'Configure a trusted explicit HTTPS API origin ending in /v1.');
  let base;
  try { base = new URL(rawBase); }
  catch { throw new SafeError('Invalid trusted HTTPS API origin.'); }
  requireValue(base.protocol === 'https:' && base.hostname && !base.username && !base.password &&
    !base.search && !base.hash && /^\/v1\/?$/.test(base.pathname),
  'Use HTTPS and /v1 without URL credentials, query or fragment.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !key.toLowerCase().includes('replace_me'),
  'Configure a server-held project key with recordings:read and transcriptions:read.');
  const project = process.env.BOTA_PROJECT_ID;
  const owner = process.env.BOTA_END_USER_ID;
  const recording = process.env.BOTA_RECORDING_ID;
  const transcription = process.env.BOTA_TRANSCRIPTION_ID;
  requireValue(validId(project, 'proj') && validId(owner, 'eu') && validId(recording, 'rec') &&
    validId(transcription, 'txn'), 'Configure the exact authorized project, end-user, recording and transcription IDs.');
  const output = process.env.OUTPUT_PATH;
  requireValue(typeof output === 'string' && output.length > 0 && output.length <= 2048 &&
    output.isWellFormed() && !/[\x00-\x1f\x7f]/.test(output) &&
    !output.split(/[\\/]/).includes('..') && output.toLowerCase().endsWith('.ndjson') &&
    !basename(output).includes(':'),
  'Configure a new .ndjson file in an existing private directory without parent traversal.');
  return { base: base.href.replace(/\/$/, ''), key, project, owner, recording,
    transcription, output: resolve(output) };
}

function finiteJson(key, value) {
  requireValue(key.isWellFormed() && (typeof value !== 'string' || value.isWellFormed()) &&
    (typeof value !== 'number' || Number.isFinite(value)), 'Invalid Unicode or nonfinite JSON number.');
  return value;
}

async function readJson(config, path, deadline, limit = MAX_METADATA_BYTES) {
  const requestSignal = AbortSignal.timeout(Math.max(1, Math.ceil(Math.min(10_000, remainingTime(deadline)))));
  const response = await fetch(config.base + path, { method: 'GET', redirect: 'error',
    credentials: 'omit', referrerPolicy: 'no-referrer', signal: requestSignal,
    headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json', 'Accept-Encoding': 'identity' } });
  if (response.status !== 200 ||
    response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json' ||
    (response.headers.get('content-encoding') ?? 'identity').trim().toLowerCase() !== 'identity' || !response.body) {
    await response.body?.cancel();
    throw new SafeError('API GET must return HTTP 200 uncompressed JSON; no redirect or retry was made.');
  }
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    requestSignal.throwIfAborted();
    remainingTime(deadline);
    size += chunk.length;
    requireValue(size <= limit, 'API response exceeds the selected example byte limit.');
    chunks.push(chunk);
  }
  requestSignal.throwIfAborted();
  remainingTime(deadline);
  let document;
  try {
    document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), finiteJson);
  } catch { throw new SafeError('API returned invalid UTF-8 JSON, Unicode or nonfinite numbers.'); }
  remainingTime(deadline);
  return document;
}

function availableIdentity(row, config) {
  return object(row) && row.status !== 'deleted' &&
    (!Object.hasOwn(row, 'deleted_at') || row.deleted_at === null) &&
    (!Object.hasOwn(row, 'project_id') || row.project_id === config.project);
}

async function verifyRecording(config, deadline) {
  const recording = await readJson(config, `/recordings/${config.recording}`, deadline);
  requireValue(availableIdentity(recording, config) && recording.id === config.recording &&
    recording.end_user_id === config.owner,
  'Recording identity, current owner, project or deletion state does not match.');
}

function renderNdjson(transcription, config, deadline) {
  requireValue(availableIdentity(transcription, config) && transcription.id === config.transcription &&
    transcription.recording_id === config.recording && transcription.status === 'completed',
  'Transcription identity, completed status, project or source does not match.');
  const segments = transcription.segments;
  requireValue(Array.isArray(segments) && segments.length <= MAX_SEGMENTS,
    'The completed transcription must supply at most 20,000 segments, not null.');
  const lines = []; let textBytes = 0; let outputBytes = 0; let previousStart = -1;
  for (const [offset, segment] of segments.entries()) {
    remainingTime(deadline);
    requireValue(object(segment) && typeof segment.start === 'number' && typeof segment.end === 'number' &&
      Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.start >= 0 &&
      segment.end >= 0 && segment.start >= previousStart && segment.end > segment.start,
    'Segments require finite nonnegative seconds, ordered starts and end strictly after start.');
    requireValue(typeof segment.text === 'string' && segment.text.isWellFormed(),
      'Segment text must be a well-formed Unicode string.');
    const selected = { index: offset + 1, start: segment.start, end: segment.end, text: segment.text };
    textBytes += Buffer.byteLength(segment.text, 'utf8');
    if (Object.hasOwn(segment, 'speaker')) {
      requireValue(segment.speaker === null ||
        (typeof segment.speaker === 'string' && segment.speaker.isWellFormed()),
      'Available speaker must be null or a well-formed Unicode string.');
      selected.speaker = segment.speaker;
      if (segment.speaker !== null) textBytes += Buffer.byteLength(segment.speaker, 'utf8');
    }
    requireValue(textBytes <= MAX_TEXT_BYTES, 'Supplied text and speaker bytes exceed the 4 MiB limit.');
    previousStart = segment.start;
    // JSON escaping preserves string values and keeps Unicode line separators off physical lines.
    let line = JSON.stringify(selected).replace(/[\u0085\u2028\u2029]/g,
      character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
    // Native JSON.stringify would discard a supplied negative-zero sign; preserve that Number value.
    if (Object.is(segment.start, -0)) line = line.replace('"start":0,', '"start":-0,');
    line += '\n';
    outputBytes += Buffer.byteLength(line, 'utf8');
    requireValue(outputBytes <= MAX_OUTPUT_BYTES, 'Exported NDJSON exceeds the 8 MiB limit.');
    lines.push(line);
  }
  remainingTime(deadline);
  return { bytes: Buffer.from(lines.join(''), 'utf8'), count: segments.length };
}

async function privateDirectory(parent) {
  let current = parent; let directory;
  while (true) {
    const info = await lstat(current, { bigint: true });
    requireValue(info.isDirectory() && !info.isSymbolicLink(),
      'Output ancestry must be existing directories without symlinks.');
    if (process.platform !== 'win32') {
      requireValue((info.mode & 0o022n) === 0n && (info.uid === 0n || info.uid === BigInt(process.getuid())),
        'Output ancestors must be trusted-owned and not writable by other users.');
    }
    if (current === parent) directory = info;
    const ancestor = dirname(current);
    if (ancestor === current) break;
    current = ancestor;
  }
  if (process.platform !== 'win32') {
    requireValue(directory.uid === BigInt(process.getuid()) && (directory.mode & 0o077n) === 0n,
      'Output directory must belong to this user and be private (for example mode 0700).');
  }
  return directory;
}

async function exportTranscription(config) {
  const deadline = performance.now() + 60_000;
  const parent = dirname(config.output);
  const directory = await privateDirectory(parent);
  try {
    await lstat(config.output);
    throw new SafeError('OUTPUT_PATH exists; no file was overwritten.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await verifyRecording(config, deadline);
  const { bytes, count } = renderNdjson(
    await readJson(config, `/transcriptions/${config.transcription}`, deadline, MAX_RESPONSE_BYTES), config, deadline);
  let partial; let file; let partialIdentity;
  try {
    const candidate = join(parent, `.${basename(config.output)}.${randomUUID()}.partial`);
    remainingTime(deadline);
    file = await open(candidate, 'wx', 0o600);
    partial = candidate; // Only this exclusively created partial can be cleaned up.
    partialIdentity = await file.stat({ bigint: true });
    requireValue(partialIdentity.isFile(), 'Partial must be a regular file.');
    await file.writeFile(bytes);
    await file.sync();
    await file.close(); file = undefined;
    requireValue(sameFile(await privateDirectory(parent), directory),
      'Output directory changed; no publication attempted.');
    await verifyRecording(config, deadline);
    remainingTime(deadline);
    await link(partial, config.output); // Fails for an existing file or dangling symlink.
  } finally {
    await file?.close().catch(() => {});
    if (partial) {
      try {
        const current = await lstat(partial, { bigint: true });
        requireValue(current.isFile() && sameFile(current, partialIdentity), 'Partial identity changed.');
        await unlink(partial);
      } catch {
        throw new SafeError('Partial cleanup failed; inspect private output before retrying. A completed export may exist.');
      }
    }
  }
  console.log(JSON.stringify({ segment_count: count, timing_inferred: false, atomic_snapshot: false,
    consumer_acceptance_verified: false, filesystem_acceptance_verified: false }));
}

try {
  await exportTranscription(configuration());
} catch (error) {
  console.error(error instanceof SafeError ? error.message :
    'NDJSON export failed or its budget expired. Inspect API access and private storage; no overwrite or automatic retry was made.');
  process.exitCode = 1;
}
