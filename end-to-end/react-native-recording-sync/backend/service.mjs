import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ID = { device: /^dev_[A-Za-z0-9]+$/, recording: /^rec_[A-Za-z0-9]+$/, user: /^eu_[A-Za-z0-9]+$/, transcription: /^txn_[A-Za-z0-9]+$/ };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA = /^[0-9a-f]{64}$/;
const STATES = ['created', 'staging', 'staged', 'ready', 'processing', 'published', 'failed', 'cancelled', 'expired'];
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class RequestError extends Error {
  constructor(status, code, message = code.replaceAll('_', ' ')) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new RequestError(status, code, message); };
const valid = (condition, code = 'invalid_request') => { if (!condition) fail(400, code); };
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
function fields(body, required, optional = []) {
  valid(body && typeof body === 'object' && !Array.isArray(body));
  valid(Object.keys(body).every(key => required.includes(key) || optional.includes(key)) && required.every(key => Object.hasOwn(body, key)));
}
function base64(value, min, max = min) {
  valid(typeof value === 'string' && value.length <= Math.ceil(max / 3) * 4);
  const bytes = Buffer.from(value, 'base64');
  valid(bytes.length >= min && bytes.length <= max && bytes.toString('base64') === value);
  return bytes;
}
function responseDocument(value, sha, length) {
  try {
    const bytes = base64(value, length);
    if (!SHA.test(sha) || createHash('sha256').update(bytes).digest('hex') !== sha) fail(502, 'upstream_response_invalid');
  } catch { fail(502, 'upstream_response_invalid'); }
}

export function readConfig(env) {
  const api = new URL(env.BOTA_API_BASE_URL ?? '');
  valid(api.protocol === 'https:' || (api.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)), 'invalid_api_origin');
  valid(api.pathname.replace(/\/$/, '') === '/v1' && !api.search && !api.hash && !api.username && !api.password, 'invalid_api_origin');
  valid(typeof env.BOTA_API_KEY === 'string' && /^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(env.BOTA_API_KEY), 'invalid_api_key');
  valid(ID.device.test(env.BOTA_DEVICE_ID) && ID.user.test(env.BOTA_END_USER_ID), 'invalid_fixed_identity');
  valid(typeof env.BOTA_PROJECT_ID === 'string' && /^[A-Za-z0-9_-]{3,128}$/.test(env.BOTA_PROJECT_ID), 'invalid_project');
  valid(typeof env.APP_ACCESS_TOKEN === 'string' && env.APP_ACCESS_TOKEN.length >= 32 && env.APP_ACCESS_TOKEN.length <= 256 && !/\s/.test(env.APP_ACCESS_TOKEN) && !/^(sk_|rk_|dtok_)/.test(env.APP_ACCESS_TOKEN) && env.APP_ACCESS_TOKEN !== env.BOTA_API_KEY, 'invalid_application_token');
  return { apiBase: api.href.replace(/\/$/, ''), apiKey: env.BOTA_API_KEY, projectId: env.BOTA_PROJECT_ID,
    endUserId: env.BOTA_END_USER_ID, deviceId: env.BOTA_DEVICE_ID, appToken: env.APP_ACCESS_TOKEN };
}

