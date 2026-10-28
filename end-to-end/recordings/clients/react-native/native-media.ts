import * as DocumentPicker from 'expo-document-picker';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { LibraryError } from './library-api.ts';
import type { MediaPorts } from './media-controller.ts';
import { prepareAudioPlayer } from './audio-player.ts';
import { preparePickedAudio } from './picked-audio.ts';

/** OS integration only: the backend owns authorization and ordinary-import eligibility. */
export function createNativeMedia(): MediaPorts {
  return {
    async pick() {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: false, copyToCacheDirectory: true });
      if (result.canceled) return null;
      const asset = result.assets[0];
      // Delete only the system picker's private cache copy, never the user's source.
      if (!asset || !asset.uri.startsWith(Paths.cache.uri)) throw new LibraryError(400, 'invalid_audio');
      const file = new File(asset.uri);
      if (!file.uri.startsWith(Paths.cache.uri)) throw new LibraryError(400, 'invalid_audio');
      return preparePickedAudio(file, asset.name, asset.mimeType);
    },
    async player(bytes, signal, onFailure) {
      await setAudioModeAsync({ allowsRecording: false, shouldPlayInBackground: false, playsInSilentMode: true, interruptionMode: 'doNotMix' });
      if (signal.aborted) throw new LibraryError(0, 'outcome_unknown');
      const file = new File(Paths.cache, `bota-playback-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
      let created = false, delegated = false;
      try {
        file.create(); created = true; file.write(bytes);
        const player = createAudioPlayer({ uri: file.uri }, { keepAudioSessionActive: false });
        delegated = true;
        return await prepareAudioPlayer(player, () => { if (file.exists) file.delete(); }, signal, onFailure);
      } catch (error) {
        if (created && !delegated) { try { if (file.exists) file.delete(); } catch { throw new LibraryError(0, 'cleanup_failed'); } }
        throw error;
      }
    },
  };
}
