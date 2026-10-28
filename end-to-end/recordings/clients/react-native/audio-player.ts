import type { AudioPlayer, AudioStatus } from 'expo-audio';
import { LibraryError } from './library-api.ts';
import type { LocalPlayer } from './media-controller.ts';

type Player = Pick<AudioPlayer, 'currentStatus' | 'addListener' | 'pause' | 'play' | 'seekTo' | 'remove' | 'release' | 'duration' | 'currentTime'>;

/** Public Expo status events qualify local decoder readiness, separately from HTTP/WAV checks. */
export async function prepareAudioPlayer(player: Player, removeFile: () => void, signal: AbortSignal, onFailure: () => void): Promise<LocalPlayer> {
  let released = false, loaded = false, failed = false, playRevision = 0;
  let subscription: { remove(): void } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const finishWait = () => { clearTimeout(timer); if (abort) signal.removeEventListener('abort', abort); };
  async function release() {
    if (released) return;
    released = true; playRevision++; finishWait();
    let failed = false;
    for (const dispose of [() => subscription?.remove(), () => player.pause(), () => player.remove(), () => player.release(), removeFile]) {
      try { dispose(); } catch { failed = true; }
    }
    if (failed) throw new LibraryError(0, 'cleanup_failed');
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (code = 'playback_failed') => { if (loaded) return; failed = true; finishWait(); reject(new LibraryError(0, code)); };
      const status = (value: AudioStatus) => {
        if (released || failed) return;
        // Never expose OS error text, local file paths or provider details.
        if (value.error != null || value.playbackState === 'failed' || value.mediaServicesDidReset) {
          failed = true;
          if (loaded) onFailure(); else fail();
        } else if (!loaded && value.isLoaded) { loaded = true; finishWait(); resolve(); }
      };
      abort = () => fail('outcome_unknown');
      timer = setTimeout(() => fail('playback_timeout'), 10_000);
      signal.addEventListener('abort', abort, { once: true });
      subscription = player.addListener('playbackStatusUpdate', status);
      if (signal.aborted) abort(); else status(player.currentStatus);
    });
    return {
      async play() {
        if (released || failed) return;
        const revision = ++playRevision;
        if (player.duration > 0 && player.currentTime >= player.duration) await player.seekTo(0);
        if (!released && !failed && revision === playRevision) player.play();
      },
      pause() { if (!released) { playRevision++; player.pause(); } },
      release,
    };
  } catch (error) {
    await release();
    throw error instanceof LibraryError ? error : new LibraryError(0, 'playback_failed');
  }
}
