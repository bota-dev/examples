import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readConfig, summarize } from './index.mjs';

const environment = {
  BOTA_API_BASE_URL: 'https://api.example.test/v1', BOTA_API_KEY: 'sk_test_serverSecret',
  BOTA_PROJECT_ID: 'proj_test', BOTA_TRANSCRIPTION_ID: 'txn_test',
};
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'bota-summary-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const config = readConfig({ ...environment, SUMMARY_STATE_PATH: join(directory, 'state.sqlite') });
  const calls = [];
  const state = {
    transcription: { id: 'txn_test', project_id: 'proj_test', recording_id: 'rec_test', status: 'completed', full_text: 'Private synthetic transcript.' },
    recording: { id: 'rec_test', project_id: 'proj_test', end_user_id: 'eu_test', device_id: null, deleted_at: null },
    summary: { id: 'sum_test', project_id: 'proj_test', transcription_id: 'txn_test', template_id: 'tmpl_general_notes',
      provider: 'gemini', custom_prompt: null, status: 'completed', output: { overview: 'Private synthetic output.' } },
    automatic: false, existing: [], intercept: undefined,
  };
  const fetchImpl = async (url, init) => {
    const path = url.replace(config.apiBase, '');
    calls.push({ path, ...init });
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, 'Bearer sk_test_serverSecret');
    if (init.signal.aborted) throw new Error('aborted private context');
    if (state.intercept) { const result = await state.intercept(path, init); if (result) return result; }
    if (path === '/transcriptions/txn_test') return Response.json(state.transcription);
    if (path === '/recordings/rec_test') return Response.json(state.recording);
    if (path.endsWith('/config/processing')) return Response.json({ value: { auto_summary: { enabled: state.automatic } } });
    if (path.startsWith('/summaries?')) return Response.json({ data: state.existing, has_more: false });
    if (path === '/summaries' && init.method === 'POST') return Response.json({ ...state.summary, status: 'pending', output: null }, { status: 201 });
    if (path.startsWith('/summaries/')) return Response.json(state.summary);
    throw new Error('Unexpected request');
  };
  return { directory, config, state, calls, fetchImpl,
    run: options => summarize(config, { fetchImpl, ...options }),
    writes: () => calls.filter(call => call.method === 'POST'),
  };
}

test('validates API origin, server credential, template and provider before requests', () => {
  assert.equal(readConfig(environment).template, 'tmpl_general_notes');
  for (const override of [
    { BOTA_API_BASE_URL: 'http://remote.example/v1' }, { BOTA_API_BASE_URL: 'https://user:secret@api.example/v1' },
    { BOTA_API_BASE_URL: 'https://api.example/v1?key=secret' }, { BOTA_API_KEY: 'sk_test_replace_me' },
    { BOTA_PROJECT_ID: 'replace_me' }, { BOTA_TRANSCRIPTION_ID: 'txn_/other' },
    { BOTA_TEMPLATE_ID: 'unknown' }, { BOTA_SUMMARY_PROVIDER: 'unknown' },
  ]) assert.throws(() => readConfig({ ...environment, ...override }));
});

test('creates once with a persisted key, polls structured output and resumes using GET only', async t => {
  const f = fixture(t); let reads = 0;
  f.state.intercept = async path => path === '/summaries/sum_test' && reads++ === 0
    ? Response.json({ ...f.state.summary, status: 'processing', output: null }) : undefined;
  assert.equal((await f.run({ sleep: async () => {} })).output.overview, 'Private synthetic output.');
  assert.equal((await f.run()).id, 'sum_test');
  assert.equal(f.writes().length, 1);
  assert.match(f.writes()[0].headers['Idempotency-Key'], /^[0-9a-f-]{36}$/);
  assert.deepEqual(JSON.parse(f.writes()[0].body), { transcription_id: 'txn_test', template_id: 'tmpl_general_notes', provider: 'gemini' });
  const db = new DatabaseSync(f.config.statePath);
  const row = db.prepare('SELECT * FROM operation').get(); db.close();
  assert.equal(row.request_key, f.writes()[0].headers['Idempotency-Key']);
  assert.equal(row.summary_id, 'sum_test');
  for (const file of readdirSync(f.directory)) {
    const contents = readFileSync(join(f.directory, file)).toString();
    for (const secret of [environment.BOTA_API_KEY, f.state.transcription.full_text, f.state.summary.output.overview]) assert.ok(!contents.includes(secret));
  }
});

