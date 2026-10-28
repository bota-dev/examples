import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkManifest, checkProject, checkImport, checkTree } from './check-dependencies.mjs';

const manifest = () => ({ name: 'BotaRecordings', dependencies: [], targets: [
  { name: 'BotaRecordings', dependencies: [], type: 'executable' },
  { name: 'BotaRecordingsTests', dependencies: [{ byName: ['BotaRecordings', null] }], type: 'test' },
] });
test('Zero-dependency policy admits only the local executable test dependency', () => {
  checkManifest(manifest());
  for (const mutate of [
    m => m.dependencies.push({ sourceControl: 'unreviewed' }),
    m => m.targets[0].dependencies.push({ product: ['Remote', 'Remote', null, null] }),
    m => m.targets[0].pluginUsages = ['Plugin'],
    m => m.targets[1].dependencies[0] = { byName: ['Remote', null] },
    m => m.targets.push({ name: 'Binary', type: 'binary', dependencies: [] }),
  ]) { const value = manifest(); mutate(value); assert.throws(() => checkManifest(value)); }
});
test('Import and Xcode project checks reject dependency bypasses', () => {
  checkImport('import Foundation\nimport SwiftUI');
  checkImport('import XCTest\n@testable import BotaRecordings\nimport Darwin', true);
  assert.throws(() => checkImport('import Unreviewed'));
  const root = new URL('../', import.meta.url);
  const project = readFileSync(new URL('ios/BotaRecordings.xcodeproj/project.pbxproj', root), 'utf8');
  checkProject(project); checkTree(fileURLToPath(root));
  assert.throws(() => checkProject(project + '\nXCRemoteSwiftPackageReference'));
  assert.throws(() => checkProject(project + '\nVendored.xcframework'));
});
