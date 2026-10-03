import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readConfig, searchTranscripts, main} from './index.mjs';

// Synthetic identifiers and credential: these tests never call Bota or a provider.
const env = {BOTA_API_BASE_URL: 'https://api.example.test/v1', BOTA_API_KEY: 'rk_testOnlyNotReal',
  BOTA_END_USER_ID: 'eu_testOwner', BOTA_QUERY: '  agreed budget  '};
const chunk = (number = 1) => ({chunk_id: `chk_test${number}`, recording_id: 'rec_testOne',
  transcription_id: 'txn_testOne', chunk_text: 'A synthetic excerpt.', speaker: null,
  start_ms: 1250, end_ms: 2500, recorded_at: null, score: 0.0312});
const json = value => new Response(JSON.stringify(value), {headers: {'Content-Type': 'application/json'}});
const owner = recordingId => ({id: recordingId, end_user_id: env.BOTA_END_USER_ID});
function capture(fetchImpl) {
  const output = []; const errors = [];
  return {output, errors, run: (input = env) => main(input, {fetchImpl, output: text => output.push(text), errorOutput: text => errors.push(text)})};
}

test('sends one scoped search then checks each unique recording before projecting timestamped excerpts', async () => {
  const requests = []; const secret = 'UNSELECTED-DATA';
  const cli = capture(async (url, options) => {
    requests.push({url, options});
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${env.BOTA_API_KEY}`);
    assert.ok(options.signal instanceof AbortSignal);
    if (options.method === 'POST') return json({results: [{...chunk(), debug: secret}, {...chunk(2), speaker: 'SPEAKER_0',
      recorded_at: '2026-10-01T12:00:00Z'}], session: secret});
    return json({...owner('rec_testOne'), audio_url: `https://storage.invalid/${secret}`, metadata: {secret}});
  });
  assert.equal(await cli.run({...env, BOTA_RECORDING_IDS: 'rec_testOne', BOTA_LIMIT: '2'}), 0);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, `${env.BOTA_API_BASE_URL}/recordings/search`);
  assert.deepEqual(JSON.parse(requests[0].options.body), {query: 'agreed budget', end_user_id: env.BOTA_END_USER_ID,
    limit: 2, recording_ids: ['rec_testOne']});
  assert.equal(requests[1].url, `${env.BOTA_API_BASE_URL}/recordings/rec_testOne`);
  assert.equal(requests[1].options.method, 'GET');
  assert.equal(requests[1].options.signal, requests[0].options.signal);
  const output = JSON.parse(cli.output[0]);
  assert.deepEqual(output.results[0], chunk());
  assert.equal(output.results[1].recorded_at, '2026-10-01T12:00:00Z');
  assert.equal(cli.output.join('').includes(secret), false);
  assert.equal(cli.output.join('').includes(env.BOTA_API_KEY), false);
  assert.equal(cli.output.join('').includes('agreed budget'), false);
  assert.deepEqual(cli.errors, []);
});

test('empty search returns empty excerpts without inventing indexing status or issuing ownership GETs', async () => {
  let calls = 0;
  assert.deepEqual(await searchTranscripts(readConfig(env), {fetchImpl: async () => { calls++; return json({results: []}); }}), {results: []});
  assert.equal(calls, 1);
});

test('all rows must match the allowlist before any ownership read or output', async () => {
  let calls = 0;
  const cli = capture(async () => { calls++; return json({results: [chunk()]}); });
  assert.equal(await cli.run({...env, BOTA_RECORDING_IDS: 'rec_testOther'}), 1);
  assert.equal(calls, 1); assert.deepEqual(cli.output, []);
  assert.match(cli.errors[0], /allowlist/);
});

test('wrong, absent or mismatched returned owner fails closed without printing even previously checked excerpts', async () => {
  for (const metadata of [{id: 'rec_testTwo', end_user_id: 'eu_other'}, {id: 'rec_testTwo'}, owner('rec_wrong')]) {
    let calls = 0;
    const cli = capture(async () => {
      calls++;
      if (calls === 1) return json({results: [chunk(), {...chunk(2), recording_id: 'rec_testTwo'}]});
      return json(calls === 2 ? owner('rec_testOne') : metadata);
    });
    assert.equal(await cli.run(), 1); assert.equal(calls, 3);
    assert.deepEqual(cli.output, []); assert.match(cli.errors[0], /end-user scope/);
  }
});

