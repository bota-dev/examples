import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve, isAbsolute } from 'node:path';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { LibraryService } from './library.mjs';
import { createApp } from './server.mjs';
import { readConfig, RequestError, SyncService } from './service.mjs';
import { createLibraryApi, LibraryError } from '../app/library-api.ts';

const environment = {
  BOTA_API_BASE_URL: 'https://api.example.test/v1', BOTA_API_KEY: 'sk_test_serverOnly',
  BOTA_PROJECT_ID: 'proj_test', BOTA_END_USER_ID: 'eu_test',
  APP_ACCESS_TOKEN: 'application-only-token-01234567890123456789',
};
const config = readConfig(environment);
const clone = value => structuredClone(value);
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

for (const prefix of ['up_', 'rct_']) test(`a ${prefix} platform credential cannot serve as the application token`, () => {
  const credential = prefix + 'x'.repeat(48);
  assert.throws(() => readConfig({ ...environment, APP_ACCESS_TOKEN: credential }),
    error => error.code === 'invalid_application_token');
  assert.equal(readConfig(environment).appToken, environment.APP_ACCESS_TOKEN);
});

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'bota-library-test-'));
  const database = join(directory, 'library.sqlite');
  const calls = [];
  const recordings = new Map([['rec_one', {
    id: 'rec_one', project_id: config.projectId, end_user_id: config.endUserId,
    name: 'Synthetic Monday recording', source: 'api_upload', status: 'uploaded',
    created_at: '2026-10-12T10:00:00.000Z', duration_seconds: 42,
    content_sha256: 'a'.repeat(64), content_sha256_verified_at: '2026-10-12T10:01:00.000Z',
    deleted_at: null, storage_path: 'DO_NOT_EXPOSE_STORAGE',
  }]]);
  const transcriptions = new Map(), summaries = new Map(), sessions = new Map(), messages = new Map();
  const state = { fail: null, after: null, wrongSummarySource: false, wrongCitation: false, nextCursor: null };
  const resources = [];
  let sequence = 0;
  const next = prefix => `${prefix}_test${++sequence}`;
  const page = data => ({ data, has_more: false, next_cursor: null });
  const transcript = (recordingId = 'rec_one') => {
    const row = { id: next('txn'), project_id: config.projectId, recording_id: recordingId,
      status: 'completed', created_at: '2026-10-12T10:02:00.000Z', full_text: 'Synthetic Monday transcript.' };
    transcriptions.set(row.id, row); return row;
  };
  const summary = (transcriptionId) => {
    const row = { id: next('sum'), project_id: config.projectId, transcription_id: transcriptionId,
      recording_id: 'rec_one', template_id: 'tmpl_general_notes', status: 'completed',
      created_at: '2026-10-12T10:03:00.000Z', output: {
        overview: 'Synthetic notes.', key_points: ['Review the prototype.'], action_items: ['Send notes.'],
        participants: ['Example participant'], decisions: ['Meet on Friday.'],
      } };
    summaries.set(row.id, row); return row;
  };
  const request = async (method, raw, body) => {
    calls.push({ method, path: raw, body: clone(body) });
    const url = new URL(raw, config.apiBase);
    const path = url.pathname;
    if (state.fail === `${method} ${path}`) throw new Error('DO_NOT_EXPOSE_UPSTREAM_SECRET');
    let value;
    if (path === '/recordings' && method === 'GET') {
      assert.equal(url.searchParams.get('end_user_id'), config.endUserId);
      assert.equal(url.searchParams.get('limit'), '20');
      value = { data: [...recordings.values()], has_more: state.nextCursor !== null, next_cursor: state.nextCursor };
    } else if (/^\/recordings\/rec_/.test(path) && method === 'GET') value = recordings.get(path.split('/')[2]);
    else if (path === '/transcriptions' && method === 'GET') {
      value = page([...transcriptions.values()].filter(row => row.recording_id === url.searchParams.get('recording_id')));
    } else if (/^\/transcriptions\/txn_/.test(path) && method === 'GET') value = transcriptions.get(path.split('/')[2]);
    else if (path === '/transcriptions' && method === 'POST') value = transcript(body.recording_id);
    else if (path === '/summaries' && method === 'GET') {
      value = page([...summaries.values()].filter(row => row.transcription_id === url.searchParams.get('transcription_id')));
    } else if (/^\/summaries\/sum_/.test(path) && method === 'GET') value = summaries.get(path.split('/')[2]);
    else if (path === '/summaries' && method === 'POST') {
      assert.equal(body.template_id, 'tmpl_general_notes');
      value = summary(body.transcription_id);
      if (state.wrongSummarySource) value.transcription_id = 'txn_foreign';
    } else if (path === '/ask/sessions' && method === 'POST') {
      assert.equal(body.end_user_id, config.endUserId);
      value = { id: next('as'), end_user_id: config.endUserId, scope: {
        type: 'recording', recording_ids: [body.scope.recording_id],
      }, message_count: 0 };
      sessions.set(value.id, value); messages.set(value.id, []);
    } else if (path === '/ask/sessions' && method === 'GET') {
      assert.equal(url.searchParams.get('end_user_id'), config.endUserId);
      assert.equal(url.searchParams.get('scope_type'), 'recording');
      value = page([...sessions.values()].filter(row => row.end_user_id === config.endUserId &&
        row.scope.recording_ids[0] === url.searchParams.get('recording_id')));
    } else {
      const match = path.match(/^\/ask\/sessions\/(as_[A-Za-z0-9]+)(\/messages)?$/);
      if (!match) throw new Error(`Unexpected fixture route ${method} ${path}`);
      const session = sessions.get(match[1]);
      if (!match[2] && method === 'GET') value = session;
      else if (match[2] && method === 'GET') value = page(messages.get(match[1]));
      else if (match[2] && method === 'POST') {
        const rows = messages.get(match[1]);
        rows.push({ id: next('msg'), role: 'user', content: body.content.trim(), session_id: session.id });
        const answer = { id: next('msg'), role: 'assistant', content: 'Synthetic answer.', finish_reason: 'stop',
          session_id: session.id, parts: [{ type: 'text', text: 'Synthetic answer.' }, {
            type: 'citation', recording_id: state.wrongCitation ? 'rec_foreign' : session.scope.recording_ids[0], start_ms: 1000,
          }] };
        rows.push(answer); session.message_count = rows.length;
        value = { session_id: session.id, message: answer, sources: [] };
      } else throw new Error('Unexpected fixture method');
    }
    assert.notEqual(value, undefined, 'Fixture resource exists');
    const result = clone(value);
    state.after?.(method, path, value);
    return result;
  };
  let library = new LibraryService(config, { database, request });
  t.after(() => {
    for (const resource of resources) resource.close();
    library.close();
    // Verify the absolute, task-created target before recursive cleanup on Windows.
    const target = resolve(directory), fromTemp = relative(resolve(tmpdir()), target);
    assert(!isAbsolute(fromTemp) && !fromTemp.startsWith('..') && basename(target).startsWith('bota-library-test-'));
    rmSync(target, { recursive: true, force: true });
  });
  return { get library() { return library; }, directory, database, calls, state, request, resources,
    recordings, transcriptions, summaries, sessions, messages, transcript, summary,
    restart() { library.close(); library = new LibraryService(config, { database, request }); },
    read(path, body) { return library.route('GET', path, body); },
    write(path, body = {}) { return library.route('POST', path, body); },
    posts(path) { return calls.filter(call => call.method === 'POST' && call.path === path); },
  };
}

