import { LibraryError, normalizeQuestion, type LibraryApi, type Operation, type Recording, type Summary, type Transcription } from './library-api.ts';

// Explicit in-memory fixtures. No network, microphone, Bluetooth or SDK dependency.
export function createDemoLibrary(): LibraryApi {
  const records: Recording[] = [
    { id: 'rec_sample1', name: 'Project catch-up', status: 'uploaded', created_at: '2026-01-15T10:00:00.000Z', duration_seconds: 42, upload_verified: true },
    { id: 'rec_sample2', name: 'A quick voice note', status: 'uploaded', created_at: '2026-01-15T11:00:00.000Z', duration_seconds: 18, upload_verified: true },
  ];
  const transcriptText: Record<string, string> = {
    rec_sample1: 'Alex: We agreed to simplify the onboarding screen. Sam: I will share the draft on Friday. Alex: I will collect feedback before our next catch-up.',
    rec_sample2: 'Remember to send the revised onboarding draft on Friday and collect feedback before the next catch-up.',
  };
  const transcripts = new Map<string, Transcription[]>();
  transcripts.set('rec_sample1', [{ id: 'txn_sample1', recording_id: 'rec_sample1', status: 'completed', full_text: transcriptText.rec_sample1 }]);
  const summaries = new Map<string, Summary[]>();
  const operations = new Map<string, Operation>();
  const known = new Map<string, string>();
  let sequence = 0, disposed = false;
  const check = (signal?: AbortSignal) => {
    if (disposed || signal?.aborted) throw new LibraryError(0, 'outcome_unknown');
  };
  const find = (id: string) => {
    const row = records.find(item => item.id === id);
    if (!row) throw new LibraryError(404, 'not_found');
    return row;
  };
  function operation(key: string, kind: string, resourceId: string, state = 'submitted') {
    const existing = known.get(key);
    if (existing) return operations.get(existing)!;
    const result = { id: `sample_${++sequence}`, kind, state, resource_id: resourceId, updated_at: '2026-01-15T12:00:00.000Z' };
    known.set(key, result.id); operations.set(result.id, result);
    return result;
  }
  return {
    async list(_cursor, signal) { check(signal); return { data: records.map(row => ({ ...row })), has_more: false, next_cursor: null }; },
    async detail(id, signal) { check(signal); return { ...find(id) }; },
    async transcriptions(recordingId, signal) {
      check(signal); find(recordingId);
      // A manual refresh advances the synthetic job; no provider is invoked.
      return (transcripts.get(recordingId) ?? []).map(row => {
        row.status = 'completed'; row.full_text = transcriptText[recordingId];
        for (const op of operations.values()) if (op.resource_id === row.id) op.state = 'complete';
        return { ...row };
      });
    },
    async summaries(transcriptionId, recordingId, signal) {
      check(signal);
      const source = [...transcripts.values()].flat().find(row => row.id === transcriptionId);
      if (!source || source.recording_id !== recordingId) throw new LibraryError(404, 'not_found');
      return (summaries.get(transcriptionId) ?? []).map(row => {
        row.status = 'completed';
        row.output = {
          overview: 'The team agreed to simplify onboarding and review a draft.',
          key_points: ['Keep the onboarding screen simple.'],
          action_items: ['Sam: share the draft on Friday.', 'Alex: collect feedback before the next catch-up.'],
          participants: ['Alex', 'Sam'], decisions: ['Simplify the onboarding screen.'],
        };
        for (const op of operations.values()) if (op.resource_id === row.id) op.state = 'complete';
        return { ...row, output: { ...row.output, key_points: [...row.output.key_points], action_items: [...row.output.action_items], participants: [...row.output.participants], decisions: [...row.output.decisions] } };
      });
    },
    async startTranscription(recordingId, signal) {
      check(signal); find(recordingId);
      if (!transcripts.has(recordingId)) transcripts.set(recordingId, [{ id: 'txn_sample2', recording_id: recordingId, status: 'pending' }]);
      return { operation: { ...operation(`transcription:${recordingId}`, 'transcription', transcripts.get(recordingId)![0].id) } };
    },
    async startSummary(transcriptionId, signal) {
      check(signal);
      const source = [...transcripts.values()].flat().find(row => row.id === transcriptionId);
      if (!source || source.status !== 'completed') throw new LibraryError(409, 'transcription_incomplete');
      if (!summaries.has(transcriptionId)) summaries.set(transcriptionId, [{ id: `sum_sample${transcriptionId === 'txn_sample1' ? 1 : 2}`, transcription_id: transcriptionId, recording_id: source.recording_id, status: 'pending', template_id: 'tmpl_general_notes' }]);
      return { operation: { ...operation(`summary:${transcriptionId}`, 'summary', summaries.get(transcriptionId)![0].id) } };
    },
    async ask(recordingId, question, signal) {
      check(signal); find(recordingId); normalizeQuestion(question);
      if (!(transcripts.get(recordingId) ?? []).some(row => row.status === 'completed')) throw new LibraryError(409, 'transcription_incomplete');
      return {
        operation: { ...operation(`ask:${recordingId}:${question.trim()}`, 'ask', `as_sample${++sequence}`, 'complete') },
        answer: 'Sample answer: share the onboarding draft on Friday and collect feedback before the next catch-up. This fixed fixture is shown for every question; no AI request is made.',
        citations: [{ recording_id: recordingId, start_ms: 0 }],
      };
    },
    async operations(signal) { check(signal); return [...operations.values()].map(row => ({ ...row })); },
    async operation(id, signal) {
      check(signal); const row = operations.get(id);
      if (!row) throw new LibraryError(404, 'not_found');
      return { operation: { ...row } };
    },
    async upload() { throw new LibraryError(400, 'invalid_audio'); },
    async audio() { throw new LibraryError(400, 'playback_unavailable'); },
    dispose() { disposed = true; known.clear(); operations.clear(); transcripts.clear(); summaries.clear(); },
  };
}