test('bad configuration fails before any request', async () => {
  for (const change of [{BOTA_QUERY: ''}, {BOTA_QUERY: ' '.repeat(5)}, {BOTA_QUERY: 'x'.repeat(1001)},
    {BOTA_END_USER_ID: ''}, {BOTA_END_USER_ID: 'eu_bad/path'}, {BOTA_API_KEY: ''}, {BOTA_LIMIT: '0'},
    {BOTA_LIMIT: '51'}, {BOTA_LIMIT: '1.5'}, {BOTA_LIMIT: '08'}, {BOTA_RECORDING_IDS: 'rec_testOne,'},
    {BOTA_RECORDING_IDS: 'rec_testOne,rec_testOne'}, {BOTA_RECORDING_IDS: '../other'},
    {BOTA_RECORDING_IDS: Array.from({length: 501}, (_, i) => `rec_test${i}`).join(',')},
    {BOTA_API_BASE_URL: 'http://api.example.test/v1'}, {BOTA_API_BASE_URL: 'https://user:pass@api.example.test/v1'},
    {BOTA_API_BASE_URL: 'https://api.example.test/v1?key=bad'}, {BOTA_API_BASE_URL: 'https://api.example.test/v1#bad'},
    {BOTA_API_BASE_URL: 'https://api.example.test/v2'}]) {
    const cli = capture(() => assert.fail('No request should be sent'));
    assert.equal(await cli.run({...env, ...change}), 1); assert.deepEqual(cli.output, []);
  }
  assert.equal(readConfig({...env, BOTA_QUERY: 'x'.repeat(1000), BOTA_LIMIT: '50'}).limit, 50);
});

test('invalid citation shapes, ranges and oversized text never reach ownership reads', async () => {
  const bad = [{start_ms: -1}, {start_ms: 1.5}, {end_ms: 1}, {end_ms: Number.MAX_SAFE_INTEGER + 1},
    {score: null}, {score: -1}, {speaker: 3}, {chunk_text: ''}, {chunk_text: 'x'.repeat(32_769)},
    {recorded_at: 'yesterday'}, {recorded_at: undefined}, {chunk_id: 'bad'}, {recording_id: 'rec_a/b'}, {transcription_id: null}];
  for (const patch of bad) {
    let calls = 0;
    const cli = capture(async () => { calls++; return json({results: [{...chunk(), ...patch}]}); });
    assert.equal(await cli.run(), 1); assert.equal(calls, 1); assert.deepEqual(cli.output, []);
  }
});

test('invalid root, too many results and duplicate chunks fail without partial output', async () => {
  for (const response of [null, {}, {results: {}}, {results: [chunk(), chunk()]},
    {results: Array.from({length: 9}, (_, i) => chunk(i))}]) {
    const cli = capture(async () => json(response));
    assert.equal(await cli.run(), 1); assert.deepEqual(cli.output, []);
  }
});

test('upstream error bodies and network exception details stay private, with no retry', async () => {
  const secret = 'PRIVATE-UPSTREAM-BODY';
  for (const status of [401, 403, 404, 429, 500]) {
    let calls = 0;
    const cli = capture(async () => { calls++; return new Response(`${secret} ${env.BOTA_API_KEY}`, {status}); });
    assert.equal(await cli.run(), 1); assert.equal(calls, 1); assert.deepEqual(cli.output, []);
    assert.equal(cli.errors.join('').includes(secret), false);
    assert.equal(cli.errors.join('').includes(env.BOTA_API_KEY), false);
  }
  const cli = capture(async () => { throw new Error(secret); });
  assert.equal(await cli.run(), 1); assert.equal(cli.errors.join('').includes(secret), false);
});

test('ownership read failure does not reissue the search or print excerpts', async () => {
  const methods = [];
  const cli = capture(async (_, options) => {
    methods.push(options.method);
    return options.method === 'POST' ? json({results: [chunk()]}) : new Response('private', {status: 503});
  });
  assert.equal(await cli.run(), 1); assert.deepEqual(methods, ['POST', 'GET']); assert.deepEqual(cli.output, []);
});

test('response byte limit, content type and malformed JSON are bounded and sanitized', async () => {
  for (const response of [new Response('x'.repeat(1024 * 1024 + 1), {headers: {'Content-Type': 'application/json'}}),
    new Response('{PRIVATE-BAD-JSON', {headers: {'Content-Type': 'application/json'}}),
    new Response('PRIVATE-HTML', {headers: {'Content-Type': 'text/html'}})]) {
    const cli = capture(async () => response);
    assert.equal(await cli.run(), 1); assert.deepEqual(cli.output, []); assert.equal(cli.errors.join('').includes('PRIVATE'), false);
  }
});

async function localServer(handler, run) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}/v1`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('real fetch refuses redirects without forwarding the credential', {timeout: 5000}, async () => {
  const paths = [];
  await localServer((req, res) => {
    paths.push(req.url); res.writeHead(302, {Location: '/leak'}); res.end();
  }, async base => {
    const cli = capture(fetch);
    assert.equal(await cli.run({...env, BOTA_API_BASE_URL: base}), 1);
    assert.deepEqual(cli.output, []); assert.deepEqual(paths, ['/v1/recordings/search']);
  });
});

test('one deadline includes slow response bodies and makes no retry', {timeout: 5000}, async () => {
  let calls = 0;
  await localServer((_, res) => {
    calls++; res.writeHead(200, {'Content-Type': 'application/json'}); res.write('{"results":[');
  }, async base => {
    await assert.rejects(searchTranscripts(readConfig({...env, BOTA_API_BASE_URL: base}), {timeoutMs: 100}), /deadline/);
    assert.equal(calls, 1);
  });
});
