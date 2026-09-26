import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Temporary ESM interop for the pinned query-string 7.1.3 consumer. Both hashes
// cover its complete index.js; changed upstream source requires a new review.
const original = 'caa3f2c8b45dfe1e91db22ae10743af68de8d96f26515132bb52485ec0f037fa';
const patched = 'fc1ca6e1961ba005e554b1bc0de932d6454bf59bfaea03d02c7261dbdcafcdbd';
export function patchSource(source) {
  const digest = createHash('sha256').update(source).digest('hex');
  assert.ok(digest === original || digest === patched, 'Unexpected query-string source; review the decoder patch');
  return digest === original
    ? source.replace("require('decode-uri-component')", "require('decode-uri-component').default")
    : source;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const require = createRequire(import.meta.url);
  const path = require.resolve('query-string');
  assert.equal(require('query-string/package.json').version, '7.1.3');
  const source = readFileSync(path, 'utf8');
  const result = patchSource(source);
  if (result !== source) writeFileSync(path, result);
  console.log('query-string 7.1.3 decoder ESM interop verified');
}
