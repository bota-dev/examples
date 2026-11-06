import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { ESLint } from 'eslint';
import { ConfigArray } from '@eslint/config-array';
import configuration from '../../eslint.config.js';

const require = createRequire(import.meta.url);
const parents = ['eslint', '@eslint/config-array', '@typescript-eslint/typescript-estree'];

for (const parent of parents) {
  test(parent + ' bounds advisory globparts amplification', () => {
    const owner = createRequire(require.resolve(parent));
    const { Minimatch } = owner('minimatch');
    const pattern = Array(8).fill('**/../a/b').join('/');
    const matcher = new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 16 });
    assert.equal(matcher.set.length, 16);
    const ordinary = new Minimatch('**/../a/b/**/../c/d', { optimizationLevel: 2 });
    assert.equal(ordinary.match('../a/b/../c/d'), true);
    assert.equal(ordinary.match('x/a/b/y/c/d'), true);
    assert.equal(ordinary.match('x/a/b/y/c/e'), false);
  });
}

test('affected installed parents use the reviewed fixed matcher and helper', () => {
  for (const parent of parents) {
    const owner = createRequire(require.resolve(parent));
    const manifest = owner.resolve('minimatch/package.json');
    assert.equal(JSON.parse(readFileSync(manifest)).version, '11.0.1');
    const matcher = createRequire(manifest);
    assert.equal(
      JSON.parse(readFileSync(matcher.resolve('@isaacs/nonrecursive-glob-match/package.json')))
        .version,
      '1.0.1',
    );
    assert.equal(
      JSON.parse(readFileSync(matcher.resolve('brace-expansion/package.json'))).version,
      '5.0.12',
    );
  }
});

test('config-array preserves AND, brace, ignore and re-inclusion path selection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bota-eslint-config-globs-'));
  try {
    const configs = new ConfigArray(
      [
        { ignores: ['**/generated/**', '**/*.skip.js', '!src/keep.skip.js'] },
        { files: [['src/**', '**/*.{js,mjs}']], ignores: ['**/*.test.js'], admitted: true },
      ],
      { basePath: root, schema: { admitted: { merge: 'overwrite', validate: 'boolean' } } },
    );
    await configs.normalize();
    for (const file of ['src/client.js', 'src/deep/client.mjs', 'src/keep.skip.js']) {
      assert.equal(configs.getConfig(join(root, file))?.admitted, true, file);
    }
    for (const file of [
      'src/client.txt',
      'other/client.js',
      'src/generated/client.js',
      'src/drop.skip.js',
      'src/client.test.js',
    ]) {
      assert.equal(configs.getConfig(join(root, file)), undefined, file);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('actual ESLint preserves source selection, lint errors and configured ignores', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bota-example-eslint-'));
  try {
    const files = {
      'src/good.mjs': 'export const answer = 42;\n',
      'src/bad.mjs': 'missingName();\n',
      'node_modules/trap.mjs': 'export const = ;\n',
      'dist/trap.mjs': 'export const = ;\n',
      '.state/trap.mjs': 'export const = ;\n',
    };
    for (const [file, contents] of Object.entries(files)) {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await writeFile(join(root, file), contents);
    }
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: configuration,
    });
    const results = await eslint.lintFiles(['**/*.mjs']);
    assert.deepEqual(
      results.map((result) => result.filePath).sort(),
      [join(root, 'src/bad.mjs'), join(root, 'src/good.mjs')].sort(),
    );
    assert.equal(results.find((result) => result.filePath.endsWith('good.mjs')).errorCount, 0);
    assert.deepEqual(
      results
        .find((result) => result.filePath.endsWith('bad.mjs'))
        .messages.map((message) => message.ruleId),
      ['no-undef'],
    );
    for (const file of Object.keys(files).filter((file) => file.includes('trap'))) {
      assert.equal(await eslint.isPathIgnored(join(root, file)), true, file);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('actual TypeScript project service retains default-project allow and deny matching', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bota-example-eslint-project-'));
  const estree = require('@typescript-eslint/typescript-estree');
  try {
    await writeFile(
      join(root, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: true }, include: ['src/**/*.ts'] }),
    );
    await writeFile(join(root, '.allowed.ts'), 'const value: number = 1;\n');
    await writeFile(join(root, 'denied.js'), 'const value = 1;\n');
    const options = { tsconfigRootDir: root, projectService: { allowDefaultProject: ['*.ts'] } };
    const result = estree.parseAndGenerateServices('const value: number = 1;', {
      ...options,
      filePath: join(root, '.allowed.ts'),
    });
    assert.equal(result.ast.body[0].type, 'VariableDeclaration');
    assert.ok(result.services.program);
    assert.throws(
      () =>
        estree.parseAndGenerateServices('const value = 1;', {
          ...options,
          filePath: join(root, 'denied.js'),
        }),
      /not found by the project service|not included|allowDefaultProject/,
    );
  } finally {
    estree.clearCaches();
    await rm(root, { recursive: true, force: true });
  }
});
