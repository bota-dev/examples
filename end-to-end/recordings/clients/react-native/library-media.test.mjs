import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryApi, pickerAudioType, readWav, MAX_AUDIO_BYTES } from './library-api.ts';

const token = 'application-token-'.padEnd(48, 'x');
const op = { id: 'op_test', kind: 'upload', state: 'complete', resource_id: 'rec_test', updated_at: '2026-10-20T00:00:00Z' };
const apiFor = (fetchImpl, expired) => createLibraryApi('http://127.0.0.1:8787', token, expired, fetchImpl);
const wav = () => { const bytes = new Uint8Array(44); for (const [start, text] of [[0, 'RIFF'], [8, 'WAVE']]) [...text].forEach((c, i) => { bytes[start + i] = c.charCodeAt(0); }); new DataView(bytes.buffer).setUint32(4, 36, true); return bytes; };
const audio = (bytes = wav(), headers = {}) => new Response(bytes, { headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(bytes.byteLength), 'Cache-Control': 'no-store', ...headers } });

test('picker classifies known audio aliases/missing types without claiming content verification', () => {
  assert.equal(pickerAudioType('note.m4a', 'audio/x-m4a'), 'audio/mp4');
  assert.equal(pickerAudioType('note.m4a', 'audio/m4a'), 'audio/mp4');
  assert.equal(pickerAudioType('note.M4A'), 'audio/mp4');
  assert.equal(pickerAudioType('note.wav', 'application/octet-stream'), 'audio/wav');
  assert.equal(pickerAudioType('note.wav', 'text/plain'), '');
  assert.equal(pickerAudioType('unknown.bin'), '');
  assert.equal(pickerAudioType('m4a'), '');
  assert.equal(pickerAudioType('note.constructor'), '');
  assert.equal(pickerAudioType('note.wav', 'constructor'), '');
});

test('raw import uses exact customer endpoint/token, encoded filename, original File/Blob body', async () => {
  let calls = 0; const body = new Blob([wav()]);
  const api = apiFor(async (target, options) => {
    calls++; assert.equal(target, 'http://127.0.0.1:8787/api/library/uploads'); assert.equal(options.method, 'POST');
    assert.equal(options.body, body); assert.equal(options.headers['Content-Type'], 'audio/wav'); assert.equal(options.headers['X-File-Name'], 'Voice%20note.wav');
    assert.equal(options.headers.Authorization, `Bearer ${token}`); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit'); return Response.json({ operation: op });
  });
  assert.equal((await api.upload({ name: 'Voice note.wav', mime: 'audio/wav', body })).operation.id, op.id);
  for (const input of [{ name: '../secret' }, { mime: 'text/plain' }, { name: 'bad\nname' }, { body: { size: MAX_AUDIO_BYTES + 1 } }])
    await assert.rejects(api.upload({ name: 'voice.wav', mime: 'audio/wav', body, ...input }));
  assert.equal(calls, 1);
});

test('audio validates same-origin response, WAV integrity and private cache policy', async () => {
  const expected = wav();
  const api = apiFor(async (target, options) => { assert.equal(target, 'http://127.0.0.1:8787/api/library/recordings/rec_test/audio'); assert.equal(options.headers.Accept, 'audio/wav'); return audio(expected); });
  assert.deepEqual(await api.audio('rec_test'), expected);
  for (const headers of [{ 'Cache-Control': 'public' }, { 'Content-Length': '43' }, { 'Content-Type': 'text/html' }, { 'Content-Length': String(MAX_AUDIO_BYTES + 1) }]) await assert.rejects(readWav(audio(expected, headers)));
  const bad = wav(); bad[0] |= 0x80; await assert.rejects(readWav(audio(bad)));
  const unknown = wav(); new DataView(unknown.buffer).setUint32(4, 0xffffffff, true); assert.deepEqual(await readWav(audio(unknown)), unknown);
  const other = audio(); Object.defineProperty(other, 'url', { value: 'https://other.test/audio.wav' }); await assert.rejects(apiFor(async () => other).audio('rec_test'));
});

test('playback source denial and expired session never release bytes', async () => {
  let expired = 0;
  await assert.rejects(apiFor(async () => Response.json({ error: { code: 'playback_unavailable' } }, { status: 404 })).audio('rec_test'), /ordinary audio imports/);
  await assert.rejects(apiFor(async () => new Response(null, { status: 401 }), () => { expired++; }).audio('rec_test'), /token was rejected/);
  assert.equal(expired, 1);
});

test('truncated or overlong chunked WAV refuses and cancels its reader', async () => {
  await assert.rejects(readWav(audio(wav(), { 'Content-Length': '45' })));
  await assert.rejects(readWav(audio(new Uint8Array(45), { 'Content-Length': '44' })));
});
