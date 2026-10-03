import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { readConfig, SyncService } from './service.mjs';
import { createApp } from './server.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const config = readConfig({ BOTA_API_BASE_URL: 'https://api.example.test/v1', BOTA_API_KEY: 'sk_test_secretServerOnly',
  BOTA_PROJECT_ID: 'prj_test', BOTA_END_USER_ID: 'eu_test', BOTA_DEVICE_ID: 'dev_test', APP_ACCESS_TOKEN: 'application-only-token-01234567890123456789' });
const capture = { device_id: 'dev_test', binding_generation: 3, recording_uuid: 'babe0001-1234-4234-8234-123456789abc',
  recording_generation: 1, ciphertext_length: 1024, ciphertext_sha256: 'a'.repeat(64) };
const sessionId = 'babe0002-1234-4234-8234-123456789abc';
const contextId = 'babe0003-1234-4234-8234-123456789abc';
const authorization = Buffer.alloc(408, 1);
const receipt = Buffer.alloc(336, 2);
const sessionBody = { ...capture, storage_format: 'bota_enc_v2', channel: 'ble', capabilities_base64: Buffer.alloc(24).toString('base64'), auth_nonce_base64: Buffer.alloc(16).toString('base64') };
const manifest = Buffer.alloc(580, 5);
const manifestBody = { owner_revision: 1, manifest_base64: manifest.toString('base64'), manifest_sha256: hash(manifest) };
const rejected = (promise, code) => assert.rejects(promise, error => error.code === code);

function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bota-sync-test-'));
  const database = join(dir, 'journal.sqlite');
  const calls = [];
  const device = { id: 'dev_test', project_id: 'prj_test', end_user_id: 'eu_test', status: 'bound', binding_generation: 3, serial_number: 'TEST1234', deleted_at: null };
  const recording = { ...capture, id: 'rec_test', project_id: 'prj_test', end_user_id: 'eu_test', source: 'device', status: 'pending', deleted_at: null };
  const status = { profile: 'encrypted_upload_v2', session_id: sessionId, owner_revision: 1, channel: 'ble', state: 'created', policy: 'v2_required',
    ciphertext_length: capture.ciphertext_length, ciphertext_sha256: capture.ciphertext_sha256,
    authorization_base64: authorization.toString('base64'), authorization_sha256: hash(authorization), expires_at: '2030-01-01T00:00:00Z' };
  const staging = { method: 'PUT', url: 'https://storage.example.test/object?signature=DO_NOT_PERSIST', headers: { 'Content-Type': 'application/octet-stream' } };
  const transcription = { id: 'txn_test', project_id: 'prj_test', recording_id: 'rec_test', status: 'completed', full_text: 'Synthetic speech.' };
  const state = { automatic: false, sessionLost: false, recordingLost: false, transcriptionLost: false, transcriptionExists: false, contextLost: false, afterStatus: null };
  const fetchImpl = async (url, init) => {
    const path = url.replace(config.apiBase, ''); const method = init.method; const body = init.body && JSON.parse(init.body);
    calls.push({ path, method, body, headers: init.headers });
    const json = value => Response.json(value);
    if (path === '/devices/dev_test') return json(device);
    if (path === '/devices/dev_test/config/processing') {
      const response = json({ value: { auto_transcription: { enabled: state.automatic } } });
      state.afterProcessing?.(); return response;
    }
    if (path === '/recordings' && method === 'POST') {
      assert.equal(body.end_user_id, config.endUserId); assert.equal(body.encryption_version, 2);
      if (state.recordingLost) { state.recordingLost = false; throw new Error('secret signed response lost'); }
      return json(recording);
    }
    if (path === '/recordings/rec_test' && method === 'GET') {
      const response = json(recording); state.afterRecording?.(); return response;
    }
    const base = '/recordings/rec_test/encrypted-upload-v2/sessions';
    if (path === base && method === 'POST') {
      if (state.sessionLost) throw new Error('session created but response lost');
      return json({ ...status, staging });
    }
    if (path === `${base}/${sessionId}` && method === 'GET') {
      const response = json(status); state.afterStatus?.(); return response;
    }
    if (path === `${base}/${sessionId}/staging-url`) return json(staging);
    if (path === `${base}/${sessionId}/manifest`) {
      if (body.manifest_sha256 !== hash(manifest)) return Response.json({ error: 'secret upstream detail' }, { status: 409 });
      return json({ state: status.state === 'published' ? 'published' : 'ready' });
    }
    if (path === `${base}/${sessionId}` && method === 'DELETE') { status.state = 'cancelled'; return new Response(null, { status: 204 }); }
    if (path === '/transcriptions?recording_id=rec_test&limit=2') {
      const response = json({ data: state.transcriptionExists ? [transcription] : [], has_more: false });
      state.afterTranscriptionList?.(); return response;
    }
    if (path === '/transcriptions' && method === 'POST') {
      state.transcriptionExists = true; if (state.transcriptionLost) throw new Error('created job response lost'); return json(transcription);
    }
    if (path === '/transcriptions/txn_test') return json(transcription);
    const ctx = '/devices/dev_test/encrypted-upload-v2/contexts';
    if (path === ctx && method === 'POST') { if (state.contextLost) throw new Error('lost context'); return json({ context_id: contextId, state: 'challenge', challenge_base64: 'opaque' }); }
    if (path === `${ctx}/${contextId}`) return json({ context_id: contextId, state: 'complete', result_base64: 'opaque' });
    if (path === `${ctx}/${contextId}/proof`) return json({ context_id: contextId, state: 'pending' });
    throw new Error(`Unexpected mocked request ${method} ${path}`);
  };
  let service = new SyncService(config, { database, fetchImpl });
  t.after(() => { service.close(); rmSync(dir, { recursive: true, force: true }); });
  const f = { calls, device, recording, status, state, transcription, database,
    get service() { return service; },
    restart() { service.close(); service = new SyncService(config, { database, fetchImpl }); },
    async prepare() { await service.createRecording(capture); return service.createSession('rec_test', sessionBody, 3); },
    publish() { status.state = 'published'; status.completion_receipt_base64 = receipt.toString('base64'); status.completion_receipt_sha256 = hash(receipt); },
  };
  Object.assign(state, options); return f;
}

