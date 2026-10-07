import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = resolve(root, 'vendor/braces-security');
const provenance = JSON.parse(readFileSync(resolve(vendor, 'provenance.json'), 'utf8'));
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
const verify = process.argv.includes('--verify');
if (process.argv.slice(2).some(arg => arg !== '--verify')) throw new Error('Unknown braces guard argument');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const contained = (base, target) => {
  const path = relative(base, target);
  return path !== '..' && !path.startsWith('../') && !path.startsWith('..\\') && !isAbsolute(path);
};

// Validate every asset and installed target before making any change.
const assets = new Map(provenance.files.map(file => {
  const path = resolve(vendor, file.asset);
  if (!contained(vendor, realpathSync(path))) throw new Error('Braces vendor path escapes its directory');
  const bytes = readFileSync(path);
  if (hash(bytes) !== file.patchedSha256) throw new Error(`Unknown braces vendor bytes: ${file.path}`);
  return [file.path, bytes];
}));
const entries = Object.entries(lock.packages ?? {}).filter(([path]) => path.endsWith('node_modules/braces'));
if (!entries.length) throw new Error('Expected locked braces package is missing');
const plan = [];
const installed = [];
for (const [path, metadata] of entries) {
  if (path.split('/').some(part => part === '..') || isAbsolute(path)) throw new Error('Invalid braces lock path');
  if (metadata.version !== provenance.version || metadata.integrity !== provenance.integrity) throw new Error(`Unknown locked braces identity: ${path}`);
  const packageRoot = resolve(root, path);
  if (!contained(root, packageRoot)) throw new Error('Braces lock path escapes repository');
  // Workspace-scoped/production installs can legitimately omit this dev dependency.
  if (!existsSync(packageRoot)) continue;
  const actualRoot = realpathSync(packageRoot);
  if (!contained(realpathSync(root), actualRoot)) throw new Error('Installed braces path escapes repository');
  const manifestPath = realpathSync(resolve(actualRoot, 'package.json'));
  if (!contained(actualRoot, manifestPath)) throw new Error('Braces manifest escapes package');
  const manifest = readFileSync(manifestPath);
  if (hash(manifest) !== provenance.manifestSha256) throw new Error(`Unknown braces manifest: ${path}`);
  for (const file of provenance.unchanged) {
    const target = realpathSync(resolve(actualRoot, file.path));
    if (!contained(actualRoot, target) || hash(readFileSync(target)) !== file.sha256) throw new Error(`Unknown unchanged braces source: ${path}/${file.path}`);
  }
  for (const file of provenance.files) {
    const target = resolve(actualRoot, file.path);
    if (!contained(actualRoot, realpathSync(dirname(target)))) throw new Error('Braces target parent escapes package');
    if (existsSync(target) && !contained(actualRoot, realpathSync(target))) throw new Error('Braces target escapes package');
    const current = existsSync(target) ? hash(readFileSync(target)) : null;
    if (current !== file.pristineSha256 && current !== file.patchedSha256) throw new Error(`Unknown braces runtime: ${path}/${file.path}`);
    if (verify && current !== file.patchedSha256) throw new Error(`Unpatched braces runtime: ${path}/${file.path}`);
    if (current !== file.patchedSha256) plan.push({ target, bytes: assets.get(file.path), expected: file.patchedSha256 });
  }
  installed.push(path);
}
for (const item of plan) writeFileSync(item.target, item.bytes);
for (const item of plan) if (hash(readFileSync(item.target)) !== item.expected) throw new Error('Braces write verification failed');
console.log(JSON.stringify({ guard: 'braces3.0.3 scoped upstream PR82', installed, changedFiles: plan.length, mode: verify ? 'verify' : 'apply', omittedInstallScope: installed.length === 0 }));
