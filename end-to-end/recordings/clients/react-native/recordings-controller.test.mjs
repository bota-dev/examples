import assert from 'node:assert/strict';
import test from 'node:test';
import { RecordingsController } from './recordings-controller.ts';
import { LibraryError } from './library-api.ts';
import { createDemoLibrary } from './demo.ts';

const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const rec = (id = 'rec_one') => ({ id, name: 'Recording', status: 'uploaded', created_at: '2026-01-15T10:00:00Z', duration_seconds: 12, upload_verified: true });
const txn = (recordingId = 'rec_one') => ({ id: `txn_${recordingId.slice(4)}`, recording_id: recordingId, status: 'completed', full_text: `Text ${recordingId}` });
const op = (kind = 'ask', state = 'complete') => ({ id: `op_${kind}`, kind, state, resource_id: kind === 'ask' ? 'as_one' : `${kind === 'summary' ? 'sum' : 'txn'}_one`, updated_at: '2026-01-15T10:00:00Z' });
function fake(overrides = {}) {
  return { list: async () => ({ data: [rec()], has_more: false, next_cursor: null }), detail: async id => rec(id),
    transcriptions: async id => [txn(id)], summaries: async () => [], startTranscription: async () => ({ operation: op('transcription') }),
    startSummary: async () => ({ operation: op('summary') }), ask: async id => ({ operation: op(), answer: 'Answer', citations: [{ recording_id: id, start_ms: 0 }] }),
    operations: async () => [], operation: async () => ({ operation: op() }), dispose() {}, ...overrides };
}
async function selected(api = fake()) { const controller = new RecordingsController(api); controller.select(rec()); await flush(); return controller; }

test('the full synthetic controller journey uses no network and reset drops every result/request', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('sample mode must not fetch');
  try {
    const controller = new RecordingsController(createDemoLibrary());
    await controller.refreshLibrary(); assert.equal(controller.snapshot().recordings.length, 2);
    controller.select(controller.snapshot().recordings[1]); await flush();
    assert.equal(controller.snapshot().transcripts.length, 0);
    await controller.startTranscription(); assert.equal(controller.snapshot().request.operation.state, 'submitted');
    await controller.refreshDetail(); assert.equal(controller.snapshot().transcripts[0].status, 'completed');
    controller.setTab('Summary'); await flush(); await controller.startSummary(); await controller.refreshDetail();
    assert.match(controller.snapshot().summaries[0].output.overview, /onboarding/);
    controller.setTab('Ask'); await flush(); controller.setQuestion('What next?'); await controller.ask();
    assert.match(controller.snapshot().answer, /fixed fixture/); assert.equal(controller.snapshot().citations[0].recording_id, 'rec_sample2');
    controller.dispose(); assert.deepEqual(controller.snapshot().recordings, []); assert.equal(controller.snapshot().answer, null); assert.equal(controller.snapshot().question, '');
  } finally { globalThis.fetch = original; }
});

test('switching recordings fences late detail and transcript reads even when transport ignores abort', async () => {
  const pending = deferred();
  const controller = new RecordingsController(fake({ transcriptions: async id => id === 'rec_one' ? pending.promise : [txn(id)] }));
  controller.select(rec()); controller.select(rec('rec_two')); await flush();
  pending.resolve([txn()]); await flush();
  assert.equal(controller.snapshot().selected.id, 'rec_two'); assert.equal(controller.snapshot().transcripts[0].recording_id, 'rec_two');
  controller.dispose();
});

test('summary-read failure only affects the Summary tab, leaving Transcript and Ask available', async () => {
  let summaryReads = 0;
  const controller = await selected(fake({ summaries: async () => { summaryReads++; throw new LibraryError(403, 'request_failed'); } }));
  assert.equal(controller.snapshot().detailError, ''); assert.equal(summaryReads, 0);
  controller.setTab('Ask'); await flush(); controller.setQuestion('Next?'); await controller.ask();
  assert.equal(controller.snapshot().answer, 'Answer'); assert.equal(summaryReads, 0);
  controller.setTab('Summary'); await flush(); assert.equal(summaryReads, 1); assert.notEqual(controller.snapshot().detailError, '');
  controller.setTab('Transcript'); await flush(); assert.equal(controller.snapshot().detailError, ''); assert.equal(controller.snapshot().transcripts[0].full_text, 'Text rec_one');
  controller.dispose();
});

