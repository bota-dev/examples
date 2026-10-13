import { LibraryError, normalizeQuestion, operationMetadata, safeMessage, type AskResult, type Citation, type LibraryApi, type Operation, type Recording, type Summary, type Transcription } from './library-api.ts';

export type DetailTab = 'Transcript' | 'Summary' | 'Ask';
export type RequestState = { key: string; busy: boolean; error: string; operation?: Operation };
export type RecordingState = {
  recordings: Recording[]; listLoading: boolean; listError: string; nextCursor: string | null;
  selected: Recording | null; tab: DetailTab; detailLoading: boolean; detailError: string;
  transcripts: Transcription[]; sourceId: string | null; summaries: Summary[];
  question: string; answer: string | null; citations: Citation[];
  operations: Operation[]; operationsLoading: boolean; operationsError: string;
  request: RequestState | null;
};
const initial = (): RecordingState => ({
  recordings: [], listLoading: false, listError: '', nextCursor: null,
  selected: null, tab: 'Transcript', detailLoading: false, detailError: '',
  transcripts: [], sourceId: null, summaries: [], question: '', answer: null, citations: [],
  operations: [], operationsLoading: false, operationsError: '', request: null,
});

/** Session-level locks survive screen changes. Source reads and visible content have separate fences. */
export class RecordingsController {
  private state = initial();
  private listeners = new Set<() => void>();
  private pending = new Set<AbortController>();
  private requests = new Map<string, RequestState>();
  private locked = new Set<string>();
  private disposed = false;
  private detailRevision = 0;
  private questionRevision = 0;
  private listRevision = 0;
  private operationsRevision = 0;
  private detailRead: AbortController | null = null;
  private listRead: AbortController | null = null;
  private operationRead: AbortController | null = null;
  private readonly api: LibraryApi;
  constructor(api: LibraryApi) { this.api = api; }

  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private key() {
    const row = this.state.selected;
    if (!row) return null;
    if (this.state.tab === 'Transcript') return `transcription:${row.id}`;
    if (this.state.tab === 'Summary') return this.state.sourceId ? `summary:${this.state.sourceId}` : null;
    return `ask:${row.id}:${JSON.stringify(this.state.question.trim())}`;
  }
  private update(patch: Partial<RecordingState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    const key = this.key();
    this.state = { ...this.state, request: key ? this.requests.get(key) ?? null : null };
    for (const listener of this.listeners) listener();
  }
  private begin() { const controller = new AbortController(); this.pending.add(controller); return controller; }
  private finish(controller: AbortController) { this.pending.delete(controller); }
  private current(revision: number) { return !this.disposed && revision === this.detailRevision; }
  private retireDetail() { this.detailRevision += 1; this.detailRead?.abort(); this.detailRead = null; }
  isLocked = () => { const key = this.key(); return !!key && this.locked.has(key); };

