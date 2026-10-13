import { isAbsolute, join } from 'node:path';

// Reuse the existing operator-only account creator with the combined host's
// explicit path. It performs no API calls and prints the new app token once.
const path =
  process.env.WEB_ACCOUNTS_FILE ??
  (process.env.WEB_LAUNCH_DIR && join(process.env.WEB_LAUNCH_DIR, 'accounts.json'));
if (typeof path !== 'string' || !isAbsolute(path)) {
  console.error('Set an absolute WEB_ACCOUNTS_FILE or WEB_LAUNCH_DIR before account creation.');
  process.exitCode = 1;
} else {
  process.env.ACCOUNTS_FILE = path;
  await import('../../web-reference/scripts/create-account.mjs');
}
