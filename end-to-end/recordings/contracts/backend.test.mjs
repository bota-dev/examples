import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, RequestError, errorOperation } from '../backend/errors.mjs';
import { getRecording } from '../backend/features/recordings.mjs';
import {
  listSummaries,
  refreshProcessing,
  startSummary,
  startTranscription,
  verifySummary,
  verifyTranscription,
} from '../backend/features/processing.mjs';

const at = '2026-10-12T10:00:00.000Z';
const principal = {
  projectId: 'proj_shared',
  endUserId: 'eu_shared',
  scopeId: 'synthetic-scope',
};
const recording = {
  id: 'rec_shared',
  project_id: principal.projectId,
  end_user_id: principal.endUserId,
  status: 'uploaded',
  created_at: at,
  content_sha256: 'a'.repeat(64),
  content_sha256_verified_at: at,
};
const transcription = {
  id: 'txn_shared',
  recording_id: recording.id,
  project_id: principal.projectId,
  status: 'completed',
  created_at: at,
  full_text: 'Synthetic transcript.',
};
const summary = {
  id: 'sum_shared',
  transcription_id: transcription.id,
  project_id: principal.projectId,
  status: 'completed',
  template_id: 'tmpl_general_notes',
  created_at: at,
  output: {
    overview: 'Synthetic notes.',
    key_points: [],
    action_items: [],
    participants: [],
    decisions: [],
  },
};
const clone = (value) => structuredClone(value);
const page = (data) => ({ data, has_more: false, next_cursor: null });

// Contract fixture only: this local map does not prove durable persistence.
// Adapter restart behavior is exercised with the real store in the web suite.
function fixture() {
  const operations = new Map(),
    calls = [];
  const state = {
    recording: clone(recording),
    transcription: clone(transcription),
    summary: clone(summary),
  };
  const ctx = {
    principal,
    store: {
      claim(_owner, kind, anchor, details) {
        const key = `${kind}:${anchor}`;
        const known = operations.get(key);
        if (known) return { fresh: false, operation: clone(known) };
        const operation = {
          id: `12345678-1234-4234-9234-${String(operations.size + 1).padStart(12, '0')}`,
          kind,
          anchor,
          details: clone(details),
          state: 'claimed',
          resourceId: null,
          updatedAt: at,
        };
        operations.set(key, operation);
        return { fresh: true, operation: clone(operation) };
      },
      save(_owner, id, changes) {
        const row = [...operations.values()].find((operation) => operation.id === id);
        assert.ok(row, 'the intent must already exist');
        Object.assign(row, clone(changes), {
          details: { ...row.details, ...changes.details },
        });
        return clone(row);
      },
      get(_owner, id) {
        const row = [...operations.values()].find((operation) => operation.id === id);
        assert.ok(row);
        return clone(row);
      },
    },
    async request(method, path, body) {
      calls.push({ method, path, body: clone(body) });
      if (method === 'POST')
        return clone(path === '/transcriptions' ? state.transcription : state.summary);
      if (path === `/recordings/${recording.id}`) return clone(state.recording);
      if (path === `/transcriptions/${transcription.id}`) return clone(state.transcription);
      if (path === `/summaries/${summary.id}`) return clone(state.summary);
      if (path.startsWith('/transcriptions?')) return page([]);
      if (path.startsWith('/summaries?')) return page(state.listSummaries ?? []);
      throw new Error(`Unexpected synthetic contract request ${method} ${path}`);
    },
  };
  return { ctx, operations, calls, state };
}

test('shared AppError retains the RequestError identity used by both HTTP adapters', () => {
  const error = new AppError(403, 'not_owned', 'Resource unavailable.');
  assert.ok(error instanceof RequestError);
  assert.equal(error.status, 403);
  assert.equal(error.code, 'not_owned');
});

test('canonical recording and transcription verification require project fields by default', async () => {
  const f = fixture();
  delete f.state.transcription.project_id;
  await assert.rejects(verifyTranscription(f.ctx, transcription.id), {
    status: 403,
    code: 'job_not_owned',
  });
  delete f.state.recording.project_id;
  await assert.rejects(getRecording(f.ctx, recording.id), {
    status: 403,
    code: 'recording_forbidden',
  });
  assert.ok(f.calls.every((call) => call.method === 'GET'));
});

test('explicit omitted-project compatibility still verifies the current recording owner', async () => {
  const f = fixture();
  f.ctx.requireProjectId = false;
  delete f.state.transcription.project_id;
  assert.equal(
    (await verifyTranscription(f.ctx, transcription.id, recording.id)).id,
    transcription.id,
  );
  f.state.recording.end_user_id = 'eu_foreign';
  await assert.rejects(verifyTranscription(f.ctx, transcription.id, recording.id), {
    status: 403,
    code: 'recording_forbidden',
  });
});

