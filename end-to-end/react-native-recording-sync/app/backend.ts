export type BackendContext = {
  deviceId: string;
  serialNumber: string;
  bindingGeneration: number;
  endUserId: string;
  projectId: string;
};

export type Transcription = {
  id: string;
  recordingId: string;
  status: string;
  text?: string;
};

export function backendOrigin(input: string): string {
  const url = new URL(input);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Enter a backend origin without a path or credentials.');
  }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('HTTPS is required except for loopback development.');
  }
  return url.origin;
}

export async function backendRequest<T>(
  origin: string, token: string, path: string, method = 'GET', signal?: AbortSignal,
  bindingGeneration?: number,
): Promise<T> {
  if (!path.startsWith('/api/') || path.includes('..')) throw new Error('Invalid backend path.');
  if (!token || /[\r\n]/.test(token)) throw new Error('Enter the separate application token.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 30_000);
  try {
    if (signal?.aborted) controller.abort();
    const response = await fetch(`${backendOrigin(origin)}${path}`, {
      method, headers: {
        Authorization: `Bearer ${token}`,
        ...(bindingGeneration === undefined ? {} : {'X-Bota-Binding-Generation': String(bindingGeneration)}),
      },
      redirect: 'error', signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Backend request failed (${response.status}). Check the server setup or retained operation.`);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Backend request failed')) throw error;
    throw new Error('Backend request interrupted. Reconcile the existing operation before retrying.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function validateContext(value: BackendContext): BackendContext {
  if (!value || !/^dev_[A-Za-z0-9]+$/.test(value.deviceId) ||
      !/^eu_[A-Za-z0-9]+$/.test(value.endUserId) || !value.projectId ||
      !/^[A-Za-z0-9]{4,64}$/.test(value.serialNumber) ||
      !Number.isSafeInteger(value.bindingGeneration) || value.bindingGeneration < 1) {
    throw new Error('Backend returned an invalid device scope.');
  }
  return value;
}