test('completed transcript and project identity are prerequisites for creation', async t => {
  const f = fixture(t);
  f.state.transcription.status = 'processing';
  await assert.rejects(f.run(), /already be completed/);
  f.state.transcription.status = 'completed'; f.state.transcription.project_id = 'proj_other';
  await assert.rejects(f.run(), /expected project/);
  assert.equal(f.writes().length, 0);
});

test('recording scope and disabled effective auto-summary are checked without mutation', async t => {
  const f = fixture(t); f.state.automatic = true;
  await assert.rejects(f.run(), /auto-summary must be disabled/);
  f.state.automatic = false; f.state.recording.project_id = 'proj_other';
  await assert.rejects(f.run(), /Recording scope/);
  assert.equal(f.writes().length, 0);
});

test('an existing completed same-template summary is never replaced, even for another provider', async t => {
  const f = fixture(t); f.state.existing = [{ ...f.state.summary, provider: 'claude' }];
  await assert.rejects(f.run(), /POST could replace it/);
  assert.equal(f.writes().length, 0);
});

test('preflight checks later pages and refuses cyclic or mismatched lists', async t => {
  const f = fixture(t);
  f.state.intercept = async path => path.startsWith('/summaries?')
    ? Response.json(path.includes('cursor=next') ? { data: [f.state.summary], has_more: false }
      : { data: [], has_more: true, next_cursor: 'next' }) : undefined;
  await assert.rejects(f.run(), /POST could replace it/);
  f.state.intercept = async path => path.startsWith('/summaries?') ? Response.json({ data: [], has_more: true, next_cursor: 'same' }) : undefined;
  await assert.rejects(f.run(), /repeated pagination/);
  f.state.intercept = undefined; f.state.existing = [{ ...f.state.summary, transcription_id: 'txn_other' }];
  await assert.rejects(f.run(), /mismatched scope/);
  assert.equal(f.writes().length, 0);
});

test('lost create response leaves durable uncertainty; restart never repeats POST', async t => {
  const f = fixture(t);
  f.state.intercept = async (path, init) => { if (path === '/summaries' && init.method === 'POST') throw new Error('secret server reply lost'); };
  await assert.rejects(f.run(), /Keep the journal/);
  f.state.intercept = undefined;
  await assert.rejects(f.run(), /uncertain/);
  assert.equal(f.writes().length, 1);
  assert.equal((await f.run({ summaryId: 'sum_test' })).id, 'sum_test');
  assert.equal(f.writes().length, 1);
});

test('HTTP create failure and malformed successful response cannot start a second job', async t => {
  for (const response of [() => new Response('private provider credential', { status: 500 }), () => Response.json({ ...fixtureSummary(), project_id: 'proj_other' })]) {
    const f = fixture(t);
    f.state.intercept = async path => path === '/summaries' ? response() : undefined;
    await assert.rejects(f.run(), error => !error.message.includes('private provider'));
    await assert.rejects(f.run(), /uncertain/);
    assert.equal(f.writes().length, 1);
  }
  function fixtureSummary() { return { id: 'sum_test', transcription_id: 'txn_test', template_id: 'tmpl_general_notes', provider: 'gemini', custom_prompt: null, status: 'pending' }; }
});

test('SQLite intent excludes concurrent creation by another process connection', async t => {
  const f = fixture(t); let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  f.state.intercept = async path => { if (path === '/summaries') { entered(); await held; } };
  const first = f.run(); await started;
  await assert.rejects(f.run(), /uncertain/);
  release(); await first;
  assert.equal(f.writes().length, 1);
});

test('inspection reports candidates without attaching or creating a journal', async t => {
  const f = fixture(t); f.state.existing = [f.state.summary];
  assert.deepEqual(await f.run({ inspect: true }), { summaries: [{ id: 'sum_test', status: 'completed', template_id: 'tmpl_general_notes', provider: 'gemini' }] });
  assert.deepEqual(readdirSync(f.directory), []);
  assert.equal(f.writes().length, 0);
});

test('explicit attachment validates exact ID, project, transcript, template and provider', async t => {
  const f = fixture(t);
  for (const [field, value] of Object.entries({ id: 'sum_other', project_id: 'proj_other', transcription_id: 'txn_other', template_id: 'tmpl_sales_call', provider: 'claude', custom_prompt: 'unexpected' })) {
    const original = f.state.summary[field]; f.state.summary[field] = value;
    await assert.rejects(f.run({ summaryId: 'sum_test' }), /identity/);
    f.state.summary[field] = original;
  }
  await f.run({ summaryId: 'sum_test' });
  await assert.rejects(f.run({ summaryId: 'sum_other' }), /different summary ID/);
  assert.equal(f.writes().length, 0);
});

