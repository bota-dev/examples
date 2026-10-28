import assert from 'node:assert/strict';
import test from 'node:test';
import { MediaController } from './media-controller.ts';
import { LibraryError } from './library-api.ts';
import { RecordingsController } from './recordings-controller.ts';
import { createDemoLibrary } from './demo.ts';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const operation = { id: 'op_upload', kind: 'upload', state: 'complete', resource_id: 'rec_test', updated_at: '2026-10-20T00:00:00Z' };
const picked = () => ({ name: 'voice.wav', mime: 'audio/wav', body: new Blob(['audio']), async remove() {} });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('load is explicit, never autoplays; switching pauses/releases exact player before replacement', async () => {
  const events = [];
  const controller = new MediaController({ async audio(id) { events.push(`read:${id}`); return new Uint8Array(44); } }, {
    async player() { return { play() { events.push('play'); }, pause() { events.push('pause'); }, async release() { events.push('release'); } }; },
  });
  controller.select('rec_first'); assert.deepEqual(events, []);
  await controller.load(); assert.deepEqual(events, ['read:rec_first']); assert.equal(controller.snapshot().ready, true);
  controller.play(); controller.select('rec_second'); assert.deepEqual(events, ['read:rec_first', 'play', 'pause']);
  await controller.load(); assert.deepEqual(events, ['read:rec_first', 'play', 'pause', 'release', 'read:rec_second']);
  await controller.dispose(); assert.equal(controller.snapshot().ready, false);
});

test('late network result after selection is discarded without player/file creation', async () => {
  const result = deferred(); let playerCalls = 0;
  const controller = new MediaController({ audio(_id, signal) { signal.addEventListener('abort', () => {}); return result.promise; } }, { async player() { playerCalls++; } });
  controller.select('rec_old'); const load = controller.load(); await tick(); controller.select('rec_new');
  result.resolve(new Uint8Array(44)); await load;
  assert.equal(playerCalls, 0); assert.equal(controller.snapshot().selected, 'rec_new'); assert.equal(controller.snapshot().ready, false);
});

test('late native player allocation after signout is released and cannot play', async () => {
  const allocated = deferred(); let pauses = 0, releases = 0, plays = 0;
  const controller = new MediaController({ async audio() { return new Uint8Array(44); } }, { player() { return allocated.promise; } });
  controller.select('rec_old'); const load = controller.load(); await tick(); let disposed = false;
  const closing = controller.dispose().then(() => { disposed = true; }); await tick(); assert.equal(disposed, false);
  allocated.resolve({ play() { plays++; }, pause() { pauses++; }, async release() { releases++; } }); await load;
  await closing; assert.equal(disposed, true);
  controller.play(); assert.equal(plays, 0); assert.equal(pauses, 1); assert.equal(releases, 1);
});

test('a replacement selection waits prior native allocation and cache release before its read', async () => {
  const allocated = deferred(); const events = []; let players = 0;
  const player = { play() {}, pause() { events.push('pause'); }, async release() { events.push('release'); } };
  const controller = new MediaController({ async audio(id) { events.push(id); return new Uint8Array(44); } }, { async player() { return ++players === 1 ? allocated.promise : player; } });
  controller.select('rec_old'); const old = controller.load(); await tick(); controller.select('rec_new'); const current = controller.load(); await tick();
  assert.deepEqual(events, ['rec_old']); allocated.resolve(player); await old; await current;
  assert.deepEqual(events, ['rec_old', 'pause', 'release', 'rec_new']); await controller.dispose();
});

test('failed release blocks any replacement read/player', async () => {
  let reads = 0;
  const controller = new MediaController({ async audio() { reads++; return new Uint8Array(44); } }, {
    async player() { return { play() {}, pause() {}, async release() { throw Error('delete failed'); } }; },
  });
  controller.select('rec_old'); await controller.load(); controller.select('rec_new'); await controller.load();
  assert.equal(reads, 1); assert.equal(controller.snapshot().ready, false); assert.match(controller.snapshot().error, /cleanup failed/);
});

