import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiClient, Mode, Operation, Recording, Session } from './api';
import { createApi, errorMessage } from './api';
import { dateLabel, durationLabel } from './format';
import { IntentContext, useRead } from './workflow';
import { Recordings } from './features/recordings/Recordings';
import { Upload } from './features/uploads/Upload';
import { Transcript } from './features/transcription/Transcript';
import { Summaries } from './features/summaries/Summaries';
import { Ask } from './features/ask/Ask';
import { Activity } from './features/webhooks/Activity';

interface AppSession extends Session {
  phase: 'loading' | 'unavailable' | 'signed-out' | 'signing-out' | 'signed-in';
  epoch: number;
}

export default function App() {
  const [session, setSession] = useState<AppSession>({
    user: null,
    mode: 'demo',
    phase: 'loading',
    epoch: 0,
  });
  const [notice, setNotice] = useState('');
  const [discoveryRevision, setDiscoveryRevision] = useState(0);
  const generation = useRef(0);
  const discoveryApi = useMemo(() => createApi(() => {}), []);
  const invalidate = useCallback(
    (message: string, phase: 'signed-out' | 'signing-out' = 'signed-out') => {
      generation.current += 1;
      setSession((previous) => ({ ...previous, user: null, phase, epoch: generation.current }));
      setNotice(message);
    },
    [],
  );
  const api = useMemo(() => {
    const expected = session.epoch;
    return createApi(() => {
      if (generation.current === expected)
        invalidate('Your session expired. Sign in again to read your recordings.');
    });
  }, [session.epoch, invalidate]);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void discoveryApi
      .get<Session>('/api/me', controller.signal)
      .then((value) => {
        if (current && generation.current === 0)
          setSession({ ...value, phase: value.user ? 'signed-in' : 'signed-out', epoch: 0 });
      })
      .catch((error) => {
        if (current && !controller.signal.aborted) {
          setNotice(errorMessage(error));
          setSession((previous) => ({ ...previous, phase: 'unavailable' }));
        }
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [discoveryApi, discoveryRevision]);
  const authenticate = (value: Session, expected: number) => {
    if (generation.current !== expected || !value.user) return;
    generation.current += 1;
    setNotice('');
    setSession({ ...value, phase: 'signed-in', epoch: generation.current });
  };
  const logout = () => {
    invalidate('Signing out. Your recording content has been cleared.', 'signing-out');
    const expected = generation.current;
    void api
      .post('/api/logout', {})
      .then(() => {
        if (generation.current === expected)
          setNotice('Signed out. Your recording content has been cleared.');
      })
      .catch(() => {
        if (generation.current === expected)
          setNotice(
            'Recording content is cleared. The server could not confirm sign-out; close this browser session before using a shared computer.',
          );
      })
      .finally(() => {
        if (generation.current === expected)
          setSession((previous) => ({ ...previous, phase: 'signed-out' }));
      });
  };
  return (
    <div className="app-frame">
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label="Bota Recordings, skip to content">
          <span className="brand-mark" aria-hidden="true">
            <i />
          </span>
          <span>Bota Recordings</span>
        </a>
        <div className="header-meta">
          <span className="sample-badge">Sample app</span>
          {['loading', 'unavailable'].includes(session.phase) ? (
            <span className="mode-badge">Mode unavailable</span>
          ) : (
            <span className={`mode-badge ${session.mode}`}>
              <span aria-hidden="true" />
              {session.mode === 'demo' ? 'Demo data' : 'Live mode'}
            </span>
          )}
          {session.user ? (
            <>
              <span className="username">{session.user.username}</span>
              <button className="text-button" onClick={logout}>
                Sign out
              </button>
            </>
          ) : null}
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {notice ? (
          <div className="session-notice" role="status">
            {notice}
          </div>
        ) : null}
        {session.phase === 'loading' ? (
          <div className="initial-loading" role="status">
            <h1>Opening your recordings…</h1>
          </div>
        ) : session.phase === 'unavailable' ? (
          <div className="initial-loading">
            <h1>The app could not open.</h1>
            <p className="muted">
              Refresh the application status to confirm its mode before signing in.
            </p>
            <button
              className="secondary-button"
              onClick={() => {
                setNotice('');
                setSession((previous) => ({ ...previous, phase: 'loading' }));
                setDiscoveryRevision((value) => value + 1);
              }}
            >
              Refresh application status
            </button>
          </div>
        ) : session.phase === 'signing-out' ? (
          <div className="initial-loading" role="status">
            <h1>Signing out…</h1>
            <p className="muted">
              Recording content is cleared. Wait for sign-out to finish before signing in again.
            </p>
          </div>
        ) : session.user ? (
          <RecordingApp key={session.epoch} api={api} />
        ) : (
          <Login
            key={session.epoch}
            api={api}
            mode={session.mode}
            onLogin={(value) => authenticate(value, session.epoch)}
          />
        )}
      </main>
      <footer className="site-footer">
        <span>
          <a
            href="https://github.com/bota-dev/examples/tree/main/end-to-end/web-reference"
            target="_blank"
            rel="noopener noreferrer"
          >
            Setup & sample code
          </a>
        </span>
        {!['loading', 'unavailable'].includes(session.phase) ? (
          <span>
            {session.mode === 'demo'
              ? 'Synthetic recordings and results. No external API calls.'
              : 'Recording app sample.'}
          </span>
        ) : null}
      </footer>
    </div>
  );
}

function Login({
  api,
  mode,
  onLogin,
}: {
  api: ApiClient;
  mode: Mode;
  onLogin: (value: Session) => void;
}) {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const login = async () => {
    if (pending.current) return;
    if (mode === 'live' && /^(?:sk_|rk_|dtok_|up_|rct_)/.test(token.trim())) {
      setToken('');
      setError('Use an application access token supplied by your app operator.');
      return;
    }
    pending.current = true;
    controller.current = new AbortController();
    setBusy(true);
    setError('');
    const body = mode === 'demo' ? { username: 'demo' } : { username: username.trim(), token };
    setToken('');
    try {
      const result = await api.post<Session>('/api/login', body, controller.current.signal);
      if (alive.current) onLogin(result);
    } catch (failure) {
      if (alive.current) setError(errorMessage(failure));
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <div className="welcome-layout">
      <section className="login-panel" aria-labelledby="login-heading">
        <h1 id="login-heading">{mode === 'demo' ? 'Try the recording app' : 'Sign in'}</h1>
        <p className="muted">
          {mode === 'demo'
            ? 'Open sample recordings, read transcripts and summaries, or ask about your audio.'
            : 'Use the account and application access token provided by your app operator.'}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void login();
          }}
        >
          {mode === 'live' ? (
            <>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                disabled={busy}
              />
              <label htmlFor="app-token">Application access token</label>
              <input
                id="app-token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="off"
                required
                disabled={busy}
              />
              <p className="small-note">
                Used for this sign-in only. It is cleared after submitting.
              </p>
            </>
          ) : (
            <div className="demo-entry">
              <div>
                <strong>Demo mode</strong>
                <span>Synthetic recordings and results. Uploaded files are not processed.</span>
              </div>
            </div>
          )}
          {error ? (
            <p className="error-note" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="primary-button"
            disabled={busy || (mode === 'live' && (!username.trim() || !token))}
          >
            {busy ? 'Opening…' : mode === 'demo' ? 'Open demo' : 'Sign in'}
          </button>
        </form>
        <p className="login-footnote">
          {mode === 'demo'
            ? 'Runs locally without an API key or external requests.'
            : 'Keep your application access token private.'}
        </p>
      </section>
    </div>
  );
}

function RecordingApp({ api }: { api: ApiClient }) {
  const [selected, setSelected] = useState<string | null>(null);
  const previousSelection = useRef<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [operations, setOperations] = useState<Operation[]>([]);
  const locks = useRef(new Set<string>());
  const requests = useRef(new Map<string, Operation>());
  const intentScope = useMemo(
    () => ({
      locks: locks.current,
      requests: requests.current,
      record: (operation: Operation) =>
        setOperations((previous) => [
          operation,
          ...previous.filter((existing) => existing.id !== operation.id),
        ]),
    }),
    [],
  );
  useEffect(() => {
    if (previousSelection.current && !selected)
      document.getElementById('recordings-heading')?.focus();
    previousSelection.current = selected;
  }, [selected]);
  return (
    <IntentContext.Provider value={intentScope}>
      <div className="workbench-heading">
        <div>
          <h1>My recordings</h1>
          <p>Keep your audio, transcripts and summaries together.</p>
        </div>
      </div>
      <div className={`workbench-layout ${selected ? 'has-selection' : ''}`}>
        <aside className="collection-column">
          <Recordings api={api} selected={selected} onSelect={setSelected} revision={revision} />
          <Upload api={api} onUploaded={() => setRevision((value) => value + 1)} />
        </aside>
        <div className="detail-column">
          {selected ? (
            <>
              <button className="text-button back-button" onClick={() => setSelected(null)}>
                <span aria-hidden="true">←</span> All recordings
              </button>
              <RecordingDetail key={selected} api={api} id={selected} />
            </>
          ) : (
            <section className="detail-empty">
              <h2>Select a recording</h2>
              <p>Read its transcript, create a summary or ask a question.</p>
            </section>
          )}
        </div>
      </div>
      <Activity api={api} localOperations={operations} onReviewed={intentScope.record} />
    </IntentContext.Provider>
  );
}

type DetailTab = 'transcription' | 'notes' | 'ask';
function RecordingDetail({ api, id }: { api: ApiClient; id: string }) {
  const record = useRead<Recording>(api, `/api/recordings/${encodeURIComponent(id)}`);
  const [tab, setTab] = useState<DetailTab>('transcription');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="recording-detail" aria-labelledby="detail-heading">
      <div className="detail-heading">
        <div className="detail-topline">
          <p className="eyebrow">Recording</p>
          <button
            className="text-button"
            onClick={record.refresh}
            disabled={record.loading}
            aria-label="Refresh recording"
          >
            Refresh recording <span aria-hidden="true">↻</span>
          </button>
        </div>
        <h2 id="detail-heading" ref={heading} tabIndex={-1}>
          {record.data?.name || 'Your recording'}
        </h2>
        {record.data ? (
          <>
            <div className="detail-meta">
              <span>{dateLabel(record.data.created_at)}</span>
              <span>{durationLabel(record.data.duration_seconds)}</span>
              <span className={`status-pill ${record.data.upload_verified ? 'success' : 'review'}`}>
                {record.data.upload_verified ? 'Upload verified' : 'Verification pending'}
              </span>
            </div>
          </>
        ) : null}
        {record.error ? (
          <p className="error-note" role="alert">
            {record.error}
          </p>
        ) : null}
        {record.loading ? (
          <p className="loading-note" role="status">
            Reading recording…
          </p>
        ) : null}
      </div>
      {record.data ? (
        <>
          <div className="detail-tabs" role="tablist" aria-label="Recording perspectives">
            {(['transcription', 'notes', 'ask'] as const).map((item, index) => (
              <button
                key={item}
                id={`tab-${item}`}
                role="tab"
                aria-selected={tab === item}
                aria-controls={`panel-${item}`}
                tabIndex={tab === item ? 0 : -1}
                onClick={() => setTab(item)}
                onKeyDown={(event) => {
                  const tabs: DetailTab[] = ['transcription', 'notes', 'ask'];
                  let next: DetailTab | undefined;
                  if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
                  if (event.key === 'ArrowLeft')
                    next = tabs[(index + tabs.length - 1) % tabs.length];
                  if (event.key === 'Home') next = tabs[0];
                  if (event.key === 'End') next = tabs[2];
                  if (next) {
                    event.preventDefault();
                    setTab(next);
                    document.getElementById(`tab-${next}`)?.focus();
                  }
                }}
              >
                {item === 'transcription' ? 'Transcript' : item === 'notes' ? 'Summary' : 'Ask'}
              </button>
            ))}
          </div>
          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
            {tab === 'transcription' ? (
              <Transcript
                api={api}
                recordingId={id}
                verified={
                  record.data.upload_verified &&
                  ['uploaded', 'completed'].includes(record.data.status)
                }
              />
            ) : tab === 'notes' ? (
              <Summaries api={api} recordingId={id} />
            ) : (
              <Ask api={api} recordingId={id} />
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
