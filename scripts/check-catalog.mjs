import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const categories = ['api', 'app-sdk', 'end-to-end'];
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const insideRoot = path => {
  const name = relative(root, path);
  return !isAbsolute(name) && name !== '..' && !name.startsWith(`..${sep}`);
};

function localPath(name, directory = false) {
  requireValue(typeof name === 'string' && name.length > 0 &&
    !isAbsolute(name) && !name.includes('\\') && !name.split('/').includes('..'),
  `Use a repository-relative path: ${name}`);
  const path = resolve(root, name);
  requireValue(insideRoot(path), `Path leaves the repository: ${name}`);
  let actual;
  try { actual = realpathSync(path); }
  catch { throw new Error(`Missing local path: ${name}`); }
  requireValue(insideRoot(actual), `Linked path leaves the repository: ${name}`);
  requireValue(directory ? statSync(actual).isDirectory() : statSync(actual).isFile(),
    `Expected a ${directory ? 'directory' : 'file'}: ${name}`);
  return actual;
}

// Only prose links are checked; fenced examples may contain placeholder paths.
function withoutFences(text) {
  let fence;
  return text.split(/\r?\n/).filter(line => {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (!fence && marker) { fence = marker; return false; }
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length &&
          new RegExp(`^ {0,3}${marker}\\s*$`).test(line)) fence = undefined;
      return false;
    }
    return true;
  }).join('\n');
}

function checkLinks(document) {
  const text = withoutFences(readFileSync(localPath(document), 'utf8'));
  let count = 0;
  for (const match of text.matchAll(/\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\s*\)/g)) {
    const target = match[1].replace(/^<|>$/g, '');
    requireValue(!/^(?:file:|[a-z]:[\\/])/i.test(target),
      `Use a portable repository link in ${document}: ${target}`);
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(target)) continue;
    let file;
    try { file = decodeURIComponent(target.split(/[?#]/)[0]); }
    catch { throw new Error(`Invalid link encoding in ${document}: ${target}`); }
    if (!file) continue; // Heading fragments are not file references.
    requireValue(!isAbsolute(file) && !file.includes('\\'),
      `Use a relative file link in ${document}: ${target}`);
    const path = resolve(dirname(resolve(root, document)), file);
    requireValue(insideRoot(path), `Link leaves the repository in ${document}: ${target}`);
    localPath(relative(root, path).split(sep).join('/'), statSyncSafe(path)?.isDirectory());
    count++;
  }
  return count;
}

function statSyncSafe(path) {
  try { return statSync(path); } catch { return undefined; }
}

function main() {
  let index;
  try { index = JSON.parse(readFileSync(localPath('examples.json'), 'utf8')); }
  catch { throw new Error('examples.json must be valid JSON in the repository.'); }
  requireValue(index?.schema_version === 1 && Array.isArray(index.examples) && index.examples.length > 0,
    'Expected a nonempty examples array with schema_version 1.');
  const ids = new Set();
  const paths = [];
  const documents = new Set(['README.md', 'AGENTS.md', 'CLAUDE.md', 'ARCHITECTURE.md',
    'docs/using-examples-with-ai.md']);
  for (const entry of index.examples) {
    requireValue(entry && typeof entry.id === 'string' &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) && !ids.has(entry.id),
      `Invalid or duplicate example ID: ${entry?.id}`);
    requireValue(categories.includes(entry.category) && entry.path === `${entry.category}/${entry.id}`,
      `Category/path mismatch: ${entry.id}`);
    for (const field of ['title', 'purpose', 'language']) {
      requireValue(typeof entry[field] === 'string' && entry[field].trim().length > 0,
        `Missing ${field}: ${entry.id}`);
    }
    requireValue(typeof entry.physical_device_required === 'boolean', `Invalid hardware flag: ${entry.id}`);
    if (entry.category !== 'api' || entry.platform !== undefined) {
      requireValue(typeof entry.platform === 'string' && entry.platform.trim().length > 0,
        `Missing or invalid platform: ${entry.id}`);
    }
    requireValue(entry.readme === `${entry.path}/README.md`, `README/path mismatch: ${entry.id}`);
    localPath(entry.path, true);
    for (const field of ['readme', 'setup_reference', 'verification_reference']) {
      localPath(entry[field]);
      if (entry[field].endsWith('.md')) documents.add(entry[field]);
    }
    if (entry.workflow !== undefined) {
      requireValue(/^\.github\/workflows\/[^/]+\.ya?ml$/.test(entry.workflow),
        `Invalid workflow path: ${entry.id}`);
      localPath(entry.workflow);
    }
    ids.add(entry.id);
    paths.push(entry.path);
  }

  const readme = withoutFences(readFileSync(localPath('README.md'), 'utf8'));
  const lines = readme.split(/\r?\n/);
  const start = lines.indexOf('## Example catalog');
  requireValue(start >= 0, 'README.md needs an Example catalog section.');
  const end = lines.findIndex((line, position) => position > start && line.startsWith('## '));
  const section = lines.slice(start + 1, end < 0 ? lines.length : end).join('\n');
  const catalog = [...section.matchAll(/^\| \[[^\n]+?\]\(((?:api|app-sdk|end-to-end)\/[^)]+)\/README\.md\) \|/gm)]
    .map(match => match[1]);
  requireValue(JSON.stringify(catalog) === JSON.stringify(paths),
    'README catalog and examples.json must contain the same unique paths in the same order.');
  const directories = categories.flatMap(category => readdirSync(localPath(category, true), { withFileTypes: true })
    .filter(entry => entry.isDirectory() || entry.isSymbolicLink()).map(entry => `${category}/${entry.name}`));
  requireValue(JSON.stringify(directories.sort()) === JSON.stringify([...paths].sort()),
    'Every independent example directory must appear in examples.json and the README catalog.');
  let links = 0;
  for (const document of documents) links += checkLinks(document);
  console.log(`Catalog validated: ${paths.length} examples, ${documents.size} documents, ${links} local file links.`);
}

try { main(); }
catch (error) { console.error(`Catalog validation failed: ${error.message}`); process.exitCode = 1; }
