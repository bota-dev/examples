import { backendOrigin } from './backend.ts';

// Customer-backend DTOs. The server checks project, end-user and source ownership.
export type Recording = {
  id: string; name: string | null; status: string; created_at: string;
  duration_seconds: number | null; upload_verified: boolean;
};
export type RecordingPage = { data: Recording[]; has_more: boolean; next_cursor: string | null };
export type Transcription = {
  id: string; recording_id: string; status: string; full_text?: string | null;
  created_at?: string | null;
};
export type Notes = { overview: string; key_points: string[]; action_items: string[]; participants: string[]; decisions: string[] };
export type Summary = { id: string; transcription_id: string; recording_id: string; status: string; template_id: string; output?: Notes | null };
export type Operation = { id: string; kind: string; state: string; resource_id: string | null; updated_at: string };
export type MutationResult = { operation: Operation };
export type Citation = { recording_id: string; start_ms: number };
export type AskResult = MutationResult & { answer?: string; citations?: Citation[] };
export type AudioImport = { name: string; mime: string; body: Blob };
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const AUDIO_TYPES = ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/opus', 'audio/webm', 'audio/flac', 'audio/x-flac'];
export function pickerAudioType(name: string, provided?: string) {
  const mime = provided?.toLowerCase().trim();
  const aliases: Record<string, string> = { 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/mp3': 'audio/mpeg', 'audio/m4a': 'audio/mp4', 'audio/x-m4a': 'audio/mp4', 'audio/x-flac': 'audio/flac' };
  if (mime && mime !== 'application/octet-stream') return Object.hasOwn(aliases, mime) ? aliases[mime] : AUDIO_TYPES.includes(mime) ? mime : '';
  const extensions: Record<string, string> = { wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/opus', webm: 'audio/webm', flac: 'audio/flac' };
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? '';
  return Object.hasOwn(extensions, extension) ? extensions[extension] : '';
}

export interface LibraryApi {
  list(cursor?: string, signal?: AbortSignal): Promise<RecordingPage>;
  detail(id: string, signal?: AbortSignal): Promise<Recording>;
  transcriptions(recordingId: string, signal?: AbortSignal): Promise<Transcription[]>;
  summaries(transcriptionId: string, recordingId: string, signal?: AbortSignal): Promise<Summary[]>;
  startTranscription(recordingId: string, signal?: AbortSignal): Promise<MutationResult>;
  startSummary(transcriptionId: string, signal?: AbortSignal): Promise<MutationResult>;
  ask(recordingId: string, question: string, signal?: AbortSignal): Promise<AskResult>;
  operations(signal?: AbortSignal): Promise<Operation[]>;
  operation(id: string, signal?: AbortSignal, recordingId?: string): Promise<AskResult>;
  upload(input: AudioImport, signal?: AbortSignal): Promise<MutationResult>;
  audio(recordingId: string, signal?: AbortSignal): Promise<Uint8Array>;
  dispose(): void;
}

export class LibraryError extends Error {
  readonly status: number;
  readonly code: string;
  readonly operation?: Operation;
  readonly operationPresent: boolean;
  constructor(status: number, code: string, operation?: Operation, operationPresent = false) {
    const messages: Record<string, string> = {
      unauthorized: 'The application token was rejected. Connect again.',
      upload_unverified: 'Refresh this recording after upload verification finishes.',
      transcription_incomplete: 'Complete and refresh the transcript before creating notes.',
      invalid_configuration: 'Enter an HTTPS backend origin and a separate application token.',
      invalid_question: 'Enter a question between 1 and 10,000 characters.',
      outcome_unknown: 'The connection ended. Refresh the saved request; this action will not be sent again.',
      invalid_response: 'The response could not be verified. Refresh reads and inspect the retained request.',
      invalid_audio: 'Choose one supported audio file between 1 byte and 25 MiB with a valid filename.',
      playback_unavailable: 'Playback is available only for verified ordinary audio imports. Device and encrypted audio are unavailable.',
      cleanup_failed: 'Local audio cleanup failed. Restart the app before loading more audio.',
      playback_failed: 'This audio could not be decoded or played. Choose supported audio or reload it.',
      playback_timeout: 'Audio did not finish loading. Reload it before trying playback again.',
    };
    super(messages[code] ?? 'The request could not complete. Preserve the server journal and refresh current results.');
    this.name = 'LibraryError'; this.status = status; this.code = code;
    this.operation = operation; this.operationPresent = operationPresent;
  }
}
export const safeMessage = (error: unknown) => error instanceof LibraryError ? error.message : 'The request could not complete. Refresh current results before continuing.';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown, prefix: string): value is string => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9_-]{1,128}$`).test(value);
const timestamp = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value));
const invalid = (): never => { throw new LibraryError(502, 'invalid_response'); };
const jobStatus = (value: unknown): value is string => typeof value === 'string' && ['pending', 'processing', 'completed', 'failed'].includes(value);

export function recording(value: unknown, expected?: string): Recording {
  if (!object(value) || !id(value.id, 'rec') || (expected && value.id !== expected) ||
      !(value.name === null || (typeof value.name === 'string' && value.name.length <= 255)) ||
      typeof value.status !== 'string' || !['pending', 'streaming', 'uploaded', 'processing', 'completed', 'failed', 'integrity_failure'].includes(value.status) ||
      !timestamp(value.created_at) || typeof value.upload_verified !== 'boolean' ||
      !(value.duration_seconds === null || (typeof value.duration_seconds === 'number' && Number.isFinite(value.duration_seconds) && value.duration_seconds >= 0))) return invalid();
  return { id: value.id, name: value.name, status: value.status, created_at: value.created_at,
    duration_seconds: value.duration_seconds, upload_verified: value.upload_verified };
}

export function operationMetadata(value: unknown): Operation | undefined {
  if (!object(value) || typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value.id) ||
      typeof value.kind !== 'string' || !['upload', 'transcription', 'summary', 'ask'].includes(value.kind) ||
      typeof value.state !== 'string' || !['claimed', 'creating', 'created', 'uploading', 'verifying', 'verification_pending', 'starting', 'sending', 'submitted', 'complete', 'uncertain'].includes(value.state) ||
      !(value.resource_id === null || (typeof value.resource_id === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(value.resource_id))) ||
      !timestamp(value.updated_at)) return undefined;
  return { id: value.id, kind: value.kind, state: value.state, resource_id: value.resource_id, updated_at: value.updated_at };
}

function collection(value: unknown, max = 200): unknown[] {
  if (!object(value) || !Array.isArray(value.data) || value.data.length > max) return invalid();
  return value.data;
}
function transcript(value: unknown, recordingId: string): Transcription {
  if (!object(value) || !id(value.id, 'txn') || value.recording_id !== recordingId || !jobStatus(value.status) ||
      !(value.created_at == null || timestamp(value.created_at)) ||
      (value.status === 'completed' && !(typeof value.full_text === 'string' && value.full_text.length <= 1_000_000))) return invalid();
  return { id: value.id, recording_id: recordingId, status: value.status,
    created_at: typeof value.created_at === 'string' ? value.created_at : null,
    ...(value.status === 'completed' ? { full_text: value.full_text as string } : {}) };
}
function summary(value: unknown, transcriptionId: string, recordingId: string): Summary {
  if (!object(value) || !id(value.id, 'sum') || value.transcription_id !== transcriptionId ||
      value.recording_id !== recordingId ||
      !jobStatus(value.status) || value.template_id !== 'tmpl_general_notes') return invalid();
  let output: Notes | undefined;
  if (value.status === 'completed') {
    const notes = value.output;
    if (!object(notes) || typeof notes.overview !== 'string' || notes.overview.length > 10_000) return invalid();
    output = { overview: notes.overview, key_points: [], action_items: [], participants: [], decisions: [] };
    for (const field of ['key_points', 'action_items', 'participants', 'decisions'] as const) {
      const items = notes[field];
      if (!Array.isArray(items) || items.length > 200 || items.some(item => typeof item !== 'string' || item.length > 10_000)) return invalid();
      output[field] = items as string[];
    }
  }
  return { id: value.id, transcription_id: transcriptionId, recording_id: recordingId,
    status: value.status, template_id: 'tmpl_general_notes', ...(output ? { output } : {}) };
}
function mutation(value: unknown, kind?: string, recordingId?: string): AskResult {
  if (!object(value)) return invalid();
  const operation = operationMetadata(value.operation);
  if (!operation || (kind && operation.kind !== kind)) return invalid();
  const result: AskResult = { operation };
  const rejectContent = (): never => { throw new LibraryError(502, 'invalid_response', operation, true); };
  // Generic saved-request reads expose metadata only. Content needs the known recording scope.
  if (recordingId && operation.kind === 'ask' && Object.hasOwn(value, 'answer')) {
    if (typeof value.answer !== 'string' || !value.answer.trim() || value.answer.length > 1_000_000 || !Array.isArray(value.citations) || value.citations.length > 1000) return rejectContent();
    result.answer = value.answer;
    result.citations = value.citations.map(item => {
      if (!object(item) || item.recording_id !== recordingId || !Number.isSafeInteger(item.start_ms) || (item.start_ms as number) < 0) return rejectContent();
      return { recording_id: recordingId, start_ms: item.start_ms as number };
    });
  } else if (recordingId && Object.hasOwn(value, 'citations')) return rejectContent();
  return result;
}

export function normalizeQuestion(value: string): string {
  const trimmed = value.trim();
  // Avoid backend replacement of unpaired UTF-16 code units changing request identity.
  if (!trimmed || trimmed.length > 10_000 || /[\uD800-\uDFFF]/u.test(trimmed)) throw new LibraryError(400, 'invalid_question');
  return trimmed;
}

export function validateAudioImport(input: AudioImport) {
  if (!input.name.trim() || input.name.length > 255 || /[\x00-\x1f\x7f/\\\uD800-\uDFFF]/u.test(input.name) ||
      !AUDIO_TYPES.includes(input.mime) || !Number.isSafeInteger(input.body.size) || input.body.size < 1 || input.body.size > MAX_AUDIO_BYTES)
    throw new LibraryError(400, 'invalid_audio');
}

export async function readWav(response: Response): Promise<Uint8Array> {
  const length = response.headers.get('content-length');
  if (!/^audio\/wav(?:;|$)/i.test(response.headers.get('content-type') ?? '') ||
      !length || !/^\d+$/.test(length) || Number(length) < 44 || Number(length) > MAX_AUDIO_BYTES ||
      !response.headers.get('cache-control')?.split(',').some(value => value.trim().toLowerCase() === 'no-store') || !response.body) {
    await response.body?.cancel().catch(() => {});
    throw new LibraryError(502, 'invalid_response');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > Number(length) || total > MAX_AUDIO_BYTES) throw new LibraryError(502, 'invalid_response');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (total !== Number(length)) throw new LibraryError(502, 'invalid_response');
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const matches = (start: number, text: string) => [...text].every((char, index) => bytes[start + index] === char.charCodeAt(0));
  const size = new DataView(bytes.buffer).getUint32(4, true);
  if (!matches(0, 'RIFF') || !matches(8, 'WAVE') || (size !== 0xffffffff && size !== total - 8)) throw new LibraryError(502, 'invalid_response');
  return bytes;
}

export function createLibraryApi(originInput: string, tokenInput: string, onExpired: () => void = () => {}, fetchImpl: typeof fetch = fetch): LibraryApi {
  let origin: string;
  try { origin = backendOrigin(originInput.trim()); } catch { throw new LibraryError(0, 'invalid_configuration'); }
  let token = tokenInput.trim();
  if (!token || token.length < 32 || token.length > 256 || /\s/.test(token) || /^(sk_|rk_|dtok_|up_|rct_)/.test(token)) throw new LibraryError(0, 'invalid_configuration');
  let disposed = false;
  const resource = (value: string, prefix: string) => { if (!id(value, prefix)) return invalid(); return encodeURIComponent(value); };
  async function request(path: string, method = 'GET', body?: unknown, signal?: AbortSignal, audioInput?: AudioImport, binary = false): Promise<unknown> {
    if (disposed) throw new LibraryError(0, 'unauthorized');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, audioInput ? 180_000 : binary ? 120_000 : path.endsWith('/ask') && method === 'POST' ? 210_000 : 30_000);
    try {
      const target = `${origin}/api/library${path}`;
      const response = await fetchImpl(target, {
        method, credentials: 'omit', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, Accept: binary ? 'audio/wav' : 'application/json',
          ...(audioInput ? { 'Content-Type': audioInput.mime, 'X-File-Name': encodeURIComponent(audioInput.name) } : body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(audioInput ? { body: audioInput.body } : body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.url && response.url !== target) return invalid();
      if (response.status === 401) { onExpired(); throw new LibraryError(401, 'unauthorized'); }
      if (binary && response.ok) {
        const bytes = await readWav(response);
        if (disposed || controller.signal.aborted) throw new LibraryError(0, 'unauthorized');
        return bytes;
      }
      if (!/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) return invalid();
      const length = response.headers.get('content-length');
      if (length && (!/^\d+$/.test(length) || Number(length) > 2 * 1024 * 1024)) return invalid();
      // React Native fetch buffers responses natively; this cap is enforced on received text.
      const raw = await response.text();
      if (raw.length > 2 * 1024 * 1024) return invalid();
      let value: unknown;
      try { value = JSON.parse(raw); } catch { return invalid(); }
      if (!response.ok) {
        const code = object(value) && object(value.error) && typeof value.error.code === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value.error.code) ? value.error.code : 'request_failed';
        throw new LibraryError(response.status, code, object(value) ? operationMetadata(value.operation) : undefined, object(value) && Object.hasOwn(value, 'operation'));
      }
      return value;
    } catch (error) {
      if (error instanceof LibraryError) throw error;
      throw new LibraryError(0, 'outcome_unknown');
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
    }
  }
  return {
    async list(cursor, signal) {
      if (cursor !== undefined && (!cursor || cursor.length > 1024 || /[\x00-\x1f\x7f]/.test(cursor))) return invalid();
      const value = await request(`/recordings${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, 'GET', undefined, signal);
      const data = collection(value, 20).map(item => recording(item));
      if (!object(value) || typeof value.has_more !== 'boolean' ||
          !(value.next_cursor === null || (typeof value.next_cursor === 'string' && value.next_cursor.length > 0 && value.next_cursor.length <= 1024 && !/[\x00-\x1f\x7f]/.test(value.next_cursor))) ||
          (value.has_more ? !value.next_cursor || data.length === 0 : value.next_cursor !== null) || new Set(data.map(row => row.id)).size !== data.length) return invalid();
      return { data, has_more: value.has_more, next_cursor: value.next_cursor };
    },
    async detail(id, signal) { return recording(await request(`/recordings/${resource(id, 'rec')}`, 'GET', undefined, signal), id); },
    async transcriptions(recordingId, signal) { return collection(await request(`/recordings/${resource(recordingId, 'rec')}/transcriptions`, 'GET', undefined, signal)).map(row => transcript(row, recordingId)); },
    async summaries(transcriptionId, recordingId, signal) {
      resource(recordingId, 'rec');
      return collection(await request(`/transcriptions/${resource(transcriptionId, 'txn')}/summaries`, 'GET', undefined, signal)).map(row => summary(row, transcriptionId, recordingId));
    },
    async startTranscription(recordingId, signal) { return mutation(await request(`/recordings/${resource(recordingId, 'rec')}/transcriptions`, 'POST', {}, signal), 'transcription'); },
    async startSummary(transcriptionId, signal) { return mutation(await request(`/transcriptions/${resource(transcriptionId, 'txn')}/summaries`, 'POST', {}, signal), 'summary'); },
    async ask(recordingId, question, signal) { return mutation(await request(`/recordings/${resource(recordingId, 'rec')}/ask`, 'POST', { question: normalizeQuestion(question) }, signal), 'ask', recordingId); },
    async operations(signal) { return collection(await request('/operations', 'GET', undefined, signal), 50).map(row => operationMetadata(row) ?? invalid()); },
    async operation(id, signal, recordingId) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return invalid();
      const result = mutation(await request(`/operations/${encodeURIComponent(id)}`, 'GET', undefined, signal), undefined, recordingId);
      if (result.operation.id !== id) return invalid();
      return result;
    },
    async upload(input, signal) {
      validateAudioImport(input);
      return mutation(await request('/uploads', 'POST', undefined, signal, input), 'upload');
    },
    async audio(recordingId, signal) {
      return await request(`/recordings/${resource(recordingId, 'rec')}/audio`, 'GET', undefined, signal, undefined, true) as Uint8Array;
    },
    dispose() { disposed = true; token = ''; origin = ''; },
  };
}
