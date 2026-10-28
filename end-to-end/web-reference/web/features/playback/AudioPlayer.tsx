import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../api';
import type { ApiClient, Mode } from '../../api';

export function AudioPlayer({
  api,
  recordingId,
  mode,
}: {
  api: ApiClient;
  recordingId: string;
  mode: Mode;
}) {
  const [state, setState] = useState({ url: '', loading: false, error: '' });
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef('');
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const reset = useCallback(() => {
    const element = audio.current;
    if (element?.hasAttribute('src')) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = '';
  }, []);
  const attach = useCallback(
    (element: HTMLAudioElement | null) => {
      if (audio.current && audio.current !== element) reset();
      audio.current = element;
    },
    [reset],
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
      reset();
    };
  }, [api, recordingId, reset]);
  const load = async () => {
    if (controller.current) return;
    reset();
    const attempt = new AbortController();
    controller.current = attempt;
    setState({ url: '', loading: true, error: '' });
    try {
      const blob = await api.audio(recordingId, attempt.signal);
      if (!alive.current || attempt.signal.aborted) return;
      url.current = URL.createObjectURL(blob);
      setState({ url: url.current, loading: false, error: '' });
    } catch (error) {
      if (alive.current && !attempt.signal.aborted)
        setState({ url: '', loading: false, error: errorMessage(error) });
    } finally {
      if (controller.current === attempt) controller.current = null;
    }
  };
  return (
    <section className="audio-player" aria-label="Recording audio">
      <div className="section-heading">
        <h3>Audio</h3>
        <button className="secondary-button" onClick={() => void load()} disabled={state.loading}>
          {state.loading ? 'Loading audio…' : state.url ? 'Reload audio' : 'Load audio'}
        </button>
      </div>
      {mode === 'demo' ? (
        <p className="small-note">Synthetic WAV tone. It does not match the example transcript.</p>
      ) : null}
      <audio
        ref={attach}
        controls
        preload="none"
        hidden={!state.url}
        src={state.url || undefined}
        aria-label="Recording playback"
        onError={() => {
          if (!state.url || url.current !== state.url) return;
          reset();
          setState({
            url: '',
            loading: false,
            error:
              'This browser could not play this audio. Try loading it again or choose a supported WAV file.',
          });
        }}
      />
      {state.loading ? (
        <p className="loading-note" role="status">
          Loading audio…
        </p>
      ) : null}
      {state.error ? (
        <p className="error-note" role="alert">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
