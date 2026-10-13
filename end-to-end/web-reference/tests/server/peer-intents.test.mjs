import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../../server/store.mjs';

const principal = { accountId: 'alice', scopeId: 'current-scope' };
const hash = (question) => createHash('sha256').update(question.trim()).digest('hex');
const conflict = (error) => {
  assert.equal(error.status, 409);
  assert.equal(error.code, 'cross_intent_reconciliation_required');
  assert.equal(error.operation, undefined);
  assert.deepEqual(Object.keys(error).sort(), ['code', 'status']);
  assert.ok(!error.message.includes('private'));
  return true;
};

test('peer lookup exempts only exact account and scope; no principal exempts no row', () => {
  for (const owner of [
    principal,
    { ...principal, scopeId: 'private-old-scope' },
    { ...principal, accountId: 'private-removed-account' },
  ]) {
    const store = createStore();
    try {
      const row = store.claim(owner, 'transcription', 'rec_one', { recordingId: 'rec_one' });
      store.save(owner, row.operation.id, { state: 'uncertain', resourceId: 'txn_private' });
      if (owner === principal)
        assert.equal(store.assertPeerIntent('transcription', 'rec_one', { principal }), true);
      else
        assert.throws(
          () => store.assertPeerIntent('transcription', 'rec_one', { principal }),
          conflict,
        );
      assert.throws(() => store.assertPeerIntent('transcription', 'rec_one'), conflict);
      assert.equal(store.assertPeerIntent('summary', 'rec_one', { principal }), true);
      assert.equal(store.assertPeerIntent('transcription', 'rec_other', { principal }), true);
    } finally {
      store.close();
    }
  }
});

test('peer intents from removed accounts survive reopen beyond the 50-row Activity view', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bota-peer-intents-'));
  const path = join(directory, 'state.sqlite');
  const removed = { accountId: 'private-removed-account', scopeId: 'private-old-scope' };
  let store;
  try {
    store = createStore(path);
    const old = [
      store.claim(removed, 'transcription', 'rec_private', { recordingId: 'rec_private' })
        .operation,
      store.claim(removed, 'summary', 'txn_private:tmpl_general_notes', {
        recordingId: 'rec_private',
      }).operation,
      store.claim(removed, 'ask', 'rec_private:legacy-private-hash', {
        recordingId: 'rec_private',
      }).operation,
    ];
    await new Promise((resolve) => setTimeout(resolve, 5));
    for (let i = 0; i < 51; i += 1)
      store.claim(removed, 'transcription', `rec_new${i}`, { recordingId: `rec_new${i}` });
    assert.equal(store.list(removed).length, 50);
    assert.ok(store.list(removed).every((row) => !old.some((saved) => saved.id === row.id)));
    store.close();
    store = createStore(path);
    assert.deepEqual(store.list(principal), []);
    assert.throws(
      () => store.assertPeerIntent('transcription', 'rec_private', { principal }),
      conflict,
    );
    assert.throws(
      () => store.assertPeerIntent('summary', 'txn_private:tmpl_general_notes', { principal }),
      conflict,
    );
    assert.throws(
      () =>
        store.assertPeerIntent('ask', `rec_private:${hash('A new question')}`, {
          principal,
          recordingId: 'rec_private',
        }),
      conflict,
    );
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('canonical Ask peer intents block only the same trimmed question, including completed intents', () => {
  const store = createStore();
  const peer = { accountId: 'private-account', scopeId: 'private-scope' };
  const questionHash = hash('What was agreed?');
  try {
    const operation = store.claim(peer, 'ask', `rec_one:${questionHash}`, {
      recordingId: 'rec_one',
      questionHash,
      questionFormat: 'trim-v1',
    }).operation;
    for (const state of ['uncertain', 'complete']) {
      store.save(peer, operation.id, { state });
      assert.throws(
        () =>
          store.assertPeerIntent('ask', `rec_one:${hash(' What was agreed? ')}`, {
            principal,
            recordingId: 'rec_one',
          }),
        conflict,
      );
      assert.equal(
        store.assertPeerIntent('ask', `rec_one:${hash('A different question')}`, {
          principal,
          recordingId: 'rec_one',
        }),
        true,
      );
    }
  } finally {
    store.close();
  }
});

test('incomplete legacy Ask peers block a new question on that recording without exposing their hash', () => {
  for (const format of [undefined, 'raw-v0']) {
    const store = createStore();
    const peer = { ...principal, scopeId: 'private-earlier-scope' };
    try {
      const operation = store.claim(peer, 'ask', 'rec_one:private-raw-hash', {
        recordingId: 'rec_one',
        ...(format ? { questionFormat: format } : {}),
      }).operation;
      store.save(peer, operation.id, { state: 'uncertain', resourceId: 'as_private' });
      assert.throws(
        () =>
          store.assertPeerIntent('ask', `rec_one:${hash('A new question')}`, {
            principal,
            recordingId: 'rec_one',
          }),
        conflict,
      );
      assert.equal(
        store.assertPeerIntent('ask', `rec_other:${hash('A new question')}`, {
          principal,
          recordingId: 'rec_other',
        }),
        true,
      );
      store.save(peer, operation.id, { state: 'complete' });
      assert.equal(
        store.assertPeerIntent('ask', `rec_one:${hash('A new question')}`, {
          principal,
          recordingId: 'rec_one',
        }),
        true,
      );
    } finally {
      store.close();
    }
  }
});
