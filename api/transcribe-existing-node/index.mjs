import { closeSync, lstatSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';

class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const resourceId = (prefix, value) => typeof value === 'string' &&
  new RegExp(`^${prefix}_[A-Za-z0-9-]{1,128}$`).test(value);
const providers = ['whisper', 'deepgram', 'assemblyai', 'elevenlabs'];
const statuses = ['pending', 'processing', 'completed', 'failed'];

function configuration() {
  requireValue(process.argv.length === 2, 'Configure the fixed server environment; this example accepts no arguments.');
  const rawOrigin = process.env.BOTA_API_ORIGIN ?? '';
  let url;
  try { url = new URL(rawOrigin); }
  catch { throw new SafeError('Set an explicit trusted BOTA_API_ORIGIN.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  requireValue(!/[\u0000-\u0020\u007f]/.test(rawOrigin) && !url.username && !url.password &&
    url.pathname === '/' && !url.search && !url.hash &&
    (url.protocol === 'https:' || (url.protocol === 'http:' && local)),
  'Use an explicit HTTPS origin with no path or credentials; HTTP is loopback-only.');
  const key = process.env.BOTA_API_KEY ?? '';
  requireValue(key.length <= 256 && /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) &&
    !key.toLowerCase().includes('replace_me'), 'Set a server-held project API key.');
  const project = process.env.BOTA_PROJECT_ID ?? '';
  requireValue(/^[A-Za-z0-9_-]{3,128}$/.test(project) && !project.toLowerCase().includes('replace_me'),
    'Set the exact expected BOTA_PROJECT_ID.');
  const owner = process.env.BOTA_END_USER_ID;
  const recording = process.env.BOTA_RECORDING_ID;
  requireValue(resourceId('eu', owner) && resourceId('rec', recording) &&
    !`${owner}${recording}`.toLowerCase().includes('replace_me'), 'Set the exact authorized owner and existing recording IDs.');
  const language = process.env.BOTA_TRANSCRIPTION_LANGUAGE ?? '';
  requireValue(language === '' || /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,6})?$/.test(language) && language.length <= 10,
    'Language must be empty or a 2–10 character language code, for example en or en-US.');
  const provider = process.env.BOTA_TRANSCRIPTION_PROVIDER ?? '';
  requireValue(provider === '' || providers.includes(provider), 'Choose an empty or documented ASR provider.');
  const rawPath = process.env.TRANSCRIPTION_STATE_PATH ?? '.state/transcription.sqlite';
  requireValue(rawPath.length > 0 && rawPath.length <= 2048 && !/[\u0000-\u001f\u007f]/.test(rawPath),
    'Set TRANSCRIPTION_STATE_PATH to a trusted local path.');
  return { origin: url.origin, key, project, owner, recording, language, provider, statePath: resolve(rawPath) };
}

