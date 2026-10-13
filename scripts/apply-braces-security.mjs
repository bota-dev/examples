import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The selected parent archives replace the vulnerable implementation at resolution.
// This mandatory hook is an attestation and never patches installed bytes.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.slice(2).some(arg => arg !== '--verify')) throw new Error('Unknown braces guard argument');
const vendor = join(root, 'vendor/braces-free-public-parents');
const provenance = JSON.parse(readFileSync(join(vendor, 'provenance.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const forbidden = name => name === 'braces' || name === 'micromatch';
const contained = path => { const part = relative(realpathSync(root), path); return part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part); };
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
for (const path of ['package.json', 'apps/react-native/package.json', 'apps/backend/package.json']) {
  const manifest = JSON.parse(readFileSync(join(root, path), 'utf8'));
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    if (Object.keys(manifest[field] ?? {}).some(forbidden)) throw new Error(`Forbidden owning edge: ${path}`);
  }
}
for (const [path, entry] of Object.entries(lock.packages)) {
  const name = entry.name ?? path.split('node_modules/').at(-1);
  if (forbidden(name)) throw new Error(`Forbidden locked identity: ${path}`);
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    if (Object.keys(entry[field] ?? {}).some(forbidden)) throw new Error(`Forbidden locked edge: ${path}`);
  }
}
for (const profile of provenance.profiles) {
  const archive = readFileSync(join(vendor, profile.archive));
  if (archive.length !== profile.archiveBytes || hash(archive) !== profile.archiveSha256) throw new Error(`Unknown maintained archive: ${profile.name}@${profile.version}`);
}
const seen = new Set();
const populations = [];
function inspectModules(path) {
  if (!existsSync(path)) return;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || (!entry.isDirectory() && !entry.isSymbolicLink())) continue;
    if (forbidden(entry.name)) throw new Error(`Forbidden physical directory: ${path}/${entry.name}`);
    const child = join(path, entry.name);
    if (entry.name.startsWith('@')) {
      for (const scoped of readdirSync(child, { withFileTypes: true })) {
        if (scoped.isDirectory() || scoped.isSymbolicLink()) inspectPackage(join(child, scoped.name));
      }
    } else inspectPackage(child);
  }
}
function inspectPackage(path) {
  const actual = realpathSync(path);
  if (!contained(actual)) throw new Error(`External installed package: ${path}`);
  if (seen.has(actual)) return;
  seen.add(actual);
  const manifestPath = join(actual, 'package.json');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (forbidden(manifest.name)) throw new Error(`Forbidden physical identity: ${path}`);
    const matchingName = provenance.profiles.filter(profile => profile.name === manifest.name);
    const profile = matchingName.find(profile => profile.version === manifest.version);
    const inherited = provenance.unmodifiedOwnerProfiles?.find(row => row.path === relative(root, actual).replaceAll('\\', '/') && row.name === manifest.name && row.version === manifest.version);
    if (matchingName.length && !profile && !inherited) throw new Error(`Unqualified parent version: ${manifest.name}@${manifest.version}`);
    if (inherited) {
      for (const file of inherited.files) {
        const bytes = readFileSync(join(actual, file.path));
        if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) throw new Error(`Unmodified owner asset changed: ${inherited.path}/${file.path}`);
      }
    }
    if (profile) {
      for (const file of profile.files) {
        const target = realpathSync(join(actual, file.installedPath ?? file.path));
        if (!contained(target)) throw new Error(`External parent asset: ${target}`);
        const bytes = readFileSync(target);
        if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) throw new Error(`Unknown parent asset: ${manifest.name}/${file.path}`);
      }
      populations.push({ name: manifest.name, version: manifest.version, path: relative(root, actual).replaceAll('\\', '/') });
    }
  }
  inspectModules(join(actual, 'node_modules'));
}
for (const path of ['node_modules', 'apps/react-native/node_modules', 'apps/backend/node_modules']) inspectModules(join(root, path));
for (const profile of provenance.profiles) {
  if (!populations.some(row => row.name === profile.name && row.version === profile.version)) throw new Error(`Missing owning parent: ${profile.name}@${profile.version}`);
}
console.log(JSON.stringify({ status: 'legacy_root_braces_and_micromatch_absent', parentProfiles: provenance.profiles.length, parentAssets: provenance.profiles.reduce((n, profile) => n + profile.files.length, 0), packagesInspected: seen.size, populations, changedFiles: 0 }));
