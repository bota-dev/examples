import { randomBytes } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  openSync,
  writeFileSync,
  ftruncateSync,
  fsyncSync,
  closeSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { tokenHash } from '../server/auth.mjs';
import { isId } from '../server/errors.mjs';

// Operator-only bootstrap: no API calls. The opaque application token is printed once.
try {
  const [username, endUserId] = process.argv.slice(2);
  if (
    process.argv.length !== 4 ||
    !/^[A-Za-z0-9_.-]{1,64}$/.test(username ?? '') ||
    !isId(endUserId, 'eu')
  )
    throw new Error('Usage: npm run account -- <username> <authorized eu_ID>');
  const path = resolve(process.env.ACCOUNTS_FILE ?? 'accounts.json');
  let rows = [];
  if (existsSync(path)) {
    const info = lstatSync(path);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.size > 256 * 1024 ||
      (process.platform !== 'win32' && (info.uid !== process.getuid() || info.mode & 0o077))
    )
      throw new Error('Use a private regular accounts file.');
    rows = JSON.parse(readFileSync(path, 'utf8'));
  }
  if (!Array.isArray(rows) || rows.length >= 100 || rows.some((row) => row.username === username))
    throw new Error('Account exists or account file needs operator review.');
  const token = randomBytes(32).toString('base64url');
  rows.push({ username, endUserId, tokenHash: tokenHash(token) });
  const fd = openSync(path, existsSync(path) ? 'r+' : 'wx', 0o600);
  try {
    const bytes = Buffer.from(JSON.stringify(rows, null, 2) + '\n');
    writeFileSync(fd, bytes);
    ftruncateSync(fd, bytes.length);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  console.log(`Application account: ${username}\nOne-time application access token: ${token}`);
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Accounts file is invalid.' : error.message);
  process.exitCode = 1;
}
