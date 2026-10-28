import { LibraryError, pickerAudioType, validateAudioImport } from './library-api.ts';
import type { PickedAudio } from './media-controller.ts';

type CacheFile = Blob & { exists: boolean; delete(): void };

/** Called only after the OS adapter proves this is its private picker cache copy. */
export function preparePickedAudio(file: CacheFile, name: string, mime?: string): PickedAudio {
  const remove = () => { if (file.exists) file.delete(); };
  try {
    const picked = { name, mime: pickerAudioType(name, mime), body: file, async remove() { remove(); } };
    validateAudioImport(picked);
    return picked;
  } catch (error) {
    try { remove(); } catch { throw new LibraryError(0, 'cleanup_failed'); }
    throw error instanceof LibraryError ? error : new LibraryError(400, 'invalid_audio');
  }
}