test('fixed scope and effective automatic-processing precondition', async t => {
  const f = fixture(t);
  assert.deepEqual(await f.service.context(), { deviceId: 'dev_test', serialNumber: 'TEST1234', bindingGeneration: 3, endUserId: 'eu_test', projectId: 'prj_test' });
  f.state.automatic = true;
  await rejected(f.service.createRecording(capture), 'automatic_transcription_enabled');
  assert.equal(f.calls.filter(c => c.method === 'POST').length, 0);
  f.state.automatic = false; f.device.end_user_id = 'eu_other';
  await rejected(f.service.context(), 'device_scope_changed');
});

test('lost recording-create response repeats only the documented stable identity', async t => {
  const f = fixture(t, { recordingLost: true });
  await rejected(f.service.createRecording(capture), 'upstream_unavailable');
  f.restart();
  assert.equal((await f.service.createRecording(capture)).id, 'rec_test');
  const writes = f.calls.filter(c => c.path === '/recordings');
  assert.equal(writes.length, 2); assert.deepEqual(writes[0].body, writes[1].body);
  f.restart(); await f.service.createRecording(capture);
  assert.equal(f.calls.filter(c => c.path === '/recordings').length, 2);
  await rejected(f.service.createRecording({ ...capture, ciphertext_sha256: 'b'.repeat(64) }), 'capture_identity_changed');
});

test('known cloud identity survives restart without persisting signed material', async t => {
  const f = fixture(t); await f.prepare(); f.restart();
  const result = await f.service.createSession('rec_test', sessionBody, 3);
  assert.equal(result.session_id, sessionId);
  assert.equal(f.calls.filter(c => c.path.endsWith('/sessions') && c.method === 'POST').length, 1);
  const contents = readFileSync(f.database).toString();
  for (const secret of [config.apiKey, config.appToken, 'DO_NOT_PERSIST', authorization.toString('base64')]) assert.ok(!contents.includes(secret));
});

