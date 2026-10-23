import { readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

// Discover existing Node API and integrated backend suites. Only the Web
// reference's host dependencies are needed; no legacy mobile install.
const root = fileURLToPath(new URL('../', import.meta.url));
const apiRoot = resolve(root, 'api');
const tests = [];
for (const entry of await readdir(apiRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.endsWith('-node')) continue;
  for (const name of await readdir(resolve(apiRoot, entry.name))) {
    if (name.endsWith('.test.mjs')) tests.push(resolve(apiRoot, entry.name, name));
  }
}
if (tests.length === 0) throw new Error('No Node API example suites were discovered');
for (const directory of [
  'end-to-end/recordings/contracts',
  'end-to-end/web-reference/tests/server',
  'end-to-end/react-native-recording-sync/backend',
]) {
  for (const name of await readdir(resolve(root, directory))) {
    if (name.endsWith('.test.mjs')) tests.push(resolve(root, directory, name));
  }
}
await mkdir(resolve(root, 'test-results'), { recursive: true });
console.log(`Running ${tests.length} Node API and integrated backend suites`);
const child = spawn(process.execPath, [
  '--experimental-strip-types', '--test', '--test-concurrency=4',
  '--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=junit', '--test-reporter-destination=test-results/api-integration.xml',
  ...tests.sort(),
], { cwd: root, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
