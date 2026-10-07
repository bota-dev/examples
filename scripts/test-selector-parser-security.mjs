import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const tailwindRequire = createRequire(require.resolve('tailwindcss/package.json'));
const nestedRequire = createRequire(tailwindRequire.resolve('postcss-nested/package.json'));
const parser = tailwindRequire('postcss-selector-parser');
const postcss = require('postcss');

test('both scoped consumers resolve only patched selector-parser copies', () => {
  for (const consumer of [tailwindRequire, nestedRequire]) {
    assert.equal(consumer('postcss-selector-parser/package.json').version, '7.1.6');
  }
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const copies = Object.entries(lock.packages).filter(([path]) => /(^|\/)node_modules\/postcss-selector-parser$/.test(path));
  assert.ok(copies.length > 0);
  for (const [path, info] of copies) assert.equal(info.version, '7.1.6', path);
});

// Count native array membership comparisons, rather than relying on machine timing.
// The inputs stay small; no shell, device or unbounded selector is executed.
for (const [name, selector, units] of [
  ['classes', '.a'.repeat(256), 256],
  ['IDs', '#a'.repeat(256), 256],
  ['Sass interpolation', '#{$a}'.repeat(128) + '.a'.repeat(128), 256],
]) {
  test(`flat ${name} parsing stays within a linear membership budget`, () => {
    const original = Array.prototype.indexOf;
    let work = 0;
    Array.prototype.indexOf = function (value, from = 0) {
      const result = original.call(this, value, from);
      if (this.length && typeof this[0] === 'number') {
        const start = from < 0 ? Math.max(0, this.length + from) : Math.min(from, this.length);
        work += Math.max(0, (result < 0 ? this.length : result + 1) - start);
      }
      return result;
    };
    let ast;
    try { ast = parser().astSync(selector); } finally { Array.prototype.indexOf = original; }
    assert.equal(ast.toString(), selector);
    assert.ok(work <= 16 * units, `${work} membership comparisons exceed ${16 * units}`);
  });
}

test('public selector AST round trips, cloning and escapes remain usable', () => {
  for (const selector of ['.foo > #bar[attr="a b" i]:not(.x,.y)', 'svg|a, *|*[data-x="q"]', '&:is(.a, .b)::before', '.foo\\:bar > .a\\.b', '[data-a="\\22x"]', '.é😀', ':nth-child(2n+1 of .a,.b)']) {
    const ast = parser().astSync(selector);
    assert.equal(ast.toString(), selector);
    assert.equal(ast.clone().toString(), selector);
  }
});

test('actual postcss-nested preserves ampersand replacement and nested pseudo selectors', async () => {
  const inputs = ['.a, .b { &:hover, & + & { color: red } }', '.a { :is(&, .x) { color: blue } }', '.a { @media (min-width: 1px) { &.b { display: block } } }', '.a { &-suffix { color: red } }'];
  const expected = ['.a:hover, .a + .a, .b:hover, .b + .b { color: red }', ':is(.a, .x) { color: blue }', '@media (min-width: 1px) { .a.b { display: block } }', '.a-suffix { color: red }'];
  const actual = [];
  for (const css of inputs) actual.push((await postcss([nestedRequire('postcss-nested')]).process(css, { from: undefined })).css);
  assert.deepEqual(actual, expected);
});

test('actual Tailwind variant, important and apply output matches the pristine consumer', async () => {
  const content = '<div class="p-4 text-red-500 hover:bg-blue-500 group-hover:underline peer-checked:block [&>p]:mt-2 [&:is(.a,.b)]:hidden before:content-[\'x\'] -translate-x-1/2 sm:hover:focus:text-blue-500 !font-bold"></div>';
  const css = (await postcss([require('tailwindcss')({ content: [{ raw: content, extension: 'html' }], corePlugins: { preflight: false }, important: '#root', plugins: [({ addComponents }) => addComponents({ '.button': { '@apply p-4 text-red-500': {}, '&:hover': { '@apply bg-blue-500': {} } } })] })]).process('@tailwind components; @tailwind utilities;', { from: undefined })).css;
  const digest = createHash('sha256').update(css).digest('hex');
  // This digest is measured against pristine 6.1.4 before the scoped overrides.
  assert.equal(digest, '63ad9afd6d97e24344abbed4228caf8ed17de93c17721db05c2b7a7642279393');
});
