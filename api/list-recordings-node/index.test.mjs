import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readConfig, listRecordings, main} from './index.mjs';

const env = {BOTA_API_BASE_URL: 'https://api.example.test/v1', BOTA_API_KEY: 'rk_testOnlyCredential'};
const row = id => ({id, status: 'uploaded', duration_seconds: 12, recorded_at: null, created_at: '2026-10-01T12:00:00Z'});
const json = document => new Response(JSON.stringify(document), {headers: {'Content-Type': 'application/json'}});
function capture(fetchImpl) {
  const output = []; const errors = [];
  return {output, errors, run: input => main(input ?? env, {fetchImpl, output: s => output.push(s), errorOutput: s => errors.push(s)})};
}

test('follows opaque cursor pages with the same project credential and optional end-user filter', async () => {
  const requests = []; const cursor = 'opaque/+?=& value';
  const result = await listRecordings(readConfig({...env, BOTA_LIMIT: '1', BOTA_END_USER_ID: 'eu_testOnly'}), {
    fetchImpl: async (url, options) => {
      requests.push(new URL(url));
      assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, `Bearer ${env.BOTA_API_KEY}`);
      assert.equal(options.headers.Accept, 'application/json');
      assert.ok(options.signal instanceof AbortSignal);
      return requests.length === 1 ? json({data: [row('rec_first')], has_more: true, next_cursor: cursor})
        : json({data: [row('rec_second')], has_more: false});
    },
  });
  assert.equal(requests.length, 2);
  for (const url of requests) {
    assert.equal(url.origin, 'https://api.example.test'); assert.equal(url.pathname, '/v1/recordings');
    assert.equal(url.searchParams.get('limit'), '1'); assert.equal(url.searchParams.get('end_user_id'), 'eu_testOnly');
  }
  assert.equal(requests[0].searchParams.has('cursor'), false);
  assert.equal(requests[1].searchParams.get('cursor'), cursor);
  assert.deepEqual(result.recordings.map(r => r.id), ['rec_first', 'rec_second']);
  assert.equal(result.complete, true); assert.equal(result.pages, 2);
  assert.equal(JSON.stringify(result).includes(cursor), false);
});

test('page cap emits an explicitly incomplete result and distinct CLI status', async () => {
  let calls = 0;
  const cli = capture(async () => { calls++; return json({data: [row('rec_first')], has_more: true, next_cursor: 'opaque'}); });
  assert.equal(await cli.run({...env, BOTA_MAX_PAGES: '1'}), 2);
  assert.equal(calls, 1); assert.deepEqual(cli.errors, []);
  const output = JSON.parse(cli.output[0]);
  assert.equal(output.complete, false); assert.equal(output.stopped_reason, 'page_limit');
  assert.equal(Object.hasOwn(output, 'next_cursor'), false);
});

test('empty list and terminal null cursor finish without additional requests', async () => {
  let calls = 0;
  const result = await listRecordings(readConfig(env), {fetchImpl: async () => { calls++; return json({data: [], has_more: false, next_cursor: null}); }});
  assert.deepEqual(result, {recordings: [], pages: 1, complete: true, stopped_reason: 'end_of_list'});
  assert.equal(calls, 1);
});

test('missing, empty and cycling cursors stop instead of walking repeated pages', async () => {
  for (const page of [{data: [row('rec_first')], has_more: true}, {data: [], has_more: true, next_cursor: 'a'},
    {data: [row('rec_first')], has_more: true, next_cursor: ''}]) {
    await assert.rejects(listRecordings(readConfig(env), {fetchImpl: async () => json(page)}), /pagination cursor/);
  }
  let calls = 0;
  await assert.rejects(listRecordings(readConfig(env), {fetchImpl: async () => {
    calls++; return json({data: [row(`rec_item${calls}`)], has_more: true, next_cursor: calls === 2 ? 'b' : 'a'});
  }}), /repeated pagination cursor/);
  assert.equal(calls, 3);
});

test('output projects safe metadata and drops arbitrary response fields', async () => {
  const secret = 'PRIVATE-CONTENT-MUST-NOT-APPEAR';
  const item = {...row('rec_testOnly'), name: secret, metadata: {secret}, device_id: secret, end_user_id: secret,
    audio_url: `https://storage.invalid/${secret}`, s3_key: secret, transcript: secret};
  const cli = capture(async () => json({data: [item], has_more: false, other: secret}));
  assert.equal(await cli.run(), 0);
  assert.deepEqual(Object.keys(JSON.parse(cli.output[0]).recordings[0]), ['id', 'status', 'duration_seconds', 'recorded_at', 'created_at']);
  assert.equal(cli.output.join('').includes(secret), false);
  assert.equal(cli.output.join('').includes(env.BOTA_API_KEY), false);
});

