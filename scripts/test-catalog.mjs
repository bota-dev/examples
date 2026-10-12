import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('./check-catalog.mjs', import.meta.url));

function fixture(run) {
  const scratch = realpathSync(tmpdir());
  const directory = mkdtempSync(join(scratch, 'bota-catalog-test-'));
  const root = join(directory, 'repository');
  const write = (name, content) => {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  const entry = id => ({ id, path: `api/${id}`, title: id, purpose: 'Public API sample',
    category: 'api', language: 'JavaScript', physical_device_required: false,
    readme: `api/${id}/README.md`, setup_reference: `api/${id}/README.md`,
    verification_reference: `api/${id}/README.md`, workflow: '.github/workflows/sample.yml' });
  const catalog = entries => '# Examples\n\n## Example catalog\n\n' + entries.map(item =>
    `| [${item.title}](${item.readme}) | ${item.purpose} | No |`).join('\n') + '\n';
  const index = entries => write('examples.json', JSON.stringify({ schema_version: 1, examples: entries }));
  const add = id => { const item = entry(id); write(item.readme, '# Sample\n'); return item; };
  const check = () => spawnSync(process.execPath, [join(root, 'scripts/check-catalog.mjs')], {
    cwd: scratch, encoding: 'utf8', timeout: 10000,
  });
  try {
    for (const category of ['api', 'app-sdk', 'end-to-end']) mkdirSync(join(root, category), { recursive: true });
    for (const name of ['DESIGN.md', 'CONTRIBUTING.md', 'AGENTS.md', 'CLAUDE.md', 'ARCHITECTURE.md', 'docs/using-examples-with-ai.md']) write(name, '# Documentation\n');
    write('.github/workflows/sample.yml', 'name: Sample\n');
    const first = add('sample-node'); index([first]); write('README.md', catalog([first]));
    mkdirSync(join(root, 'scripts')); copyFileSync(checker, join(root, 'scripts/check-catalog.mjs'));
    run({ root, directory, write, add, index, catalog, first, check });
  } finally {
    const target = realpathSync(directory);
    assert.equal(dirname(target), scratch);
    assert.ok(basename(target).startsWith('bota-catalog-test-'));
    rmSync(target, { recursive: true, force: true });
  }
}

function rejects(result, reason) {
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, reason);
  assert.equal(result.stdout, '');
}

test('valid discovery is portable and checks encoded local links while ignoring fenced/remote examples', () => fixture(({ write, first, catalog, check }) => {
  write('docs/fixture notes.md', '# Notes\n');
  write('README.md', catalog([first]) + '\n[Notes](docs/fixture%20notes.md)\n[Remote](https://example.test/docs)\n\n```md\n[Placeholder](does-not-exist.md)\n```\n');
  const result = check();
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Catalog validated: 1 examples, 8 documents/);
}));

test('duplicate IDs cannot make two catalog rows appear as distinct examples', () => fixture(({ first, index, write, catalog, check }) => {
  index([first, first]); write('README.md', catalog([first, first]));
  rejects(check(), /Invalid or duplicate example ID/);
}));

test('catalog order must match the discovery index', () => fixture(({ first, add, index, write, catalog, check }) => {
  const second = add('second-node'); index([first, second]); write('README.md', catalog([second, first]));
  rejects(check(), /same unique paths in the same order/);
}));

test('unindexed directories cannot silently disappear from customer discovery', () => fixture(({ add, check }) => {
  add('forgotten-node'); rejects(check(), /Every independent example directory/);
}));

test('hardware metadata must be a boolean and workflow targets must exist', () => fixture(({ first, index, check }) => {
  index([{ ...first, physical_device_required: 'false' }]); rejects(check(), /Invalid hardware flag/);
  index([{ ...first, workflow: '.github/workflows/missing.yml' }]); rejects(check(), /Missing local path/);
}));

test('broken local links and machine-specific file URLs fail CI', () => fixture(({ write, first, catalog, check }) => {
  for (const [target, reason] of [['missing.md', /Missing local path/], ['file:///private.md', /portable repository link/], ['C:/private.md', /portable repository link/]]) {
    write('README.md', catalog([first]) + `\n[Setup](${target})\n`); rejects(check(), reason);
  }
}));

test('a relative Markdown link cannot escape the repository', () => fixture(({ write, first, catalog, check }) => {
  write('README.md', catalog([first]) + '\n[Outside](../outside.md)\n');
  rejects(check(), /Link leaves the repository/);
}));

test('a local symlink or Windows junction cannot disguise an outside link target', () => fixture(({ root, directory, write, first, catalog, check }) => {
  const outside = join(directory, 'outside'); mkdirSync(outside); writeFileSync(join(outside, 'notes.md'), '# Outside\n');
  symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  write('README.md', catalog([first]) + '\n[Outside](linked/notes.md)\n');
  rejects(check(), /Linked path leaves the repository/);
  assert.equal(readFileSync(join(outside, 'notes.md'), 'utf8'), '# Outside\n');
}));

test('malformed JSON reports a bounded diagnostic and a failure exit', () => fixture(({ write, check }) => {
  write('examples.json', '{invalid JSON'); rejects(check(), /examples.json must be valid JSON/);
}));