test('wrong source and expired account errors never reach native media', async () => {
  for (const error of [new LibraryError(404, 'playback_unavailable'), new LibraryError(401, 'unauthorized')]) {
    let calls = 0;
    const controller = new MediaController({ async audio() { throw error; } }, { async player() { calls++; } });
    controller.select('rec_test'); await controller.load(); assert.equal(calls, 0); assert.equal(controller.snapshot().ready, false);
  }
});

test('uncertain upload is not retried; picker cache is removed, known ID uses GET only', async () => {
  let posts = 0, removed = 0, gets = 0;
  const file = picked(); file.remove = async () => { removed++; };
  const controller = new MediaController({
    async upload() { posts++; throw new LibraryError(0, 'outcome_unknown', { ...operation, state: 'uncertain' }, true); },
    async operation(id) { gets++; assert.equal(id, operation.id); return { operation }; },
    async detail(id) { return { id, upload_verified: true }; },
  }, { async pick() { return file; } });
  await controller.importAudio(); await controller.importAudio();
  assert.equal(posts, 1); assert.equal(removed, 1); assert.equal(controller.snapshot().importLocked, true);
  await controller.refreshUpload(); assert.equal(gets, 1); assert.equal(posts, 1); assert.equal(controller.snapshot().operation.state, 'complete');
  assert.equal(controller.snapshot().canImportAnother, true);
  controller.anotherImport(); assert.equal(controller.snapshot().importLocked, false);
});

test('complete metadata alone or wrong recording cannot unlock another import', async () => {
  const controller = new MediaController({ async upload() { return { operation }; }, async detail() { return { id: 'rec_other', upload_verified: true }; } }, { async pick() { return picked(); } });
  await controller.importAudio(); controller.anotherImport();
  assert.equal(controller.snapshot().importLocked, true); assert.equal(controller.snapshot().canImportAnother, false);
});

test('cancelled/invalid pick sends no write and removes only owned picker copy', async () => {
  let posts = 0, removed = 0;
  const file = { ...picked(), mime: 'text/plain', async remove() { removed++; } };
  const controller = new MediaController({ async upload() { posts++; } }, { async pick() { return file; } });
  await controller.importAudio(); assert.equal(posts, 0); assert.equal(removed, 1); assert.equal(controller.snapshot().importLocked, false);
  const cancelled = new MediaController({ async upload() { posts++; } }, { async pick() { return null; } });
  await cancelled.importAudio(); assert.equal(posts, 0); assert.equal(cancelled.snapshot().importing, false);
});

test('signout while picker open removes its late cache copy without upload', async () => {
  const result = deferred(); let posts = 0, removed = 0;
  const controller = new MediaController({ async upload() { posts++; } }, { pick() { return result.promise; } });
  const work = controller.importAudio(); let disposed = false;
  const closing = controller.dispose().then(() => { disposed = true; }); await tick(); assert.equal(disposed, false);
  result.resolve({ ...picked(), async remove() { removed++; } }); await work;
  await closing; assert.equal(disposed, true);
  assert.equal(posts, 0); assert.equal(removed, 1); assert.equal(controller.snapshot().operation, undefined);
});

test('failed picker deletion rejects joined disposal and requires restart', async () => {
  let posts = 0;
  const controller = new MediaController({ async upload() { posts++; return { operation }; }, async detail(id) { return { id, upload_verified: true }; } }, { async pick() { return { ...picked(), async remove() { throw Error('delete failed'); } }; } });
  await controller.importAudio(); controller.anotherImport(); await controller.importAudio();
  assert.equal(controller.snapshot().canImportAnother, false); assert.equal(posts, 1);
  await assert.rejects(controller.dispose(), /cleanup failed/);
});

test('actual recording session clears immediately and joins late media finalizers on signout', async () => {
  const result = deferred(); let removed = false, disposed = false;
  const controller = new RecordingsController(createDemoLibrary(), { pick() { return result.promise; } });
  await controller.refreshLibrary(); const work = controller.media.importAudio();
  const closing = controller.dispose().then(() => { disposed = true; });
  assert.deepEqual(controller.snapshot().recordings, []); await tick(); assert.equal(disposed, false);
  result.resolve({ ...picked(), async remove() { removed = true; } }); await work; await closing;
  assert.equal(removed, true); assert.equal(disposed, true);
});
