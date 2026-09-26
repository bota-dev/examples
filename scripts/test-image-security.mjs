import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

test('locked image-size copies are outside both affected advisory ranges', () => {
  const { packages } = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
  for (const [path, info] of Object.entries(packages)) {
    if (path.endsWith('/image-size')) {
      assert.equal(require('semver').lt(info.version, '2.0.3'), false, `${path}: ${info.version}`);
    }
  }
});

// Literal invalid containers: ICNS has a zero-sized entry, JXL a zero-sized
// partial-stream box, and HEIF has no dimension box.
const malformed = {
  icns: Buffer.from('69636e73000000106963703400000000', 'hex'),
  jxl: Buffer.from('0000000c4a584c200d0a870a00000014667479706a786c20000000006a786c20000000006a786c7000000000', 'hex'),
  heif: Buffer.from('00000010667479706865696300000000', 'hex'),
};

const resolvers = {
  'React Native': createRequire(require.resolve('@react-native/community-cli-plugin/package.json')),
  Expo: createRequire(require.resolve('@expo/metro/package.json')),
};
for (const [name, resolve] of Object.entries(resolvers)) {
  const assets = resolve('metro/private/Assets');
  for (const [format, bytes] of Object.entries(malformed)) {
    test(`${name}: malformed ${format} disguised as PNG is rejected with bounded work`, () => {
      // The old ICNS/JXL loops append forever. Bound those real synchronous
      // operations rather than letting a regression exhaust test-runner memory.
      const original = Array.prototype.push;
      const budgetExceeded = new Error('parser did not terminate');
      let count = 0;
      let failure;
      try {
        Array.prototype.push = function (...values) {
          if (++count > 128) throw budgetExceeded;
          return Reflect.apply(original, this, values);
        };
        try { assets.getAssetSize('png', bytes, 'bad.png'); }
        catch (error) { failure = error; }
      } finally {
        Array.prototype.push = original;
      }
      assert.notEqual(failure, budgetExceeded);
      assert.ok(failure instanceof Error, 'malformed content must reject');
    });
  }

  test(`${name}: supported dimensions and invalid/non-image handling remain usable`, () => {
    assert.deepEqual(assets.getAssetSize('png', png, 'one.png'), { width: 1, height: 1 });
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"></svg>');
    assert.deepEqual(assets.getAssetSize('svg', svg, 'vector.svg'), { width: 30, height: 20 });
    assert.throws(() => assets.getAssetSize('png', Buffer.alloc(0), 'empty.png'));
    assert.throws(() => assets.getAssetSize('png', Buffer.from('invalid'), 'invalid.png'));
    assert.equal(assets.getAssetSize('txt', Buffer.from('text'), 'note.txt'), null);
  });

  test(`${name}: file-based asset metadata retains pixel scaling and paths`, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'examples-image-'));
    const file = join(directory, 'pixel@2x.png');
    try {
      writeFileSync(file, png);
      const data = await assets.getAssetData(file, 'images/pixel@2x.png', [], null, '/assets');
      assert.equal(data.width, 0.5);
      assert.equal(data.height, 0.5);
      assert.deepEqual(data.scales, [2]);
      assert.deepEqual(data.files, [file]);
      assert.equal(data.name, 'pixel');
      assert.equal(data.type, 'png');
      assert.equal(data.httpServerLocation, '/assets/images');
      assert.match(data.hash, /^[a-f0-9]{32}$/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
