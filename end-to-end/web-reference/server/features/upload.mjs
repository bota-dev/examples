import * as upload from '../../../recordings/backend/features/upload.mjs';

// Retain Web's explicit omitted-project response policy; mobile stays strict.
export const uploadAudio = (ctx, input) =>
  upload.uploadAudio({ ...ctx, requireProjectId: false }, input);
export const refreshUpload = (ctx, id) =>
  upload.refreshUpload({ ...ctx, requireProjectId: false }, id);
