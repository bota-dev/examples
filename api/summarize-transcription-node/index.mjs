import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const templates = ['tmpl_general_notes', 'tmpl_sales_call', 'tmpl_clinical_soap', 'tmpl_legal_memo'];
const providers = ['gemini', 'openai', 'claude'];
const statuses = ['pending', 'processing', 'completed', 'failed'];
const id = (prefix, value) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(value);
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };

export function readConfig(env) {
  let url;
  try { url = new URL(env.BOTA_API_BASE_URL ?? 'https://api.bota.dev/v1'); }
  catch { throw new Error('BOTA_API_BASE_URL must be an HTTPS API base ending /v1.'); }
  const local = url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  requireValue((url.protocol === 'https:' || local) && !url.username && !url.password && !url.search && !url.hash && /^\/v1\/?$/.test(url.pathname), 'Use HTTPS (or loopback tests), with API base /v1 and no URL credentials.');
  requireValue(/^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(env.BOTA_API_KEY ?? '') && !env.BOTA_API_KEY.includes('replace_me'), 'Set a server-side project API key in BOTA_API_KEY.');
  requireValue(/^[A-Za-z0-9_-]{3,128}$/.test(env.BOTA_PROJECT_ID ?? '') && env.BOTA_PROJECT_ID !== 'replace_me', 'Set BOTA_PROJECT_ID to the expected project.');
  requireValue(id('txn', env.BOTA_TRANSCRIPTION_ID), 'Set BOTA_TRANSCRIPTION_ID to an existing completed transcription.');
  const template = env.BOTA_TEMPLATE_ID ?? 'tmpl_general_notes';
  const provider = env.BOTA_SUMMARY_PROVIDER ?? 'gemini';
  requireValue(templates.includes(template), 'Choose a documented built-in BOTA_TEMPLATE_ID.');
  requireValue(providers.includes(provider), 'BOTA_SUMMARY_PROVIDER must be gemini, openai or claude.');
  return { apiBase: url.href.replace(/\/$/, ''), apiKey: env.BOTA_API_KEY,
    projectId: env.BOTA_PROJECT_ID, transcriptionId: env.BOTA_TRANSCRIPTION_ID,
    template, provider, statePath: resolve(env.SUMMARY_STATE_PATH ?? './state/summary.sqlite') };
}

