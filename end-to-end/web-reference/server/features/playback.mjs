import * as playback from '../../../recordings/backend/features/playback.mjs';

// Missing project fields retain Web compatibility; supplied mismatches always deny.
export const playbackAudio = (ctx, id) =>
  playback.playbackAudio({ ...ctx, requireProjectId: false }, id);
