export type Mode = 'demo' | 'live';
export interface Session {
  user: { username: string } | null;
  mode: Mode;
}
export interface Recording {
  id: string;
  name: string | null;
  status: string;
  created_at: string;
  duration_seconds: number | null;
  upload_verified: boolean;
}
export interface RecordingPage {
  data: Recording[];
  has_more: boolean;
  next_cursor: string | null;
}
export interface Transcription {
  id: string;
  recording_id: string;
  status: string;
  full_text?: string | null;
  created_at?: string | null;
}
export interface Summary {
  id: string;
  transcription_id: string;
  status: string;
  template_id: string;
  output?: {
    overview?: string;
    key_points?: string[];
    action_items?: string[];
    participants?: string[];
    decisions?: string[];
  } | null;
}
export interface Operation {
  id: string;
  kind: string;
  state: string;
  resource_id: string | null;
  updated_at: string;
}
export interface MutationResult {
  operation: Operation;
}
export interface UploadResult extends MutationResult {
  recording?: Recording;
}
export interface AskResult extends MutationResult {
  answer?: string;
  citations?: { recording_id: string; start_ms: number }[];
}
export interface ResourceEvent {
  id: string;
  type: string;
  created_at: string;
}
export interface Collection<T> {
  data: T[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public operation?: Operation,
    public operationPresent = operation !== undefined,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function operationMetadata(value: unknown): Operation | undefined {
  if (!value || typeof value !== 'object') return;
  const row = value as Record<string, unknown>;
  const states = [
    'claimed',
    'creating',
    'created',
    'uploading',
    'verifying',
    'verification_pending',
    'starting',
    'sending',
    'submitted',
    'complete',
    'uncertain',
  ];
  if (
    typeof row.id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(row.id) ||
    typeof row.kind !== 'string' ||
    !['upload', 'transcription', 'summary', 'ask'].includes(row.kind) ||
    typeof row.state !== 'string' ||
    !states.includes(row.state) ||
    !(
      row.resource_id === null ||
      (typeof row.resource_id === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(row.resource_id))
    ) ||
    typeof row.updated_at !== 'string' ||
    row.updated_at.length > 64 ||
    !Number.isFinite(Date.parse(row.updated_at))
  )
    return;
  return {
    id: row.id,
    kind: row.kind,
    state: row.state,
    resource_id: row.resource_id,
    updated_at: row.updated_at,
  };
}

export type ApiClient = ReturnType<typeof createApi>;

export function createApi(onExpired: () => void) {
  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!path.startsWith('/api/'))
      throw new ApiError(0, 'invalid_path', 'This request is unavailable.');
    let response: Response;
    try {
      response = await fetch(path, { ...options, credentials: 'same-origin', redirect: 'error' });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError(0, 'outcome_unknown', 'The connection ended before a response arrived.');
    }
    if (response.status === 401 && path !== '/api/login') onExpired();
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new ApiError(
        response.status,
        'invalid_response',
        'The server response could not be read.',
      );
    }
    if (!response.ok) {
      const body = value as { error?: { code?: unknown; message?: unknown }; operation?: unknown };
      const detail = body?.error;
      throw new ApiError(
        response.status,
        typeof detail?.code === 'string' ? detail.code : 'request_failed',
        typeof detail?.message === 'string'
          ? detail.message.slice(0, 300)
          : 'The request could not be completed.',
        operationMetadata(body?.operation),
        Boolean(body && typeof body === 'object' && Object.hasOwn(body, 'operation')),
      );
    }
    return value as T;
  }
  return {
    get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
    post: <T>(path: string, body: unknown, signal?: AbortSignal) =>
      request<T>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }),
    upload: (file: File, signal?: AbortSignal) =>
      request<UploadResult>('/api/uploads', {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) },
        body: file,
        signal,
      }),
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'The request could not be completed.';
}
