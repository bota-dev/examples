import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const contentTypes = {
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg', '.opus': 'audio/opus', '.flac': 'audio/flac',
  '.webm': 'audio/webm', '.aac': 'audio/aac',
};
const maxBytes = 25 * 1024 * 1024;

function checkedUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} must be a valid URL.`); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.hash) {
    throw new Error(`${label} requires HTTPS (HTTP is allowed only on loopback).`);
  }
  return url;
}

function resourceId(value, prefix) {
  if (typeof value !== 'string' || !new RegExp(`^${prefix}_[A-Za-z0-9_-]+$`).test(value)) {
    throw new Error(`API returned an invalid ${prefix} identifier.`);
  }
  return value;
}

export async function uploadAndTranscribe({ filePath, apiBaseUrl, apiKey, endUserId }, {
  fetchImpl = fetch,
  onProgress = () => {},
  pollIntervalMs = 2000,
  pollTimeoutMs = 300000,
  requestTimeoutMs = 30000,
} = {}) {
  const base = checkedUrl(apiBaseUrl, 'BOTA_API_BASE_URL');
  if (base.search || base.pathname.replace(/\/$/, '') !== '/v1') {
    throw new Error('BOTA_API_BASE_URL must end in /v1 with no query string.');
  }
  if (!apiKey || apiKey === 'replace_me' || /[\r\n]/.test(apiKey)) {
    throw new Error('Set BOTA_API_KEY to a project-scoped server credential.');
  }
  if (!/^eu_[A-Za-z0-9_-]+$/.test(endUserId ?? '') || endUserId === 'eu_replace_me') {
    throw new Error('Set BOTA_END_USER_ID to an existing test end user in the project.');
  }
  const contentType = contentTypes[extname(filePath).toLowerCase()];
  if (!contentType) throw new Error('Unsupported audio extension; see README.md.');
  let audio;
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size === 0 || info.size > maxBytes) {
      throw new Error('size');
    }
    audio = await readFile(filePath);
    if (audio.length === 0 || audio.length > maxBytes) throw new Error('size');
  } catch {
    throw new Error('Audio must be a readable, nonempty file of at most 25 MiB.');
  }
  const completion = {
    file_size_bytes: audio.length,
    content_sha256: createHash('sha256').update(audio).digest('hex'),
  };

  async function api(path, { body, signal, allowPending = false } = {}) {
    const method = body === undefined ? 'GET' : 'POST';
    const label = `${method} ${path}`;
    let response;
    try {
      response = await fetchImpl(`${base.href.replace(/\/$/, '')}${path}`, {
        method,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'error',
        signal: AbortSignal.any([AbortSignal.timeout(requestTimeoutMs), ...(signal ? [signal] : [])]),
      });
      if (allowPending && response.status === 425) {
        await response.body?.cancel();
        return null;
      }
      if (!response.ok) {
        await response.body?.cancel();
      } else {
        const data = await response.json();
        if (allowPending && response.status !== 200) {
          throw new Error('Completion requires HTTP 200.');
        }
        return data;
      }
    } catch {
      throw new Error(`${label} did not return a usable response; its outcome may be unknown.`);
    }
    throw new Error(`${label} failed (HTTP ${response.status}). Inspect the resource before retrying.`);
  }

  async function poll(label, check) {
    const signal = AbortSignal.timeout(pollTimeoutMs);
    let delay = pollIntervalMs;
    try {
      while (true) {
        signal.throwIfAborted();
        const result = await check(signal);
        if (result !== null) return result;
        await sleep(delay, undefined, { signal });
        delay = Math.min(delay * 2, 10000);
      }
    } catch (error) {
      if (signal.aborted) throw new Error(`${label} timed out; cloud work may still be running.`);
      throw error;
    }
  }

  const recording = await api('/recordings', { body: {
    end_user_id: endUserId,
    name: `API upload example ${new Date().toISOString()}`,
    source: 'api_upload',
    upload_method: 'import',
  } });
  const recordingId = resourceId(recording.id, 'rec');
  onProgress(`Recording created: ${recordingId}`);

  const upload = await api(`/recordings/${recordingId}/upload-url`, {
    body: { content_type: contentType, file_size_bytes: audio.length },
  });
  const uploadUrl = checkedUrl(upload.upload_url, 'Upload URL');
  if (!Object.values(contentTypes).includes(upload.content_type)) {
    throw new Error('API returned an unsupported upload content type.');
  }
  let stored;
  try {
    stored = await fetchImpl(uploadUrl.href, {
      method: 'PUT',
      headers: { 'Content-Type': upload.content_type },
      body: audio,
      redirect: 'error',
      signal: AbortSignal.timeout(120000),
    });
    await stored.body?.cancel();
  } catch {
    throw new Error('Storage PUT failed or timed out; inspect the recording before retrying.');
  }
  if (!stored.ok) throw new Error(`Storage PUT failed (HTTP ${stored.status}).`);
  onProgress('Audio stored; waiting for server integrity verification.');

  const completed = await poll('Upload verification', signal => api(
    `/recordings/${recordingId}/upload-complete`,
    { body: completion, signal, allowPending: true },
  ));
  if (completed.id !== recordingId || completed.content_sha256 !== completion.content_sha256 ||
      !completed.content_sha256_verified_at || completed.status !== 'uploaded') {
    throw new Error('Upload completion response did not confirm the expected recording and hash.');
  }
  onProgress('Upload confirmed. Starting transcription.');

  const created = await api('/transcriptions', { body: { recording_id: recordingId } });
  const transcriptionId = resourceId(created.id, 'txn');
  onProgress(`Transcription created: ${transcriptionId}`);
  const transcription = await poll('Transcription', async signal => {
    const current = await api(`/transcriptions/${transcriptionId}`, { signal });
    if (current.id !== transcriptionId || current.recording_id !== recordingId) {
      throw new Error('API returned a transcription for an unexpected recording.');
    }
    if (current.status === 'completed' && typeof current.full_text === 'string') return current;
    if (current.status === 'failed') throw new Error(`Transcription ${transcriptionId} failed. Inspect it through the API.`);
    if (!['pending', 'processing'].includes(current.status)) throw new Error('Unexpected transcription status or result.');
    return null;
  });
  return { recording_id: recordingId, transcription_id: transcriptionId, text: transcription.full_text };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--help') || process.argv.length !== 3) {
    console.log('Usage: npm start -- <audio-file>\nConfigure .env first; see README.md.');
    process.exitCode = process.argv.includes('--help') ? 0 : 1;
  } else {
    try {
      const result = await uploadAndTranscribe({
        filePath: process.argv[2],
        apiBaseUrl: process.env.BOTA_API_BASE_URL,
        apiKey: process.env.BOTA_API_KEY,
        endUserId: process.env.BOTA_END_USER_ID,
      }, { onProgress: message => console.error(message) });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