test('library works with no device and emits selected metadata only', async t => {
  const f = fixture(t);
  assert.equal(config.deviceId, null);
  const page = await f.read('/api/library/recordings');
  assert.equal(page.data[0].name, 'Synthetic Monday recording');
  assert.equal(page.data[0].upload_verified, true);
  assert.equal(page.has_more, false);
  assert(!JSON.stringify(page).includes('storage'));
  assert(!f.calls.some(call => call.path.includes('/devices/')));
});

test('an encoded opaque cursor retains the fixed owner filter', async t => {
  const f = fixture(t);
  await f.read('/api/library/recordings?cursor=opaque%2B%2F%3D');
  const url = new URL(f.calls[0].path, config.apiBase);
  assert.equal(url.searchParams.get('cursor'), 'opaque+/=');
  assert.equal(url.searchParams.get('end_user_id'), config.endUserId);
});

for (const [field, value, code] of [
  ['end_user_id', 'eu_foreign', 'recording_forbidden'],
  ['project_id', 'proj_foreign', 'NOT_FOUND'],
  ['project_id', undefined, 'recording_forbidden'],
  ['deleted_at', '2026-10-12T00:00:00Z', 'NOT_FOUND'],
]) test(`cloud detail rejects ${value === undefined ? 'missing' : 'changed'} ${field} without exposing content`, async t => {
  const f = fixture(t);
  if (value === undefined) delete f.recordings.get('rec_one')[field];
  else f.recordings.get('rec_one')[field] = value;
  await rejects(f.read('/api/library/recordings/rec_one'), code);
});

