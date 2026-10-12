import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import App from '../../web/App';
import type { Operation, Recording } from '../../web/api';

const recordingA: Recording = {
  id: 'rec_workshop',
  name: 'Workshop notes',
  status: 'uploaded',
  created_at: '2026-10-12T10:00:00Z',
  duration_seconds: 125,
  upload_verified: true,
};
const recordingB: Recording = {
  ...recordingA,
  id: 'rec_walk',
  name: 'An afternoon walk',
  duration_seconds: 49,
};
const operation: Operation = {
  id: 'op_demo',
  kind: 'transcription',
  state: 'submitted',
  resource_id: 'txn_demo',
  updated_at: '2026-10-12T12:00:00Z',
};
const transcript = {
  id: 'txn_demo',
  recording_id: recordingA.id,
  status: 'completed',
  full_text: 'Private workshop transcript.',
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
type Handler = (path: string, init: RequestInit) => Response | Promise<Response> | undefined;
function mockServer(handler?: Handler, signedIn = true, mode: 'demo' | 'live' = 'demo') {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit) => {
    const path = String(input);
    const custom = handler?.(path, init);
    if (custom) return custom;
    if (path === '/api/me') return json({ user: signedIn ? { username: 'demo' } : null, mode });
    if (path === '/api/login')
      return json({ user: { username: mode === 'demo' ? 'demo' : 'alex' }, mode });
    if (path === '/api/logout') return json({ ok: true });
    if (path === '/api/recordings')
      return json({ data: [recordingA, recordingB], has_more: false, next_cursor: null });
    if (path === `/api/recordings/${recordingA.id}`) return json(recordingA);
    if (path === `/api/recordings/${recordingB.id}`) return json(recordingB);
    if (path.endsWith('/transcriptions') && (!init.method || init.method === 'GET'))
      return json({ data: [] });
    if (path.endsWith('/summaries') && (!init.method || init.method === 'GET'))
      return json({ data: [] });
    if (path === '/api/events' || path === '/api/operations') return json({ data: [] });
    throw new Error(`Unexpected mock request: ${init.method || 'GET'} ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
async function openRecording(name = 'Workshop notes') {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
  await screen.findByRole('heading', { name, level: 2 });
  await waitFor(() => expect(screen.queryByText('Reading transcription…')).toBeNull());
}
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('customer reference boundaries', () => {
  it('keeps processing failure and upload verification distinct in the library', async () => {
    mockServer((path) =>
      path === '/api/recordings'
        ? json({
            data: [
              { ...recordingA, status: 'failed' },
              { ...recordingB, status: 'processing', upload_verified: false },
            ],
            has_more: false,
            next_cursor: null,
          })
        : undefined,
    );
    render(<App />);
    await screen.findByRole('button', { name: /Workshop notes.*failed.*Upload verified/ });
    expect(
      screen.getByRole('button', { name: /An afternoon walk.*processing.*Verification pending/ }),
    ).toBeTruthy();
    expect(screen.queryByText('Ready')).toBeNull();
  });

  it('presents recording tasks without API documentation panels', async () => {
    const fetchMock = mockServer();
    render(<App />);
    await openRecording();
    expect(screen.getByRole('tab', { name: 'Transcript' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Summary' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Ask' })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Integration sample' })).toBeNull();
    expect(screen.queryByText(/(?:GET|POST) \/v1\//)).toBeNull();
    expect(screen.queryByRole('link', { name: /API documentation/ })).toBeNull();
    expect(screen.queryByText(recordingA.id)).toBeNull();
    expect(screen.getByText('Activity & request review').closest('details')?.open).toBe(false);
    expect(fetchMock.mock.calls.every(([, init]) => !init.method || init.method === 'GET')).toBe(
      true,
    );
  });

  it('returns to the library with focus and fences a late result without unlocking the attempt', async () => {
    const pending = deferred<Response>();
    const fetchMock = mockServer((path, init) =>
      path.endsWith('/transcriptions') && init.method === 'POST' ? pending.promise : undefined,
    );
    render(<App />);
    await openRecording();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Workshop notes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start transcription' }));
    fireEvent.click(screen.getByRole('button', { name: 'All recordings' }));
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: /Recordings/ }));
    await act(async () =>
      pending.resolve(json({ operation, private_text: 'Late private result' })),
    );
    expect(screen.queryByText('Late private result')).toBeNull();
    await openRecording();
    expect(
      (screen.getByRole('button', { name: 'Start transcription' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Start transcription' }));
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
  });

  it('starts only reads, and exposes the demo entry only after mode discovery', async () => {
    const fetchMock = mockServer(undefined, false);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open demo' }));
    await openRecording();
    expect(
      fetchMock.mock.calls
        .filter(([, init]) => init.method === 'POST')
        .map(([path]) => String(path)),
    ).toEqual(['/api/login']);
    expect(screen.getByRole('tab', { name: 'Transcript' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.queryByLabelText('Application access token')).toBeNull();
  });

  it('uses the ephemeral application token and clears it when login fails', async () => {
    const writeStorage = vi.spyOn(Storage.prototype, 'setItem');
    const fetchMock = mockServer(
      (path) =>
        path === '/api/login'
          ? json(
              { error: { code: 'invalid_login', message: 'Check your application credentials.' } },
              401,
            )
          : undefined,
      false,
      'live',
    );
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Username'), { target: { value: 'alex' } });
    fireEvent.change(screen.getByLabelText('Application access token'), {
      target: { value: 'opaque-app-credential' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Check your application credentials.');
    expect((screen.getByLabelText('Application access token') as HTMLInputElement).value).toBe('');
    const login = fetchMock.mock.calls.find(([path]) => path === '/api/login')!;
    expect(JSON.parse(login[1].body as string)).toEqual({
      username: 'alex',
      token: 'opaque-app-credential',
    });
    expect(login[1].credentials).toBe('same-origin');
    expect(login[1].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(writeStorage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Open demo' })).toBeNull();
  });

  it('does not send a Bota secret mistakenly entered into the application login', async () => {
    const fetchMock = mockServer(undefined, false, 'live');
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Username'), { target: { value: 'alex' } });
    fireEvent.change(screen.getByLabelText('Application access token'), {
      target: { value: 'sk_test_synthetic_example' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Use an application access token supplied by your app operator.');
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/login')).toBe(false);
    expect((screen.getByLabelText('Application access token') as HTMLInputElement).value).toBe('');
  });

  it('keeps failed mode discovery unavailable until a manual read refresh succeeds', async () => {
    let fail = true;
    const fetchMock = mockServer(
      (path) => (path === '/api/me' && fail ? Promise.reject(new Error('offline')) : undefined),
      false,
      'live',
    );
    render(<App />);
    await screen.findByRole('heading', { name: 'The app could not open.' });
    expect(screen.queryByRole('button', { name: 'Open demo' })).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(1);
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh application status' }));
    await screen.findByLabelText('Application access token');
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it('fences late content when a different recording is selected', async () => {
    const oldRead = deferred<Response>();
    const fetchMock = mockServer((path) => {
      if (path === `/api/recordings/${recordingA.id}/transcriptions`) return oldRead.promise;
      if (path === `/api/recordings/${recordingB.id}/transcriptions`)
        return json({
          data: [
            { ...transcript, recording_id: recordingB.id, full_text: 'Current walk transcript.' },
          ],
        });
      return undefined;
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Workshop notes/ }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([path]) =>
          String(path).endsWith(`${recordingA.id}/transcriptions`),
        ),
      ).toBe(true),
    );
    await openRecording('An afternoon walk');
    await screen.findByText('Current walk transcript.');
    await act(async () => oldRead.resolve(json({ data: [transcript] })));
    expect(screen.queryByText('Private workshop transcript.')).toBeNull();
    expect(screen.getByRole('heading', { name: 'An afternoon walk', level: 2 })).toBeTruthy();
  });

  it('sends one transcription despite repeated clicks and keeps uncertainty locked across tabs', async () => {
    const pending = deferred<Response>();
    const fetchMock = mockServer((path, init) =>
      path.endsWith('/transcriptions') && init.method === 'POST' ? pending.promise : undefined,
    );
    render(<App />);
    await openRecording();
    const start = screen.getByRole('button', { name: 'Start transcription' });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
    await act(async () => pending.reject(new Error('connection interrupted')));
    await screen.findByText('Review this request');
    fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Start transcription' }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Refresh transcription' }));
    await waitFor(() => expect(screen.queryByText('Reading transcription…')).toBeNull());
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
    expect(screen.getByText('Review this request')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Refresh request' })).toBeNull();
  });

  it('redacts all recording content on logout and ignores a late Ask result', async () => {
    const pending = deferred<Response>();
    const fetchMock = mockServer((path, init) => {
      if (path.endsWith('/transcriptions')) return json({ data: [transcript] });
      if (path.endsWith('/ask') && init.method === 'POST') return pending.promise;
      return undefined;
    });
    render(<App />);
    await openRecording();
    await screen.findByText('Private workshop transcript.');
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    await waitFor(() =>
      expect(screen.queryByText('Checking for a completed transcript…')).toBeNull(),
    );
    fireEvent.change(screen.getByLabelText('Your question'), {
      target: { value: 'What was our private decision?' },
    });
    const form = screen.getByLabelText('Your question').closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(
      fetchMock.mock.calls.filter(
        ([path, init]) => String(path).endsWith('/ask') && init.method === 'POST',
      ),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('button', { name: 'Open demo' });
    expect(screen.queryByText(/Workshop notes/)).toBeNull();
    expect(screen.queryByLabelText('Your question')).toBeNull();
    await act(async () =>
      pending.resolve(
        json({
          operation: { ...operation, kind: 'ask', state: 'complete' },
          answer: 'Late private answer',
          citations: [],
        }),
      ),
    );
    expect(screen.queryByText('Late private answer')).toBeNull();
    expect(screen.queryByText('Private workshop transcript.')).toBeNull();
  });

  it('clears content after a session-expired response and fences other pending reads', async () => {
    let expired = false;
    const pending = deferred<Response>();
    mockServer((path) => {
      if (path.endsWith('/transcriptions')) return json({ data: [transcript] });
      if (path === '/api/events') return pending.promise;
      if (path === `/api/recordings/${recordingA.id}` && expired)
        return json({ error: { code: 'session_expired', message: 'Session expired.' } }, 401);
      return undefined;
    });
    render(<App />);
    await openRecording();
    await screen.findByText('Private workshop transcript.');
    expired = true;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh recording' }));
    await screen.findByText('Your session expired. Sign in again to read your recordings.');
    expect(screen.queryByText('Private workshop transcript.')).toBeNull();
    await act(async () =>
      pending.resolve(
        json({
          data: [
            { id: 'evt_private', type: 'recording.uploaded', created_at: '2026-10-12T10:00:00Z' },
          ],
        }),
      ),
    );
    expect(screen.queryByText('evt_private')).toBeNull();
  });

  it('waits for the sign-out cookie response before allowing a new sign-in', async () => {
    const logout = deferred<Response>();
    let cookie = 'old-session';
    const fetchMock = mockServer((path) => {
      if (path === '/api/logout')
        return logout.promise.then((response) => {
          cookie = '';
          return response;
        });
      if (path === '/api/login') {
        cookie = 'new-session';
        return json({ user: { username: 'demo' }, mode: 'demo' });
      }
      return undefined;
    });
    render(<App />);
    await openRecording();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Signing out…' });
    expect(screen.queryByText(/Workshop notes/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open demo' })).toBeNull();
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/login')).toBe(false);
    await act(async () => logout.resolve(json({ ok: true })));
    expect(cookie).toBe('');
    fireEvent.click(await screen.findByRole('button', { name: 'Open demo' }));
    await screen.findByRole('button', { name: /Workshop notes/ });
    expect(cookie).toBe('new-session');
    expect(
      fetchMock.mock.calls.filter(([, init]) => init.method === 'POST').map(([path]) => path),
    ).toEqual(['/api/logout', '/api/login']);
  });

  it('clears content when sign-out fails and reports its unconfirmed server outcome', async () => {
    const logout = deferred<Response>();
    mockServer((path) => (path === '/api/logout' ? logout.promise : undefined));
    render(<App />);
    await openRecording();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Signing out…' });
    await act(async () => logout.reject(new Error('connection ended')));
    await screen.findByText(/The server could not confirm sign-out/);
    expect(screen.queryByText(/Workshop notes/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Open demo' })).toBeTruthy();
  });

  it('reconciles a saved request after reopening through one GET and keeps Activity metadata-only', async () => {
    const recovery = deferred<Response>();
    const saved = { ...operation, kind: 'ask', state: 'uncertain', resource_id: 'as_demo' };
    const fetchMock = mockServer((path) => {
      if (path === '/api/operations') return json({ data: [saved] });
      if (path === `/api/operations/${saved.id}`) return recovery.promise;
      return undefined;
    });
    render(<App />);
    fireEvent.click(await screen.findByText('Activity & request review'));
    const refresh = await screen.findByRole('button', { name: `Refresh ask request ${saved.id}` });
    fireEvent.click(refresh);
    fireEvent.click(refresh);
    expect(
      fetchMock.mock.calls.filter(([path]) => path === `/api/operations/${saved.id}`),
    ).toHaveLength(1);
    await act(async () =>
      recovery.resolve(
        json({
          operation: { ...saved, state: 'complete', updated_at: '2026-10-12T12:01:00Z' },
          answer: 'Private recovered content must remain hidden.',
          citations: [],
        }),
      ),
    );
    const requests = screen.getByRole('heading', { name: 'Recorded requests' }).closest('section')!;
    await waitFor(() => expect(within(requests).getByText('complete')).toBeTruthy());
    expect(screen.queryByText('Private recovered content must remain hidden.')).toBeNull();
    expect(fetchMock.mock.calls.some(([, init]) => init.method === 'POST')).toBe(false);
  });

  it('withholds foreign Activity recovery metadata and keeps an unknown resource uncertain', async () => {
    let foreign = true;
    const saved = { ...operation, state: 'uncertain', resource_id: null };
    const fetchMock = mockServer((path) => {
      if (path === '/api/operations') return json({ data: [saved] });
      if (path === `/api/operations/${saved.id}`)
        return json({
          operation: foreign ? { ...saved, id: 'op_foreign', state: 'complete' } : saved,
        });
      return undefined;
    });
    render(<App />);
    fireEvent.click(await screen.findByText('Activity & request review'));
    const refresh = await screen.findByRole('button', {
      name: `Refresh transcription request ${saved.id}`,
    });
    fireEvent.click(refresh);
    await screen.findByText('The refreshed request did not match the recorded request.');
    expect(screen.queryByText('op_foreign')).toBeNull();
    foreign = false;
    fireEvent.click(refresh);
    await waitFor(() =>
      expect(
        screen.queryByText('The refreshed request did not match the recorded request.'),
      ).toBeNull(),
    );
    expect(screen.getByText('Resource not confirmed')).toBeTruthy();
    expect(screen.getByText('uncertain')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init.method === 'POST')).toBe(false);
  });

  it('fences an Activity recovery after sign-out', async () => {
    const recovery = deferred<Response>();
    const saved = { ...operation, state: 'uncertain' };
    mockServer((path) => {
      if (path === '/api/operations') return json({ data: [saved] });
      if (path === `/api/operations/${saved.id}`) return recovery.promise;
      return undefined;
    });
    render(<App />);
    fireEvent.click(await screen.findByText('Activity & request review'));
    fireEvent.click(
      await screen.findByRole('button', { name: `Refresh transcription request ${saved.id}` }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('button', { name: 'Open demo' });
    await act(async () =>
      recovery.resolve(
        json({ operation: { ...saved, state: 'complete' }, answer: 'Late private content.' }),
      ),
    );
    expect(screen.queryByText(saved.id)).toBeNull();
    expect(screen.queryByText('Late private content.')).toBeNull();
  });

  it('uploads exact bytes and filename metadata once, without starting processing', async () => {
    const pending = deferred<Response>();
    const fetchMock = mockServer((path, init) =>
      path === '/api/uploads' && init.method === 'POST' ? pending.promise : undefined,
    );
    render(<App />);
    await screen.findByRole('button', { name: /Workshop notes/ });
    const file = new File(['synthetic audio bytes'], 'sample notes.wav', {
      type: 'audio/wav',
      lastModified: 1,
    });
    fireEvent.change(screen.getByLabelText(/Choose an audio file/), { target: { files: [file] } });
    const upload = screen.getByRole('button', { name: 'Upload audio' });
    await waitFor(() => expect((upload as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(upload);
    fireEvent.click(upload);
    const requests = fetchMock.mock.calls.filter(([, init]) => init.method === 'POST');
    expect(requests).toHaveLength(1);
    expect(requests[0][0]).toBe('/api/uploads');
    expect(requests[0][1].body).toBe(file);
    expect(requests[0][1].headers).toEqual({
      'Content-Type': 'audio/wav',
      'X-File-Name': 'sample%20notes.wav',
    });
    await act(async () =>
      pending.resolve(
        json({
          operation: {
            ...operation,
            kind: 'upload',
            state: 'verification_pending',
            resource_id: 'rec_uploaded',
          },
        }),
      ),
    );
    await screen.findByText('Review this request');
    expect(
      (screen.getByRole('button', { name: 'Upload audio' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
  });

  it('renders untrusted transcript text literally and refreshes activity using reads only', async () => {
    const maliciousText = '<img src=x onerror=alert(1)><script>private()</script>';
    const fetchMock = mockServer((path) =>
      path.endsWith('/transcriptions')
        ? json({ data: [{ ...transcript, full_text: maliciousText }] })
        : undefined,
    );
    const { container } = render(<App />);
    await openRecording();
    await screen.findByText(maliciousText);
    expect(container.querySelector('img, script')).toBeNull();
    fireEvent.click(screen.getByText('Activity & request review'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh activity' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([path]) => path === '/api/operations')).toHaveLength(2),
    );
    expect(fetchMock.mock.calls.some(([, init]) => init.method === 'POST')).toBe(false);
    const selected = screen.getByRole('tab', { name: 'Transcript' });
    selected.focus();
    fireEvent.keyDown(selected, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Summary' }));
  });

  it('starts general notes once and reads the structured result only on manual refresh', async () => {
    let requested = false;
    const pending = deferred<Response>();
    const output = {
      overview: 'Our prototype review.',
      key_points: ['Keep the scope small.'],
      action_items: ['Share the prototype.'],
      participants: ['Example participant'],
      decisions: ['Review on Friday.'],
    };
    const fetchMock = mockServer((path, init) => {
      if (path.endsWith('/transcriptions')) return json({ data: [transcript] });
      if (path.endsWith('/summaries') && init.method === 'POST') {
        requested = true;
        return pending.promise;
      }
      if (path.endsWith('/summaries'))
        return json({
          data: requested
            ? [
                {
                  id: 'sum_demo',
                  transcription_id: transcript.id,
                  status: 'completed',
                  template_id: 'tmpl_general_notes',
                  output,
                },
              ]
            : [],
        });
      return undefined;
    });
    render(<App />);
    await openRecording();
    fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
    const create = await screen.findByRole('button', { name: 'Create general notes' });
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(create);
    fireEvent.click(create);
    await act(async () =>
      pending.resolve(
        json({
          operation: { ...operation, kind: 'summary', state: 'complete', resource_id: 'sum_demo' },
        }),
      ),
    );
    await screen.findByText('Request completed');
    expect(screen.queryByText(output.overview)).toBeNull();
    expect(
      fetchMock.mock.calls.filter(
        ([path, init]) => String(path).endsWith('/summaries') && init.method === 'POST',
      ),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh notes' }));
    await screen.findByText(output.overview);
    expect(screen.getByText('Share the prototype.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Create general notes' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('renders one completed Ask answer with matching source timestamps', async () => {
    const answer = 'Share <the prototype> on Friday.';
    const fetchMock = mockServer((path, init) => {
      if (path.endsWith('/transcriptions')) return json({ data: [transcript] });
      if (path.endsWith('/ask') && init.method === 'POST')
        return json({
          operation: { ...operation, kind: 'ask', state: 'complete', resource_id: 'as_demo' },
          answer,
          citations: [{ recording_id: recordingA.id, start_ms: 75000 }],
        });
      return undefined;
    });
    render(<App />);
    await openRecording();
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    await waitFor(() =>
      expect(screen.queryByText('Checking for a completed transcript…')).toBeNull(),
    );
    fireEvent.change(screen.getByLabelText('Your question'), {
      target: { value: '  What happens next?  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask recording' }));
    await screen.findByText(answer);
    expect(screen.getByText(/This recording · 1:15/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Ask recording' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    const request = fetchMock.mock.calls.find(([path]) => String(path).endsWith('/ask'))!;
    expect(JSON.parse(request[1].body as string)).toEqual({ question: 'What happens next?' });
  });

  it('withholds a mismatched Ask citation and keeps its attempted question locked', async () => {
    const fetchMock = mockServer((path, init) => {
      if (path.endsWith('/transcriptions')) return json({ data: [transcript] });
      if (path.endsWith('/ask') && init.method === 'POST')
        return json({
          operation: { ...operation, kind: 'ask', state: 'complete' },
          answer: 'Foreign answer should stay hidden.',
          citations: [{ recording_id: recordingB.id, start_ms: 0 }],
        });
      return undefined;
    });
    render(<App />);
    await openRecording();
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    await waitFor(() =>
      expect(screen.queryByText('Checking for a completed transcript…')).toBeNull(),
    );
    fireEvent.change(screen.getByLabelText('Your question'), {
      target: { value: 'What happens next?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask recording' }));
    await screen.findByText(
      'The returned citations did not match this recording. Review this request.',
    );
    expect(screen.queryByText('Foreign answer should stay hidden.')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Ask recording' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/ask'))).toHaveLength(1);
  });

  it('distinguishes different audio bytes with identical metadata and keeps the same bytes locked', async () => {
    const fetchMock = mockServer((path) =>
      path === '/api/uploads'
        ? json({ operation: { ...operation, kind: 'upload', state: 'complete' } })
        : undefined,
    );
    render(<App />);
    await screen.findByRole('button', { name: /Workshop notes/ });
    const first = new File(['first'], 'same.wav', { type: 'audio/wav', lastModified: 1 });
    const second = new File(['other'], 'same.wav', { type: 'audio/wav', lastModified: 1 });
    fireEvent.change(screen.getByLabelText(/Choose an audio file/), { target: { files: [first] } });
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Upload audio' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Upload audio' }));
    await screen.findByText('Request completed');
    fireEvent.change(screen.getByLabelText('Choose an audio file'), {
      target: { files: [second] },
    });
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Upload audio' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Upload audio' }));
    await screen.findByText('Request completed');
    fireEvent.change(screen.getByLabelText('Choose an audio file'), {
      target: {
        files: [new File(['first'], 'same.wav', { type: 'audio/wav', lastModified: 999 })],
      },
    });
    await waitFor(() => expect(screen.queryByText('Identifying the selected file…')).toBeNull());
    expect(
      (screen.getByRole('button', { name: 'Upload audio' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/uploads')).toHaveLength(2);
  });

  it('recovers a known failed Ask through one manual GET, including after switching tabs', async () => {
    const recovery = deferred<Response>();
    const saved = { ...operation, kind: 'ask', state: 'uncertain', resource_id: 'as_demo' };
    const fetchMock = mockServer((path, init) => {
      if (path.endsWith('/transcriptions')) return json({ data: [transcript] });
      if (path.endsWith('/ask') && init.method === 'POST')
        return json(
          {
            error: { code: 'operation_uncertain', message: 'The saved request needs review.' },
            operation: saved,
          },
          502,
        );
      if (path === `/api/operations/${operation.id}`) return recovery.promise;
      return undefined;
    });
    render(<App />);
    await openRecording();
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    await waitFor(() =>
      expect(screen.queryByText('Checking for a completed transcript…')).toBeNull(),
    );
    fireEvent.change(screen.getByLabelText('Your question'), {
      target: { value: 'What happens next?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask recording' }));
    await screen.findByText('The saved request needs review.');
    expect(screen.getByRole('button', { name: 'Refresh request' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    fireEvent.change(screen.getByLabelText('Your question'), {
      target: { value: 'What happens next?' },
    });
    const refresh = await screen.findByRole('button', { name: 'Refresh request' });
    fireEvent.click(refresh);
    fireEvent.click(refresh);
    expect(
      fetchMock.mock.calls.filter(([path]) => path === `/api/operations/${operation.id}`),
    ).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
    await act(async () =>
      recovery.resolve(
        json({
          operation: { ...saved, state: 'complete' },
          answer: 'Recovered answer from the saved request.',
          citations: [{ recording_id: recordingA.id, start_ms: 12500 }],
        }),
      ),
    );
    await screen.findByText('Recovered answer from the saved request.');
    expect(screen.getByText(/This recording · 0:12/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Ask recording' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
  });

  it('clears a previous answer before recovery and withholds a foreign recovered citation', async () => {
    const saved = { ...operation, kind: 'ask', state: 'complete', resource_id: 'as_demo' };
    const recovery = deferred<Response>();
    mockServer((path, init) => {
      if (path.endsWith('/transcriptions')) return json({ data: [transcript] });
      if (path.endsWith('/ask') && init.method === 'POST')
        return json({ operation: saved, answer: 'Previous answer.', citations: [] });
      if (path === `/api/operations/${operation.id}`) return recovery.promise;
      return undefined;
    });
    render(<App />);
    await openRecording();
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    await waitFor(() =>
      expect(screen.queryByText('Checking for a completed transcript…')).toBeNull(),
    );
    fireEvent.change(screen.getByLabelText('Your question'), {
      target: { value: 'What happens next?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask recording' }));
    await screen.findByText('Previous answer.');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh request' }));
    expect(screen.queryByText('Previous answer.')).toBeNull();
    await act(async () =>
      recovery.resolve(
        json({
          operation: saved,
          answer: 'Foreign recovered answer.',
          citations: [{ recording_id: recordingB.id, start_ms: 0 }],
        }),
      ),
    );
    await screen.findByText(
      'The returned citations did not match this recording. Review this request.',
    );
    expect(screen.queryByText('Foreign recovered answer.')).toBeNull();
    expect(screen.queryByText('Previous answer.')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Ask recording' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it.each(['selection', 'logout'])(
    'fences a late request recovery after %s',
    async (destination) => {
      const recovery = deferred<Response>();
      const saved = { ...operation, kind: 'ask', state: 'uncertain', resource_id: 'as_demo' };
      mockServer((path, init) => {
        if (path.endsWith('/transcriptions')) return json({ data: [transcript] });
        if (path.endsWith('/ask') && init.method === 'POST')
          return json(
            {
              error: { code: 'operation_uncertain', message: 'The saved request needs review.' },
              operation: saved,
            },
            502,
          );
        if (path === `/api/operations/${operation.id}`) return recovery.promise;
        return undefined;
      });
      render(<App />);
      await openRecording();
      fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
      await waitFor(() =>
        expect(screen.queryByText('Checking for a completed transcript…')).toBeNull(),
      );
      fireEvent.change(screen.getByLabelText('Your question'), {
        target: { value: 'What happens next?' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Ask recording' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Refresh request' }));
      if (destination === 'selection') await openRecording('An afternoon walk');
      else {
        fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
        await screen.findByRole('button', { name: 'Open demo' });
      }
      await act(async () =>
        recovery.resolve(
          json({
            operation: { ...saved, state: 'complete' },
            answer: 'Late recovered private answer.',
            citations: [],
          }),
        ),
      );
      expect(screen.queryByText('Late recovered private answer.')).toBeNull();
    },
  );

  it.each([
    {
      kind: 'transcription',
      code: 'upload_unverified',
      tab: 'Transcript',
      action: 'Start transcription',
      refresh: 'Refresh recording',
      suffix: '/transcriptions',
    },
    {
      kind: 'summary',
      code: 'transcription_incomplete',
      tab: 'Summary',
      action: 'Create general notes',
      refresh: 'Refresh notes',
      suffix: '/summaries',
    },
  ])(
    'allows a manual $kind action after an explicit preclaim readiness rejection and read refresh',
    async (scenario) => {
      let attempts = 0;
      const fetchMock = mockServer((path, init) => {
        if (path.endsWith(scenario.suffix) && init.method === 'POST') {
          attempts += 1;
          return attempts === 1
            ? json(
                {
                  error: {
                    code: scenario.code,
                    message: 'Refresh source readiness before starting.',
                  },
                },
                409,
              )
            : json({ operation: { ...operation, kind: scenario.kind, state: 'complete' } });
        }
        if (scenario.kind === 'summary' && path.endsWith('/transcriptions'))
          return json({ data: [transcript] });
        return undefined;
      });
      render(<App />);
      await openRecording();
      fireEvent.click(screen.getByRole('tab', { name: scenario.tab }));
      const action = await screen.findByRole('button', { name: scenario.action });
      await waitFor(() => expect((action as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(action);
      await screen.findByText('Action not started');
      expect(screen.getByText('Refresh source readiness before starting.')).toBeTruthy();
      expect(
        (screen.getByRole('button', { name: scenario.action }) as HTMLButtonElement).disabled,
      ).toBe(false);
      expect(attempts).toBe(1);
      expect(screen.queryByRole('button', { name: 'Refresh request' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: scenario.refresh }));
      await waitFor(() =>
        expect(
          (screen.getByRole('button', { name: scenario.refresh }) as HTMLButtonElement).disabled,
        ).toBe(false),
      );
      expect(attempts).toBe(1);
      fireEvent.click(screen.getByRole('button', { name: scenario.action }));
      await screen.findByText('Request completed');
      expect(attempts).toBe(2);
      expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(2);
      expect(
        (screen.getByRole('button', { name: scenario.action }) as HTMLButtonElement).disabled,
      ).toBe(true);
    },
  );

  it.each([
    {
      label: 'a claimed readiness failure',
      status: 409,
      code: 'upload_unverified',
      metadata: { operation: { ...operation, state: 'uncertain' } },
    },
    {
      label: 'a malformed operation field',
      status: 409,
      code: 'upload_unverified',
      metadata: { operation: null },
    },
    { label: 'an arbitrary conflict', status: 409, code: 'operation_uncertain', metadata: {} },
    {
      label: 'a readiness code with the wrong status',
      status: 502,
      code: 'upload_unverified',
      metadata: {},
    },
    {
      label: 'a readiness code for a different action',
      status: 409,
      code: 'transcription_incomplete',
      metadata: {},
    },
  ])('keeps the write locked after $label', async (scenario) => {
    const fetchMock = mockServer((path, init) =>
      path.endsWith('/transcriptions') && init.method === 'POST'
        ? json(
            {
              error: { code: scenario.code, message: 'This outcome requires review.' },
              ...scenario.metadata,
            },
            scenario.status,
          )
        : undefined,
    );
    render(<App />);
    await openRecording();
    fireEvent.click(screen.getByRole('button', { name: 'Start transcription' }));
    await screen.findByText('Review this request');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh recording' }));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Refresh recording' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(
      (screen.getByRole('button', { name: 'Start transcription' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
  });
});