test('back clears content and retains uncertain intent locks across selecting the same recording', async () => {
  let calls = 0;
  const controller = await selected(fake({ ask: async () => { calls++; throw new LibraryError(0, 'outcome_unknown'); } }));
  controller.setTab('Ask'); await flush(); controller.setQuestion(' What next? '); await controller.ask();
  assert.equal(controller.isLocked(), true);
  controller.back(); assert.equal(controller.snapshot().answer, null); assert.equal(controller.snapshot().question, '');
  controller.select(rec()); await flush(); controller.setTab('Ask'); await flush(); controller.setQuestion('What next?'); await controller.ask();
  assert.equal(calls, 1); assert.equal(controller.isLocked(), true); controller.dispose();
});

test('a late Ask result after back retains metadata and cannot restore an answer', async () => {
  const pending = deferred();
  const controller = await selected(fake({ ask: () => pending.promise }));
  controller.setTab('Ask'); await flush(); controller.setQuestion('Next?'); const asking = controller.ask();
  controller.back(); pending.resolve({ operation: op(), answer: 'Late private answer', citations: [] }); await asking;
  assert.equal(controller.snapshot().selected, null); assert.equal(controller.snapshot().answer, null);
  assert.equal(controller.snapshot().operations[0].id, op().id); controller.dispose();
});

test('tab changes and edited questions fence late answer content while preserving the original lock', async () => {
  const pending = deferred();
  const controller = await selected(fake({ ask: () => pending.promise }));
  controller.setTab('Ask'); await flush(); controller.setQuestion('Original?'); const asking = controller.ask();
  controller.setTab('Transcript'); pending.resolve({ operation: op(), answer: 'Late private answer', citations: [] }); await asking;
  assert.equal(controller.snapshot().answer, null);
  controller.setTab('Ask'); await flush(); assert.equal(controller.isLocked(), true);
  controller.setQuestion('Different?'); assert.equal(controller.isLocked(), false); assert.equal(controller.snapshot().answer, null);
  controller.dispose();
});

test('editing away and back to the same question retires its pending answer without unlocking the intent', async () => {
  const pending = deferred(); let posts = 0;
  const controller = await selected(fake({ ask: () => { posts++; return pending.promise; } }));
  controller.setTab('Ask'); await flush(); controller.setQuestion('Original?'); const asking = controller.ask();
  controller.setQuestion('Changed?'); controller.setQuestion('Original?');
  pending.resolve({ operation: op(), answer: 'Retired answer', citations: [] }); await asking;
  assert.equal(controller.snapshot().answer, null); assert.equal(controller.isLocked(), true);
  await controller.ask(); assert.equal(posts, 1); controller.dispose();
});

test('only known preclaim readiness failures without an operation unlock a processing action', async () => {
  let calls = 0;
  const controller = await selected(fake({ transcriptions: async () => [], startTranscription: async () => {
    calls++; if (calls === 1) throw new LibraryError(409, 'upload_unverified'); return { operation: op('transcription') };
  } }));
  await controller.startTranscription(); assert.equal(controller.isLocked(), false);
  await controller.refreshDetail(); await controller.startTranscription(); assert.equal(calls, 2); assert.equal(controller.isLocked(), true);
  controller.dispose();
  for (const error of [new LibraryError(409, 'upload_unverified', undefined, true), new LibraryError(502, 'invalid_response'), new LibraryError(0, 'outcome_unknown')]) {
    let posts = 0;
    const retained = await selected(fake({ transcriptions: async () => [], startTranscription: async () => { posts++; throw error; } }));
    await retained.startTranscription(); await retained.startTranscription(); assert.equal(posts, 1); assert.equal(retained.isLocked(), true); retained.dispose();
  }
});

