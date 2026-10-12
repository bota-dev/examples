import { useEffect, useRef, useState } from 'react';
import type { ApiClient, UploadResult } from '../../api';
import { IntentNotice, useIntent } from '../../workflow';
import { Capability } from '../../Capability';

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

async function fileDigest(file: File): Promise<string> {
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('File could not be read.'));
    reader.readAsArrayBuffer(file);
  });
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function Upload({ api, onUploaded }: { api: ApiClient; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState('');
  const [digest, setDigest] = useState('');
  const [reading, setReading] = useState(false);
  const selection = useRef(0);
  useEffect(
    () => () => {
      selection.current += 1;
    },
    [],
  );
  const key =
    file && digest
      ? `upload:${encodeURIComponent(file.name)}:${file.type}:${digest}`
      : 'upload:unprepared';
  const intent = useIntent<UploadResult>(key, api);
  const chooseFile = async (next: File | null) => {
    const expected = ++selection.current;
    setValidation('');
    setDigest('');
    setReading(false);
    setFile(next);
    if (next && (!audioTypes.has(next.type) || next.size === 0 || next.size > 25 * 1024 * 1024)) {
      setValidation('Choose a supported audio file between 1 byte and 25 MiB.');
      return;
    }
    if (!next) return;
    setReading(true);
    try {
      const value = await fileDigest(next);
      if (selection.current === expected) setDigest(value);
    } catch {
      if (selection.current === expected)
        setValidation(
          'This browser could not identify the file. Use a current browser on localhost or HTTPS.',
        );
    } finally {
      if (selection.current === expected) setReading(false);
    }
  };
  return (
    <section className="upload-panel" aria-labelledby="upload-heading">
      <p className="eyebrow">Add to your collection</p>
      <h2 id="upload-heading">Bring your own audio.</h2>
      <p className="muted">WAV, MP3, M4A, OGG, Opus, WebM or FLAC. Up to 25 MiB.</p>
      <Capability
        calls={[
          'POST /v1/recordings',
          'POST /v1/recordings/:id/upload-url',
          'PUT signed storage URL (no API key)',
          'POST /v1/recordings/:id/upload-complete',
        ]}
        docs="https://docs.bota.dev/api-reference/recordings/create"
        source="server/features/upload.mjs"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!file || validation || reading || !digest) return;
          void intent.mutate(async (signal) => {
            const result = await api.upload(file, signal);
            if (!signal.aborted) onUploaded();
            return result;
          });
        }}
      >
        <label className="file-label" htmlFor="audio-file">
          <span aria-hidden="true">↑</span>
          <span>
            {file ? file.name : 'Choose an audio file'}
            <small>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MiB selected`
                : 'Select a file from your computer'}
            </small>
          </span>
        </label>
        <input
          id="audio-file"
          name="audio-file"
          type="file"
          accept={[...audioTypes].join(',')}
          onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)}
          disabled={intent.busy || intent.refreshing}
          aria-describedby="upload-guidance"
        />
        <p id="upload-guidance" className="small-note">
          Upload is separate from transcription. Each processing step starts with your action.
        </p>
        {validation ? (
          <p className="error-note" role="alert">
            {validation}
          </p>
        ) : null}
        {reading ? (
          <p className="small-note" role="status">
            Identifying the selected file…
          </p>
        ) : null}
        <button
          className="primary-button"
          type="submit"
          disabled={
            !file || Boolean(validation) || reading || !digest || intent.busy || intent.locked
          }
        >
          {intent.busy ? 'Uploading…' : 'Upload audio'} <span aria-hidden="true">↗</span>
        </button>
      </form>
      <IntentNotice
        busy={intent.busy}
        locked={intent.locked}
        error={intent.error}
        operation={intent.result?.operation}
        refreshing={intent.refreshing}
        onRefresh={() => void intent.refreshRequest()}
      />
    </section>
  );
}
