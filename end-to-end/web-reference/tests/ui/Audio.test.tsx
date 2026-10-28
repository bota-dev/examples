import { Blob as NodeBlob } from 'node:buffer';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../web/App';
import { createApi } from '../../web/api';

const recording = {
  id: 'rec_audio',
  name: 'Audio example',
  status: 'uploaded',
  created_at: '2026-10-14T10:00:00Z',
  duration_seconds: 1,
  upload_verified: true,
};
const next = { ...recording, id: 'rec_next', name: 'Next recording' };
const bytes = new Uint8Array([82, 73, 70, 70]);
const createUrl = vi.fn(() => 'blob:ephemeral-audio');
const revokeUrl = vi.fn();

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function wav(body: BodyInit = bytes) {
  return new Response(body, { headers: { 'Content-Type': 'audio/wav' } });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
type Handler = (path: string, init: RequestInit) => Response | Promise<Response> | undefined;
function server(handler: Handler, mode: 'demo' | 'live' = 'demo') {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit) => {
    const path = String(input);
    const custom = handler(path, init);
    if (custom) return custom;
    if (path === '/api/me') return json({ user: { username: 'sample' }, mode });
    if (path === '/api/logout') return json({ ok: true });
    if (path === '/api/recordings')
      return json({ data: [recording, next], has_more: false, next_cursor: null });
    if (path === `/api/recordings/${recording.id}`) return json(recording);
    if (path === `/api/recordings/${next.id}`) return json(next);
    if (path.endsWith('/transcriptions') || path === '/api/operations' || path === '/api/events')
      return json({ data: [] });
    throw new Error(`Unexpected mock read: ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
async function select(name = recording.name) {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
  await screen.findByRole('button', { name: 'Load audio' });
}

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob);
  createUrl.mockClear();
  revokeUrl.mockClear();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(createUrl);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeUrl);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('bounded application audio reads', () => {
  it('uses only the selected same-origin cookie endpoint and returns complete audio bytes', async () => {
    const fetchMock = vi.fn(async () => wav());
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const blob = await createApi(vi.fn()).audio('rec_selected', controller.signal);
    expect(blob.type).toBe('audio/wav');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
    expect(fetchMock).toHaveBeenCalledWith('/api/recordings/rec_selected/audio', {
      credentials: 'same-origin',
      redirect: 'error',
      signal: controller.signal,
    });
  });

  it.each<{ headers: Record<string, string>; body: Uint8Array<ArrayBuffer> }>([
    { headers: { 'Content-Type': 'audio/mpeg' }, body: bytes },
    {
      headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(25 * 1024 * 1024 + 1) },
      body: bytes,
    },
    { headers: { 'Content-Type': 'audio/wav', 'Content-Length': '5' }, body: bytes },
    { headers: { 'Content-Type': 'audio/wav' }, body: new Uint8Array() },
  ])(
    'refuses unsupported, oversized, incomplete or empty representations: $headers',
    async ({ headers, body }) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(body, { headers })),
      );
      await expect(createApi(vi.fn()).audio(recording.id)).rejects.toMatchObject({
        name: 'ApiError',
      });
      expect(createUrl).not.toHaveBeenCalled();
    },
  );

  it('bounds chunked bytes even without Content-Length and cancels the body', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(25 * 1024 * 1024 + 1));
      },
      cancel,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => wav(body)),
    );
    await expect(createApi(vi.fn()).audio(recording.id)).rejects.toMatchObject({
      code: 'audio_too_large',
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('cancels a pending body read and rejects after abort without creating media', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => wav(body)),
    );
    const controller = new AbortController();
    const read = createApi(vi.fn()).audio(recording.id, controller.signal);
    await Promise.resolve();
    controller.abort();
    await expect(read).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('expires the current session on audio 401 and keeps its readable error', async () => {
    const expired = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({ error: { code: 'session_expired', message: 'Sign in again.' } }, 401),
      ),
    );
    await expect(createApi(expired).audio(recording.id)).rejects.toMatchObject({
      status: 401,
      message: 'Sign in again.',
    });
    expect(expired).toHaveBeenCalledOnce();
  });
});

describe('ordinary recording playback', () => {
  it('loads only after a click, labels synthetic audio, uses native controls and never auto-plays', async () => {
    const fetchMock = server((path) => (path.endsWith('/audio') ? wav() : undefined));
    render(<App />);
    await select();
    expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith('/audio'))).toBe(false);
    expect(
      screen.getByText('Synthetic WAV tone. It does not match the example transcript.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load audio' }));
    await screen.findByRole('button', { name: 'Reload audio' });
    const player = screen.getByLabelText('Recording playback') as HTMLAudioElement;
    expect(player.controls).toBe(true);
    expect(player.autoplay).toBe(false);
    expect(player.getAttribute('src')).toBe('blob:ephemeral-audio');
    expect(player.preload).toBe('none');
    expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/audio'))).toHaveLength(
      1,
    );
  });

  it.each(['selection', 'logout', 'unmount', 'refresh'])(
    'stops playback and revokes its ephemeral URL on %s',
    async (destination) => {
      server((path) => (path.endsWith('/audio') ? wav() : undefined));
      const view = render(<App />);
      await select();
      fireEvent.click(screen.getByRole('button', { name: 'Load audio' }));
      await screen.findByRole('button', { name: 'Reload audio' });
      const player = screen.getByLabelText('Recording playback') as HTMLAudioElement;
      if (destination === 'selection') await select(next.name);
      else if (destination === 'logout')
        fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
      else if (destination === 'refresh')
        fireEvent.click(screen.getByRole('button', { name: 'Refresh recording' }));
      else view.unmount();
      await waitFor(() => expect(revokeUrl).toHaveBeenCalledWith('blob:ephemeral-audio'));
      expect(player.pause).toHaveBeenCalled();
      expect(player.load).toHaveBeenCalled();
      expect(player.hasAttribute('src')).toBe(false);
      expect(revokeUrl).toHaveBeenCalledOnce();
    },
  );

  it.each(['selection', 'logout', 'refresh'])(
    'aborts and ignores late audio after %s',
    async (destination) => {
      const pending = deferred<Response>();
      const fetchMock = server((path) => (path.endsWith('/audio') ? pending.promise : undefined));
      render(<App />);
      await select();
      fireEvent.click(screen.getByRole('button', { name: 'Load audio' }));
      if (destination === 'selection') await select(next.name);
      else
        fireEvent.click(
          screen.getByRole('button', {
            name: destination === 'logout' ? 'Sign out' : 'Refresh recording',
          }),
        );
      const request = fetchMock.mock.calls.find(([path]) => String(path).endsWith('/audio'))!;
      expect(request[1].signal?.aborted).toBe(true);
      await act(async () => pending.resolve(wav()));
      expect(createUrl).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Reload audio' })).toBeNull();
    },
  );

  it('keeps unavailable audio readable and permits only an explicit retry', async () => {
    let reads = 0;
    const fetchMock = server((path) => {
      if (!path.endsWith('/audio')) return;
      reads += 1;
      return reads === 1
        ? json(
            {
              error: {
                code: 'audio_unavailable',
                message: 'Encrypted audio is unavailable for playback.',
              },
            },
            409,
          )
        : wav();
    }, 'live');
    render(<App />);
    await select();
    expect(screen.queryByText(/Synthetic WAV tone/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Load audio' }));
    await screen.findByText('Encrypted audio is unavailable for playback.');
    expect(reads).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Load audio' }));
    await screen.findByRole('button', { name: 'Reload audio' });
    expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/audio'))).toHaveLength(
      2,
    );
  });

  it('clears media and restores a manual load action after a browser decoder error', async () => {
    server((path) => (path.endsWith('/audio') ? wav() : undefined));
    render(<App />);
    await select();
    fireEvent.click(screen.getByRole('button', { name: 'Load audio' }));
    await screen.findByRole('button', { name: 'Reload audio' });
    fireEvent.error(screen.getByLabelText('Recording playback'));
    await screen.findByText(/This browser could not play this audio/);
    expect(screen.getByRole('button', { name: 'Load audio' })).toBeTruthy();
    expect(revokeUrl).toHaveBeenCalledOnce();
    expect(
      (screen.getByLabelText('Recording playback') as HTMLAudioElement).hasAttribute('src'),
    ).toBe(false);
  });

  it('immediately clears signed-in content after an audio 401', async () => {
    server((path) =>
      path.endsWith('/audio')
        ? json({ error: { code: 'session_expired', message: 'Session expired.' } }, 401)
        : undefined,
    );
    render(<App />);
    await select();
    fireEvent.click(screen.getByRole('button', { name: 'Load audio' }));
    await screen.findByRole('button', { name: 'Open demo' });
    expect(screen.queryByLabelText('Recording playback')).toBeNull();
    expect(screen.queryByText(recording.name)).toBeNull();
    expect(createUrl).not.toHaveBeenCalled();
  });
});
