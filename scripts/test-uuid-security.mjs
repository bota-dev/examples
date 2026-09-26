import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const require = createRequire(import.meta.url);
const xcode = require('xcode');
const uuid = createRequire(require.resolve('xcode'))('uuid');

test('all locked UUID copies exclude the advisory range', () => {
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
  const entries = Object.entries(lock.packages).filter(([path]) => path.endsWith('/uuid'));
  assert.ok(entries.length > 0);
  for (const [path, entry] of entries) assert.equal(entry.version, '11.1.1', path);
});

test('Xcode-resolved name UUID methods reject partial output writes', () => {
  for (const method of ['v3', 'v5']) {
    for (const [length, offset] of [[8, 0], [16, 1], [16, -1]]) {
      const output = new Uint8Array(length).fill(0xaa);
      assert.throws(() => uuid[method]('example', uuid[method].DNS, output, offset), RangeError);
      assert.ok(output.every(byte => byte === 0xaa));
    }
  }
});

test('Xcode generates unique project IDs and serializes group references', () => {
  const project = xcode.project('example.pbxproj');
  project.hash = { project: { objects: { PBXGroup: {}, PBXFileReference: {} } } };
  const groups = Array.from({ length: 32 }, (_, index) => project.addPbxGroup([], `Example${index}`));
  assert.equal(new Set(groups.map(group => group.uuid)).size, groups.length);
  const serialized = project.writeSync();
  for (const group of groups) {
    assert.match(group.uuid, /^[A-F0-9]{24}$/);
    assert.ok(serialized.includes(group.uuid));
    assert.equal(project.hash.project.objects.PBXGroup[group.uuid].isa, 'PBXGroup');
  }
});