test('lost session-create response parks the durable intent across restart', async t => {
  const f = fixture(t, { sessionLost: true }); await f.service.createRecording(capture);
  await rejected(f.service.createSession('rec_test', sessionBody, 3), 'upstream_unavailable');
  f.restart(); await rejected(f.service.createSession('rec_test', sessionBody, 3), 'session_create_uncertain');
  assert.equal(f.calls.filter(c => c.path.endsWith('/sessions') && c.method === 'POST').length, 1);
  assert.equal((await f.service.listRecordings()).recordings[0].status, 'session_create_uncertain');
});

test('concurrent create cannot create a second recording or session', async t => {
  const f = fixture(t);
  const results = await Promise.allSettled([f.service.createRecording(capture), f.service.createRecording(capture)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'operation_in_progress');
  const sessions = await Promise.allSettled([f.service.createSession('rec_test', sessionBody, 3), f.service.createSession('rec_test', sessionBody, 3)]);
  assert.equal(sessions.filter(r => r.status === 'fulfilled').length, 1);
});

test('generation and ownership changes fence all remembered operations', async t => {
  const f = fixture(t); await f.prepare(); f.device.binding_generation = 4;
  await rejected(f.service.sessionOperation('rec_test', sessionId, '', 'GET', {}, 3), 'binding_changed');
  assert.deepEqual(await f.service.listRecordings(), { recordings: [] });
  f.device.binding_generation = 3; f.recording.end_user_id = 'eu_other';
  await rejected(f.service.sessionOperation('rec_test', sessionId, '', 'GET', {}, 3), 'recording_scope_changed');
});

test('a rebind during a status request does not return old receipt material', async t => {
  const f = fixture(t); await f.prepare(); f.publish(); f.state.afterStatus = () => { f.device.binding_generation++; };
  await rejected(f.service.sessionOperation('rec_test', sessionId, '', 'GET', {}, 3), 'binding_changed');
});

test('a rebind during processing configuration stops recording creation before POST', async t => {
  const f = fixture(t);
  f.state.afterProcessing = () => { f.device.binding_generation++; };
  await rejected(f.service.createRecording(capture), 'binding_changed');
  assert.equal(f.calls.filter(c => c.method === 'POST').length, 0);
  assert.equal(f.service.db.prepare('SELECT COUNT(*) AS count FROM captures').get().count, 0);
});

test('a rebind during a known recording read stops identity replay', async t => {
  const f = fixture(t); await f.service.createRecording(capture);
  f.state.afterRecording = () => { f.device.binding_generation++; };
  await rejected(f.service.createRecording(capture), 'binding_changed');
  assert.equal(f.calls.filter(c => c.path === '/recordings' && c.method === 'POST').length, 1);
  assert.equal(f.service.db.prepare('SELECT recording_id FROM captures').get().recording_id, 'rec_test');
});

test('a rebind during session processing lookup stops before session intent and POST', async t => {
  const f = fixture(t); await f.service.createRecording(capture);
  f.state.afterProcessing = () => { f.device.binding_generation++; };
  await rejected(f.service.createSession('rec_test', sessionBody, 3), 'binding_changed');
  assert.equal(f.calls.filter(c => c.path.endsWith('/sessions') && c.method === 'POST').length, 0);
  const row = f.service.db.prepare('SELECT recording_id,session_state,session_id FROM captures').get();
  assert.equal(row.recording_id, 'rec_test');
  assert.equal(row.session_state, null); assert.equal(row.session_id, null);
});

test('a rebind during the existing-job read stops transcription creation before POST', async t => {
  const f = fixture(t); await f.prepare(); f.publish();
  f.state.afterTranscriptionList = () => { f.device.binding_generation++; };
  await rejected(f.service.transcribe('rec_test', 3), 'binding_changed');
  assert.equal(f.calls.filter(c => c.path === '/transcriptions' && c.method === 'POST').length, 0);
  assert.equal(f.service.db.prepare('SELECT transcription_state FROM captures').get().transcription_state, null);
});

test('a stale caller cannot list or transcribe a newer binding even for the same owner', async t => {
  const f = fixture(t);
  f.device.binding_generation = 2;
  const previous = await f.service.route('GET', '/api/context', {});
  f.device.binding_generation = 3;
  await f.prepare(); f.publish();
  const list = '/api/recordings';
  const start = '/api/recordings/rec_test/transcription';
  const result = '/api/transcriptions/txn_test';
  for (const [method, path] of [['GET', list], ['POST', start], ['GET', result]]) {
    await rejected(f.service.route(method, path, {}), 'binding_generation_required');
  }
  const stale = String(previous.bindingGeneration);
  await rejected(f.service.route('GET', list, {}, stale), 'binding_changed');
  await rejected(f.service.route('POST', start, {}, stale), 'binding_changed');
  assert.equal(f.calls.filter(c => c.path === '/transcriptions' && c.method === 'POST').length, 0);
  const current = await f.service.route('GET', '/api/context', {});
  const generation = String(current.bindingGeneration);
  assert.deepEqual((await f.service.route('GET', list, {}, generation)).recordings, [{ id: 'rec_test', status: 'published' }]);
  assert.equal((await f.service.route('POST', start, {}, generation)).id, 'txn_test');
  await rejected(f.service.route('GET', result, {}, stale), 'binding_changed');
  assert.equal(f.calls.filter(c => c.path === '/transcriptions/txn_test').length, 0);
  assert.equal((await f.service.route('GET', result, {}, generation)).text, 'Synthetic speech.');
});

test('pending and committed sessions never offer a replacement storage PUT', async t => {
  const f = fixture(t); await f.prepare();
  for (const state of ['staged', 'ready', 'processing']) {
    f.status.state = state;
    assert.equal((await f.service.createSession('rec_test', sessionBody, 3)).staging, undefined);
    await rejected(f.service.sessionOperation('rec_test', sessionId, 'staging-url', 'POST', { owner_revision: 1 }, 3), 'upload_phase_changed');
  }
  f.publish(); assert.equal((await f.service.createSession('rec_test', sessionBody, 3)).staging, undefined);
  await rejected(f.service.sessionOperation('rec_test', sessionId, 'recover', 'POST', {}, 3), 'recovery_requires_reconciliation');
});

test('exact published manifest replay is checked by the API; conflicting replay is rejected', async t => {
  const f = fixture(t); await f.prepare(); f.publish();
  await f.service.sessionOperation('rec_test', sessionId, 'manifest', 'POST', manifestBody, 3);
  const changed = Buffer.alloc(580, 7);
  await rejected(f.service.sessionOperation('rec_test', sessionId, 'manifest', 'POST', { ...manifestBody, manifest_base64: changed.toString('base64'), manifest_sha256: hash(changed) }, 3), 'upstream_rejected');
  await rejected(f.service.sessionOperation('rec_test', sessionId, 'manifest', 'POST', { ...manifestBody, manifest_sha256: '0'.repeat(64) }, 3), 'manifest_digest_mismatch');
});

test('transcription requires valid published receipt and remains separate from upload', async t => {
  const f = fixture(t); await f.prepare();
  await rejected(f.service.transcribe('rec_test'), 'publication_pending');
  f.publish(); f.status.completion_receipt_sha256 = 'f'.repeat(64);
  await rejected(f.service.transcribe('rec_test'), 'upstream_response_invalid');
  f.publish();
  const first = await f.service.transcribe('rec_test'); f.restart(); const second = await f.service.transcribe('rec_test');
  assert.deepEqual(first, { id: 'txn_test', recordingId: 'rec_test', status: 'completed', text: 'Synthetic speech.' });
  assert.deepEqual(first, second);
  assert.equal(f.calls.filter(c => c.path === '/transcriptions' && c.method === 'POST').length, 1);
  assert.deepEqual((await f.service.listRecordings()).recordings, [{ id: 'rec_test', status: 'published' }]);
});

test('lost transcription-create response cannot create a duplicate job', async t => {
  const f = fixture(t, { transcriptionLost: true }); await f.prepare(); f.publish();
  await rejected(f.service.transcribe('rec_test'), 'upstream_unavailable');
  f.restart(); await rejected(f.service.transcribe('rec_test'), 'transcription_create_uncertain');
  assert.equal(f.calls.filter(c => c.path === '/transcriptions' && c.method === 'POST').length, 1);
});

test('existing transcription is reused without creating another job', async t => {
  const f = fixture(t, { transcriptionExists: true }); await f.prepare(); f.publish();
  assert.equal((await f.service.transcribe('rec_test')).id, 'txn_test');
  assert.equal(f.calls.filter(c => c.path === '/transcriptions' && c.method === 'POST').length, 0);
  await rejected(f.service.getTranscription('txn_foreign'), 'transcription_not_found');
});

test('context creation persists mapping and fences unknown or foreign IDs', async t => {
  const f = fixture(t); const body = { nonce_base64: Buffer.alloc(16).toString('base64') };
  assert.equal((await f.service.uploadContext('dev_test', undefined, false, 'POST', body, 3)).context_id, contextId);
  f.restart(); await f.service.uploadContext('dev_test', undefined, false, 'POST', body, 3);
  assert.equal(f.calls.filter(c => c.path.endsWith('/contexts') && c.method === 'POST').length, 1);
  await rejected(f.service.uploadContext('dev_other', contextId, false, 'GET', {}, 3), 'invalid_request');
  f.device.binding_generation = 4;
  await rejected(f.service.uploadContext('dev_test', contextId, false, 'GET', {}, 3), 'binding_changed');
});

test('server restart under a different fixed identity refuses the original journal', t => {
  const f = fixture(t);
  assert.throws(() => new SyncService({ ...config, endUserId: 'eu_other' }, { database: f.database }), e => e.code === 'journal_scope_changed');
});

test('lost context-create response is retained and never silently replaced', async t => {
  const f = fixture(t, { contextLost: true });
  const body = { nonce_base64: Buffer.alloc(16).toString('base64') };
  await rejected(f.service.uploadContext('dev_test', undefined, false, 'POST', body, 3), 'upstream_unavailable');
  f.restart();
  await rejected(f.service.uploadContext('dev_test', undefined, false, 'POST', body, 3), 'context_create_uncertain');
  assert.equal(f.calls.filter(c => c.path.endsWith('/contexts') && c.method === 'POST').length, 1);
});

test('HTTP rejects anonymous/browser/proxy requests before upstream access', async t => {
  const f = fixture(t); const server = createApp(f.service, config.appToken);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(origin + '/api/context')).status, 401);
  assert.equal((await fetch(origin + '/api/context', { headers: { Authorization: `Bearer ${config.apiKey}` } })).status, 401);
  assert.equal((await fetch(origin + '/api/context', { headers: { Authorization: `Bearer ${config.appToken}`, Origin: 'https://evil.example' } })).status, 401);
  assert.equal(f.calls.length, 0);
  const headers = { Authorization: `Bearer ${config.appToken}` };
  assert.equal((await fetch(origin + '/api/context?project=other', { headers })).status, 404);
  assert.equal((await fetch(origin + '/api/context', { headers })).status, 200);
  assert.ok(f.calls.every(c => c.headers.Authorization === `Bearer ${config.apiKey}`));
  const invalid = await fetch(origin + '/api/recordings', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...capture, end_user_id: 'eu_other' }) });
  assert.equal(invalid.status, 400);
  assert.ok(!(await invalid.text()).includes(config.apiKey));
});

test('binding headers and exact metadata are mandatory on native material routes', async t => {
  const f = fixture(t); await f.service.createRecording(capture);
  await rejected(f.service.route('POST', '/api/recordings/rec_test/encrypted-upload-v2/sessions', sessionBody), 'binding_generation_required');
  await rejected(f.service.createSession('rec_test', { ...sessionBody, channel: 'wifi' }, 3), 'invalid_request');
  await rejected(f.service.createSession('rec_test', { ...sessionBody, recording_uuid: contextId }, 3), 'capture_identity_changed');
});
