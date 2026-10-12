import { createHash } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensure, isId } from './errors.mjs';

export function configuration(env, { demo = false } = {}) {
  const mode = demo ? 'demo' : env.APP_MODE;
  ensure(['demo', 'live'].includes(mode), 500, 'CONFIGURATION', 'Select explicit APP_MODE=live or npm run demo.');
  const port = Number(env.PORT ?? 5173);
  ensure(Number.isInteger(port) && port >= 1 && port <= 65535, 500, 'CONFIGURATION', 'Configure a valid local port.');
  const rawOrigin = env.APP_ORIGIN ?? `http://127.0.0.1:${port}`;
  const origin = new URL(rawOrigin);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  ensure(rawOrigin.length <= 2048 && !/[\x00-\x20\x7f\\?#]/.test(rawOrigin) &&
    (origin.protocol === 'https:' || (origin.protocol === 'http:' && local)) &&
    !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash,
  500, 'CONFIGURATION', 'APP_ORIGIN needs HTTPS or explicit loopback HTTP, without a path or credentials.');
  const config = { mode, port, origin: origin.origin, stateDir: resolve(env.STATE_DIR ?? '.state'),
    accountsFile: resolve(env.ACCOUNTS_FILE ?? 'accounts.json') };
  if (mode === 'demo') {
    return { ...config, apiBase: 'https://fixture.bota.invalid/v1', apiKey: 'sk_test_fixture_only',
      projectId: 'proj_demo', storageHosts: ['storage.example.test'], webhookSecret: null,
      accounts: [{ username: 'demo', principal: { accountId: 'demo', username: 'demo',
        endUserId: 'eu_demo', projectId: 'proj_demo', scopeId: 'demo' } }] };
  }
  const rawBase = env.BOTA_API_BASE_URL ?? '';
  const base = new URL(rawBase);
  ensure(rawBase.length <= 2048 && !/[\x00-\x20\x7f\\?#]/.test(rawBase) && base.protocol === 'https:' &&
    !base.username && !base.password && /^\/v1\/?$/.test(base.pathname) && !base.search && !base.hash,
  500, 'CONFIGURATION', 'Configure an explicit trusted HTTPS Bota API base ending in /v1.');
  ensure(/^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]{16,256}$/.test(env.BOTA_API_KEY ?? '') &&
    !/replace_me/i.test(env.BOTA_API_KEY) && isId(env.BOTA_PROJECT_ID, 'proj'),
  500, 'CONFIGURATION', 'Configure the server-held project key and independently verified project mapping.');
  let accounts;
  const info = lstatSync(config.accountsFile);
  ensure(info.isFile() && !info.isSymbolicLink() && info.size <= 256 * 1024 &&
    (process.platform === 'win32' || (info.uid === process.getuid() && (info.mode & 0o077) === 0)),
  500, 'CONFIGURATION', 'Accounts must be a private regular file.');
  try { accounts = JSON.parse(readFileSync(config.accountsFile, 'utf8')); }
  catch { ensure(false, 500, 'CONFIGURATION', 'Accounts file is invalid.'); }
  const usernames = new Set();
  ensure(Array.isArray(accounts) && accounts.length > 0 && accounts.length <= 100,
    500, 'CONFIGURATION', 'Configure at most 100 application accounts.');
  for (const row of accounts) {
    ensure(row && /^[A-Za-z0-9_.-]{1,64}$/.test(row.username) && !usernames.has(row.username) &&
      /^[a-f0-9]{64}$/.test(row.tokenHash) && isId(row.endUserId, 'eu'),
    500, 'CONFIGURATION', 'Accounts need unique usernames, token hashes and end-user mappings.');
    usernames.add(row.username);
    row.principal = { accountId: row.username, username: row.username, endUserId: row.endUserId,
      projectId: env.BOTA_PROJECT_ID, scopeId: createHash('sha256').update(JSON.stringify([
        row.username, row.endUserId, env.BOTA_PROJECT_ID, env.BOTA_API_KEY,
      ])).digest('hex') };
  }
  const storageHosts = (env.BOTA_STORAGE_HOSTS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  ensure(storageHosts.every(host => /^[a-z0-9][a-z0-9.-]{0,252}$/.test(host)),
    500, 'CONFIGURATION', 'Storage hosts must be trusted exact lowercase names without paths or wildcards.');
  const webhookSecret = env.WEBHOOK_SECRET || null;
  ensure(!webhookSecret || (webhookSecret.length >= 32 && webhookSecret.length <= 256 &&
    !/[\x00-\x20\x7f]/.test(webhookSecret)), 500, 'CONFIGURATION', 'Use a valid configured webhook signing secret.');
  return { ...config, apiBase: base.href.replace(/\/$/, ''), apiKey: env.BOTA_API_KEY,
    projectId: env.BOTA_PROJECT_ID, storageHosts, webhookSecret, accounts };
}