test('list rechecks ownership with exact resource GETs', async t => {
  const f = fixture(t);
  f.state.after = (method, path) => {
    if (path === '/recordings') f.recordings.get('rec_one').end_user_id = 'eu_foreign';
  };
  await rejects(f.read('/api/library/recordings'), 'recording_forbidden');
});

test('recording list refuses repeated IDs and incoherent cursors', async t => {
  const f = fixture(t);
  f.recordings.set('alias', f.recordings.get('rec_one'));
  await rejects(f.read('/api/library/recordings'), 'invalid_recording_page');
  f.recordings.delete('alias'); f.state.nextCursor = 'same';
  await rejects(f.read('/api/library/recordings?cursor=same'), 'invalid_recording_page');
});

test('completed transcript and general notes preserve exact source links', async t => {
  const f = fixture(t), transcript = f.transcript(), summary = f.summary(transcript.id);
  const tx = await f.read('/api/library/recordings/rec_one/transcriptions');
  assert.equal(tx.data[0].full_text, 'Synthetic Monday transcript.');
  const notes = await f.read(`/api/library/transcriptions/${transcript.id}/summaries`);
  assert.equal(notes.data[0].id, summary.id);
  assert.equal(notes.data[0].recording_id, 'rec_one');
  assert.equal(notes.data[0].output.overview, 'Synthetic notes.');
  assert.equal(f.posts('/summaries').length, 0);
});

test('transcription ownership is rechecked before completed content is returned', async t => {
  const f = fixture(t); f.transcript();
  f.state.after = (_method, path) => {
    if (path.startsWith('/transcriptions/')) f.recordings.get('rec_one').end_user_id = 'eu_foreign';
  };
  await rejects(f.read('/api/library/recordings/rec_one/transcriptions'), 'recording_forbidden');
});

test('foreign summary source, template and malformed output do not produce content', async t => {
  const f = fixture(t), transcript = f.transcript(), summary = f.summary(transcript.id);
  summary.recording_id = 'rec_foreign';
  await rejects(f.read(`/api/library/transcriptions/${transcript.id}/summaries`), 'invalid_job');
  summary.recording_id = 'rec_one'; summary.output.action_items = ['valid', 42];
  await rejects(f.read(`/api/library/transcriptions/${transcript.id}/summaries`), 'invalid_summary');
  summary.template_id = 'tmpl_sales_call';
  assert.deepEqual(await f.read(`/api/library/transcriptions/${transcript.id}/summaries`), { data: [] });
});

test('pending processing omits uncompleted text and output', async t => {
  const f = fixture(t), transcript = f.transcript(), summary = f.summary(transcript.id);
  transcript.status = 'processing'; summary.status = 'processing';
  const tx = await f.read('/api/library/recordings/rec_one/transcriptions');
  assert.equal(tx.data[0].full_text, undefined);
  const notes = await f.read(`/api/library/transcriptions/${transcript.id}/summaries`);
  assert.equal(notes.data[0].output, undefined);
});

test('existing transcription is reused; explicit creation is durable and returned', async t => {
  const f = fixture(t);
  const first = await f.write('/api/library/recordings/rec_one/transcriptions');
  assert.equal(first.operation.state, 'complete');
  assert.equal(first.transcription.recording_id, 'rec_one');
  f.restart();
  const restored = await f.write('/api/library/recordings/rec_one/transcriptions');
  assert.equal(restored.operation.id, first.operation.id);
  assert.equal(restored.transcription.id, first.transcription.id);
  assert.equal(f.posts('/transcriptions').length, 1);
});

