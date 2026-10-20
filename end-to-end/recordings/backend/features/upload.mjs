import { createHash } from 'node:crypto';
import { AppError, assertProject, ensure, isId, object, operationView } from '../errors.mjs';
import { verifyRecording } from './recordings.mjs';

const audioTypes = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
  'audio/flac',
]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const intentAnchor = ({ accountId, name, contentType, size, digest }) =>
  hash(JSON.stringify({ accountId, name, contentType, size, digest }));
const verified = (row, digest) =>
  ['uploaded', 'processing', 'completed'].includes(row.status) &&
  row.content_sha256 === digest &&
  typeof row.content_sha256_verified_at === 'string' &&
  /^\d{4}-\d{2}-\d{2}T/.test(row.content_sha256_verified_at) &&
  Number.isFinite(Date.parse(row.content_sha256_verified_at));

function recordingView(row) {
  return {
    id: row.id,
    name: row.name ?? null,
    status: row.status,
    created_at: row.created_at,
    duration_seconds: row.duration_seconds ?? null,
    upload_verified: true,
  };
}

function checkReply(ctx, row, id) {
  ensure(
    object(row) && isId(row.id, 'rec') && (!id || row.id === id),
    502,
    'invalid_upload_response',
    'Invalid upload response.',
  );
  assertProject(row, ctx);
  ensure(
    row.end_user_id === ctx.principal.endUserId,
    403,
    'recording_forbidden',
    'Recording access denied.',
  );
}

async function reconcile(ctx, op, digest) {
  if (!op.resourceId) return { operation: operationView(op) };
  const row = await verifyRecording(ctx, op.resourceId);
  ensure(
    row.content_sha256 == null || row.content_sha256 === digest,
    409,
    'upload_hash_conflict',
    'Stored upload does not match this file.',
  );
  if (verified(row, digest)) {
    if (op.state !== 'complete')
      op = await ctx.store.save(ctx.principal, op.id, { state: 'complete' });
    return { operation: operationView(op), recording: recordingView(row) };
  }
  if (op.state === 'complete')
    op = await ctx.store.save(ctx.principal, op.id, { state: 'uncertain' });
  return { operation: operationView(op) };
}

export async function refreshUpload(ctx, operationId) {
  ensure(
    typeof operationId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(operationId),
    400,
    'invalid_operation_id',
    'Invalid operation ID.',
  );
  const op = await ctx.store.get(ctx.principal, operationId);
  ensure(
    object(op) && op.id === operationId && op.kind === 'upload',
    404,
    'upload_operation_not_found',
    'Upload operation unavailable.',
  );
  const details = op.details;
  ensure(
    object(details) &&
      typeof details.digest === 'string' &&
      /^[0-9a-f]{64}$/.test(details.digest) &&
      typeof details.name === 'string' &&
      details.name.trim().length > 0 &&
      details.name.length <= 255 &&
      !/[\x00-\x1f\x7f]/.test(details.name) &&
      audioTypes.has(details.contentType) &&
      Number.isSafeInteger(details.size) &&
      details.size > 0 &&
      details.size <= 25 * 1024 * 1024 &&
      ['accountId', 'projectId', 'endUserId', 'scopeId'].every(
        (key) => details[key] === ctx.principal[key],
      ) &&
      op.anchor === intentAnchor(details) &&
      (op.resourceId === null || isId(op.resourceId, 'rec')),
    409,
    'upload_intent_conflict',
    'Upload intent is invalid for this account.',
  );
  return reconcile(ctx, op, details.digest);
}

export async function uploadAudio(ctx, { name, contentType, bytes }) {
  ensure(
    typeof name === 'string' &&
      name.trim().length > 0 &&
      name.length <= 255 &&
      !/[\x00-\x1f\x7f]/.test(name),
    400,
    'invalid_file_name',
    'Choose a valid audio filename.',
  );
  ensure(
    audioTypes.has(contentType),
    415,
    'unsupported_audio_type',
    'Unsupported audio content type.',
  );
  ensure(
    bytes instanceof Uint8Array && bytes.byteLength > 0 && bytes.byteLength <= 25 * 1024 * 1024,
    413,
    'invalid_audio_size',
    'Audio must be nonempty and at most 25 MiB.',
  );
  const audio = Buffer.from(bytes);
  const digest = hash(audio);
  const { accountId, projectId, endUserId, scopeId } = ctx.principal;
  const details = {
    name,
    contentType,
    size: audio.length,
    digest,
    accountId,
    projectId,
    endUserId,
    scopeId,
  };
  const anchor = intentAnchor(details);
  const claim = await ctx.store.claim(ctx.principal, 'upload', anchor, details);
  let op = claim.operation;
  ensure(
    object(op.details) &&
      Object.entries(details).every(([key, value]) => op.details[key] === value),
    409,
    'upload_intent_conflict',
    'Upload intent does not match this file.',
  );

  if (!claim.fresh) return reconcile(ctx, op, digest);

  try {
    op = await ctx.store.save(ctx.principal, op.id, {
      state: 'creating',
      details: { phase: 'create' },
    });
    const created = await ctx.request('POST', '/recordings', {
      name,
      end_user_id: endUserId,
      source: 'api_upload',
      upload_method: 'import',
    });
    // Retain a syntactically valid identity even if later ownership checks fail.
    // This records uncertainty; it does not authorize content or another write.
    if (object(created) && isId(created.id, 'rec'))
      op = await ctx.store.save(ctx.principal, op.id, {
        state: 'created',
        resourceId: created.id,
        details: { phase: 'upload_url' },
      });
    checkReply(ctx, created);
    await verifyRecording(ctx, created.id);
    const destination = await ctx.request('POST', `/recordings/${created.id}/upload-url`, {
      content_type: contentType,
      file_size_bytes: audio.length,
    });
    ensure(
      object(destination) &&
        typeof destination.upload_url === 'string' &&
        destination.content_type === contentType,
      502,
      'invalid_upload_destination',
      'Invalid upload destination.',
    );
    await verifyRecording(ctx, created.id);
    op = await ctx.store.save(ctx.principal, op.id, {
      state: 'uploading',
      details: { phase: 'storage_put' },
    });
    await ctx.storagePut(destination.upload_url, audio, contentType);
    await verifyRecording(ctx, created.id);
    op = await ctx.store.save(ctx.principal, op.id, {
      state: 'verifying',
      details: { phase: 'completion' },
    });
    const completed = await ctx.request(
      'POST',
      `/recordings/${created.id}/upload-complete`,
      { content_sha256: digest },
      { pending425: true },
    );
    if (completed === null) {
      op = await ctx.store.save(ctx.principal, op.id, { state: 'verification_pending' });
      return { operation: operationView(op) };
    }
    checkReply(ctx, completed, created.id);
    ensure(
      verified(completed, digest),
      502,
      'unverified_upload',
      'Upload verification was not confirmed.',
    );
    const row = await verifyRecording(ctx, created.id);
    ensure(
      verified(row, digest),
      502,
      'unverified_upload',
      'Upload verification was not confirmed.',
    );
    op = await ctx.store.save(ctx.principal, op.id, { state: 'complete' });
    return { operation: operationView(op), recording: recordingView(row) };
  } catch (error) {
    const retained = await ctx.store.save(ctx.principal, op.id, { state: 'uncertain' });
    if (error instanceof AppError) error.operation = operationView(retained);
    throw error;
  }
}