test('401 and 403 do not print upstream errors, credentials or partial results; no retry', async () => {
  for (const status of [401, 403]) {
    let calls = 0;
    const cli = capture(async () => { calls++; return new Response(`private ${env.BOTA_API_KEY}`, {status}); });
    assert.equal(await cli.run(), 1); assert.equal(calls, 1); assert.deepEqual(cli.output, []);
    assert.match(cli.errors[0], /Authorization rejected/);
    assert.equal(cli.errors.join('').includes(env.BOTA_API_KEY), false);
  }
});

test('rate limits, HTTP failures and raw transport errors stay bounded and redacted', async () => {
  for (const outcome of [429, 503, new Error(`private token ${env.BOTA_API_KEY}`)]) {
    let calls = 0;
    const cli = capture(async () => { calls++; if (outcome instanceof Error) throw outcome; return new Response(env.BOTA_API_KEY, {status: outcome}); });
    assert.equal(await cli.run(), 1); assert.equal(calls, 1); assert.deepEqual(cli.output, []);
    assert.equal(cli.errors.join('').includes(env.BOTA_API_KEY), false);
  }
});

test('a failed later page does not emit the earlier page as a complete result', async () => {
  let calls = 0;
  const cli = capture(async () => ++calls === 1 ? json({data: [row('rec_first')], has_more: true, next_cursor: 'next'}) : new Response('private error', {status: 500}));
  assert.equal(await cli.run(), 1); assert.equal(calls, 2); assert.deepEqual(cli.output, []);
});

test('rejects malformed or oversized pages and invalid projected values without echoing them', async () => {
  const invalid = [new Response('private non-JSON'), new Response('x'.repeat(2 * 1024 * 1024 + 1)),
    json({data: {}, has_more: false}), json({data: [], has_more: 'false'}),
    json({data: [row('rec_one'), row('rec_two')], has_more: false}),
    json({data: [{...row('rec_one'), duration_seconds: -1}], has_more: false}),
    json({data: [{...row('rec_one'), created_at: 'private-invalid-date'}], has_more: false})];
  for (const response of invalid) {
    const cli = capture(async () => response);
    assert.equal(await cli.run({...env, BOTA_LIMIT: '1'}), 1);
    assert.deepEqual(cli.output, []); assert.equal(cli.errors.join('').includes('private'), false);
  }
});

test('invalid configuration is rejected before any network request', async () => {
  const changes = [{BOTA_API_BASE_URL: 'http://api.example.test/v1'}, {BOTA_API_BASE_URL: 'https://user:password@example.test/v1'},
    {BOTA_API_BASE_URL: 'https://example.test/v1?key=private'}, {BOTA_API_BASE_URL: 'https://example.test/dashboard'},
    {BOTA_API_KEY: 'dtok_no'}, {BOTA_API_KEY: 'rk_has\nnewline'}, {BOTA_END_USER_ID: 'dev_other'},
    {BOTA_LIMIT: '0'}, {BOTA_LIMIT: '101'}, {BOTA_LIMIT: '1.5'}, {BOTA_MAX_PAGES: '51'}];
  for (const change of changes) {
    let called = false; const cli = capture(async () => { called = true; throw new Error('unexpected'); });
    assert.equal(await cli.run({...env, ...change}), 1); assert.equal(called, false); assert.deepEqual(cli.output, []);
  }
});

test('real fetch refuses redirects instead of forwarding the project bearer', async t => {
  let destinationCalls = 0;
  const server = createServer((request, response) => {
    if (request.url.startsWith('/v1/recordings')) { response.writeHead(302, {Location: '/destination'}); response.end(); }
    else { destinationCalls++; response.end('{}'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const cli = capture(fetch);
  assert.equal(await cli.run({...env, BOTA_API_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`}), 1);
  assert.equal(destinationCalls, 0); assert.deepEqual(cli.output, []);
});

test('standalone CLI makes only a GET to a local fake API and prints projected JSON', async t => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({method: request.method, url: request.url, auth: request.headers.authorization});
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({data: [row('rec_localOnly')], has_more: false}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const child = spawn(process.execPath, ['index.mjs'], {cwd: new URL('.', import.meta.url), env: {
    ...process.env, ...env, BOTA_API_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`, BOTA_END_USER_ID: '', BOTA_LIMIT: '1', BOTA_MAX_PAGES: '2',
  }});
  let stdout = ''; let stderr = '';
  child.stdout.on('data', value => { stdout += value; }); child.stderr.on('data', value => { stderr += value; });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  assert.equal(code, 0); assert.equal(stderr, '');
  assert.deepEqual(requests, [{method: 'GET', url: '/v1/recordings?limit=1', auth: `Bearer ${env.BOTA_API_KEY}`}]);
  assert.equal(JSON.parse(stdout).recordings[0].id, 'rec_localOnly');
});
