import * as recordings from '../../../recordings/backend/features/recordings.mjs';

// Public web responses may omit project_id; exact owned recording/source checks remain mandatory.
const context = (ctx) => ({ ...ctx, requireProjectId: false });

export const verifyRecording = (ctx, id) => recordings.verifyRecording(context(ctx), id);
export const getRecording = (ctx, id) => recordings.getRecording(context(ctx), id);
export const listRecordings = (ctx, cursor) => recordings.listRecordings(context(ctx), cursor);
