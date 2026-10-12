import assert from 'node:assert/strict';
import test from 'node:test';
import { createDevicePage } from '../page.ts';

const device = { id: 'browser-handle-1', serialNumber: 'CUSTOMER1' };
const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function fixture(overrides = {}) {
  const calls = [];
  const frames = [];
  const client = {
    devices: {
      isSupported: true,
      connectedDevice: null,
      connect: async options => {
        calls.push(['connect', options]);
        client.devices.connectedDevice = device;
        return device;
      },
      readSnapshot: async () => { calls.push(['read']); return { battery: 71 }; },
      disconnect: async () => { calls.push(['disconnect']); client.devices.connectedDevice = null; },
      ...overrides,
    },
    destroy: async () => { calls.push(['destroy']); client.devices.connectedDevice = null; },
  };
  const page = createDevicePage(client, (message, controls) => frames.push({ message, controls }));
  return { client, page, calls, frames, latest: () => frames.at(-1) };
}

test('connect starts the public picker immediately with the caller serial, then reads a fresh snapshot', async () => {
  const f = fixture();
  const connecting = f.page.connect(' CUSTOMER1 ');
  assert.deepEqual(f.calls, [['connect', { expectedSerialNumber: 'CUSTOMER1' }]]);
  await connecting;
  assert.equal(f.latest().controls.connectDisabled, true);
  assert.equal(f.latest().controls.readDisabled, false);
  assert.equal(f.latest().controls.serialDisabled, true);
  await f.page.readStatus();
  assert.deepEqual(JSON.parse(f.latest().message), { battery: 71 });
  await f.page.disconnect();
  assert.match(f.latest().message, /Disconnected/);
  assert.equal(f.latest().controls.connectDisabled, false);
  assert.deepEqual(f.calls.map(call => call[0]), ['connect', 'read', 'disconnect']);
});

test('asynchronous Bluetooth loss clears metadata and enables explicit reconnection without a GATT read', async () => {
  const f = fixture();
  await f.page.connect('CUSTOMER1');
  await f.page.readStatus();
  f.client.devices.connectedDevice = null;
  f.page.observeConnection();
  assert.match(f.latest().message, /Connection lost/);
  assert.doesNotMatch(f.latest().message, /battery|CUSTOMER1/);
  assert.equal(f.latest().controls.connectDisabled, false);
  assert.equal(f.latest().controls.readDisabled, true);
  assert.equal(f.latest().controls.disconnectDisabled, true);
  assert.equal(f.latest().controls.serialDisabled, false);
  assert.deepEqual(f.calls.map(call => call[0]), ['connect', 'read']);
});

test('loss during a pending read fences its late snapshot, even before an observation tick', async () => {
  const pending = deferred();
  const f = fixture({ readSnapshot: () => pending.promise });
  await f.page.connect('CUSTOMER1');
  const reading = f.page.readStatus();
  f.client.devices.connectedDevice = null;
  pending.resolve({ obsolete: 'secret old device content' });
  await reading;
  assert.match(f.latest().message, /Connection lost/);
  assert.doesNotMatch(f.latest().message, /obsolete|secret/);
  assert.equal(f.latest().controls.connectDisabled, false);
});

test('disconnect observed before a read prevents issuing that read', async () => {
  const f = fixture();
  await f.page.connect('CUSTOMER1');
  f.client.devices.connectedDevice = null;
  await f.page.readStatus();
  assert.deepEqual(f.calls.map(call => call[0]), ['connect']);
  assert.equal(f.latest().controls.readDisabled, true);
});

test('disconnect then reconnect to the same identity still fences the prior read', async () => {
  const pending = deferred();
  const f = fixture({ readSnapshot: () => pending.promise });
  await f.page.connect('CUSTOMER1');
  const reading = f.page.readStatus();
  f.client.devices.connectedDevice = null;
  f.page.observeConnection();
  f.client.devices.connectedDevice = { ...device };
  f.page.observeConnection();
  pending.resolve({ obsolete: true });
  await reading;
  assert.match(f.latest().message, /fresh device snapshot/);
  assert.doesNotMatch(f.latest().message, /obsolete/);
});

test('duplicate actions are held while a public operation is pending', async () => {
  const pending = deferred();
  let reads = 0;
  const f = fixture({ readSnapshot: () => { reads += 1; return pending.promise; } });
  await f.page.connect('CUSTOMER1');
  const reading = f.page.readStatus();
  await f.page.readStatus();
  await f.page.disconnect();
  assert.equal(reads, 1);
  assert.deepEqual(f.calls.map(call => call[0]), ['connect']);
  pending.resolve({ battery: 20 });
  await reading;
});

test('page close disables controls, destroys once, and suppresses late success or rejection', async () => {
  for (const rejected of [false, true]) {
    const pending = deferred();
    const f = fixture({ readSnapshot: () => pending.promise });
    await f.page.connect('CUSTOMER1');
    const reading = f.page.readStatus();
    await f.page.close();
    const closed = f.latest();
    if (rejected) pending.reject(new Error('private SDK error'));
    else pending.resolve({ obsolete: 'private old snapshot' });
    await reading;
    await f.page.close();
    f.page.observeConnection();
    await f.page.connect('CUSTOMER1');
    assert.deepEqual(f.latest(), closed);
    assert.ok(Object.values(closed.controls).every(value => value === true));
    assert.equal(f.calls.filter(call => call[0] === 'destroy').length, 1);
    assert.doesNotMatch(closed.message, /private|obsolete/);
  }
});

test('unsupported Bluetooth and blank serial never call the SDK', async () => {
  const unsupported = fixture({ isSupported: false });
  await unsupported.page.connect('CUSTOMER1');
  await unsupported.page.readStatus();
  assert.match(unsupported.latest().message, /unavailable/);
  assert.ok(unsupported.latest().controls.connectDisabled);
  assert.deepEqual(unsupported.calls, []);
  const blank = fixture();
  await blank.page.connect('  ');
  assert.match(blank.latest().message, /Enter the device serial/);
  assert.deepEqual(blank.calls, []);
});

test('failed status is sanitized and replaces prior snapshot output', async () => {
  const f = fixture();
  await f.page.connect('CUSTOMER1');
  await f.page.readStatus();
  f.client.devices.readSnapshot = async () => { throw new Error('private payload'); };
  await f.page.readStatus();
  assert.match(f.latest().message, /Operation failed/);
  assert.doesNotMatch(f.latest().message, /private|battery/);
});