test('known operation recovery uses GET only, checks exact identity and can recover a scoped answer', async () => {
  let posts = 0, reads = 0;
  const controller = await selected(fake({ ask: async () => { posts++; throw new LibraryError(503, 'request_failed', op('ask', 'uncertain'), true); },
    operation: async (id, signal, recordingId) => { reads++; assert.equal(id, 'op_ask'); assert.equal(recordingId, 'rec_one'); assert.equal(signal.aborted, false);
      return { operation: op(), answer: 'Recovered answer', citations: [{ recording_id: recordingId, start_ms: 0 }] }; } }));
  controller.setTab('Ask'); await flush(); controller.setQuestion('Next?'); await controller.ask(); await controller.refreshRequest();
  assert.equal(controller.snapshot().answer, 'Recovered answer'); await controller.ask(); assert.equal(posts, 1); assert.equal(reads, 1); controller.dispose();
});

test('mismatched recovered operation preserves known metadata and never unlocks the mutation', async () => {
  const controller = await selected(fake({ operation: async () => ({ operation: { ...op(), id: 'op_other' } }) }));
  controller.setTab('Ask'); await flush(); controller.setQuestion('Next?'); await controller.ask(); await controller.refreshRequest();
  assert.equal(controller.snapshot().request.operation.id, 'op_ask'); assert.equal(controller.isLocked(), true); assert.match(controller.snapshot().request.error, /verified/); controller.dispose();
});

test('saved-request panel reads expose metadata without leaking recovered answer content', async () => {
  const controller = new RecordingsController(fake({ operations: async () => [op()], operation: async () => ({ operation: op(), answer: 'private content', citations: [] }) }));
  await controller.refreshOperations(); await controller.refreshOperations('op_ask');
  assert.equal(controller.snapshot().operations[0].id, 'op_ask'); assert.equal(controller.snapshot().answer, null); controller.dispose();
});

test('disposal aborts reads and mutations, clears account content and fences late resolutions', async () => {
  const pending = deferred(); let signal, disposed = 0;
  const controller = await selected(fake({ ask: async (_id, _question, pendingSignal) => { signal = pendingSignal; return pending.promise; }, dispose: () => { disposed++; } }));
  controller.setTab('Ask'); await flush(); controller.setQuestion('Private question'); const asking = controller.ask();
  controller.dispose(); assert.equal(signal.aborted, true); assert.equal(disposed, 1);
  pending.resolve({ operation: op(), answer: 'Private answer', citations: [] }); await asking;
  assert.equal(controller.snapshot().selected, null); assert.equal(controller.snapshot().question, ''); assert.equal(controller.snapshot().answer, null); assert.deepEqual(controller.snapshot().operations, []);
});

test('completed-source and upload-readiness gates prevent unrelated processing writes', async () => {
  let posts = 0;
  const controller = await selected(fake({ detail: async () => ({ ...rec(), upload_verified: false }), transcriptions: async () => [],
    startTranscription: async () => { posts++; }, startSummary: async () => { posts++; }, ask: async () => { posts++; } }));
  await controller.startTranscription(); controller.setTab('Summary'); await flush(); await controller.startSummary();
  controller.setTab('Ask'); await flush(); controller.setQuestion('Next?'); await controller.ask();
  assert.equal(posts, 0); controller.dispose();
});

test('explicit pagination rejects overlap and a repeating next cursor', async () => {
  const controller = new RecordingsController(fake({ list: async cursor => cursor ? { data: [rec()], has_more: true, next_cursor: cursor } : { data: [rec()], has_more: true, next_cursor: 'page2' } }));
  await controller.refreshLibrary(); await controller.refreshLibrary(true);
  assert.equal(controller.snapshot().recordings.length, 1); assert.match(controller.snapshot().listError, /verified/); controller.dispose();
});
