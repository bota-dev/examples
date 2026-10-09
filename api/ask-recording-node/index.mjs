import { createHash } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// One local journal represents one question. Existing intent always resumes with GETs.
class ExampleError extends Error {}
const fail = (message) => { throw new ExampleError(message); };
const hash = (value) => createHash('sha256').update(value).digest('hex');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value, prefix) => typeof value === 'string' &&
  new RegExp(`^${prefix}_[A-Za-z0-9-]{1,128}$`).test(value);

function configuration() {
  let url;
  try { url = new URL(process.env.BOTA_API_ORIGIN ?? 'https://api.bota.dev'); }
  catch { fail('Invalid BOTA_API_ORIGIN.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback))) {
    fail('Use an HTTPS origin, or HTTP on explicit loopback, with no path or credentials.');
  }
  const key = process.env.BOTA_API_KEY;
  if (!key || !/^(sk_test_|sk_live_|rk_)[A-Za-z0-9_-]+$/.test(key) || key.includes('REPLACE_ME')) {
    fail('Configure a server-held API key.');
  }
  const endUser = process.env.BOTA_END_USER_ID;
  const recording = process.env.BOTA_RECORDING_ID;
  if (!validId(endUser, 'eu') || !validId(recording, 'rec') ||
      endUser.includes('REPLACE_ME') || recording.includes('REPLACE_ME')) {
    fail('Configure fixed end-user and recording identifiers.');
  }
  const question = process.env.BOTA_QUESTION?.trim();
  if (!question || question.length > 10000) fail('BOTA_QUESTION must contain 1–10000 characters.');
  const provider = process.env.BOTA_ASK_PROVIDER;
  if (!['gemini', 'openai', 'claude'].includes(provider)) fail('Choose gemini, openai or claude.');
  return { origin: url.origin, key, endUser, recording, question, provider };
}

function journal(scope) {
  const directory = resolve('.state');
  if (existsSync(directory) && (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink())) {
    fail('Journal directory must be a real local directory.');
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, 'ask.sqlite');
  if (existsSync(path) && (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())) {
    fail('Journal must be a real local file.');
  }
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec(`PRAGMA busy_timeout=5000;
    PRAGMA journal_mode=DELETE;
    PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS operation (
      singleton INTEGER PRIMARY KEY CHECK(singleton=1),
      scope TEXT NOT NULL, phase TEXT NOT NULL,
      session_id TEXT, answer_id TEXT
    );`);
  return {
    claim() {
      // SQLite makes the pre-POST intent atomic across competing local invocations.
      const inserted = db.prepare(`INSERT OR IGNORE INTO operation
        (singleton, scope, phase) VALUES (1, ?, 'creating')`).run(scope).changes === 1;
      const row = db.prepare('SELECT * FROM operation WHERE singleton=1').get();
      if (row.scope !== scope) fail('Journal belongs to another configured question or scope. Preserve it.');
      return { inserted, row };
    },
    created(id) {
      const result = db.prepare(`UPDATE operation SET session_id=?, phase='created'
        WHERE singleton=1 AND phase='creating' AND session_id IS NULL`).run(id);
      if (result.changes !== 1) fail('Journal creation state changed. Preserve it.');
    },
    sending() {
      const result = db.prepare(`UPDATE operation SET phase='sending'
        WHERE singleton=1 AND phase='created'`).run();
      if (result.changes !== 1) fail('Message intent could not be committed. Preserve the journal.');
    },
    answered(id) {
      db.prepare(`UPDATE operation SET phase='answered', answer_id=?
        WHERE singleton=1 AND phase='sending'`).run(id);
    },
    close() { db.close(); },
  };
}

function client(config) {
  const deadline = Date.now() + 120000;
  return async (method, path, body, expected = 200) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) fail('Operation deadline exceeded; preserve the journal.');
    let response;
    try {
      response = await fetch(`${config.origin}/v1${path}`, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(remaining),
        headers: {
          Authorization: `Bearer ${config.key}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { fail(`${method} transport failed; preserve the journal and use GET-only reconciliation.`); }
    if (response.status !== expected) {
      await response.body?.cancel();
      fail(`${method} returned HTTP ${response.status}; preserve the journal. No POST retry is performed.`);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel();
      fail('Expected JSON; preserve the journal.');
    }
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 3 * 1024 * 1024) fail('Response size limit exceeded.');
        chunks.push(chunk);
      }
      return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks)));
    } catch { fail('Response could not be read as bounded JSON; preserve the journal.'); }
  };
}

function checkSession(session, config, expectedId) {
  if (!object(session) || !validId(session.id, 'as') ||
      (expectedId && session.id !== expectedId) || !object(session.scope) ||
      session.scope.type !== 'recording' || !Array.isArray(session.scope.recording_ids) ||
      session.scope.recording_ids.length !== 1 || session.scope.recording_ids[0] !== config.recording ||
      ('end_user_id' in session && session.end_user_id !== config.endUser)) {
    fail('Session identity or recording scope mismatch; preserve the journal.');
  }
}

async function checkRecording(request, config) {
  const recording = await request('GET', `/recordings/${config.recording}`);
  if (!object(recording) || recording.id !== config.recording || recording.end_user_id !== config.endUser) {
    fail('Recording identity or ownership mismatch.');
  }
}

function answer(message, sources, config) {
  if (!object(message) || !validId(message.id, 'msg') || message.role !== 'assistant' ||
      typeof message.content !== 'string' || !message.content.trim() ||
      message.content.length > 1000000 || !Array.isArray(message.parts) ||
      message.parts.length > 1000 || !Array.isArray(sources) || sources.length > 1000 ||
      message.provider !== config.provider || message.finish_reason !== 'stop') {
    fail('Expected a complete assistant answer from the selected provider.');
  }
  const citations = [];
  for (const part of message.parts) {
    if (!object(part)) fail('Invalid answer part.');
    if (part.type === 'text') {
      if (typeof part.text !== 'string') fail('Invalid text part.');
    } else if (part.type === 'citation') {
      if (part.recording_id !== config.recording || !Number.isSafeInteger(part.start_ms) || part.start_ms < 0) {
        fail('Citation outside the configured recording or invalid position.');
      }
      citations.push({ recording_id: part.recording_id, start_ms: part.start_ms });
    } else { fail('Unsupported answer part.'); }
    if ('recording_id' in part && part.recording_id !== config.recording) fail('Answer scope mismatch.');
  }
  for (const source of sources) {
    if (!object(source) || source.recording_id !== config.recording) fail('Source outside configured recording.');
  }
  return { message_id: message.id, answer: message.content, citations };
}

async function resume(request, config, row) {
  if (!row.session_id) fail('Creation outcome is unknown. Reconcile the session manually; this run sends no POST.');
  if (!validId(row.session_id, 'as')) fail('Invalid journal session identifier.');
  const session = await request('GET', `/ask/sessions/${row.session_id}`);
  checkSession(session, config, row.session_id);
  const page = await request('GET', `/ask/sessions/${row.session_id}/messages?limit=3`);
  if (!object(page) || !Array.isArray(page.data) || page.has_more !== false ||
      page.data.length !== 2 || session.message_count !== 2) {
    fail('No single complete question/answer pair yet. This run sends no POST; reconcile manually or rerun later.');
  }
  // Reconcile by role; deployed API versions can differ in message ordering.
  const users = page.data.filter(message => message?.role === 'user');
  const assistants = page.data.filter(message => message?.role === 'assistant');
  if (users.length !== 1 || assistants.length !== 1) fail('Expected one question and one assistant answer.');
  const [user] = users;
  const [assistant] = assistants;
  if (!object(user) || user.role !== 'user' || typeof user.content !== 'string' ||
      hash(user.content) !== hash(config.question) ||
      (row.answer_id && assistant?.id !== row.answer_id)) {
    fail('Message history differs from the journaled question or answer.');
  }
  // List Messages does not return retrieval sources; recording scope uses none.
  return answer(assistant, [], config);
}

async function main() {
  const config = configuration();
  const scope = JSON.stringify({
    origin: config.origin, endUser: config.endUser, recording: config.recording,
    provider: config.provider, questionHash: hash(config.question),
  });
  const state = journal(scope);
  try {
    const request = client(config);
    await checkRecording(request, config);
    const { inserted, row } = state.claim();
    let result;
    let sessionId = row.session_id;
    if (!inserted) {
      result = await resume(request, config, row);
    } else {
      const session = await request('POST', '/ask/sessions', {
        scope: { type: 'recording', recording_id: config.recording },
      }, 201);
      checkSession(session, config);
      if (session.message_count !== 0) fail('Expected an empty new session; preserve the journal.');
      sessionId = session.id;
      state.created(sessionId);
      const fresh = await request('GET', `/ask/sessions/${sessionId}`);
      checkSession(fresh, config, sessionId);
      if (fresh.message_count !== 0) fail('Session already contains messages; preserve the journal.');
      await checkRecording(request, config);
      state.sending();
      const response = await request('POST', `/ask/sessions/${sessionId}/messages`, {
        content: config.question, provider: config.provider,
      });
      if (!object(response) || response.session_id !== sessionId) fail('Answer session identity mismatch.');
      result = answer(response.message, response.sources, config);
      state.answered(result.message_id);
    }
    await checkRecording(request, config);
    const finalSession = await request('GET', `/ask/sessions/${sessionId}`);
    checkSession(finalSession, config, sessionId);
    if (finalSession.message_count !== 2) fail('Session changed during the operation.');
    console.log(JSON.stringify({ session_id: sessionId, recording_id: config.recording, ...result }, null, 2));
  } finally { state.close(); }
}

main().catch((error) => {
  // Only our controlled messages are surfaced; never print API bodies, URLs or native errors.
  console.error(error instanceof ExampleError ? error.message :
    'Local operation failed; preserve .state and inspect configuration.');
  process.exitCode = 1;
});