  async refreshLibrary(append = false) {
    if (this.disposed || (append && !this.state.nextCursor)) return;
    const cursor = append ? this.state.nextCursor! : undefined;
    const revision = ++this.listRevision;
    this.listRead?.abort(); const controller = this.begin(); this.listRead = controller;
    this.update({ listLoading: true, listError: '' });
    try {
      const page = await this.api.list(cursor, controller.signal);
      if (this.disposed || revision !== this.listRevision) return;
      const existing = append ? this.state.recordings : [];
      if (page.next_cursor === cursor || page.data.some(row => existing.some(old => old.id === row.id))) throw new LibraryError(502, 'invalid_response');
      this.update({ recordings: [...existing, ...page.data], nextCursor: page.next_cursor, listLoading: false });
    } catch (error) {
      if (!this.disposed && revision === this.listRevision) this.update({ listLoading: false, listError: safeMessage(error) });
    } finally { this.finish(controller); }
  }
  select(recording: Recording) {
    if (this.disposed) return;
    this.retireDetail();
    this.update({ selected: recording, tab: 'Transcript', transcripts: [], summaries: [], sourceId: null,
      question: '', answer: null, citations: [], detailError: '' });
    void this.refreshDetail();
  }
  back() {
    this.retireDetail(); this.update({ selected: null, detailLoading: false, detailError: '', transcripts: [],
      summaries: [], sourceId: null, question: '', answer: null, citations: [] });
  }
  setTab(tab: DetailTab) {
    this.retireDetail(); this.update({ tab, answer: null, citations: [], detailLoading: false });
    void this.refreshDetail();
  }
  setQuestion(question: string) { this.questionRevision += 1; this.update({ question, answer: null, citations: [] }); }
  async refreshDetail(sourceId = this.state.sourceId) {
    const selected = this.state.selected;
    if (!selected || this.disposed) return;
    this.retireDetail(); const revision = this.detailRevision;
    const controller = this.begin(); this.detailRead = controller;
    this.update({ detailLoading: true, detailError: '', transcripts: [], summaries: [], sourceId: null });
    try {
      const [row, transcripts] = await Promise.all([
        this.api.detail(selected.id, controller.signal), this.api.transcriptions(selected.id, controller.signal),
      ]);
      if (!this.current(revision)) return;
      const completed = transcripts.filter(item => item.status === 'completed');
      const source = completed.find(item => item.id === sourceId)?.id ?? completed[0]?.id ?? null;
      const summaries = source && this.state.tab === 'Summary' ? await this.api.summaries(source, selected.id, controller.signal) : [];
      if (!this.current(revision)) return;
      this.update({ selected: row, transcripts, sourceId: source, summaries, detailLoading: false });
    } catch (error) {
      if (this.current(revision)) this.update({ detailLoading: false, detailError: safeMessage(error) });
    } finally { this.finish(controller); }
  }
  async chooseSource(id: string) {
    if (!this.state.transcripts.some(row => row.id === id && row.status === 'completed')) return;
    await this.refreshDetail(id);
  }
  async startTranscription() {
    const row = this.state.selected;
    if (!row || !row.upload_verified || this.state.transcripts.length || this.state.detailLoading || this.state.detailError) return;
    await this.mutate(`transcription:${row.id}`, 'transcription', row.id, signal => this.api.startTranscription(row.id, signal));
  }
  async startSummary() {
    const sourceId = this.state.sourceId, row = this.state.selected;
    if (!row || !sourceId || this.state.summaries.length || this.state.detailLoading || this.state.detailError) return;
    await this.mutate(`summary:${sourceId}`, 'summary', row.id, signal => this.api.startSummary(sourceId, signal));
  }
  async ask() {
    const row = this.state.selected;
    if (!row || !this.state.sourceId || this.state.detailLoading || this.state.detailError) return;
    let question: string;
    try { question = normalizeQuestion(this.state.question); }
    catch (error) { const key = this.key(); if (key) this.record(key, { key, busy: false, error: safeMessage(error) }); return; }
    const key = `ask:${row.id}:${JSON.stringify(question)}`;
    await this.mutate(key, 'ask', row.id, signal => this.api.ask(row.id, question, signal));
  }
  private record(key: string, value: RequestState) {
    this.requests.set(key, value);
    if (value.operation) this.update({ operations: [value.operation, ...this.state.operations.filter(row => row.id !== value.operation!.id)] });
    else this.update({});
  }
  private async mutate(key: string, kind: string, recordingId: string, action: (signal: AbortSignal) => Promise<AskResult>) {
    if (this.disposed || this.locked.has(key)) return;
    this.locked.add(key); const revision = this.detailRevision, questionRevision = this.questionRevision; const controller = this.begin();
    this.record(key, { key, busy: true, error: '' });
    try {
      const result = await action(controller.signal);
      if (this.disposed) return;
      const operation = operationMetadata(result.operation);
      if (!operation || operation.kind !== kind) throw new LibraryError(502, 'invalid_response');
      this.record(key, { key, busy: false, error: '', operation });
      if (this.current(revision) && questionRevision === this.questionRevision && this.state.selected?.id === recordingId && this.key() === key && result.answer !== undefined) {
        this.update({ answer: result.answer, citations: result.citations ?? [] });
      }
    } catch (error) {
      if (this.disposed) return;
      const known = error instanceof LibraryError && error.operation?.kind === kind ? error.operation : undefined;
      const preclaimReadiness = error instanceof LibraryError && error.status === 409 && !error.operationPresent && !error.operation &&
        ((kind === 'transcription' && error.code === 'upload_unverified') || (kind === 'summary' && error.code === 'transcription_incomplete'));
      if (preclaimReadiness) this.locked.delete(key);
      this.record(key, { key, busy: false, error: safeMessage(error), ...(known ? { operation: known } : {}) });
    } finally { this.finish(controller); }
  }
  async refreshRequest() {
    const key = this.key(); const known = key ? this.requests.get(key) : undefined;
    if (!key || !known?.operation || known.busy || this.disposed) return;
    const previous = known.operation, revision = this.detailRevision, questionRevision = this.questionRevision;
    const recordingId = previous.kind === 'ask' ? this.state.selected?.id : undefined;
    const controller = this.begin(); this.record(key, { ...known, busy: true, error: '' });
    try {
      const result = await this.api.operation(previous.id, controller.signal, recordingId);
      if (this.disposed) return;
      if (result.operation.id !== previous.id || result.operation.kind !== previous.kind) throw new LibraryError(502, 'invalid_response');
      this.record(key, { key, busy: false, error: '', operation: result.operation });
      if (this.current(revision) && questionRevision === this.questionRevision && this.key() === key && result.answer !== undefined) this.update({ answer: result.answer, citations: result.citations ?? [] });
    } catch (error) {
      if (!this.disposed) this.record(key, { key, busy: false, error: safeMessage(error), operation: previous });
    } finally { this.finish(controller); }
  }
  async refreshOperations(id?: string) {
    if (this.disposed) return;
    const revision = ++this.operationsRevision;
    this.operationRead?.abort(); const controller = this.begin(); this.operationRead = controller;
    this.update({ operationsLoading: true, operationsError: '' });
    try {
      const rows = id ? [(await this.api.operation(id, controller.signal)).operation] : await this.api.operations(controller.signal);
      if (this.disposed || revision !== this.operationsRevision) return;
      this.update({ operationsLoading: false, operations: id ? this.state.operations.map(row => row.id === id ? rows[0] : row) : rows });
    } catch (error) {
      if (!this.disposed && revision === this.operationsRevision) this.update({ operationsLoading: false, operationsError: safeMessage(error) });
    } finally { this.finish(controller); }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.detailRevision += 1; this.listRevision += 1; this.operationsRevision += 1;
    for (const controller of this.pending) controller.abort();
    this.pending.clear(); this.requests.clear(); this.locked.clear(); this.api.dispose(); this.state = initial();
    for (const listener of this.listeners) listener();
    this.listeners.clear();
  }
}
