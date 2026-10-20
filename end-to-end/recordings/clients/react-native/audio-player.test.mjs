import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareAudioPlayer } from './audio-player.ts';
import { MediaController } from './media-controller.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));
function nativePlayer(initial = {}) {
  const listeners = new Set(), calls = [];
  const player = {
    currentStatus: { isLoaded: false, error: null, playbackState: 'unknown', ...initial }, duration: 1, currentTime: 0,
    addListener(name, listener) { assert.equal(name, 'playbackStatusUpdate'); listeners.add(listener); return { remove() { calls.push('unsubscribe'); listeners.delete(listener); } }; },
    play() { calls.push('play'); }, pause() { calls.push('pause'); }, async seekTo() { calls.push('seek'); },
    remove() { calls.push('remove'); }, release() { calls.push('release'); },
    emit(status) { player.currentStatus = { ...player.currentStatus, ...status }; for (const listener of listeners) listener(player.currentStatus); },
  };
  return { player, calls, listeners };
}

test('decoder readiness waits for public loaded event, never autoplays and removes native/shared resources', async () => {
  const { player, calls, listeners } = nativePlayer(); let ready = false;
  const work = prepareAudioPlayer(player, () => calls.push('delete'), new AbortController().signal, () => assert.fail('unexpected error')).then(value => { ready = true; return value; });
  await tick(); assert.equal(ready, false); assert.deepEqual(calls, []);
  player.emit({ isLoaded: true, playbackState: 'readyToPlay' }); const prepared = await work;
  assert.equal(ready, true); assert.deepEqual(calls, []); await prepared.play(); assert.deepEqual(calls, ['play']);
  await prepared.release(); assert.equal(listeners.size, 0); assert.deepEqual(calls, ['play', 'unsubscribe', 'pause', 'remove', 'release', 'delete']);
  await prepared.release(); await prepared.play(); assert.equal(calls.filter(value => value === 'play').length, 1);
});

test('already loaded snapshot is checked after subscribing so readiness events cannot be missed', async () => {
  const { player } = nativePlayer({ isLoaded: true });
  const prepared = await prepareAudioPlayer(player, () => {}, new AbortController().signal, () => {}); await prepared.release();
});

test('asynchronous decoder failure before ready is sanitized and cleans its exact native/cache resources', async () => {
  const { player, calls, listeners } = nativePlayer();
  const work = prepareAudioPlayer(player, () => calls.push('delete'), new AbortController().signal, () => assert.fail('not ready'));
  const rejected = assert.rejects(work, error => error.code === 'playback_failed' && !error.message.includes('private'));
  player.emit({ error: 'private file:///cache/audio.wav decoder detail' }); await rejected;
  assert.equal(listeners.size, 0); assert.deepEqual(calls, ['unsubscribe', 'pause', 'remove', 'release', 'delete']);
});

test('failed native snapshot rejects even when the platform error string was transient', async () => {
  const { player, listeners } = nativePlayer({ playbackState: 'failed' });
  await assert.rejects(prepareAudioPlayer(player, () => {}, new AbortController().signal, () => {}), error => error.code === 'playback_failed');
  assert.equal(listeners.size, 0);
});

test('a silent decoder reaches its ten-second deadline and does not leave a player/listener/cache', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { player, calls, listeners } = nativePlayer();
  const rejected = assert.rejects(prepareAudioPlayer(player, () => calls.push('delete'), new AbortController().signal, () => {}), error => error.code === 'playback_timeout');
  t.mock.timers.tick(10_000); await rejected;
  assert.equal(listeners.size, 0); assert.ok(calls.includes('release')); assert.ok(calls.includes('delete'));
});

test('retirement aborts an unready decoder and joins cache removal', async () => {
  const { player, calls, listeners } = nativePlayer(); const abort = new AbortController();
  const rejected = assert.rejects(prepareAudioPlayer(player, () => calls.push('delete'), abort.signal, () => {}), error => error.code === 'outcome_unknown');
  abort.abort(); await rejected; assert.equal(listeners.size, 0); assert.ok(calls.includes('delete'));
});

test('post-load decoder failure clears controller readiness, sanitizes error and retires its player', async () => {
  const { player, calls, listeners } = nativePlayer();
  const controller = new MediaController({ async audio() { return new Uint8Array(44); } }, {
    player(_bytes, signal, onFailure) { return prepareAudioPlayer(player, () => calls.push('delete'), signal, onFailure); },
  });
  controller.select('rec_test'); const load = controller.load(); await tick(); assert.equal(controller.snapshot().ready, false);
  player.emit({ isLoaded: true }); await load; assert.equal(controller.snapshot().ready, true);
  player.emit({ error: 'private decoder filepath' }); assert.equal(controller.snapshot().ready, false);
  assert.match(controller.snapshot().error, /decoded or played/); assert.equal(controller.snapshot().error.includes('private'), false);
  await controller.dispose(); assert.equal(listeners.size, 0); assert.ok(calls.includes('release')); assert.ok(calls.includes('delete'));
});

test('shared native release failure still deletes cache and blocks another controller load', async () => {
  const { player, calls } = nativePlayer(); let reads = 0;
  player.release = () => { calls.push('release'); throw Error('native failure'); };
  const controller = new MediaController({ async audio() { reads++; return new Uint8Array(44); } }, {
    player(_bytes, signal, onFailure) { return prepareAudioPlayer(player, () => calls.push('delete'), signal, onFailure); },
  });
  controller.select('rec_old'); const load = controller.load(); await tick(); player.emit({ error: 'bad decoder' }); await load;
  assert.match(controller.snapshot().error, /cleanup failed/); assert.ok(calls.includes('delete'));
  controller.select('rec_new'); await controller.load(); assert.equal(reads, 1); await assert.rejects(controller.dispose(), /cleanup failed/);
});

test('a paused or released replay cannot resume after a late seek', async () => {
  const { player, calls } = nativePlayer({ isLoaded: true }); let completeSeek;
  player.currentTime = player.duration; player.seekTo = () => new Promise(resolve => { completeSeek = resolve; });
  const prepared = await prepareAudioPlayer(player, () => {}, new AbortController().signal, () => {});
  const play = prepared.play(); prepared.pause(); completeSeek(); await play; assert.equal(calls.includes('play'), false);
  await prepared.release();
});
