import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const config = dirname(require.resolve('metro-config/package.json'));
const nestedMetro = dirname(require.resolve('metro/package.json', { paths: [config] }));
const nestedMap = dirname(require.resolve('metro-file-map/package.json', { paths: [nestedMetro] }));
const consumers = [
  { name: 'Expo57.0.3', path: join(dirname(require.resolve('@expo/metro-file-map/package.json')), 'build/watchers/common.js') },
  { name: 'Metro0.84.5', path: join(dirname(require.resolve('metro-file-map/package.json')), 'src/watchers/common.js') },
  { name: 'Actual nested Metro0.84.6', path: join(nestedMap, 'src/watchers/common.js') },
];

test('the owning archive keeps the actual nested Metro versions', () => {
  assert.equal(require(join(config, 'package.json')).version, '0.84.6');
  assert.equal(require(join(nestedMetro, 'package.json')).version, '0.84.6');
  assert.equal(require(join(nestedMap, 'package.json')).version, '0.84.6');
  assert.ok(nestedMap.startsWith(join(config, 'node_modules', 'metro', 'node_modules')));
  assert.equal(require('metro-file-map/package.json').version, '0.84.5');
});

for (const consumer of consumers) {
  test(`${consumer.name} preserves ordinary file, directory, dot and negative selectors`, () => {
    const { includedByGlob } = require(consumer.path);
    for (const [type, patterns, dot, path, expected] of [
      ['f', ['**/*.js'], false, 'src/a.js', true],
      ['f', ['**/*.js'], false, 'src/a.ts', false],
      ['f', ['**/*.{js,ts}'], false, 'src/a.ts', true],
      ['f', ['src/**', '!src/skip/**'], false, 'src/a.js', true],
      // Micromatch.some is any-pattern matching, not an ordered exclusion filter.
      ['f', ['src/**', '!src/skip/**'], false, 'src/skip/a.js', true],
      ['f', ['!src/skip/**'], false, 'src/skip/a.js', false],
      ['f', ['!src/skip/**'], false, 'src/a.js', true],
      ['f', ['**/*.js'], false, '.hidden/a.js', false],
      ['f', ['**/*.js'], true, '.hidden/a.js', true],
      ['d', ['**/*.js'], false, 'src', true],
      ['f', [], false, 'src/a.js', true],
      ['f', [], false, '.hidden/a.js', false],
      ['f', [], true, '.hidden/a.js', true],
    ]) assert.equal(includedByGlob(type, patterns, dot, path), expected, JSON.stringify({ type, patterns, dot, path }));
  });
}

test('Fast-glob preserves actual filesystem selection across its three APIs', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'examples-glob-'));
  try {
    for (const path of ['src/a.js', 'src/b.ts', 'src/skip/c.js', '.hidden/d.js', 'src/é.js']) {
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      writeFileSync(join(directory, path), 'fixture\n');
    }
    const fg = require('fast-glob');
    const patterns = ['src/**/*.{js,ts}', '!src/skip/**'];
    const expected = ['src/a.js', 'src/b.ts', 'src/é.js'].sort();
    assert.deepEqual(fg.sync(patterns, { cwd: directory }).sort(), expected);
    assert.deepEqual((await fg(patterns, { cwd: directory })).sort(), expected);
    const events = [];
    for await (const path of fg.stream(patterns, { cwd: directory })) events.push(path);
    assert.deepEqual(events.sort(), expected);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

for (const [caller, helper, errorCode] of [
  ['Fast-glob', 'fast-glob/out/utils/brace-expansion', 'ERR_FAST_GLOB_COMPLEXITY'],
  ['Chokidar', 'chokidar/lib/brace-expansion', 'ERR_CHOKIDAR_GLOB_COMPLEXITY'],
]) {
  for (const [label, input] of [
    ['decoded ordinary prefix', 'x'.repeat(5000) + '{1..1000}'],
    ['decoded quoted prefix', '"' + 'x'.repeat(5000) + '"{1..1000}'],
    ['decoded literal prefix', "'" + 'x'.repeat(5000) + "'{1..1000}"],
    ['oversized input', 'x'.repeat(65537)],
    ['excessive product', '{a,b}'.repeat(17)],
  ]) {
    test(`${caller} refuses ${label} before the expander allocates results`, () => {
      const script = `const assert=require('node:assert/strict');const helper=require.resolve(${JSON.stringify(helper)});const local=require('node:module').createRequire(helper);const child=local.resolve('brace-expansion');const original=require(child);let calls=0;require.cache[child].exports=(...args)=>{calls++;return original(...args)};const expand=require(helper);assert.throws(()=>expand(${JSON.stringify(input)}),error=>error.code===${JSON.stringify(errorCode)});assert.equal(calls,0);`;
      const result = spawnSync(process.execPath, ['-'], { cwd: root, input: script, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    });
  }
  test(`${caller} preserves safe literal and padded ranges below the budget`, () => {
    const expand = require(helper);
    assert.deepEqual(expand('src/{a,b}.js'), ['src/a.js', 'src/b.js']);
    assert.deepEqual(expand('src/{01..03}.js'), ['src/01.js', 'src/02.js', 'src/03.js']);
    assert.deepEqual(expand('src/literal.js'), ['src/literal.js']);
  });
}

test('Tailwind still compiles ordinary development content with its actual parent', async () => {
  const result = await require('postcss')([require('tailwindcss')({ content: [{ raw: '<div class="flex p-4 text-red-500"></div>', extension: 'html' }], corePlugins: { preflight: false } })]).process('@tailwind utilities;', { from: undefined });
  assert.match(result.css, /\.flex\s*\{/);
  assert.match(result.css, /\.p-4\s*\{/);
  assert.match(result.css, /\.text-red-500\s*\{/);
});

test('the mandatory attestation verifies the real graph and rejects unknown options', () => {
  const result = spawnSync(process.execPath, ['scripts/apply-braces-security.mjs', '--verify'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout.trim());
  assert.equal(output.status, 'legacy_root_braces_and_micromatch_absent');
  assert.equal(output.changedFiles, 0);
  const refusal = spawnSync(process.execPath, ['scripts/apply-braces-security.mjs', '--skip-integrity'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(refusal.status, 0);
  assert.match(refusal.stderr, /Unknown braces guard argument/);
});

test('unknown parent archive bytes refuse before any installed target can be touched', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'examples-archive-refusal-'));
  try {
    for (const path of ['package.json', 'package-lock.json', 'apps/react-native/package.json', 'apps/backend/package.json', 'scripts/apply-braces-security.mjs']) {
      mkdirSync(dirname(join(fixture, path)), { recursive: true });
      writeFileSync(join(fixture, path), readFileSync(join(root, path)));
    }
    cpSync(join(root, 'vendor/braces-free-public-parents'), join(fixture, 'vendor/braces-free-public-parents'), { recursive: true });
    const provenance = JSON.parse(readFileSync(join(fixture, 'vendor/braces-free-public-parents/provenance.json')));
    const archive = join(fixture, 'vendor/braces-free-public-parents', provenance.profiles[0].archive);
    const original = readFileSync(archive);
    const corrupted = Buffer.from(original);
    corrupted[corrupted.length - 1] ^= 1;
    writeFileSync(archive, corrupted);
    const refusal = spawnSync(process.execPath, ['scripts/apply-braces-security.mjs'], { cwd: fixture, encoding: 'utf8' });
    assert.notEqual(refusal.status, 0);
    assert.match(refusal.stderr, /Unknown maintained archive/);
    assert.deepEqual(readFileSync(archive), corrupted);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