for (const policy of ['strict default', 'explicit compatibility']) {
  test(`${policy} rejects every provided foreign job project, owner and source`, async () => {
    for (const [altered, status] of [
      [{ project_id: 'proj_foreign' }, 404],
      [{ project_id: null }, 404],
      [{ end_user_id: 'eu_foreign' }, 403],
      [{ recording_id: 'rec_foreign' }, 502],
    ]) {
      const f = fixture();
      if (policy === 'explicit compatibility') f.ctx.requireProjectId = false;
      Object.assign(f.state.transcription, altered);
      await assert.rejects(verifyTranscription(f.ctx, transcription.id, recording.id), { status });
      assert.ok(f.calls.every((call) => call.method === 'GET'));
    }
  });
}

test('canonical mobile-compatible processing results retain verified source fields and bounded notes', async () => {
  const f = fixture();
  const transcript = await startTranscription(f.ctx, recording.id);
  assert.equal(transcript.operation.resource_id, transcription.id);
  assert.equal(transcript.transcription.recording_id, recording.id);
  assert.equal(transcript.transcription.full_text, transcription.full_text);
  assert.equal(transcript.transcription.project_id, undefined);
  const notes = await startSummary(f.ctx, transcription.id);
  assert.equal(notes.operation.resource_id, summary.id);
  assert.equal(
    notes.summary.recording_id,
    recording.id,
    'the recording source is derived from the verified chain',
  );
  assert.equal(notes.summary.transcription_id, transcription.id);
  assert.deepEqual(notes.summary.output, summary.output);
  f.state.listSummaries = [summary];
  const listed = await listSummaries(f.ctx, transcription.id);
  assert.equal(listed.data[0].recording_id, recording.id);
  assert.deepEqual(
    f.calls.filter((call) => call.method === 'POST').map((call) => call.body),
    [
      { recording_id: recording.id },
      { transcription_id: transcription.id, template_id: 'tmpl_general_notes' },
    ],
  );
});

for (const requireProjectId of [undefined, false]) {
  test(`summary source mismatches remain denied under ${requireProjectId === false ? 'compatibility' : 'strict'} policy`, async () => {
    const f = fixture();
    if (requireProjectId !== undefined) f.ctx.requireProjectId = requireProjectId;
    f.state.summary.recording_id = 'rec_foreign';
    await assert.rejects(verifySummary(f.ctx, summary.id, transcription.id), {
      status: 502,
      code: 'invalid_job',
    });
    f.state.summary.recording_id = recording.id;
    f.state.summary.project_id = 'proj_foreign';
    await assert.rejects(verifySummary(f.ctx, summary.id, transcription.id), {
      status: 404,
    });
  });
}

test('strict-policy rejection of a created identity preserves the local intent without replacement', async () => {
  const f = fixture();
  delete f.state.transcription.project_id;
  await assert.rejects(startTranscription(f.ctx, recording.id), (error) => {
    assert.equal(error.status, 403);
    assert.equal(error.code, 'job_not_owned');
    assert.equal(error.operation, undefined);
    return true;
  });
  const [saved] = f.operations.values();
  assert.equal(saved.resourceId, transcription.id);
  assert.equal(saved.state, 'uncertain');
  await assert.rejects(startTranscription(f.ctx, recording.id), {
    status: 403,
  });
  await assert.rejects(refreshProcessing(f.ctx, saved.id), { status: 403 });
  assert.equal(f.calls.filter((call) => call.method === 'POST').length, 1);
  assert.equal(f.operations.size, 1);
});

test('shared error metadata is narrowly projected and suppressed for authorization denial', () => {
  const operation = {
    id: '12345678-1234-4234-9234-123456789abc',
    kind: 'transcription',
    state: 'uncertain',
    resource_id: transcription.id,
    updated_at: at,
    details: { recordingId: 'rec_private', privateToken: 'PRIVATE_TOKEN' },
  };
  const error = new AppError(502, 'unavailable', 'Resource unavailable.');
  error.operation = operation;
  assert.deepEqual(errorOperation(error), {
    id: operation.id,
    kind: operation.kind,
    state: operation.state,
    resource_id: operation.resource_id,
    updated_at: at,
  });
  for (const status of [401, 403, 404]) {
    const denial = new AppError(status, 'unavailable', 'Resource unavailable.');
    denial.operation = operation;
    assert.equal(errorOperation(denial), null);
  }
  for (const altered of [
    { id: 'invalid' },
    { state: 'invented' },
    { kind: 'upload' },
    { resource_id: recording.id },
    { updated_at: 'invalid' },
  ]) {
    error.operation = { ...operation, ...altered };
    assert.equal(errorOperation(error), null);
  }
});
