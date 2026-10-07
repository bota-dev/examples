import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Local backport of the parser guards proposed in digitalbazaar/forge #1152
// and #1157. Keep upstream package identity/version unchanged (1.4.0).
const originalSha = 'fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50';
const patchedSha = '5a5be15860c0a10204075331e38a059d2d9675cc500d3f53ec8bf511d7e6c036';
const original = 'obj.value.length !== 2) {';
const patched = `obj.value.length !== 2 ||
        obj.value[0].value.length !== (('parameters' in capture) ? 2 : 1) ||
        ('parameters' in capture && capture.parameters !== '')) {`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function applyNodeForgeSecurityPatch(packageDir) {
  const metadata = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  if (metadata.name !== 'node-forge' || metadata.version !== '1.4.0') {
    throw new Error('Review node-forge security backport for changed package version');
  }
  const path = join(packageDir, 'lib/rsa.js');
  const source = readFileSync(path);
  const observed = sha256(source);
  if (observed === patchedSha) return 'already patched';
  if (observed !== originalSha) {
    throw new Error('Unexpected node-forge RSA source; security backport not applied');
  }
  const result = source.toString('utf8').replace(original, patched);
  if (sha256(result) !== patchedSha) {
    throw new Error('Unexpected node-forge security backport result');
  }
  writeFileSync(path, result, 'utf8');
  return 'patched';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const require = createRequire(import.meta.url);
  const expoRequire = createRequire(require.resolve('expo/package.json'));
  const cliRequire = createRequire(expoRequire.resolve('@expo/cli/package.json'));
  const consumerRequire = createRequire(cliRequire.resolve('@expo/code-signing-certificates'));
  const packageDirs = new Set([
    dirname(require.resolve('node-forge/package.json')),
    dirname(cliRequire.resolve('node-forge/package.json')),
    dirname(consumerRequire.resolve('node-forge/package.json')),
  ]);
  for (const packageDir of packageDirs) {
    console.log(`node-forge 1.4.0 RSA parser: ${applyNodeForgeSecurityPatch(packageDir)}`);
  }
}
