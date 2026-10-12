import { useState } from 'react';
import type { ApiClient, Collection, MutationResult, Summary, Transcription } from '../../api';
import { stateLabel } from '../../format';
import { IntentNotice, useIntent, useRead } from '../../workflow';
import { Capability } from '../../Capability';

export function Summaries({ api, recordingId }: { api: ApiClient; recordingId: string }) {
  const transcripts = useRead<Collection<Transcription>>(
    api,
    `/api/recordings/${encodeURIComponent(recordingId)}/transcriptions`,
  );
  const completed = transcripts.data?.data.filter((job) => job.status === 'completed') ?? [];
  const [selected, setSelected] = useState('');
  const source = completed.find((job) => job.id === selected)?.id ?? completed[0]?.id;
  return (
    <section className="feature-panel" aria-labelledby="notes-heading">
      <p className="eyebrow">03 / Find the useful parts</p>
      <h3 id="notes-heading">Notes & next steps</h3>
      <p className="muted">
        General notes from a completed transcript. Review generated content before relying on it.
      </p>
      <Capability
        calls={[
          'GET /v1/summaries?transcription_id=:id',
          'GET /v1/summaries/:id',
          'POST /v1/summaries (tmpl_general_notes)',
        ]}
        docs="https://docs.bota.dev/api-reference/ai/summaries/create"
        source="server/features/processing.mjs"
      />
      {transcripts.error ? (
        <p className="error-note" role="alert">
          {transcripts.error}
        </p>
      ) : null}
      {completed.length > 1 ? (
        <label className="source-select">
          Source transcript
          <select value={source} onChange={(event) => setSelected(event.target.value)}>
            {completed.map((job) => (
              <option key={job.id} value={job.id}>
                {job.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {source ? (
        <SummaryResults key={source} api={api} transcriptionId={source} />
      ) : (
        <div className="feature-empty">
          <span className="empty-symbol" aria-hidden="true">
            ≡
          </span>
          <h4>A transcript comes first.</h4>
          <p>
            {transcripts.loading
              ? 'Reading existing transcriptions…'
              : 'Complete a transcription to turn it into structured notes.'}
          </p>
          <button
            className="secondary-button"
            onClick={transcripts.refresh}
            disabled={transcripts.loading}
          >
            Refresh source transcripts
          </button>
        </div>
      )}
    </section>
  );
}

function SummaryResults({ api, transcriptionId }: { api: ApiClient; transcriptionId: string }) {
  const path = `/api/transcriptions/${encodeURIComponent(transcriptionId)}/summaries`;
  const read = useRead<Collection<Summary>>(api, path);
  const intent = useIntent<MutationResult>(`summary:${transcriptionId}`, api);
  const jobs = read.data?.data ?? [];
  return (
    <>
      <div className="result-label">
        <code>Source: {transcriptionId}</code>
        <button
          className="text-button"
          onClick={read.refresh}
          disabled={read.loading}
          aria-label="Refresh notes"
        >
          Refresh notes <span aria-hidden="true">↻</span>
        </button>
      </div>
      {read.error ? (
        <p className="error-note" role="alert">
          {read.error}
        </p>
      ) : null}
      {read.loading ? (
        <p className="loading-note" role="status">
          Reading notes…
        </p>
      ) : null}
      {jobs.map((job) => (
        <article className="summary-result" key={job.id}>
          <div className="result-label">
            <span className={`status-pill ${job.status === 'completed' ? 'success' : ''}`}>
              {stateLabel(job.status)}
            </span>
            <code>{job.id}</code>
          </div>
          {job.status === 'completed' && job.output ? (
            <>
              <p className="summary-overview">{job.output.overview}</p>
              {(['key_points', 'action_items', 'decisions', 'participants'] as const).map(
                (field) =>
                  job.output?.[field]?.length ? (
                    <section className="notes-group" key={field}>
                      <h4>{stateLabel(field)}</h4>
                      <ul>
                        {job.output[field].map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null,
              )}
            </>
          ) : (
            <p className="empty-note">Notes are not ready. Refresh to read their current state.</p>
          )}
        </article>
      ))}
      {!jobs.length && !read.loading && !read.error ? (
        <p className="empty-note">
          No notes yet. Request a general-notes summary for this transcript.
        </p>
      ) : null}
      <div className="action-row">
        <button
          className="primary-button"
          onClick={() => void intent.mutate((signal) => api.post<MutationResult>(path, {}, signal))}
          disabled={
            read.loading || Boolean(read.error) || jobs.length > 0 || intent.busy || intent.locked
          }
        >
          {intent.busy ? 'Requesting…' : 'Create general notes'} <span aria-hidden="true">↗</span>
        </button>
        <small>
          {jobs.length ? 'An existing summary is already recorded.' : 'Starts one summary request.'}
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
    </>
  );
}
