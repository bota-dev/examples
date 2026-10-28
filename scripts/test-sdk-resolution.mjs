import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sdkName = '@bota.dev/react-native-app-sdk';
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

test('legacy workspace consumes the exact public SDK declared by its manifest and lock', () => {
  const appPath = join(root, 'apps/react-native/package.json');
  const app = readJson(appPath);
  const expected = app.dependencies[sdkName];
  assert.match(expected, /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/);

  let sdkRoot = dirname(createRequire(appPath).resolve(sdkName));
  let installed;
  while (true) {
    try {
      const candidate = readJson(join(sdkRoot, 'package.json'));
      if (candidate.name === sdkName) {
        installed = candidate;
        break;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = dirname(sdkRoot);
    assert.notEqual(parent, sdkRoot, 'installed SDK package metadata was not found');
    sdkRoot = parent;
  }
  assert.equal(installed.version, expected, 'the app resolves a different SDK version');

  const lock = readJson(join(root, 'package-lock.json'));
  assert.equal(lock.packages['apps/react-native'].dependencies[sdkName], expected);
  const installedPath = relative(root, sdkRoot).split(sep).join('/');
  assert.ok(!installedPath.startsWith('../'), 'SDK must resolve inside this install root');
  assert.equal(lock.packages[installedPath]?.version, expected, 'installed SDK and lock disagree');
});