test('verified upload and completed transcription are required before writes', async t => {
  const f = fixture(t);
  f.recordings.get('rec_one').content_sha256_verified_at = null;
  await rejects(f.write('/api/library/recordings/rec_one/transcriptions'), 'upload_unverified');
  assert.equal((await f.read('/api/library/operations')).data.length, 0);
  const transcript = f.transcript(); transcript.status = 'processing';
  await rejects(f.write(`/api/library/transcriptions/${transcript.id}/summaries`), 'transcription_incomplete');
  assert.equal(f.posts('/transcriptions').length + f.posts('/summaries').length, 0);
});

test('structured general summary survives restart without a replacement write', async t => {
  const f = fixture(t), transcript = f.transcript();
  const first = await f.write(`/api/library/transcriptions/${transcript.id}/summaries`);
  assert.equal(first.summary.output.overview, 'Synthetic notes.');
  f.restart();
  const recovered = await f.read(`/api/library/operations/${first.operation.id}`);
  assert.equal(recovered.summary.id, first.summary.id);
  assert.equal(recovered.operation.state, 'complete');
  await f.write(`/api/library/transcriptions/${transcript.id}/summaries`);
  assert.equal(f.posts('/summaries').length, 1);
});

for (const kind of ['transcription', 'summary']) test(`uncertain ${kind} creation never replays across restart`, async t => {
  const f = fixture(t), transcript = kind === 'summary' ? f.transcript() : null;
  const path = kind === 'summary' ? `/api/library/transcriptions/${transcript.id}/summaries` : '/api/library/recordings/rec_one/transcriptions';
  const upstream = kind === 'summary' ? '/summaries' : '/transcriptions';
  f.state.fail = `POST ${upstream}`;
  await rejects(f.write(path), 'operation_uncertain');
  const operation = (await f.read('/api/library/operations')).data[0];
  assert.equal(operation.state, 'uncertain');
  f.restart(); f.state.fail = null;
  await f.read(`/api/library/operations/${operation.id}`);
  await f.write(path);
  assert.equal(f.posts(upstream).length, 1);
});

test('a valid but foreign created summary ID remains retained and immutable', async t => {
  const f = fixture(t), transcript = f.transcript(); f.state.wrongSummarySource = true;
  const path = `/api/library/transcriptions/${transcript.id}/summaries`;
  await rejects(f.write(path), 'invalid_job');
  const operation = (await f.read('/api/library/operations')).data[0];
  assert.match(operation.resource_id, /^sum_/);
  f.restart();
  await rejects(f.write(path), 'invalid_job');
  assert.equal(f.posts('/summaries').length, 1);
});

test('Ask trims before hashing and returns only selected-recording citations', async t => {
  const f = fixture(t);
  const result = await f.write('/api/library/recordings/rec_one/ask', { question: '  What happened?  ' });
  assert.equal(result.answer, 'Synthetic answer.');
  assert.deepEqual(result.citations, [{ recording_id: 'rec_one', start_ms: 1000 }]);
  f.restart();
  const restored = await f.write('/api/library/recordings/rec_one/ask', { question: 'What happened?' });
  assert.equal(restored.operation.id, result.operation.id);
  assert.equal(f.posts('/ask/sessions').length, 1);
  assert.equal(f.calls.filter(call => call.method === 'POST' && call.path.endsWith('/messages')).length, 1);
  assert(f.calls.some(call => call.path.startsWith('/ask/sessions?end_user_id=')));
  const bytes = readFileSync(f.database).toString('utf8');
  assert(!bytes.includes('What happened?') && !bytes.includes('Synthetic answer.') && !bytes.includes(config.apiKey));
});

test('Ask rejects blank and invalid Unicode before consuming any intent', async t => {
  const f = fixture(t);
  for (const question of ['   ', '\ud800', 'x'.repeat(10001)]) {
    await rejects(f.write('/api/library/recordings/rec_one/ask', { question }), 'invalid_question');
  }
  assert.equal(f.calls.length, 0);
  assert.equal((await f.read('/api/library/operations')).data.length, 0);
});

