import { randomUUID } from 'node:crypto';
import { link, lstat, open, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const MAX_RESPONSE_BYTES = 1024 * 1024;
class SafeError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new SafeError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);

function configuration() {
  let base;
  try { base = new URL(process.env.BOTA_API_BASE_URL); }
  catch { throw new SafeError('Configure the intended API origin ending in /v1.'); }
  const local = base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  requireValue((base.protocol === 'https:' || local) && !base.username && !base.password &&
    !base.search && !base.hash && /^\/v1\/?$/.test(base.pathname), 'Use HTTPS (or loopback HTTP), API path /v1 and no URL credentials/query/fragment.');
  const key = process.env.BOTA_API_KEY;
  requireValue(typeof key === 'string' && key.length <= 256 &&
    /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) && !key.toLowerCase().includes('replace_me'),
  'Configure a server-held key with recordings:read, transcriptions:read and summaries:read.');
  const project = process.env.BOTA_PROJECT_ID;
  requireValue(typeof project === 'string' && /^[A-Za-z0-9_-]{3,128}$/.test(project) &&
    !project.toLowerCase().includes('replace_me'), 'Configure the exact expected project ID.');
  const owner = process.env.BOTA_END_USER_ID;
  const recording = process.env.BOTA_RECORDING_ID;
  const transcription = process.env.BOTA_TRANSCRIPTION_ID;
  const summary = process.env.BOTA_SUMMARY_ID;
  requireValue(validId(owner, 'eu') && validId(recording, 'rec') && validId(transcription, 'txn') && validId(summary, 'sum'),
    'Configure the exact end-user, recording, transcription and summary identifiers.');
  const output = process.env.OUTPUT_PATH;
  requireValue(typeof output === 'string' && output.length > 0 && output.length <= 2048 &&
    !/[\x00-\x1f\x7f]/.test(output), 'Configure a new output file in an existing private directory.');
  return { base: base.href.replace(/\/$/, ''), key, project, owner, recording,
    transcription, summary, output: resolve(output) };
}

function text(value) {
  requireValue(typeof value === 'string' && value.length <= 10_000, 'Invalid or oversized general-notes text.');
  const plain = value.replace(/[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  requireValue(plain.length > 0, 'General-notes text must not be blank.');
  // Encode punctuation in source text, so it cannot become Markdown, HTML or an autolink.
  return plain.replace(/[!-/:-@\[-`{-~]/g, character => `&#${character.charCodeAt(0)};`);
}

function markdown(summary) {
  const output = summary.output;
  requireValue(object(output), 'Completed general-notes summary has no structured output.');
  const sections = [['key_points', 'Key points'], ['action_items', 'Action items'],
    ['participants', 'Participants'], ['decisions', 'Decisions']];
  const lines = ['# General notes', '', '## Overview', '', text(output.overview), ''];
  for (const [field, title] of sections) {
    requireValue(Array.isArray(output[field]) && output[field].length <= 200, 'Invalid or oversized general-notes list.');
    const values = output[field].map(text);
    lines.push(`## ${title}`, '', ...(values.length ? values.map(value => `- ${value}`) : ['None reported.']), '');
  }
  const content = lines.join('\n');
  requireValue(Buffer.byteLength(content, 'utf8') <= 2 * 1024 * 1024, 'Rendered Markdown exceeds this example\'s 2 MiB limit.');
  return content;
}

async function exportSummary(config) {
  const signal = AbortSignal.timeout(30_000);
  let partial; let file;
  try {
    try {
      await lstat(config.output);
      throw new SafeError('Output already exists; no file was overwritten.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    requireValue((await lstat(dirname(config.output))).isDirectory(), 'Output directory must already exist.');
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
        requireValue(size <= MAX_RESPONSE_BYTES, 'API response exceeds this example\'s 1 MiB limit.');
        chunks.push(chunk);
      }
      signal.throwIfAborted();
      try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { throw new SafeError('The API returned invalid JSON.'); }
    }
    const recording = await api(`/recordings/${config.recording}`);
    requireValue(object(recording) && recording.id === config.recording && recording.end_user_id === config.owner &&
      !recording.deleted_at && (!('project_id' in recording) || recording.project_id === config.project),
    'Recording identity, project or configured owner mismatch.');
    const transcription = await api(`/transcriptions/${config.transcription}`);
    requireValue(object(transcription) && transcription.id === config.transcription &&
      transcription.recording_id === config.recording && transcription.status === 'completed' &&
      (!('project_id' in transcription) || transcription.project_id === config.project),
    'Transcription must match the completed configured source and project.');
    const summary = await api(`/summaries/${config.summary}`);
    requireValue(object(summary) && summary.id === config.summary && summary.project_id === config.project &&
      summary.transcription_id === config.transcription && summary.status === 'completed' &&
      summary.template_id === 'tmpl_general_notes' && summary.custom_prompt === null,
    'Summary must be the completed configured general-notes result, with no custom prompt.');
    const content = markdown(summary);
    signal.throwIfAborted();
    const candidate = join(dirname(config.output), `.${basename(config.output)}.${randomUUID()}.partial`);
    file = await open(candidate, 'wx', 0o600);
    partial = candidate; // Cleanup applies only after this invocation's exclusive creation succeeds.
    await file.writeFile(content, { encoding: 'utf8', signal });
    await file.sync();
    await file.close(); file = undefined;
    signal.throwIfAborted();
    await link(partial, config.output); // Refuses an existing file or symlink at publication time.
  } finally {
    await file?.close().catch(() => {});
    if (partial) {
      try { await unlink(partial); }
      catch { throw new SafeError('Could not remove this invocation\'s partial file; inspect the output directory.'); }
    }
  }
}

try {
  await exportSummary(configuration());
  console.log('Exported completed general notes to OUTPUT_PATH.');
} catch (error) {
  console.error(error instanceof SafeError ? error.message :
    'Export failed or its deadline expired. Inspect configuration, API access and local output before trying again.');
  process.exitCode = 1;
}
