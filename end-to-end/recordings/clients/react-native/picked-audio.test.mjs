import assert from 'node:assert/strict';
import test from 'node:test';
import { preparePickedAudio } from './picked-audio.ts';

function cacheFile() {
  let deleted = false;
  const file = new Blob(['synthetic audio']);
  Object.defineProperty(file, 'exists', { get: () => !deleted });
  file.delete = () => { deleted = true; };
  return { file, deleted: () => deleted };
}

test('valid picked cache retains ownership until the returned cleanup, without deleting the user source', async () => {
  const cache = cacheFile(); const picked = preparePickedAudio(cache.file, 'voice.m4a', 'audio/x-m4a');
  assert.equal(picked.mime, 'audio/mp4'); assert.equal(picked.body, cache.file); assert.equal(cache.deleted(), false);
  await picked.remove(); assert.equal(cache.deleted(), true); await picked.remove();
});

test('unsupported metadata and thrown MIME normalization remove the already-verified private copy', () => {
  for (const [name, mime] of [['note.wav', 'text/plain'], ['bad/name.wav', 'audio/wav'], ['note.wav', {}]]) {
    const cache = cacheFile(); assert.throws(() => preparePickedAudio(cache.file, name, mime), error => error.code === 'invalid_audio');
    assert.equal(cache.deleted(), true);
  }
});

test('failed private-cache deletion retains a cleanup failure requiring restart', () => {
  const { file } = cacheFile(); file.delete = () => { throw Error('private filesystem failure'); };
  assert.throws(() => preparePickedAudio(file, 'note.wav', 'text/plain'), error => error.code === 'cleanup_failed' && !error.message.includes('filesystem failure'));
});