test('unknown Ask session creation is preserved without another POST', async t => {
  const f = fixture(t); f.state.fail = 'POST /ask/sessions';
  await rejects(f.write('/api/library/recordings/rec_one/ask', { question: 'What happened?' }), 'operation_uncertain');
  f.restart(); f.state.fail = null;
  const result = await f.write('/api/library/recordings/rec_one/ask', { question: 'What happened?' });
  assert.equal(result.operation.state, 'uncertain');
  assert.equal(f.posts('/ask/sessions').length, 1);
});

test('unknown Ask message delivery reconciles by GET without resending', async t => {
  const f = fixture(t);
  f.state.after = (method, path, value) => {
    if (method === 'POST' && path === '/ask/sessions') f.state.fail = `POST /ask/sessions/${value.id}/messages`;
  };
  await rejects(f.write('/api/library/recordings/rec_one/ask', { question: 'What happened?' }), 'operation_uncertain');
  const operation = (await f.read('/api/library/operations')).data[0];
  f.restart(); f.state.fail = null; f.state.after = null;
  const recovered = await f.read(`/api/library/operations/${operation.id}`);
  assert.equal(recovered.answer, undefined);
  await f.write('/api/library/recordings/rec_one/ask', { question: 'What happened?' });
  assert.equal(f.calls.filter(call => call.method === 'POST' && call.path.endsWith('/messages')).length, 1);
});

test('Ask refuses cross-recording citations and owner-filtered membership loss', async t => {
  const f = fixture(t); f.state.wrongCitation = true;
  await rejects(f.write('/api/library/recordings/rec_one/ask', { question: 'What happened?' }), 'invalid_citation');
  const operation = (await f.read('/api/library/operations')).data[0];
  const session = f.sessions.get(operation.resource_id); session.end_user_id = 'eu_foreign';
  await rejects(f.read(`/api/library/operations/${operation.id}`), 'session_not_owned');
  assert.equal(f.posts('/ask/sessions').length, 1);
});

test('concurrent mutations share one durable intent', async t => {
  const f = fixture(t);
  const results = await Promise.all([
    f.write('/api/library/recordings/rec_one/transcriptions'),
    f.write('/api/library/recordings/rec_one/transcriptions'),
  ]);
  assert.equal(results[0].operation.id, results[1].operation.id);
  assert.equal(f.posts('/transcriptions').length, 1);
});

test('API-key, endpoint, project and owner rotation refuse the original library journal', async t => {
  const f = fixture(t);
  for (const changed of [
    { apiKey: 'sk_test_rotated' }, { apiBase: 'https://other.example.test/v1' },
    { projectId: 'proj_other' }, { endUserId: 'eu_other' },
  ]) assert.throws(() => new LibraryService({ ...config, ...changed }, { database: f.database, request: f.request }),
    error => error.code === 'library_scope_changed');
  assert.deepEqual(await f.read('/api/library/operations'), { data: [] });
});

test('library refuses a publicly readable existing database on POSIX', { skip: process.platform === 'win32' }, async t => {
  const f = fixture(t);
  const original = readFileSync(f.database);
  chmodSync(f.database, 0o644);
  try {
    assert.throws(() => new LibraryService(config, { database: f.database, request: f.request }),
      error => error.code === 'private_state');
    assert.deepEqual(readFileSync(f.database), original);
  } finally { chmodSync(f.database, 0o600); }
  assert.deepEqual(await f.read('/api/library/operations'), { data: [] });
});

test('device configuration is optional but configuring it later cannot reuse a capture journal', async t => {
  const f = fixture(t), database = join(f.directory, 'captures.sqlite');
  const service = new SyncService(config, { database, fetchImpl: () => { throw new Error('No native API call expected'); } });
  for (const path of ['/api/context', '/api/recordings', '/api/transcriptions/txn_one', '/api/devices/dev_one/encrypted-upload-v2/contexts']) {
    await rejects(service.route('GET', path, {}, '1'), 'device_not_configured');
  }
  service.close();
  assert.throws(() => new SyncService({ ...config, deviceId: 'dev_bound' }, { database }), error => error.code === 'journal_scope_changed');
  assert.throws(() => readConfig({ ...environment, BOTA_DEVICE_ID: 'invalid' }), error => error.code === 'invalid_fixed_identity');
  assert.equal(readConfig({ ...environment, BOTA_DEVICE_ID: 'dev_bound' }).deviceId, 'dev_bound');
  // Satisfy the library's independent privacy gate so this case tests journal identity/type.
  // The older native service creates files using the process umask.
  chmodSync(database, 0o600);
  const original = readFileSync(database);
  assert.throws(() => new LibraryService(config, { database, request: f.request }), error => error.code === 'library_journal_invalid');
  assert.deepEqual(readFileSync(database), original);
});

