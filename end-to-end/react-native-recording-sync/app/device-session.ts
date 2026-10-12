type Cleanup = { disposeHost: () => Promise<void>; destroySdk: () => Promise<void> };

/** One native upload host and SDK owner exist per app process. New screens wait for the old owner. */
export class DeviceSessionGate {
  private barrier: Promise<void> = Promise.resolve();
  create(cleanup: Cleanup) { return new DeviceSession(this, cleanup); }
  register(closed: Promise<void>) {
    const previous = this.barrier;
    this.barrier = previous.then(() => closed);
    void this.barrier.catch(() => {});
    return previous;
  }
}

class DeviceSession {
  private readonly gate: DeviceSessionGate;
  private readonly cleanup: Cleanup;
  private readonly closed: Promise<void>;
  private resolveClosed!: () => void;
  private rejectClosed!: (error: unknown) => void;
  private previous: Promise<void> | null = null;
  private pending = new Set<Promise<void>>();
  private entered = false;
  private retired = false;
  private closing: Promise<void> | null = null;
  constructor(gate: DeviceSessionGate, cleanup: Cleanup) {
    this.gate = gate; this.cleanup = cleanup;
    this.closed = new Promise((resolve, reject) => { this.resolveClosed = resolve; this.rejectClosed = reject; });
    void this.closed.catch(() => {});
  }
  run(action: () => Promise<void>) {
    if (this.retired) return Promise.reject(new Error('Device session ended.'));
    // Register on an explicit action, never during a possibly abandoned React render.
    this.previous ??= this.gate.register(this.closed);
    const work = (async () => {
      await this.previous;
      if (this.retired) throw new Error('Device session ended.');
      this.entered = true;
      await action();
    })();
    this.pending.add(work);
    void work.then(() => this.pending.delete(work), () => this.pending.delete(work));
    return work;
  }
  close() {
    if (this.closing) return this.closing;
    this.retired = true;
    // Start cancellation, but do not release ownership while configure/action finally blocks can still write.
    const cancellation = this.entered ? Promise.resolve().then(this.cleanup.disposeHost).catch(() => {}) : Promise.resolve();
    this.closing = (async () => {
      try {
        await Promise.allSettled([...this.pending]);
        await cancellation;
        await this.previous;
        if (this.entered) {
          try { await this.cleanup.disposeHost(); }
          finally { await this.cleanup.destroySdk(); }
        }
        this.resolveClosed();
      } catch (error) {
        // A failed final cleanup blocks later owners until the app process is restarted.
        this.rejectClosed(error);
        throw error;
      }
    })();
    return this.closing;
  }
}

// This module is reachable only through the live Device screen.
export const deviceSessions = new DeviceSessionGate();