class Journal {
  constructor(config) {
    const directory = lstatSync(dirname(config.statePath));
    requireValue(directory.isDirectory() && !directory.isSymbolicLink(), 'Create a private real journal parent directory first.');
    if (process.platform !== 'win32') requireValue((directory.mode & 0o077) === 0, 'Journal parent must be private (mode 0700).');
    try { closeSync(openSync(config.statePath, 'wx', 0o600)); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const file = lstatSync(config.statePath);
    requireValue(file.isFile() && !file.isSymbolicLink(), 'Journal must be a regular file, not a symlink.');
    if (process.platform !== 'win32') requireValue((file.mode & 0o077) === 0, 'Journal must be private (mode 0600).');
    this.db = new DatabaseSync(config.statePath);
    try {
      this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS operation (
          id INTEGER PRIMARY KEY CHECK(id=1), scope TEXT NOT NULL,
          phase TEXT NOT NULL CHECK(phase IN ('ready','uncertain','known')), transcription_id TEXT
        )`);
      const scope = JSON.stringify([config.origin, '/v1', config.project, config.owner,
        config.recording, config.language, config.provider]);
      this.db.prepare("INSERT OR IGNORE INTO operation VALUES (1,?,'ready',NULL)").run(scope);
      const saved = this.row();
      requireValue(saved.scope === scope, 'Journal scope differs. Restore its original origin/project/owner/recording/language/provider.');
      requireValue((['ready', 'uncertain'].includes(saved.phase) && saved.transcription_id === null) ||
        (saved.phase === 'known' && resourceId('txn', saved.transcription_id)), 'Invalid journal state; preserve it for manual reconciliation.');
    } catch (error) { this.db.close(); throw error; }
  }
  row() { return this.db.prepare('SELECT * FROM operation WHERE id=1').get(); }
  claim() {
    // The atomic FULL-synchronous commit precedes the only POST, including crash uncertainty.
    const update = this.db.prepare("UPDATE operation SET phase='uncertain' WHERE id=1 AND phase='ready' AND transcription_id IS NULL").run();
    requireValue(update.changes === 1, 'Creation was claimed by another invocation; no POST was repeated.');
  }
  remember(id) {
    const update = this.db.prepare("UPDATE operation SET phase='known',transcription_id=? WHERE id=1 AND phase='uncertain' AND transcription_id IS NULL").run(id);
    requireValue(update.changes === 1, 'Journal cannot retain this identity; preserve it for manual reconciliation.');
  }
  close() { this.db.close(); }
}

function client(config, signal) {
  const deadline = performance.now() + 300000;
  const remaining = () => {
    const value = deadline - performance.now();
    requireValue(value > 0 && !signal.aborted, 'Observation ended or was cancelled. Preserve the journal; known IDs resume by GET only.');
    return value;
  };
  return {
    remaining,
    async request(path, body) {
      const method = body === undefined ? 'GET' : 'POST';
      let response;
      try {
        response = await fetch(`${config.origin}/v1${path}`, {
          method, redirect: 'error',
          signal: AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, Math.floor(Math.min(15000, remaining()))))]),
          headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json', 'Accept-Encoding': 'identity',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        requireValue(response.status === (body === undefined ? 200 : 201),
          `${method} returned HTTP ${response.status}. Preserve the journal; no automatic retry is performed.`);
        requireValue(/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') &&
          [null, 'identity'].includes(response.headers.get('content-encoding')), 'Expected uncompressed JSON; preserve the journal.');
        const chunks = []; let size = 0;
        for await (const chunk of response.body) {
          size += chunk.length;
          requireValue(size <= 1024 * 1024, 'Response exceeds the example 1 MiB limit; preserve the journal.');
          chunks.push(chunk);
        }
        remaining();
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      } catch (error) {
        try { await response?.body?.cancel(); } catch {}
        if (error instanceof SafeError) throw error;
        throw new SafeError(`${method} did not return bounded valid JSON. Preserve the journal; no automatic retry is performed.`);
      }
    },
  };
}

async function checkRecording(api, config) {
  const value = await api.request(`/recordings/${config.recording}`);
  requireValue(object(value) && value.id === config.recording && value.end_user_id === config.owner &&
    (!('project_id' in value) || value.project_id === config.project) &&
    (!('deleted_at' in value) || value.deleted_at === null) && value.status !== 'deleted' &&
    ['uploaded', 'completed'].includes(value.status), 'Recording identity, owner, project or uploaded-compatible state differs. No replacement is created.');
}

function checkTranscription(value, config, expectedId) {
  requireValue(object(value) && resourceId('txn', value.id) && (!expectedId || value.id === expectedId) &&
    value.recording_id === config.recording && (!('project_id' in value) || value.project_id === config.project) &&
    statuses.includes(value.status) && (value.provider === null || providers.includes(value.provider)) &&
    (value.language === null || typeof value.language === 'string' && value.language.length <= 32) &&
    (!config.provider || value.provider === config.provider) &&
    (!config.language || ['completed', 'failed'].includes(value.status) || value.language === config.language),
  'Transcription identity, source, project, provider, language or status differs. Preserve the journal.');
  if (value.status === 'completed') requireValue(typeof value.full_text === 'string', 'Completed transcription has no full_text; preserve its known ID.');
  requireValue(value.word_count === null || Number.isSafeInteger(value.word_count) && value.word_count >= 0,
    'Invalid transcription word count; preserve the journal.');
  return value;
}

async function main() {
  const config = configuration();
  const journal = new Journal(config);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    const api = client(config, controller.signal);
    const saved = journal.row();
    requireValue(saved.phase !== 'uncertain', 'Creation outcome is uncertain with no saved ID. Reconcile manually; this example never repeats or discovers a POST.');
    await checkRecording(api, config);
    if (saved.phase === 'ready') {
      const body = { recording_id: config.recording,
        ...(config.language ? { language: config.language } : {}),
        ...(config.provider ? { provider: config.provider } : {}) };
      api.remaining();
      journal.claim();
      const created = checkTranscription(await api.request('/transcriptions', body), config);
      journal.remember(created.id);
    }
    const knownId = journal.row().transcription_id;
    for (;;) {
      const job = checkTranscription(await api.request(`/transcriptions/${knownId}`), config, knownId);
      if (job.status === 'completed') {
        await checkRecording(api, config);
        api.remaining();
        console.log(JSON.stringify({ transcription_id: job.id, recording_id: job.recording_id,
          status: job.status, provider: job.provider, language: job.language, word_count: job.word_count }, null, 2));
        return;
      }
      requireValue(job.status !== 'failed', 'Known transcription failed. Its ID is retained; no replacement or provider error is printed.');
      await delay(Math.min(2000, api.remaining()), undefined, { signal: controller.signal });
    }
  } finally {
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    journal.close();
  }
}

main().catch((error) => {
  console.error(error instanceof SafeError ? error.message :
    'Local operation stopped. Preserve the journal and check private configuration; no raw error or API body is printed.');
  process.exitCode = 1;
});