function composeNative(t, f) {
  const device = { id: 'dev_bound', project_id: config.projectId, end_user_id: config.endUserId,
    status: 'bound', binding_generation: 3, serial_number: 'TEST1234', deleted_at: null };
  const identity = { device_id: device.id, binding_generation: 3,
    recording_uuid: 'babe0001-1234-4234-8234-123456789abc', recording_generation: 1,
    ciphertext_length: 1024, ciphertext_sha256: 'a'.repeat(64) };
  Object.assign(f.recordings.get('rec_one'), identity, { source: 'device' });
  const sessionId = 'babe0002-1234-4234-8234-123456789abc';
  const authorization = Buffer.alloc(408, 1), receipt = Buffer.alloc(336, 2);
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const session = { profile: 'encrypted_upload_v2', session_id: sessionId, owner_revision: 1,
    channel: 'ble', state: 'published', ciphertext_length: 1024, ciphertext_sha256: 'a'.repeat(64),
    authorization_base64: authorization.toString('base64'), authorization_sha256: sha(authorization),
    completion_receipt_base64: receipt.toString('base64'), completion_receipt_sha256: sha(receipt) };
  const native = new SyncService({ ...config, deviceId: device.id }, {
    database: join(f.directory, 'captures.sqlite'),
    fetchImpl: async (url, init) => {
      const path = url.slice(config.apiBase.length);
      if (path === '/devices/dev_bound') return Response.json(device);
      if (path === '/devices/dev_bound/config/processing') return Response.json({ value: { auto_transcription: { enabled: false } } });
      if (path === `/recordings/rec_one/encrypted-upload-v2/sessions/${sessionId}`) return Response.json(session);
      return Response.json(await f.request(init.method, path, init.body ? JSON.parse(init.body) : undefined));
    },
  });
  native.db.prepare(`INSERT INTO captures(capture_key,generation,identity,recording_id,session_state,session_id,owner_revision)
    VALUES(?,3,?,'rec_one','known',?,1)`).run('test_capture', JSON.stringify(identity), sessionId);
  f.resources.push(native);
  createApp(native, config.appToken, f.library);
  return native;
}

test('native uncertain intent blocks library processing before a new claim or POST', async t => {
  const f = fixture(t), native = composeNative(t, f);
  native.db.prepare("UPDATE captures SET transcription_state='uncertain' WHERE recording_id='rec_one'").run();
  await rejects(f.write('/api/library/recordings/rec_one/transcriptions'), 'transcription_create_uncertain');
  assert.equal(f.calls.length, 0);
  assert.deepEqual(await f.read('/api/library/operations'), { data: [] });
});

test('library uncertain intent blocks a native replacement after library restart', async t => {
  const f = fixture(t), native = composeNative(t, f); f.state.fail = 'POST /transcriptions';
  await rejects(f.write('/api/library/recordings/rec_one/transcriptions'), 'operation_uncertain');
  f.restart(); createApp(native, config.appToken, f.library); f.state.fail = null;
  await rejects(native.transcribe('rec_one', 3), 'library_transcription_reconciliation_required');
  assert.equal(f.posts('/transcriptions').length, 1);
});

test('concurrent native and library paths create only one transcription', async t => {
  const f = fixture(t), native = composeNative(t, f);
  const outcomes = await Promise.allSettled([
    native.transcribe('rec_one', 3), f.write('/api/library/recordings/rec_one/transcriptions'),
  ]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(result => result.status === 'rejected').reason.code, 'operation_in_progress');
  assert.equal(f.posts('/transcriptions').length, 1);
  const nativeResult = await native.transcribe('rec_one', 3);
  const libraryResult = await f.write('/api/library/recordings/rec_one/transcriptions');
  assert.equal(nativeResult.id, libraryResult.transcription.id);
  assert.equal(f.posts('/transcriptions').length, 1);
});

