import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

function check(t, license) {
  const root = mkdtempSync(join(tmpdir(), 'bota-dart-license-'));
  t.after(() => {
    const resolvedRoot = realpathSync(root);
    const fromTemporaryDirectory = relative(realpathSync(tmpdir()), resolvedRoot);
    assert.ok(
      fromTemporaryDirectory && !isAbsolute(fromTemporaryDirectory)
        && fromTemporaryDirectory !== '..' && !fromTemporaryDirectory.startsWith('../')
        && !fromTemporaryDirectory.startsWith('..\\')
        && basename(resolvedRoot).startsWith('bota-dart-license-'),
      'License fixture cleanup must stay within its temporary directory.',
    );
    rmSync(resolvedRoot, { recursive: true, force: true });
  });
  const scripts = join(root, 'scripts');
  const config = join(root, '.dart_tool');
  const dependency = join(root, 'dependency');
  for (const dir of [scripts, config, dependency]) mkdirSync(dir, { recursive: true });
  copyFileSync(new URL('./check-flutter-licenses.mjs', import.meta.url), join(scripts, 'check.mjs'));
  if (license !== null) writeFileSync(join(dependency, 'LICENSE'), license);
  writeFileSync(join(config, 'package_config.json'), JSON.stringify({
    configVersion: 2,
    packages: [{ name: 'fixture', rootUri: pathToFileURL(dependency + '/').href }],
  }));
  return spawnSync(process.execPath, [join(scripts, 'check.mjs')], { encoding: 'utf8' });
}

test('canonical permissive dependency is admitted', t => {
  const result = check(t, 'MIT License\nPermission is hereby granted, free of charge, to any person obtaining a copy.');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 resolved dependencies/);
});

test('missing dependency license fails the gate', t => {
  const result = check(t, null);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing dependency license/);
});

test('unknown proprietary terms fail the gate', t => {
  const result = check(t, 'All rights reserved. Commercial use requires written approval.');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unrecognized or forbidden dependency license/);
});

test('a permissive notice does not hide a forbidden GPL notice', t => {
  const result = check(t, 'Permission is hereby granted, free of charge.\nGNU GENERAL PUBLIC LICENSE Version 3');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Forbidden dependency license/);
});

test('combined noncommercial/no-derivatives terms cannot hide behind MIT text', t => {
  const result = check(t, 'Permission is hereby granted, free of charge.\nCC-BY-NC-ND-4.0');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Forbidden dependency license/);
});
