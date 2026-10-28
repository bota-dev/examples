import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkManifest(manifest) {
  assert.equal(manifest.name, 'BotaRecordings');
  assert.deepEqual(manifest.dependencies, [], 'Third-party Swift dependencies require an explicit license/security review');
  assert.equal(manifest.targets.length, 2);
  for (const target of manifest.targets) {
    assert.ok(['BotaRecordings', 'BotaRecordingsTests'].includes(target.name));
    if (target.name === 'BotaRecordings') assert.deepEqual(target.dependencies, []);
    else {
      assert.equal(target.dependencies.length, 1);
      assert.equal(target.dependencies[0].byName?.[0], 'BotaRecordings');
    }
    assert.ok(target.type === 'executable' || target.type === 'test');
    assert.ok(!target.pluginUsages?.length, 'Build plugins require review');
    assert.ok(!target.settings?.some(setting => JSON.stringify(setting).includes('unsafeFlags')), 'Unsafe build flags require review');
  }
}
export function checkProject(project) {
  assert.doesNotMatch(project, /XCRemoteSwiftPackageReference|XCLocalSwiftPackageReference|XCSwiftPackageProductDependency|\.xcframework|\.framework|Pods_|Carthage/i,
    'Native dependencies require an explicit license/security review');
  assert.match(project, /packageReferences\s*=\s*\(\s*\)/);
  assert.match(project, /packageProductDependencies\s*=\s*\(\s*\)/);
  assert.match(project, /IPHONEOS_DEPLOYMENT_TARGET = 15\.0/);
  assert.match(project, /SWIFT_VERSION = 6\.0/);
}
export function checkImport(source, isTest = false) {
  const allowed = isTest ? ['Darwin', 'Foundation', 'XCTest', 'BotaRecordings'] : ['Foundation', 'SwiftUI', 'Combine'];
  for (const match of source.matchAll(/^\s*(?:@testable\s+)?import\s+(\w+)/gm)) assert.ok(allowed.includes(match[1]), `Unreviewed import ${match[1]}`);
}
function files(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    if (['.build', '.swiftpm', 'BotaRecordings.app', 'DerivedData', 'xcuserdata', '.git'].includes(entry.name)) return [];
    const path = join(root, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
export function checkTree(root) {
  for (const path of files(root)) {
    const name = relative(root, path).replaceAll('\\', '/');
    assert.doesNotMatch(name, /\.(?:a|dylib|zip|tgz|tar|gem|jar|aar)$|\.xcframework\/|\.framework\/|(?:^|\/)Package\.resolved$/i,
      'Vendored archives and dependency lock additions require review');
    if (path.endsWith('.swift') && !path.endsWith('Package.swift')) checkImport(readFileSync(path, 'utf8'), name.startsWith('Tests/'));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = JSON.parse(execFileSync('swift', ['package', 'dump-package'], { cwd: root, encoding: 'utf8' }));
  checkManifest(manifest);
  checkProject(readFileSync(join(root, 'ios/BotaRecordings.xcodeproj/project.pbxproj'), 'utf8'));
  checkTree(root);
  assert.match(readFileSync(join(root, 'LICENSE'), 'utf8'), /^MIT License/);
  console.log('Dependency/license gate passed: zero third-party dependencies; Apple system frameworks only.');
}
