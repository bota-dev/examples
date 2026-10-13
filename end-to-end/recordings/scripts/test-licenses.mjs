import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('./check-licenses.mjs', import.meta.url));
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'bota-recordings-license-'));
  const root = join(directory, 'node_modules');
  mkdirSync(root);
  t.after(() => {
    const target = resolve(directory);
    const fromTemp = relative(resolve(tmpdir()), target);
    assert.ok(!isAbsolute(fromTemp) && !fromTemp.startsWith('..'));
    assert.ok(basename(target).startsWith('bota-recordings-license-'));
    rmSync(target, { recursive: true, force: true });
  });
  function pkg(path, license, extra = {}) {
    const location = join(root, path);
    mkdirSync(location, { recursive: true });
    writeFileSync(
      join(location, 'package.json'),
      JSON.stringify({ name: 'synthetic', version: '1.0.0', license, ...extra }),
    );
    return location;
  }
  function run(paths = [root]) {
    const result = spawnSync(process.execPath, [checker, ...paths], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    return { status: result.status, output: result.stdout + result.stderr };
  }
  return { root, pkg, run };
}

for (const license of [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'BlueOak-1.0.0',
]) {
  test(`metadata policy permits the current ${license} identifier`, (t) => {
    const f = fixture(t);
    f.pkg('one', license);
    assert.equal(f.run().status, 0);
  });
}

for (const [expression, status] of [
  ['GPL-3.0-only', 1],
  ['MIT OR GPL-3.0-only', 0],
  ['GPL-3.0-only OR MIT', 0],
  ['MIT AND GPL-3.0-only', 1],
  ['GPL-3.0-only AND MIT', 1],
  ['MIT OR GPL-3.0-only AND AGPL-3.0-only', 0],
  ['(MIT OR GPL-3.0-only) AND AGPL-3.0-only', 1],
  ['MIT AND (Apache-2.0 OR GPL-3.0-only)', 0],
  ['GPL-3.0-only OR (MIT AND Apache-2.0)', 0],
  ['(MIT AND GPL-3.0-only) OR ISC', 0],
]) {
  test(`CLI evaluates AND/OR and parentheses: ${expression}`, (t) => {
    const f = fixture(t);
    f.pkg('one', expression);
    assert.equal(f.run().status, status);
  });
}

for (const expression of [
  'UNKNOWN',
  'LicenseRef-custom',
  'MIT OR UNKNOWN',
  'MIT OR (UNKNOWN AND GPL-3.0-only)',
  'MIT WITH LLVM-exception',
  '',
  ' ',
  'MIT OR',
  'OR MIT',
  'MIT AND AND ISC',
  '(MIT',
  'MIT)',
  'MIT ISC',
  'MIT or ISC',
  'MIT AND ()',
]) {
  test(`CLI rejects unknown, unsupported or malformed expression ${JSON.stringify(expression)}`, (t) => {
    const f = fixture(t);
    f.pkg('one', expression);
    assert.equal(f.run().status, 1);
  });
}

for (const kind of [
  'missing file',
  'unreadable file',
  'invalid JSON',
  'invalid object',
  'missing name',
  'missing version',
  'missing license',
]) {
  test(`CLI fails closed for ${kind} package metadata`, (t) => {
    const f = fixture(t);
    const location = f.pkg('one', 'MIT');
    const path = join(location, 'package.json');
    if (kind === 'missing file') rmSync(path);
    if (kind === 'unreadable file') {
      rmSync(path);
      mkdirSync(path);
    }
    if (kind === 'invalid JSON') writeFileSync(path, '{PRIVATE_INVALID_METADATA');
    if (kind === 'invalid object') writeFileSync(path, '[]');
    if (kind === 'missing name') f.pkg('one', 'MIT', { name: null });
    if (kind === 'missing version') f.pkg('one', 'MIT', { version: null });
    if (kind === 'missing license') f.pkg('one', undefined);
    const result = f.run();
    assert.equal(result.status, 1);
    assert.ok(!result.output.includes('PRIVATE_INVALID_METADATA'));
  });
}

test('private metadata flags do not bypass third-party license policy', (t) => {
  const f = fixture(t);
  f.pkg('one', 'GPL-3.0-only', { private: true });
  assert.equal(f.run().status, 1);
});

test('CLI checks scoped and nested installed packages, including default node_modules lookup', (t) => {
  const f = fixture(t);
  f.pkg('@scope/one', 'MIT', { name: '@scope/one' });
  f.pkg('outer', 'Apache-2.0', { name: 'outer' });
  f.pkg('outer/node_modules/@inner/two', 'ISC', { name: '@inner/two' });
  const result = f.run([]);
  assert.equal(result.status, 0);
  assert.match(result.output, /3 installed packages passed/);
});

test('nested duplicate package identities are checked rather than hidden by deduplication', (t) => {
  const f = fixture(t);
  f.pkg('one', 'MIT');
  f.pkg('one/node_modules/duplicate', 'GPL-3.0-only');
  assert.equal(f.run().status, 1);
});

test('a scoped package without metadata fails closed', (t) => {
  const f = fixture(t);
  mkdirSync(join(f.root, '@scope', 'missing'), { recursive: true });
  assert.equal(f.run().status, 1);
});

test('missing roots and empty installations cannot produce a passing scan', (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 1);
  f.pkg('one', 'MIT');
  assert.equal(f.run([f.root, join(dirname(f.root), 'missing')]).status, 1);
});
