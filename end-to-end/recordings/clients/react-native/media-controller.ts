import { LibraryError, safeMessage, validateAudioImport, type AudioImport, type LibraryApi, type Operation } from './library-api.ts';

export type PickedAudio = AudioImport & { remove(): Promise<void> };
export type LocalPlayer = { play(): void | Promise<void>; pause(): void; release(): Promise<void> };
export interface MediaPorts {
  pick(): Promise<PickedAudio | null>;
  player(bytes: Uint8Array, signal: AbortSignal, onFailure: () => void): Promise<LocalPlayer>;
}
export type MediaState = { selected: string | null; loading: boolean; ready: boolean; error: string; importing: boolean; importLocked: boolean; canImportAnother: boolean; importError: string; operation?: Operation };
const initial = (): MediaState => ({ selected: null, loading: false, ready: false, error: '', importing: false, importLocked: false, canImportAnother: false, importError: '' });

/** Per-account ephemeral media. The backend retains durable upload intents. */
export class MediaController {
  private state = initial();
  private listeners = new Set<() => void>();
  private revision = 0;
  private disposed = false;
  private read: AbortController | null = null;
  private upload: AbortController | null = null;
  private active: LocalPlayer | null = null;
  private cleanup = Promise.resolve();
  private loadTail = Promise.resolve();
  private cleanupFailed = false;
  private pending = new Set<Promise<void>>();
  private api: LibraryApi;
  private ports: MediaPorts;
  constructor(api: LibraryApi, ports: MediaPorts) { this.api = api; this.ports = ports; }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<MediaState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener();
  }
  private retire(player: LocalPlayer | null) {
    if (!player) return;
    // Stop immediately before asynchronous file deletion; cleanup errors block replacement.
    try { player.pause(); } catch { this.cleanupFailed = true; }
    this.cleanup = this.cleanup.then(() => player.release()).catch(() => { this.cleanupFailed = true; });
  }
  select(id: string | null) {
    this.revision++; this.read?.abort(); this.read = null;
    this.retire(this.active); this.active = null;
    this.update({ selected: id, ready: false, loading: false, error: this.cleanupFailed ? safeMessage(new LibraryError(0, 'cleanup_failed')) : '' });
  }
  private track(work: Promise<void>) { this.pending.add(work); void work.finally(() => this.pending.delete(work)); return work; }
  load() {
    if (this.disposed || this.state.loading || !this.state.selected) return Promise.resolve();
    const work = this.loadAudio(this.loadTail); this.loadTail = work.catch(() => {});
    return this.track(work);
  }
  private async loadAudio(previous: Promise<void>) {
    const id = this.state.selected;
    if (!id || this.disposed || this.state.loading) return;
    this.select(id); const revision = this.revision;
    const read = new AbortController(); this.read = read;
    this.update({ loading: true, error: '' });
    let player: LocalPlayer | null = null;
    try {
      await previous;
      await this.cleanup;
      if (this.cleanupFailed) throw new LibraryError(0, 'cleanup_failed');
      if (this.disposed || revision !== this.revision) return;
      const bytes = await this.api.audio(id, read.signal);
      if (this.disposed || revision !== this.revision) return;
      let failed = false;
      const onFailure = () => {
        failed = true;
        if (this.disposed || revision !== this.revision) return;
        this.retire(this.active); this.active = null;
        this.update({ loading: false, ready: false, error: safeMessage(new LibraryError(0, 'playback_failed')) });
      };
      player = await this.ports.player(bytes, read.signal, onFailure);
      if (failed || this.disposed || revision !== this.revision) { this.retire(player); player = null; await this.cleanup; return; }
      this.active = player; player = null;
      this.update({ loading: false, ready: true }); // Loading never starts playback.
    } catch (error) {
      if (error instanceof LibraryError && error.code === 'cleanup_failed') this.cleanupFailed = true;
      if (!this.disposed && revision === this.revision) this.update({ loading: false, ready: false, error: safeMessage(error) });
    } finally { if (player) this.retire(player); if (this.read === read) this.read = null; }
  }
  async play() {
    const revision = this.revision;
    if (!this.disposed && this.state.ready) { try { await this.active?.play(); } catch { if (revision === this.revision) this.update({ error: 'Audio could not play. Reload it before trying again.' }); } }
  }
  pause() { try { this.active?.pause(); } catch { this.update({ error: 'Audio could not pause. Return to the library to release it.' }); } }
  importAudio() { return this.track(this.importFile()); }
  private async importFile() {
    if (this.disposed || this.cleanupFailed || this.state.importing || this.state.importLocked) return;
    this.update({ importing: true, importError: '' });
    let picked: PickedAudio | null = null;
    try {
      picked = await this.ports.pick();
      if (!picked || this.disposed) return;
      validateAudioImport(picked);
      const upload = new AbortController(); this.upload = upload;
      // Lock before sending. Cancellation or an invalid response cannot prove no write occurred.
      this.update({ importLocked: true });
      const result = await this.api.upload(picked, upload.signal);
      if (!this.disposed) { this.update({ operation: result.operation }); await this.verifyUpload(result.operation); }
    } catch (error) {
      if (error instanceof LibraryError && error.code === 'cleanup_failed') { this.cleanupFailed = true; this.update({ importLocked: true }); }
      const operation = error instanceof LibraryError && error.operation?.kind === 'upload' ? error.operation : undefined;
      this.update({ importError: safeMessage(error), ...(operation ? { operation } : {}) });
    } finally {
      if (picked) { try { await picked.remove(); } catch { this.cleanupFailed = true; this.update({ importLocked: true, canImportAnother: false, importError: safeMessage(new LibraryError(0, 'cleanup_failed')) }); } }
      this.upload = null; this.update({ importing: false });
    }
  }
  refreshUpload() { return this.track(this.readUpload()); }
  private async readUpload() {
    const previous = this.state.operation;
    if (!previous || this.disposed || this.state.importing) return;
    this.update({ importing: true });
    try {
      const result = await this.api.operation(previous.id);
      if (result.operation.id !== previous.id || result.operation.kind !== 'upload') throw new LibraryError(502, 'invalid_response');
      this.update({ operation: result.operation, importError: '' });
      await this.verifyUpload(result.operation);
    } catch (error) { this.update({ importError: safeMessage(error) }); }
    finally { this.update({ importing: false }); }
  }
  private async verifyUpload(operation: Operation) {
    this.update({ canImportAnother: false });
    if (operation.kind !== 'upload' || operation.state !== 'complete' || !operation.resource_id?.startsWith('rec_')) return;
    const row = await this.api.detail(operation.resource_id);
    if (row.id !== operation.resource_id || !row.upload_verified) throw new LibraryError(502, 'invalid_response');
    this.update({ canImportAnother: !this.cleanupFailed });
  }
  anotherImport() {
    if (!this.disposed && !this.cleanupFailed && !this.state.importing && this.state.canImportAnother)
      this.update({ operation: undefined, importLocked: false, canImportAnother: false, importError: '' });
  }
  async dispose() {
    this.select(null); this.disposed = true; this.upload?.abort(); this.state = initial();
    for (const listener of this.listeners) listener(); this.listeners.clear();
    await Promise.allSettled([...this.pending]);
    await this.cleanup;
    if (this.cleanupFailed) throw new LibraryError(0, 'cleanup_failed');
  }
}
