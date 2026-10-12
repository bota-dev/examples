import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ensure } from './errors.mjs';

export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

export function createAuth(config, { now = Date.now } = {}) {
  const sessions = new Map();
  const failures = new Map();
  const cookie = (token, age) =>
    `bota_reference=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${age}${config.origin.startsWith('https:') ? '; Secure' : ''}`;
  function login({ username, token }, address) {
    for (const [key, value] of failures) if (value.until <= now()) failures.delete(key);
    const count = failures.get(address)?.count ?? 0;
    ensure(
      count < 10 && (failures.has(address) || failures.size < 1000),
      429,
      'RATE_LIMIT',
      'Try signing in later.',
    );
    const account = config.accounts.find((row) => row.username === username);
    const candidate = tokenHash(typeof token === 'string' && token.length <= 256 ? token : '');
    const valid =
      config.mode === 'demo'
        ? username === 'demo'
        : account &&
          typeof token === 'string' &&
          token.length >= 32 &&
          token.length <= 256 &&
          timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(account.tokenHash, 'hex'));
    if (!account || !valid) {
      failures.set(address, {
        count: count + 1,
        until: failures.get(address)?.until ?? now() + 60000,
      });
      ensure(false, 401, 'UNAUTHENTICATED', 'Sign-in details are invalid.');
    }
    failures.delete(address);
    for (const [key, value] of sessions) if (value.until <= now()) sessions.delete(key);
    ensure(sessions.size < 256, 503, 'SESSION_LIMIT', 'Session capacity reached.');
    const sessionToken = randomBytes(32).toString('base64url');
    sessions.set(tokenHash(sessionToken), { principal: account.principal, until: now() + 1800000 });
    return { principal: account.principal, cookie: cookie(sessionToken, 1800) };
  }
  const sessionKey = (header) => {
    const matches = String(header ?? '')
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.startsWith('bota_reference='));
    if (matches.length !== 1) return null;
    const token = matches[0].slice('bota_reference='.length);
    return /^[A-Za-z0-9_-]{43}$/.test(token) ? tokenHash(token) : null;
  };
  return {
    login,
    principal(header) {
      const key = sessionKey(header);
      const session = sessions.get(key);
      if (!session || session.until <= now()) {
        sessions.delete(key);
        return null;
      }
      return session.principal;
    },
    logout(header) {
      sessions.delete(sessionKey(header));
      return cookie('', 0);
    },
  };
}
