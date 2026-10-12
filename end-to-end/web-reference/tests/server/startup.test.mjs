import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../../', import.meta.url));

test(
  'an occupied demo port fails promptly and closes development watchers',
  { timeout: 15000 },
  async () => {
    const occupied = createServer();
    await new Promise((resolve, reject) => {
      occupied.once('error', reject);
      occupied.listen(0, '127.0.0.1', resolve);
    });
    const port = String(occupied.address().port);
    const child = spawn(process.execPath, ['server/main.mjs', '--demo', '--dev'], {
      cwd: directory,
      env: {
        ...process.env,
        PORT: port,
        APP_ORIGIN: `http://127.0.0.1:${port}`,
        APP_MODE: 'demo',
        BOTA_API_KEY: 'sk_test_fixture_only',
        BOTA_API_BASE_URL: 'https://fixture.bota.invalid/v1',
        BOTA_PROJECT_ID: 'proj_demo',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (bytes) => {
      output += bytes.toString();
    });
    child.stderr.on('data', (bytes) => {
      output += bytes.toString();
    });
    let timer;
    try {
      const exit = await new Promise((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Demo startup retained open handles after its listener failed.')),
          10000,
        );
        child.once('error', reject);
        child.once('close', (code, signal) => resolve({ code, signal }));
      });
      assert.deepEqual(exit, { code: 1, signal: null });
      assert.match(output, /Application port is already in use/);
      assert.doesNotMatch(output, /Bota API Explorer \(demo\):/);
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null) child.kill();
      await new Promise((resolve) => occupied.close(resolve));
    }
  },
);
