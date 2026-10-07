import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const consumerRequire = createRequire(require.resolve('react-devtools-core/package.json'));
const shellQuote = consumerRequire('shell-quote');

test('every locked shell-quote copy is outside the affected advisory range', () => {
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const copies = Object.entries(lock.packages).filter(([path]) => /(^|\/)node_modules\/shell-quote$/.test(path));
  assert.ok(copies.length > 0);
  for (const [path, info] of copies) {
    assert.equal(require('semver').satisfies(info.version, '>=1.8.4 <1.11.0'), false,
      `${path}: affected ${info.version}`);
  }
});

for (const [name, terminator] of [['LF', '\n'], ['CR', '\r'], ['line separator', '\u2028'], ['paragraph separator', '\u2029']]) {
  test(`React DevTools shell-quote rejects ${name} in a string after a comment token`, () => {
    assert.throws(() => shellQuote.quote(['echo', 'ok', { comment: 'comment' }, `before${terminator}after`]), TypeError);
  });
}

test('parse then quote rejects a new line after a parsed URL-fragment comment', () => {
  const tokens = shellQuote.parse('echo http://example.invalid/#fragment');
  assert.ok(tokens.some(token => typeof token === 'object' && 'comment' in token));
  assert.throws(() => shellQuote.quote([...tokens, 'before\nafter']), TypeError);
});

test('React DevTools resolved dependency preserves ordinary argument quoting', () => {
  const tokens = ['command', 'path with spaces', 'apostrophe\'s', 'a;$(literal)', '#literal', 'before\nafter', ''];
  assert.deepEqual(shellQuote.parse(shellQuote.quote(tokens)), tokens);
  assert.equal(shellQuote.quote(['echo', { comment: 'safe comment' }, 'ordinary']), 'echo #safe comment ordinary');
});