/** A single fixed customer identity. The database never contains signed material or audio. */
export class SyncService {
  constructor(config, { database = './data/recording-sync.sqlite', fetchImpl = fetch } = {}) {
    this.config = config;
    this.fetch = fetchImpl;
    this.busy = new Set();
    this.db = new DatabaseSync(database);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS scope (id INTEGER PRIMARY KEY CHECK(id=1), identity TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS captures (
        capture_key TEXT PRIMARY KEY, generation INTEGER NOT NULL, identity TEXT NOT NULL,
        recording_id TEXT UNIQUE, session_state TEXT, session_id TEXT, owner_revision INTEGER,
        session_fingerprint TEXT, transcription_state TEXT, transcription_id TEXT UNIQUE
      );
      CREATE TABLE IF NOT EXISTS contexts (
        context_key TEXT PRIMARY KEY, generation INTEGER NOT NULL, state TEXT NOT NULL, context_id TEXT UNIQUE
      );`);
    const identity = digest([config.apiBase, config.projectId, config.endUserId, config.deviceId]);
    const old = this.db.prepare('SELECT identity FROM scope WHERE id=1').get();
    if (old && old.identity !== identity) { this.db.close(); fail(409, 'journal_scope_changed', 'Use the original server identity with this journal.'); }
    this.db.prepare('INSERT OR IGNORE INTO scope (id,identity) VALUES (1,?)').run(identity);
    if (this.db.prepare('SELECT identity FROM scope WHERE id=1').get().identity !== identity) { this.db.close(); fail(409, 'journal_scope_changed'); }
  }
  close() { this.db.close(); }

  async upstream(path, method = 'GET', body) {
    // Every path comes from a fixed route below and validated identifiers.
    let response;
    try {
      response = await this.fetch(this.config.apiBase + path, { method, redirect: 'error', signal: AbortSignal.timeout(25_000),
        headers: { Authorization: `Bearer ${this.config.apiKey}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (!response.ok) fail(response.status === 404 ? 404 : response.status === 429 ? 429 : 502, 'upstream_rejected');
      if (response.status === 204) return null;
      const reader = response.body.getReader();
      const chunks = []; let length = 0;
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        length += value.length;
        if (length > 2 * 1024 * 1024) { await reader.cancel(); fail(502, 'upstream_response_invalid'); }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      if (error instanceof RequestError) throw error;
      fail(502, 'upstream_unavailable', 'Upstream request outcome may be unknown. Retained operations must be reconciled.');
    }
  }
  async exclusive(key, work) {
    if (this.busy.has(key)) fail(409, 'operation_in_progress');
    this.busy.add(key);
    try { return await work(); } finally { this.busy.delete(key); }
  }
  async device(expectedGeneration) {
    const device = await this.upstream(`/devices/${this.config.deviceId}`);
    if (device?.id !== this.config.deviceId || device.project_id !== this.config.projectId || device.end_user_id !== this.config.endUserId || device.status !== 'bound' || device.deleted_at || !integer(device.binding_generation, 1, 0x7fffffff)) fail(409, 'device_scope_changed');
    if (expectedGeneration !== undefined && device.binding_generation !== expectedGeneration) fail(409, 'binding_changed');
    if (typeof device.serial_number !== 'string' || !/^[A-Za-z0-9]{4,64}$/.test(device.serial_number)) fail(502, 'upstream_response_invalid');
    return device;
  }
  async manualProcessing() {
    const section = await this.upstream(`/devices/${this.config.deviceId}/config/processing`);
    if (section?.value?.auto_transcription?.enabled !== false) fail(409, 'automatic_transcription_enabled', 'Disable effective automatic transcription for the fixed device before using this example.');
  }
  async context() {
    const d = await this.device();
    await this.manualProcessing();
    await this.device(d.binding_generation);
    return { deviceId: d.id, serialNumber: d.serial_number, bindingGeneration: d.binding_generation, endUserId: this.config.endUserId, projectId: this.config.projectId };
  }
  async capture(recordingId, generation) {
    valid(ID.recording.test(recordingId));
    const row = this.db.prepare('SELECT * FROM captures WHERE recording_id=?').get(recordingId);
    if (!row) fail(404, 'recording_not_found');
    if (generation !== undefined && row.generation !== generation) fail(409, 'binding_changed');
    await this.device(row.generation);
    const recording = await this.upstream(`/recordings/${recordingId}`);
    const identity = JSON.parse(row.identity);
    if (recording?.id !== recordingId || recording.project_id !== this.config.projectId || recording.end_user_id !== this.config.endUserId || recording.device_id !== this.config.deviceId || recording.source !== 'device' || recording.deleted_at || recording.recording_uuid !== identity.recording_uuid || recording.recording_generation !== identity.recording_generation) fail(409, 'recording_scope_changed');
    await this.device(row.generation);
    return row;
  }
  async createRecording(body) {
    fields(body, ['device_id', 'binding_generation', 'recording_uuid', 'recording_generation', 'ciphertext_length', 'ciphertext_sha256'], ['started_at_ms', 'duration_ms']);
    valid(body.device_id === this.config.deviceId && integer(body.binding_generation, 1, 0x7fffffff) && UUID.test(body.recording_uuid) && integer(body.recording_generation, 1, 0xffffffff));
    valid(integer(body.ciphertext_length, 1) && SHA.test(body.ciphertext_sha256));
    for (const key of ['started_at_ms', 'duration_ms']) if (body[key] !== undefined) valid(integer(body[key]) || (typeof body[key] === 'string' && /^(0|[1-9][0-9]{0,14})$/.test(body[key])));
    const identity = { device_id: body.device_id, binding_generation: body.binding_generation, recording_uuid: body.recording_uuid, recording_generation: body.recording_generation, ciphertext_length: body.ciphertext_length, ciphertext_sha256: body.ciphertext_sha256 };
    const key = digest([body.recording_uuid, body.recording_generation]);
    return this.exclusive(`capture:${key}`, async () => {
      await this.device(body.binding_generation); await this.manualProcessing();
      await this.device(body.binding_generation);
      const old = this.db.prepare('SELECT * FROM captures WHERE capture_key=?').get(key);
      if (old && old.identity !== JSON.stringify(identity)) fail(409, 'capture_identity_changed');
      if (old?.recording_id) { await this.capture(old.recording_id, body.binding_generation); return { id: old.recording_id, recording_id: old.recording_id }; }
      this.db.prepare('INSERT OR IGNORE INTO captures (capture_key,generation,identity) VALUES (?,?,?)').run(key, body.binding_generation, JSON.stringify(identity));
      // Public POST /recordings explicitly deduplicates this device UUID/generation pair.
      // Retain it even when the response is lost; never fall back to an identity-free create.
      const result = await this.upstream('/recordings', 'POST', { device_id: this.config.deviceId, end_user_id: this.config.endUserId,
        source: 'device', upload_method: 'ble', encryption_version: 2, recording_uuid: body.recording_uuid, recording_generation: body.recording_generation });
      if (!ID.recording.test(result?.id) || result.device_id !== this.config.deviceId || result.end_user_id !== this.config.endUserId || result.project_id !== this.config.projectId || result.recording_uuid !== body.recording_uuid || result.recording_generation !== body.recording_generation) fail(502, 'upstream_response_invalid');
      this.db.prepare('UPDATE captures SET recording_id=? WHERE capture_key=?').run(result.id, key);
      await this.device(body.binding_generation);
      return { id: result.id, recording_id: result.id };
    });
  }
  async sessionStatus(row) {
    const status = await this.upstream(`/recordings/${row.recording_id}/encrypted-upload-v2/sessions/${row.session_id}`);
    const identity = JSON.parse(row.identity);
    if (status?.profile !== 'encrypted_upload_v2' || status.session_id !== row.session_id || status.owner_revision !== row.owner_revision || status.channel !== 'ble' || !STATES.includes(status.state) || status.ciphertext_length !== identity.ciphertext_length || status.ciphertext_sha256 !== identity.ciphertext_sha256) fail(502, 'session_identity_changed');
    responseDocument(status.authorization_base64, status.authorization_sha256, 408);
    if (status.state === 'published') responseDocument(status.completion_receipt_base64, status.completion_receipt_sha256, 336);
    await this.device(row.generation);
    return status;
  }
  async createSession(recordingId, body, generation) {
    const required = ['device_id', 'binding_generation', 'recording_uuid', 'recording_generation', 'storage_format', 'channel', 'capabilities_base64', 'auth_nonce_base64', 'ciphertext_length', 'ciphertext_sha256'];
    fields(body, required); valid(body.channel === 'ble' && body.storage_format === 'bota_enc_v2');
    base64(body.capabilities_base64, 24); base64(body.auth_nonce_base64, 16);
    return this.exclusive(`recording:${recordingId}`, async () => {
      const row = await this.capture(recordingId, generation); const identity = JSON.parse(row.identity);
      valid(Object.entries(identity).every(([key, value]) => body[key] === value), 'capture_identity_changed');
      await this.manualProcessing();
      await this.device(row.generation);
      const fingerprint = digest(required.map(key => body[key]));
      if (row.session_state === 'uncertain') fail(409, 'session_create_uncertain', 'Session creation may have succeeded. Keep the journal and inspect the existing operation; do not create another session.');
      if (row.session_id) {
        if (row.session_fingerprint !== fingerprint) fail(409, 'session_request_changed');
        const status = await this.sessionStatus(row);
        if (['failed', 'cancelled', 'expired'].includes(status.state)) fail(409, 'session_terminal');
        let staging;
        if (['created', 'staging'].includes(status.state)) staging = await this.upstream(`/recordings/${recordingId}/encrypted-upload-v2/sessions/${row.session_id}/staging-url`, 'POST', { owner_revision: row.owner_revision });
        await this.device(generation);
        return { ...status, ...(staging ? { staging } : {}) };
      }
      const intent = this.db.prepare("UPDATE captures SET session_state='uncertain',session_fingerprint=? WHERE recording_id=? AND session_state IS NULL").run(fingerprint, recordingId);
      if (intent.changes !== 1) fail(409, 'session_create_uncertain');
      const result = await this.upstream(`/recordings/${recordingId}/encrypted-upload-v2/sessions`, 'POST', body);
      if (result?.profile !== 'encrypted_upload_v2' || !UUID.test(result.session_id) || !integer(result.owner_revision, 1) || !['legacy_allowed', 'v2_preferred', 'v2_required'].includes(result.policy) || typeof result.authorization_base64 !== 'string' || !SHA.test(result.authorization_sha256) || result.staging?.method !== 'PUT' || typeof result.staging.url !== 'string') fail(502, 'upstream_response_invalid');
      responseDocument(result.authorization_base64, result.authorization_sha256, 408);
      this.db.prepare("UPDATE captures SET session_state='known',session_id=?,owner_revision=? WHERE recording_id=?").run(result.session_id, result.owner_revision, recordingId);
      await this.device(generation);
      return result;
    });
  }
  async sessionOperation(recordingId, sessionId, suffix, method, body, generation) {
    valid(UUID.test(sessionId));
    return this.exclusive(`recording:${recordingId}`, async () => {
      const row = await this.capture(recordingId, generation);
      if (row.session_id !== sessionId || row.session_state !== 'known') fail(404, 'session_not_found');
      if (method === 'GET') return this.sessionStatus(row);
      if (suffix === 'recover') fail(409, 'recovery_requires_reconciliation', 'This bounded example retains terminal or nonce-changed sessions for inspection; it does not replace an upload owner.');
      fields(body, suffix === 'manifest' ? ['owner_revision', 'manifest_base64', 'manifest_sha256'] : ['owner_revision']);
      valid(body.owner_revision === row.owner_revision, 'owner_revision_changed');
      if (suffix === 'manifest') {
        const manifest = base64(body.manifest_base64, 580);
        valid(SHA.test(body.manifest_sha256) && createHash('sha256').update(manifest).digest('hex') === body.manifest_sha256, 'manifest_digest_mismatch');
        await this.manualProcessing();
      }
      const status = await this.sessionStatus(row);
      if (suffix === 'staging-url' && !['created', 'staging'].includes(status.state)) fail(409, 'upload_phase_changed');
      if (['failed', 'cancelled', 'expired'].includes(status.state)) fail(409, 'session_terminal');
      const result = await this.upstream(`/recordings/${recordingId}/encrypted-upload-v2/sessions/${sessionId}${suffix ? '/' + suffix : ''}`, method, body);
      await this.device(generation);
      return result;
    });
  }
  async uploadContext(deviceId, contextId, proof, method, body, generation) {
    valid(deviceId === this.config.deviceId); if (contextId) valid(UUID.test(contextId));
    await this.device(generation);
    const base = `/devices/${deviceId}/encrypted-upload-v2/contexts`;
    if (!contextId) {
      fields(body, ['nonce_base64']); base64(body.nonce_base64, 16);
      const key = digest([generation, body.nonce_base64]);
      return this.exclusive(`context:${key}`, async () => {
        const old = this.db.prepare('SELECT * FROM contexts WHERE context_key=?').get(key);
        if (old?.context_id) {
          const result = await this.upstream(`${base}/${old.context_id}`);
          if (result?.context_id !== old.context_id) fail(502, 'upstream_response_invalid');
          await this.device(generation); return result;
        }
        if (old) fail(409, 'context_create_uncertain');
        const intent = this.db.prepare("INSERT OR IGNORE INTO contexts (context_key,generation,state) VALUES (?,?,'uncertain')").run(key, generation);
        if (intent.changes !== 1) fail(409, 'context_create_uncertain');
        const result = await this.upstream(base, 'POST', body);
        if (!UUID.test(result?.context_id)) fail(502, 'upstream_response_invalid');
        this.db.prepare("UPDATE contexts SET state='known',context_id=? WHERE context_key=?").run(result.context_id, key);
        await this.device(generation); return result;
      });
    }
    const row = this.db.prepare('SELECT * FROM contexts WHERE context_id=?').get(contextId);
    if (!row || row.generation !== generation) fail(404, 'context_not_found');
    if (proof) { fields(body, ['proof_base64']); base64(body.proof_base64, 116, 366); }
    const result = await this.upstream(`${base}/${contextId}${proof ? '/proof' : ''}`, method, proof ? body : undefined);
    if (result?.context_id !== contextId) fail(502, 'upstream_response_invalid');
    await this.device(generation); return result;
  }
  normalizeTranscription(value, recordingId) {
    if (!ID.transcription.test(value?.id) || value.project_id !== this.config.projectId || value.recording_id !== recordingId || !['pending', 'processing', 'completed', 'failed'].includes(value.status)) fail(502, 'upstream_response_invalid');
    return { id: value.id, recordingId, status: value.status, ...(value.status === 'completed' && typeof value.full_text === 'string' ? { text: value.full_text } : {}) };
  }
  async transcribe(recordingId, generation) {
    return this.exclusive(`recording:${recordingId}`, async () => {
      const row = await this.capture(recordingId, generation);
      if (!row.session_id || row.session_state !== 'known' || (await this.sessionStatus(row)).state !== 'published') fail(409, 'publication_pending');
      await this.manualProcessing();
      if (row.transcription_id) return this.getTranscription(row.transcription_id, generation);
      if (row.transcription_state === 'uncertain') fail(409, 'transcription_create_uncertain', 'A transcription may already exist. Inspect the retained recording; no replacement job is created.');
      const existing = await this.upstream(`/transcriptions?recording_id=${recordingId}&limit=2`);
      if (!Array.isArray(existing?.data) || typeof existing.has_more !== 'boolean') fail(502, 'upstream_response_invalid');
      if (existing.has_more || existing.data.length > 1) fail(409, 'multiple_transcriptions_exist');
      if (existing.data.length === 1) {
        const item = this.normalizeTranscription(existing.data[0], recordingId);
        this.db.prepare("UPDATE captures SET transcription_state='known',transcription_id=? WHERE recording_id=?").run(item.id, recordingId);
        await this.device(row.generation); return item;
      }
      await this.device(row.generation);
      const intent = this.db.prepare("UPDATE captures SET transcription_state='uncertain' WHERE recording_id=? AND transcription_state IS NULL").run(recordingId);
      if (intent.changes !== 1) fail(409, 'transcription_create_uncertain');
      const item = this.normalizeTranscription(await this.upstream('/transcriptions', 'POST', { recording_id: recordingId }), recordingId);
      this.db.prepare("UPDATE captures SET transcription_state='known',transcription_id=? WHERE recording_id=?").run(item.id, recordingId);
      await this.device(row.generation); return item;
    });
  }
  async getTranscription(id, generation) {
    valid(ID.transcription.test(id));
    const row = this.db.prepare('SELECT * FROM captures WHERE transcription_id=?').get(id);
    if (!row) fail(404, 'transcription_not_found');
    await this.capture(row.recording_id, generation);
    const result = this.normalizeTranscription(await this.upstream(`/transcriptions/${id}`), row.recording_id);
    await this.device(row.generation); return result;
  }
  async listRecordings(generation) {
    const device = await this.device(generation);
    const rows = this.db.prepare('SELECT recording_id FROM captures WHERE generation=? AND recording_id IS NOT NULL ORDER BY rowid DESC LIMIT 100').all(device.binding_generation);
    const recordings = [];
    for (const item of rows) {
      const row = await this.capture(item.recording_id, device.binding_generation);
      const status = row.session_state === 'uncertain' ? 'session_create_uncertain'
        : row.session_id ? (await this.sessionStatus(row)).state : 'not_started';
      recordings.push({ id: item.recording_id, status });
    }
    await this.device(device.binding_generation);
    return { recordings };
  }
  async route(method, path, body, generationHeader) {
    if (method === 'GET' && path === '/api/context') return this.context();
    if (method === 'POST' && path === '/api/recordings') return this.createRecording(body);
    valid(typeof generationHeader === 'string' && /^[1-9][0-9]*$/.test(generationHeader) && integer(Number(generationHeader), 1, 0x7fffffff), 'binding_generation_required');
    const generation = Number(generationHeader);
    if (method === 'GET' && path === '/api/recordings') return this.listRecordings(generation);
    let match = path.match(/^\/api\/recordings\/(rec_[A-Za-z0-9]+)\/transcription$/);
    if (match && method === 'POST') { fields(body, []); return this.transcribe(match[1], generation); }
    match = path.match(/^\/api\/transcriptions\/(txn_[A-Za-z0-9]+)$/);
    if (match && method === 'GET') return this.getTranscription(match[1], generation);
    match = path.match(/^\/api\/recordings\/(rec_[A-Za-z0-9]+)\/encrypted-upload-v2\/sessions(?:\/([0-9a-f-]+)(?:\/(manifest|staging-url|recover))?)?$/);
    if (match) {
      if (!match[2] && method === 'POST') return this.createSession(match[1], body, generation);
      if (match[2] && ((!match[3] && ['GET', 'DELETE'].includes(method)) || (match[3] && method === 'POST'))) return this.sessionOperation(match[1], match[2], match[3] ?? '', method, body, generation);
    }
    match = path.match(/^\/api\/devices\/(dev_[A-Za-z0-9]+)\/encrypted-upload-v2\/contexts(?:\/([0-9a-f-]+)(\/proof)?)?$/);
    if (match && ((!match[2] && method === 'POST') || (match[2] && (match[3] ? method === 'POST' : method === 'GET')))) return this.uploadContext(match[1], match[2], Boolean(match[3]), method, body, generation);
    fail(404, 'route_not_found');
  }
}
