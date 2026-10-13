import * as ask from '../../../recordings/backend/features/ask.mjs';

// Public web responses may omit project_id; owner-filtered session membership and citations stay exact.
const context = (ctx) => ({ ...ctx, requireProjectId: false });

export const askRecording = (ctx, recordingId, question) =>
  ask.askRecording(context(ctx), recordingId, question);
export const refreshAsk = (ctx, operationId) => ask.refreshAsk(context(ctx), operationId);
