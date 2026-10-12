import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createDevicePage } from '../page.ts';

// Execute the real entry point with a fake SDK/browser, without Bluetooth or WASM.
const source = ts.transpileModule(readFileSync(new URL('../main.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const settle = () => new Promise(resolve => setImmediate(resolve));

function browser(create) {
  const elements = Object.fromEntries(['serial', 'output', 'connect', 'status', 'disconnect']
    .map(id => [id, { value: 'CUSTOMER1', textContent: '', disabled: true }]));
  const listeners = new Map();
  const intervals = new Map();
  const context = vm.createContext({
    exports: {},
    require: name => {
      if (name === '@bota.dev/web-app-sdk') return { BotaDeviceClient: { create } };
      if (name === './page.ts') return { createDevicePage };
      throw new Error('Unexpected test import');
    },
    document: { querySelector: selector => elements[selector.slice(1)] },
    window: {
      addEventListener: (name, callback) => listeners.set(name, callback),
      setInterval: (callback, milliseconds) => { assert.equal(milliseconds, 250); intervals.set(1, callback); return 1; },
      clearInterval: id => intervals.delete(id),
    },
  });
  const initialized = vm.runInContext('(async () => {\n' + source + '\n})()', context);
  return { elements, listeners, intervals, initialized };
}

test('pagehide during SDK initialization destroys the late client without attaching handlers or timers', async () => {
  let resolve;
  let destroys = 0;
  const pending = new Promise(yes => { resolve = yes; });
  const b = browser(() => pending);
  b.listeners.get('pagehide')();
  resolve({ destroy: async () => { destroys += 1; } });
  await b.initialized;
  assert.equal(destroys, 1);
  assert.equal(b.intervals.size, 0);
  assert.equal(b.elements.connect.onclick, undefined);
  assert.ok(['connect', 'status', 'disconnect', 'serial'].every(id => b.elements[id].disabled));
  assert.match(b.elements.output.textContent, /Reload this page/);
});

test('entry point observes cached connection loss and cancels observation on pagehide', async () => {
  let destroys = 0;
  const client = {
    devices: {
      isSupported: true,
      connectedDevice: null,
      connect: async () => (client.devices.connectedDevice = { id: 'handle1', serialNumber: 'CUSTOMER1' }),
      readSnapshot: async () => ({ battery: 88 }),
      disconnect: async () => { client.devices.connectedDevice = null; },
    },
    destroy: async () => { destroys += 1; },
  };
  const b = browser(async () => client);
  await b.initialized;
  b.elements.connect.onclick();
  await settle();
  assert.equal(b.elements.status.disabled, false);
  client.devices.connectedDevice = null;
  b.intervals.get(1)();
  assert.equal(b.elements.connect.disabled, false);
  assert.equal(b.elements.status.disabled, true);
  assert.match(b.elements.output.textContent, /Connection lost/);
  b.listeners.get('pagehide')();
  await settle();
  assert.equal(b.intervals.size, 0);
  assert.equal(destroys, 1);
  assert.ok(b.elements.connect.disabled);
});