/** One fixed logical request per journal; only metadata is persisted. */
class Journal {
  constructor(config) {
    mkdirSync(dirname(config.statePath), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(config.statePath);
    try {
      this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS operation (
          id INTEGER PRIMARY KEY CHECK(id=1), scope TEXT NOT NULL, request_key TEXT NOT NULL,
          phase TEXT NOT NULL CHECK(phase IN ('ready','uncertain','known')), summary_id TEXT
        )`);
      const scope = JSON.stringify([config.apiBase, config.projectId, config.transcriptionId, config.template, config.provider]);
      this.db.prepare("INSERT OR IGNORE INTO operation VALUES (1,?,?,'ready',NULL)").run(scope, randomUUID());
      requireValue(this.row().scope === scope, 'Journal scope differs. Keep the original journal and restore its API/project/transcription/template/provider settings.');
    } catch (error) { this.db.close(); throw error; }
  }
  row() { return this.db.prepare('SELECT * FROM operation WHERE id=1').get(); }
  claim() {
    const update = this.db.prepare("UPDATE operation SET phase='uncertain' WHERE id=1 AND phase='ready' AND summary_id IS NULL").run();
    requireValue(update.changes === 1, 'Creation is already known or uncertain. Resume by reading; never repeat POST.');
  }
  remember(summaryId) {
    const update = this.db.prepare("UPDATE operation SET summary_id=?,phase='known' WHERE id=1 AND (summary_id IS NULL OR summary_id=?)").run(summaryId, summaryId);
    requireValue(update.changes === 1, 'Journal already owns a different summary ID. Reconcile without replacing it.');
  }
  close() { this.db.close(); }
}

function checkSummary(value, config, expectedId) {
  requireValue(value && id('sum', value.id) && (!expectedId || value.id === expectedId) &&
    value.project_id === config.projectId && value.transcription_id === config.transcriptionId &&
    value.template_id === config.template && value.provider === config.provider &&
    value.custom_prompt === null && statuses.includes(value.status), 'Summary identity or state differs from the journal; stopped without creating a replacement.');
  if (value.status === 'completed') requireValue(value.output && typeof value.output === 'object' && !Array.isArray(value.output), 'Completed summary has no structured output.');
  return value;
}

export async function summarize(config, { fetchImpl = fetch, inspect = false, summaryId,
  signal, pollIntervalMs = 2000, pollTimeoutMs = 300000, now = Date.now,
  sleep = milliseconds => delay(milliseconds, undefined, { signal }) } = {}) {
  requireValue(!summaryId || id('sum', summaryId), '--summary-id must be a sum_* identifier.');
  requireValue(!(inspect && summaryId), 'Use --inspect or --summary-id, not both.');
  async function api(path, body, key, timeoutMs = 25000) {
    const method = body === undefined ? 'GET' : 'POST';
    let response;
    try {
      response = await fetchImpl(config.apiBase + path, {
        method, redirect: 'error',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': key } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error('API request failed.');
      }
      const chunks = []; let length = 0;
      for await (const bytes of response.body) {
        length += bytes.length;
        requireValue(length <= 2 * 1024 * 1024, 'API response exceeds the example limit.');
        chunks.push(bytes);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      if (response && !response.ok) throw new Error(`API HTTP ${response.status}. Retained state must be inspected before retrying a write.`);
      throw new Error(`${method} did not return a valid result. Keep the journal; inspect or resume the existing operation.`);
    }
  }
  async function transcription() {
    const value = await api(`/transcriptions/${config.transcriptionId}`);
    requireValue(value?.id === config.transcriptionId && value.project_id === config.projectId && id('rec', value.recording_id), 'Transcription does not match the expected project and identity.');
    requireValue(value.status === 'completed', 'Transcription must already be completed; no summary was created.');
    return value;
  }
  async function list() {
    const results = []; const seen = new Set(); let cursor;
    for (let page = 0; page < 10; page++) {
      const query = new URLSearchParams({ transcription_id: config.transcriptionId, limit: '100', ...(cursor ? { cursor } : {}) });
      const result = await api(`/summaries?${query}`);
      requireValue(Array.isArray(result?.data) && typeof result.has_more === 'boolean', 'Invalid summary list; no creation attempted.');
      for (const value of result.data) {
        requireValue(id('sum', value?.id) && value.project_id === config.projectId && value.transcription_id === config.transcriptionId && statuses.includes(value.status), 'Summary list contains mismatched scope or status.');
        results.push({ id: value.id, status: value.status, template_id: value.template_id, provider: value.provider });
      }
      if (!result.has_more) return results;
      requireValue(typeof result.next_cursor === 'string' && result.next_cursor && !seen.has(result.next_cursor), 'Invalid or repeated pagination cursor; no creation attempted.');
      cursor = result.next_cursor; seen.add(cursor);
    }
    throw new Error('More than 1,000 summaries require manual inspection; no creation attempted.');
  }
  async function manualProcessing(recordingId) {
    const recording = await api(`/recordings/${recordingId}`);
    requireValue(recording?.id === recordingId && recording.project_id === config.projectId && !recording.deleted_at, 'Recording scope changed; no summary was created.');
    requireValue(recording.device_id === null || id('dev', recording.device_id), 'Invalid recording device identity.');
    requireValue(recording.end_user_id === null || id('eu', recording.end_user_id), 'Invalid recording end-user identity.');
    const path = recording.device_id ? `/devices/${recording.device_id}/config/processing`
      : recording.end_user_id ? `/end-users/${recording.end_user_id}/config/processing` : '/config/processing';
    const processing = await api(path);
    requireValue(processing?.value?.auto_summary?.enabled === false, 'Effective auto-summary must be disabled before this manual workflow. Existing automation and other writers require reconciliation.');
  }
  if (inspect) { await transcription(); return { summaries: await list() }; }
  const journal = new Journal(config);
  try {
    const source = await transcription();
    const saved = journal.row();
    if (summaryId) {
      requireValue(!saved.summary_id || saved.summary_id === summaryId, 'Journal already owns a different summary ID.');
      checkSummary(await api(`/summaries/${summaryId}`), config, summaryId);
      journal.remember(summaryId);
    } else if (!saved.summary_id) {
      requireValue(saved.phase === 'ready', 'Summary creation outcome is uncertain. Run --inspect, then explicitly attach a verified --summary-id. No POST was retried.');
      await manualProcessing(source.recording_id);
      const existing = (await list()).filter(value => value.template_id === config.template);
      requireValue(existing.length === 0, 'A summary already uses this template, possibly with another provider. Use --inspect and --summary-id; POST could replace it.');
      if (signal?.aborted) throw new Error('Cancelled before creation; no POST was sent.');
      journal.claim(); // Committed before the one permitted POST, including process-crash uncertainty.
      const created = checkSummary(await api('/summaries', {
        transcription_id: config.transcriptionId, template_id: config.template, provider: config.provider,
      }, saved.request_key), config);
      journal.remember(created.id);
    }
    const knownId = journal.row().summary_id;
    const deadline = now() + pollTimeoutMs;
    const timeoutMessage = `Polling timed out for ${knownId}. Run again with the same journal to read this job.`;
    for (;;) {
      const remaining = deadline - now();
      requireValue(remaining > 0, timeoutMessage);
      let result;
      try { result = await api(`/summaries/${knownId}`, undefined, undefined, Math.min(25000, remaining)); }
      catch (error) { if (now() >= deadline) throw new Error(timeoutMessage); throw error; }
      requireValue(now() < deadline, timeoutMessage);
      const summary = checkSummary(result, config, knownId);
      if (summary.status === 'completed') return { id: summary.id, transcription_id: summary.transcription_id, template_id: summary.template_id, provider: summary.provider, output: summary.output };
      requireValue(summary.status !== 'failed', `Summary ${knownId} failed. Its identity is retained; no replacement is created.`);
      await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - now())));
    }
  } finally { journal.close(); }
}

const help = `Summarize one existing completed transcription using a built-in template.
Usage: npm start -- [--inspect | --summary-id sum_... | --help]
Required environment: BOTA_API_KEY, BOTA_PROJECT_ID, BOTA_TRANSCRIPTION_ID
Optional: BOTA_API_BASE_URL (https://api.bota.dev/v1), BOTA_TEMPLATE_ID
  (tmpl_general_notes), BOTA_SUMMARY_PROVIDER (gemini), SUMMARY_STATE_PATH
  (./state/summary.sqlite).
The journal permits one POST only; restarts read its saved summary ID.
--inspect lists metadata without creating or attaching anything.
--summary-id validates and retains an explicit existing summary for polling.
Keep the journal. Do not delete it to retry an uncertain creation.
Successful output is JSON on stdout; it can contain sensitive summary content.`;

export async function main(args = process.argv.slice(2), env = process.env) {
  if (args.length === 1 && args[0] === '--help') { console.log(help); return; }
  const inspect = args.length === 1 && args[0] === '--inspect';
  const summaryId = args.length === 2 && args[0] === '--summary-id' ? args[1] : undefined;
  requireValue(args.length === 0 || inspect || summaryId, 'Unknown arguments. Run npm start -- --help.');
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try { console.log(JSON.stringify(await summarize(readConfig(env), { inspect, summaryId, signal: controller.signal }), null, 2)); }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
