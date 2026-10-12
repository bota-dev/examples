import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../../', import.meta.url));

async function within(promise, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), 10000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

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

test(
  'shutdown closes active HMR connections before waiting for the HTTP drain',
  { timeout: 30000 },
  async () => {
    const reservation = createServer();
    await new Promise((resolve, reject) => {
      reservation.once('error', reject);
      reservation.listen(0, '127.0.0.1', resolve);
    });
    const port = String(reservation.address().port);
    await new Promise((resolve) => reservation.close(resolve));
    const origin = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, ['--input-type=module', '-', '--demo', '--dev'], {
      cwd: directory,
      env: {
        ...process.env,
        PORT: port,
        APP_ORIGIN: origin,
        APP_MODE: 'demo',
        BOTA_API_KEY: 'sk_test_fixture_only',
        BOTA_API_BASE_URL: 'https://fixture.bota.invalid/v1',
        BOTA_PROJECT_ID: 'proj_demo',
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    const exited = new Promise((resolve) =>
      child.once('close', (code, signal) => resolve({ code, signal })),
    );
    let output = '';
    let socket;
    const ready = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.stdout.on('data', (bytes) => {
        output += bytes.toString();
        if (output.includes('Bota API Explorer (demo):')) resolve();
      });
      child.stderr.on('data', (bytes) => {
        output += bytes.toString();
      });
    });
    // Exercise the normal signal handler on Windows and Linux. This wrapper is
    // test-only: main.mjs receives no extra production flag or shutdown API.
    child.stdin.end(
      "process.on('message', () => { process.disconnect(); process.emit('SIGTERM'); }); await import('./server/main.mjs');",
    );
    try {
      await within(ready, 'The synthetic demo listener did not start.');
      const response = await fetch(`${origin}/@vite/client`);
      assert.equal(response.status, 200);
      const client = await response.text();
      const token = /const wsToken = ("[^"]+")/.exec(client)?.[1];
      assert.ok(token, 'Read the actual Vite HMR token from the local client module.');
      socket = new WebSocket(`ws://127.0.0.1:${port}/?token=${JSON.parse(token)}`, 'vite-hmr');
      await within(
        new Promise((resolve, reject) => {
          socket.addEventListener('open', resolve, { once: true });
          socket.addEventListener(
            'error',
            () => reject(new Error('The local HMR connection failed.')),
            { once: true },
          );
        }),
        'The local HMR connection did not open.',
      );
      const hmrClosed = new Promise((resolve) =>
        socket.addEventListener('close', resolve, { once: true }),
      );
      child.send('shutdown');
      const [, exit] = await within(
        Promise.all([hmrClosed, exited]),
        'Shutdown retained the HMR socket or application process.',
      );
      assert.equal(socket.readyState, WebSocket.CLOSED);
      assert.deepEqual(exit, { code: 0, signal: null });
    } finally {
      socket?.close();
      if (child.exitCode === null) child.kill();
      await exited;
    }
  },
);