test('changed journal scope is rejected before any API access', async t => {
  const f = fixture(t); await f.run(); const count = f.calls.length;
  for (const [field, value] of Object.entries({ apiBase: 'https://other.example/v1', projectId: 'proj_other', transcriptionId: 'txn_other', template: 'tmpl_sales_call', provider: 'claude' })) {
    await assert.rejects(summarize({ ...f.config, [field]: value }, { fetchImpl: f.fetchImpl }), /Journal scope differs/);
  }
  assert.equal(f.calls.length, count);
});

test('failed and timed-out known jobs stay known and do not cause another POST', async t => {
  const f = fixture(t); f.state.summary.status = 'processing'; f.state.summary.output = null;
  await assert.rejects(f.run({ pollTimeoutMs: 0 }), /Polling timed out/);
  f.state.summary.status = 'failed';
  await assert.rejects(f.run(), /failed/);
  f.state.summary.status = 'completed'; f.state.summary.output = { overview: 'Recovered.' };
  assert.equal((await f.run()).id, 'sum_test');
  assert.equal(f.writes().length, 1);
});

test('foreign or missing known summary is never replaced', async t => {
  const f = fixture(t); await f.run();
  f.state.summary.id = 'sum_other';
  await assert.rejects(f.run(), /identity/);
  f.state.intercept = async path => path === '/summaries/sum_test' ? new Response('sensitive raw error', { status: 404 }) : undefined;
  await assert.rejects(f.run(), /HTTP 404/);
  assert.equal(f.writes().length, 1);
});

test('cancellation before admission performs no creation', async t => {
  const f = fixture(t); const controller = new AbortController(); controller.abort();
  await assert.rejects(f.run({ signal: controller.signal }), /Keep the journal/);
  assert.equal(f.writes().length, 0);
});

test('polling does not issue another GET once the deadline has elapsed', async t => {
  const f = fixture(t); f.state.summary.status = 'processing'; f.state.summary.output = null;
  let clock = 0;
  await assert.rejects(f.run({ pollTimeoutMs: 10, pollIntervalMs: 10, now: () => clock,
    sleep: async milliseconds => { clock += milliseconds; } }), /Polling timed out/);
  assert.equal(f.calls.filter(call => call.path === '/summaries/sum_test').length, 1);
  assert.equal(f.writes().length, 1);
});

test('a completed response after the deadline remains a timeout with a retained ID', async t => {
  const f = fixture(t); let clock = 0;
  f.state.intercept = async path => { if (path === '/summaries/sum_test') clock = 20; };
  await assert.rejects(f.run({ pollTimeoutMs: 10, now: () => clock }), /Polling timed out/);
  f.state.intercept = undefined;
  assert.equal((await f.run()).id, 'sum_test');
  assert.equal(f.writes().length, 1);
});

test('a stalled polling request is cancelled by the remaining total budget', async t => {
  const f = fixture(t); let aborted = false;
  f.state.intercept = (path, init) => path === '/summaries/sum_test' ? new Promise((resolve, reject) => {
    // Keep the mock connection alive; AbortSignal.timeout itself uses an unref timer.
    const fallback = setTimeout(() => reject(new Error('poll deadline did not cancel request')), 1000);
    init.signal.addEventListener('abort', () => { clearTimeout(fallback); aborted = true; reject(new Error('cancelled')); }, { once: true });
  }) : undefined;
  await assert.rejects(f.run({ pollTimeoutMs: 30 }), /Polling timed out|Keep the journal/);
  assert.equal(aborted, true);
  assert.equal(f.writes().length, 1);
  f.state.intercept = undefined;
  assert.equal((await f.run()).id, 'sum_test');
  assert.equal(f.writes().length, 1);
});

test('an error response body is cancelled and never exposed', async t => {
  const f = fixture(t); let cancelled = false;
  f.state.intercept = async path => path === '/summaries' ? new Response(new ReadableStream({
    cancel() { cancelled = true; },
  }), { status: 403 }) : undefined;
  await assert.rejects(f.run(), /HTTP 403/);
  assert.equal(cancelled, true);
  await assert.rejects(f.run(), /uncertain/);
  assert.equal(f.writes().length, 1);
});
