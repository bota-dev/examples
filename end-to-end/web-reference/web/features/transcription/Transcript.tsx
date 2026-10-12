import type { ApiClient, Collection, MutationResult, Transcription } from '../../api';
import { stateLabel } from '../../format';
import { IntentNotice, useIntent, useRead } from '../../workflow';

export function Transcript({
  api,
  recordingId,
  verified,
}: {
  api: ApiClient;
  recordingId: string;
  verified: boolean;
}) {
  const path = `/api/recordings/${encodeURIComponent(recordingId)}/transcriptions`;
  const read = useRead<Collection<Transcription>>(api, path);
  const intent = useIntent<MutationResult>(`transcription:${recordingId}`, api);
  const jobs = read.data?.data ?? [];
  return (
    <section className="feature-panel" aria-labelledby="transcript-heading">
      <div className="section-heading">
        <div>
          <h3 id="transcript-heading">Transcript</h3>
        </div>
        <button
          className="text-button"
          onClick={read.refresh}
          disabled={read.loading}
          aria-label="Refresh transcription"
        >
          Refresh <span aria-hidden="true">↻</span>
        </button>
      </div>
      <p className="muted">Turn the recording into text.</p>
      {read.error ? (
        <p className="error-note" role="alert">
          {read.error}
        </p>
      ) : null}
      {read.loading ? (
        <p className="loading-note" role="status">
          Reading transcription…
        </p>
      ) : null}
      {jobs.map((job) => (
        <article className="transcript-result" key={job.id}>
          <div className="result-label">
            <span className={`status-pill ${job.status === 'completed' ? 'success' : ''}`}>
              {stateLabel(job.status)}
            </span>
          </div>
          {job.status === 'completed' && typeof job.full_text === 'string' ? (
            <p className="transcript-text">{job.full_text}</p>
          ) : (
            <p className="empty-note">
              {job.status === 'failed'
                ? 'Transcription failed. Check the request status before continuing.'
                : 'The transcript is not ready. Refresh to read its current state.'}
            </p>
          )}
        </article>
      ))}
      {!jobs.length && !read.loading && !read.error ? (
        <div className="feature-empty">
          <p>No transcript yet. Start transcription to create one.</p>
        </div>
      ) : null}
      <div className="action-row">
        <button
          className="primary-button"
          onClick={() => void intent.mutate((signal) => api.post<MutationResult>(path, {}, signal))}
          disabled={
            !verified ||
            read.loading ||
            Boolean(read.error) ||
            jobs.length > 0 ||
            intent.busy ||
            intent.locked
          }
        >
          {intent.busy ? 'Requesting…' : 'Start transcription'} <span aria-hidden="true">↗</span>
        </button>
        <small>
          {!verified
            ? 'Upload verification is required.'
            : jobs.length
              ? 'A transcript has already been requested.'
              : 'Creates a transcript for this recording.'}
        </small>
      </div>
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
