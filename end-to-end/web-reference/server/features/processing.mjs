import * as processing from '../../../recordings/backend/features/processing.mjs';

// The web public contract permits absent project_id; supplied projects and exact sources still match.
const context = (ctx) => ({ ...ctx, requireProjectId: false });

export const verifyTranscription = (ctx, id, recordingId) =>
  processing.verifyTranscription(context(ctx), id, recordingId);
export const verifySummary = (ctx, id, transcriptionId) =>
  processing.verifySummary(context(ctx), id, transcriptionId);
export const listTranscriptions = (ctx, recordingId) =>
  processing.listTranscriptions(context(ctx), recordingId);

export async function listSummaries(ctx, transcriptionId) {
  const result = await processing.listSummaries(context(ctx), transcriptionId);
  return { data: result.data.map(({ recording_id: _recordingId, ...row }) => row) };
}

// Keep the existing web response projection; the mobile adapter also returns its source-linked result.
export async function startTranscription(ctx, recordingId) {
  const { operation } = await processing.startTranscription(context(ctx), recordingId);
  return { operation };
}
export async function startSummary(ctx, transcriptionId) {
  const { operation } = await processing.startSummary(context(ctx), transcriptionId);
  return { operation };
}
export async function refreshProcessing(ctx, operationId) {
  const { operation } = await processing.refreshProcessing(context(ctx), operationId);
  return { operation };
}
