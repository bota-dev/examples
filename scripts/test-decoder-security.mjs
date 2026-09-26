import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { patchSource } from './patch-query-string.mjs';

const require = createRequire(new URL('../apps/react-native/package.json', import.meta.url));
const router = dirname(require.resolve('expo-router/package.json'));
const navigation = dirname(require.resolve('@react-navigation/core/package.json'));
const consumers = [
  ['Expo Router', join(router, 'build/react-navigation/core/getStateFromPath.js')],
  ['React Navigation', join(navigation, 'lib/module/getStateFromPath.js')],
];
const config = { screens: { Detail: 'items/:id' } };

test('decoder patch is repeatable and rejects changed upstream source', () => {
  const installed = readFileSync(require.resolve('query-string'), 'utf8');
  const original = installed.replace("require('decode-uri-component').default", "require('decode-uri-component')");
  const patched = patchSource(original);
  assert.equal(patchSource(patched), patched);
  assert.match(patched, /require\('decode-uri-component'\)\.default/);
  assert.throws(() => patchSource(`${original}\n`), /Unexpected query-string source/);
});

test('lock retains one reviewed query-string copy and only patched decoders', () => {
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
  const queryPaths = Object.keys(lock.packages).filter(path => path.endsWith('/query-string'));
  assert.deepEqual(queryPaths, ['node_modules/query-string']);
  const decoders = Object.entries(lock.packages).filter(([path]) => path.endsWith('/decode-uri-component'));
  assert.ok(decoders.length > 0);
  for (const [path, entry] of decoders) assert.equal(entry.version, '0.5.0', path);
});

for (const [name, entry] of consumers) {
  const { getStateFromPath } = await import(pathToFileURL(entry));
  const query = createRequire(entry)('query-string');

  test(`${name}: malformed query decoding takes bounded native decoder work`, () => {
    const malformed = '%EA'.repeat(12);
    const original = globalThis.decodeURIComponent;
    let attempts = 0;
    try {
      globalThis.decodeURIComponent = input => { attempts++; return original(input); };
      const state = getStateFromPath(`/items/rec_example?text=${malformed}`, config);
      assert.equal(state.routes[0].params.text, malformed);
      assert.ok(attempts <= malformed.length, `${attempts} attempts for ${malformed.length} characters`);
    } finally {
      globalThis.decodeURIComponent = original;
    }
  });

  test(`${name}: decoded route IDs and Unicode/repeated/empty query values survive`, () => {
    const state = getStateFromPath('/items/rec_example?name=%E6%B5%8B%E8%AF%95&tag=one&tag=two&blank=&flag&space=a+b&plus=%2B', config);
    assert.deepEqual({ ...state.routes[0].params }, {
      id: 'rec_example', name: '测试', tag: ['one', 'two'], blank: '', flag: null, space: 'a b', plus: '+',
    });
    assert.equal(query.stringify({ name: '测试', plus: '+' }), 'name=%E6%B5%8B%E8%AF%95&plus=%2B');
    assert.deepEqual({ ...query.parse('bad=%EA%41%G1&good=%F0%9F%8E%A7') }, { bad: '%EAA%G1', good: '🎧' });
    assert.deepEqual({ ...query.parse('raw=%EA', { decode: false }) }, { raw: '%EA' });
  });
}
