import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve('vite/package.json'));
const postcssRequire = createRequire(viteRequire.resolve('postcss/package.json'));
const { SourceMapConsumer, SourceMapGenerator } = postcssRequire('source-map-js');
const postcss = viteRequire('postcss');

test('PostCSS resolves the patched source-map-js contract', () => {
  assert.equal(postcssRequire('source-map-js/package.json').version, '1.2.2');
});

test('source maps preserve valid indexed offsets and source content', () => {
  const map = new SourceMapGenerator({ file: 'out.js' });
  map.addMapping({ generated: { line: 1, column: 0 }, original: { line: 2, column: 1 }, source: 'in.js' });
  map.setSourceContent('in.js', 'const value = 1;');
  const consumer = new SourceMapConsumer({ version: 3, sections: [{ offset: { line: 1, column: 0 }, map: map.toJSON() }] });
  const mappings = [];
  consumer.eachMapping(mapping => mappings.push(mapping));
  assert.equal(mappings.length, 1);
  assert.equal(mappings[0].generatedLine, 2);
  assert.equal(mappings[0].originalLine, 2);
  assert.equal(consumer.sourceContentFor('in.js'), 'const value = 1;');
});

test('source maps reject an oversized indexed offset before expansion', () => {
  const leaf = { version: 3, sources: ['in.js'], names: [], mappings: 'AAAA' };
  assert.throws(() => new SourceMapConsumer({ version: 3, sections: [{ offset: { line: 10000001, column: 0 }, map: leaf }] }), /must not exceed 10000000/);
});

test('PostCSS emits a consumable map through its actual dependency', () => {
  const result = postcss().process('a { color: red }', { from: 'in.css', to: 'out.css', map: { inline: false } });
  assert.match(result.css, /color: red/);
  const consumer = new SourceMapConsumer(result.map.toJSON());
  assert.equal(consumer.originalPositionFor({ line: 1, column: 0 }).source, 'in.css');
});
