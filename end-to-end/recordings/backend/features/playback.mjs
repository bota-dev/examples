import { ensure, object } from '../errors.mjs';
import { audioTypes } from '../http.mjs';
import { verifyRecording } from './recordings.mjs';

function source(row) {
  ensure(
    row.deleted_at == null &&
      row.source === 'api_upload' &&
      row.upload_method === 'import' &&
      row.device_id === null &&
      (row.encryption_version === null || row.encryption_version === 0) &&
      (row.upload_contract == null || row.upload_contract === 'legacy_v1') &&
      audioTypes.has(row.mime_type) &&
      ['uploaded', 'processing', 'completed'].includes(row.status) &&
      typeof row.content_sha256 === 'string' &&
      /^[0-9a-f]{64}$/.test(row.content_sha256) &&
      typeof row.content_sha256_verified_at === 'string' &&
      Number.isFinite(Date.parse(row.content_sha256_verified_at)),
    409,
    'playback_unavailable',
    'Audio playback is available for verified ordinary imports. Encrypted or unsupported sources are unavailable.',
  );
  // The digest identifies the original import, never the converted WAV bytes.
  return JSON.stringify([
    row.id,
    row.project_id ?? null,
    row.end_user_id,
    row.source,
    row.upload_method,
    row.device_id,
    row.encryption_version,
    row.upload_contract ?? null,
    row.mime_type,
    row.content_sha256,
    row.content_sha256_verified_at,
    row.file_size_bytes ?? null,
    row.s3_key ?? null,
  ]);
}

/** One explicit public export request; no signed URL or original encrypted bytes reach the app. */
export async function playbackAudio(ctx, id) {
  const before = source(await verifyRecording(ctx, id));
  const descriptor = await ctx.request(
    'GET',
    `/recordings/${encodeURIComponent(id)}/download-url?format=wav&use_enhanced=false`,
  );
  ensure(
    object(descriptor) &&
      descriptor.content_type === 'audio/wav' &&
      Number.isSafeInteger(descriptor.expires_in) &&
      descriptor.expires_in > 0 &&
      descriptor.expires_in <= 3600,
    502,
    'invalid_playback',
    'The audio service did not return a supported WAV source.',
  );
  const bytes = await ctx.storageGet(descriptor.download_url, descriptor.file_size_bytes);
  // FFmpeg's unseekable WAV output can retain the unknown RIFF-length sentinel.
  ensure(
    bytes.length >= 44 &&
      bytes.subarray(0, 4).equals(Buffer.from('RIFF')) &&
      bytes.subarray(8, 12).equals(Buffer.from('WAVE')) &&
      [bytes.length - 8, 0xffffffff].includes(bytes.readUInt32LE(4)),
    502,
    'invalid_playback',
    'The audio source is not a supported WAV file.',
  );
  ensure(
    source(await verifyRecording(ctx, id)) === before,
    409,
    'playback_source_changed',
    'The recording source changed. Select it again before loading audio.',
  );
  return bytes;
}