test('a known native transcription cannot be replaced if absent from the API list', async t => {
  const f = fixture(t), native = composeNative(t, f);
  native.db.prepare("UPDATE captures SET transcription_state='known',transcription_id='txn_known' WHERE recording_id='rec_one'").run();
  await rejects(f.write('/api/library/recordings/rec_one/transcriptions'), 'native_transcription_reconciliation_required');
  assert.equal(f.posts('/transcriptions').length, 0);
});

async function httpFixture(t, f) {
  const native = new SyncService(config, { database: ':memory:', fetchImpl: () => { throw new Error('No native upstream call expected'); } });
  const server = createApp(native, config.appToken, f.library);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); native.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, options = {}) => {
    const response = await fetch(origin + path, {
      ...options, headers: { Authorization: `Bearer ${config.appToken}`, ...options.headers },
    });
    return { status: response.status, body: await response.json() };
  };
  request.origin = origin;
  return request;
}

test('the real mobile HTTP adapter completes the fixture library workflow against this server', async t => {
  const f = fixture(t), request = await httpFixture(t, f);
  const api = createLibraryApi(request.origin, config.appToken);
  t.after(() => api.dispose());
  const page = await api.list();
  assert.equal(page.data[0].id, 'rec_one');
  assert.equal(page.data[0].upload_verified, true);
  const row = await api.detail('rec_one');
  const transcription = await api.startTranscription(row.id);
  const transcripts = await api.transcriptions(row.id);
  assert.equal(transcripts[0].id, transcription.operation.resource_id);
  assert.equal(transcripts[0].full_text, 'Synthetic Monday transcript.');
  const summary = await api.startSummary(transcripts[0].id);
  const notes = await api.summaries(transcripts[0].id, row.id);
  assert.equal(notes[0].id, summary.operation.resource_id);
  assert.equal(notes[0].output.overview, 'Synthetic notes.');
  const asked = await api.ask(row.id, '  What happened?  ');
  assert.equal(asked.answer, 'Synthetic answer.');
  assert.equal(asked.citations[0].recording_id, row.id);
  const recovered = await api.operation(asked.operation.id, undefined, row.id);
  assert.equal(recovered.answer, asked.answer);
  const metadata = await api.operation(asked.operation.id);
  assert.deepEqual(Object.keys(metadata), ['operation']);
  assert.equal((await api.operations()).length, 3);
  assert.equal(f.posts('/transcriptions').length, 1);
  assert.equal(f.posts('/summaries').length, 1);
  assert.equal(f.calls.filter(call => call.method === 'POST' && call.path.endsWith('/messages')).length, 1);
});

test('the real mobile adapter receives a known uncertain operation and recovers only by GET', async t => {
  const f = fixture(t), request = await httpFixture(t, f);
  const api = createLibraryApi(request.origin, config.appToken);
  t.after(() => api.dispose());
  f.state.after = (method, path, value) => {
    if (method === 'POST' && path === '/transcriptions') f.state.fail = `GET /transcriptions/${value.id}`;
  };
  let operation;
  await assert.rejects(api.startTranscription('rec_one'), error => {
    assert(error instanceof LibraryError);
    assert.equal(error.code, 'operation_uncertain');
    operation = error.operation;
    assert.equal(operation.kind, 'transcription');
    return true;
  });
  f.state.after = null; f.state.fail = null;
  const result = await api.operation(operation.id);
  assert.equal(result.operation.state, 'complete');
  assert.equal(f.posts('/transcriptions').length, 1);
});

