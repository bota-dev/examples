#!/usr/bin/env node
// Conservative package-metadata gate for this sample's installed development tools.
// It is not a license-text audit. Unknown terms and unreadable metadata fail closed.
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const permitted = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'BlueOak-1.0.0',
]);
// Known disallowed terms may participate in OR alternatives; unsupported terms cannot.
const forbidden = new Set([
  'GPL-2.0',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'AGPL-3.0',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'LGPL-2.1',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'MPL-2.0',
  'EPL-1.0',
  'EPL-2.0',
  'EUPL-1.2',
  'SSPL-1.0',
  'BUSL-1.1',
  'OSL-3.0',
  'CC-BY-NC-4.0',
  'CC-BY-NC-ND-4.0',
  'CC-BY-NC-SA-4.0',
  'CC-BY-SA-4.0',
]);
const require = (condition, message) => {
  if (!condition) throw new Error(message);
};

function allowed(expression) {
  require(typeof expression === 'string' &&
    expression.length > 0 &&
    expression.length <= 4096, 'Missing or unsupported SPDX license expression.');
  const tokens = expression.match(/[A-Za-z0-9.+-]+|[()]|\S/g) ?? [];
  require(tokens.length > 0 && tokens.length <= 512, 'Invalid SPDX license expression.');
  let index = 0;
  function term(depth) {
    require(depth <= 32, 'License expression nesting exceeded the bound.');
    const token = tokens[index++];
    if (token === '(') {
      const result = either(depth + 1);
      require(tokens[index++] === ')', 'Unbalanced license expression.');
      return result;
    }
    require(permitted.has(token) || forbidden.has(token), 'Unknown or unsupported SPDX term.');
    return permitted.has(token);
  }
  function both(depth) {
    let result = term(depth);
    while (tokens[index] === 'AND') {
      index++;
      const next = term(depth); // Parse even if false, so unsupported alternatives still fail.
      result = result && next;
    }
    return result;
  }
  function either(depth) {
    let result = both(depth);
    while (tokens[index] === 'OR') {
      index++;
      const next = both(depth);
      result = result || next;
    }
    return result;
  }
  const result = either(0);
  require(index === tokens.length, 'Malformed or unsupported license expression.');
  return result;
}

let scanned = 0;
const violations = [];
function directory(path) {
  const info = lstatSync(path);
  require(info.isDirectory() &&
    !info.isSymbolicLink(), 'Expected a regular installed package directory.');
}
function walk(root) {
  directory(root);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === '.bin' || entry.name === '.cache') continue;
    require(!entry.isSymbolicLink(), 'Symbolic package paths need separate qualification.');
    if (!entry.isDirectory()) continue;
    const path = join(root, entry.name);
    if (entry.name.startsWith('@')) walk(path);
    else inspect(path);
  }
}
function inspect(path) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
  } catch {
    throw new Error('Unreadable or invalid installed package metadata.');
  }
  require(pkg &&
    typeof pkg === 'object' &&
    !Array.isArray(pkg) &&
    typeof pkg.name === 'string' &&
    pkg.name.length > 0 &&
    pkg.name.length <= 256 &&
    typeof pkg.version === 'string' &&
    pkg.version.length > 0 &&
    pkg.version.length <= 128, 'Invalid installed package metadata.');
  scanned++;
  // Inspect every location, even duplicate name/version pairs or packages marked private.
  if (!allowed(pkg.license)) violations.push(`${pkg.name}@${pkg.version}: ${pkg.license}`);
  const nested = join(path, 'node_modules');
  try {
    directory(nested);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  walk(nested);
}

try {
  const roots = process.argv.slice(2);
  for (const root of roots.length ? roots : ['node_modules']) walk(root);
  require(scanned > 0, 'No installed packages found; run npm ci first.');
  require(violations.length ===
    0, `Disallowed license expressions:\n${violations.sort().join('\n')}`);
  console.log(`license-gate: ${scanned} installed packages passed the metadata policy.`);
} catch (error) {
  console.error(`license-gate: ${error.message}`);
  process.exitCode = 1;
}
