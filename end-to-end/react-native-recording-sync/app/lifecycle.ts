/** Cancelling a UI scope invalidates results before native teardown finishes. */
export class OperationScope {
  private revision = 0;
  private controller: AbortController | undefined;

  begin() {
    if (this.controller) throw new Error('Wait for the current operation to stop.');
    const controller = new AbortController();
    this.controller = controller;
    const revision = this.revision;
    return {
      signal: controller.signal,
      current: () => revision === this.revision && !controller.signal.aborted,
      finish: () => { if (this.controller === controller) this.controller = undefined; },
    };
  }

  invalidate() {
    this.revision += 1;
    this.controller?.abort();
  }
}

export function waitForPoll(signal: AbortSignal, milliseconds = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Cancelled')); return; }
    const abort = () => { clearTimeout(timer); reject(new Error('Cancelled')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    signal.addEventListener('abort', abort, {once: true});
  });
}

/** A half-configured native host must not poison the next authorization attempt. */
export async function configureNativeScope(
  configure: () => Promise<void>, initialize: () => Promise<void>,
  current: () => boolean, dispose: () => Promise<void>,
): Promise<boolean> {
  let committed = false;
  try {
    await configure();
    if (!current()) return false;
    await initialize();
    committed = current();
    return committed;
  } finally {
    if (!committed) await dispose();
  }
}