test('real HTTP serves the cloud library without a binding header or physical device', async t => {
  const f = fixture(t), request = await httpFixture(t, f);
  const list = await request('/api/library/recordings?cursor=opaque%2B%2F%3D');
  assert.equal(list.status, 200);
  const native = await request('/api/context');
  assert.equal(native.status, 409); assert.equal(native.body.error.code, 'device_not_configured');
  const result = await request('/api/library/recordings/rec_one/transcriptions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(result.status, 200); assert.equal(result.body.transcription.status, 'completed');
});

test('real HTTP authentication and browser rejection precede all library reads', async t => {
  const f = fixture(t), request = await httpFixture(t, f);
  for (const headers of [{ Authorization: '' }, { Authorization: `Bearer ${config.apiKey}` }, { Origin: 'https://example.test' }]) {
    assert.equal((await request('/api/library/recordings', { headers })).status, 401);
  }
  assert.equal(f.calls.length, 0);
});

test('real HTTP rejects unknown fields, queries, encoded paths, large or invalid JSON', async t => {
  const f = fixture(t), request = await httpFixture(t, f);
  for (const path of ['/api/library/recordings?end_user_id=eu_foreign', '/api/library/recordings?cursor=a&cursor=b',
    '/api/library/recordings/rec_one?cursor=x', '/api/library/recordings/rec%5Fone', '/api/library/proxy',
    '/api/recordings?cursor=a']) assert([400, 404].includes((await request(path)).status));
  for (const body of ['{', 'null', '{"question":"hello","end_user_id":"eu_foreign"}']) {
    const result = await request('/api/library/recordings/rec_one/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    assert.equal(result.status, 400);
  }
  const large = await request('/api/library/recordings/rec_one/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'x'.repeat(33000) }),
  });
  assert.equal(large.status, 413);
  assert.equal(f.calls.length, 0);
});

test('real HTTP uncertainty errors reveal neither upstream content nor credentials', async t => {
  const f = fixture(t), request = await httpFixture(t, f); f.state.fail = 'POST /transcriptions';
  const result = await request('/api/library/recordings/rec_one/transcriptions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(result.status, 503); assert.equal(result.body.error.code, 'operation_uncertain');
  const text = JSON.stringify(result.body);
  assert(!text.includes('DO_NOT_EXPOSE') && !text.includes(config.apiKey) && !text.includes('rec_one'));
  const retained = await request('/api/library/operations');
  assert.equal(retained.body.data[0].state, 'uncertain');
  assert.deepEqual(Object.keys(result.body.operation).sort(), ['id', 'kind', 'resource_id', 'state', 'updated_at']);
});

for (const kind of ['transcription', 'ask']) test(`real HTTP known uncertain ${kind} errors carry narrow recovery metadata`, async t => {
  const f = fixture(t), request = await httpFixture(t, f);
  f.state.after = (method, path, value) => {
    if (kind === 'transcription' && method === 'POST' && path === '/transcriptions') f.state.fail = `GET /transcriptions/${value.id}`;
    if (kind === 'ask' && method === 'POST' && path.endsWith('/messages')) f.state.fail = `GET /ask/sessions/${value.session_id}`;
  };
  const path = kind === 'ask' ? '/api/library/recordings/rec_one/ask' : '/api/library/recordings/rec_one/transcriptions';
  const result = await request(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(kind === 'ask' ? { question: 'What happened?' } : {}),
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.operation.state, 'uncertain');
  assert.match(result.body.operation.resource_id, kind === 'ask' ? /^as_/ : /^txn_/);
  assert.deepEqual(Object.keys(result.body.operation).sort(), ['id', 'kind', 'resource_id', 'state', 'updated_at']);
  const text = JSON.stringify(result.body);
  assert(!text.includes('Synthetic') && !text.includes('What happened?') && !text.includes('DO_NOT_EXPOSE') && !text.includes(config.apiKey));
  f.state.fail = null; f.state.after = null;
  const recovered = await request(`/api/library/operations/${result.body.operation.id}`);
  assert.equal(recovered.status, 200); assert.equal(recovered.body.operation.state, 'complete');
});

test('real HTTP ownership and missing-resource errors omit operation metadata', async t => {
  const f = fixture(t), request = await httpFixture(t, f);
  f.state.after = (method, path, value) => {
    if (method === 'POST' && path === '/ask/sessions') value.end_user_id = 'eu_foreign';
  };
  const ask = await request('/api/library/recordings/rec_one/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"question":"What happened?"}',
  });
  assert.equal(ask.status, 403); assert.equal(ask.body.operation, undefined);
  f.state.after = (method, path) => {
    if (method === 'GET' && path.startsWith('/transcriptions/')) throw new RequestError(404, 'upstream_rejected');
  };
  const tx = await request('/api/library/recordings/rec_one/transcriptions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(tx.status, 404); assert.equal(tx.body.operation, undefined);
});
