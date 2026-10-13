import assert from 'node:assert/strict';
import test from 'node:test';
import { DeviceSessionGate } from './device-session.ts';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));

test('closing waits late configure and its cleanup before a replacement native owner can initialize', async () => {
  const gate = new DeviceSessionGate(), configure = deferred(), finalSdkDestroy = deferred();
  const order = [];
  const first = gate.create({ disposeHost: async () => { order.push('dispose'); }, destroySdk: async () => { order.push('destroy'); await finalSdkDestroy.promise; } });
  const working = first.run(async () => {
    try { order.push('configure'); await configure.promise; }
    finally { order.push('late configure finally'); }
  });
  await flush();
  const closing = first.close();
  const second = gate.create({ disposeHost: async () => {}, destroySdk: async () => {} });
  let entered = false;
  const replacement = second.run(async () => { entered = true; order.push('replacement'); });
  await flush(); assert.equal(entered, false); assert.deepEqual(order, ['configure', 'dispose']);
  configure.resolve(); await working; await flush();
  assert.equal(entered, false); assert.deepEqual(order, ['configure', 'dispose', 'late configure finally', 'dispose', 'destroy']);
  finalSdkDestroy.resolve(); await closing; await replacement; assert.equal(entered, true);
  assert.equal(order.at(-1), 'replacement'); await second.close();
});

test('an unmounted owner awaiting its predecessor never initializes and cannot release a later owner early', async () => {
  const gate = new DeviceSessionGate(), pending = deferred();
  const first = gate.create({ disposeHost: async () => {}, destroySdk: async () => {} });
  const working = first.run(() => pending.promise); await flush();
  const second = gate.create({ disposeHost: async () => assert.fail('unadmitted owner cannot dispose predecessor'), destroySdk: async () => assert.fail('unadmitted owner cannot destroy SDK') });
  const cancelled = second.run(async () => assert.fail('retired owner cannot configure'));
  const rejected = assert.rejects(cancelled, /session ended/);
  const retired = second.close();
  const third = gate.create({ disposeHost: async () => {}, destroySdk: async () => {} });
  let entered = false; const replacement = third.run(async () => { entered = true; });
  const closing = first.close(); await flush(); assert.equal(entered, false);
  pending.resolve(); await working; await closing; await rejected; await retired; await replacement;
  assert.equal(entered, true); await third.close();
});

test('final cleanup failure still awaits SDK destruction and prevents later native admission', async () => {
  const gate = new DeviceSessionGate(); let disposals = 0, destroyed = false;
  const owner = gate.create({ disposeHost: async () => { if (++disposals > 1) throw Error('host cleanup failed'); }, destroySdk: async () => { destroyed = true; } });
  await owner.run(async () => {});
  await assert.rejects(owner.close(), /host cleanup failed/); assert.equal(destroyed, true);
  const replacement = gate.create({ disposeHost: async () => assert.fail(), destroySdk: async () => assert.fail() });
  await assert.rejects(replacement.run(async () => assert.fail('poisoned gate cannot admit')), /host cleanup failed/);
  await assert.rejects(replacement.close(), /host cleanup failed/);
});

test('creating or closing an unused screen does not reserve or alter a native owner', async () => {
  const gate = new DeviceSessionGate();
  const unused = gate.create({ disposeHost: async () => assert.fail(), destroySdk: async () => assert.fail() });
  const active = gate.create({ disposeHost: async () => {}, destroySdk: async () => {} });
  await unused.close(); let entered = false;
  await active.run(async () => { entered = true; }); assert.equal(entered, true); await active.close();
});
