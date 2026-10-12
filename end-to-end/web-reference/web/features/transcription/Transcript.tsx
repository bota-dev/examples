import type { ApiClient, Collection, MutationResult, Transcription } from '../../api';
import { stateLabel } from '../../format';
import { IntentNotice, useIntent, useRead } from '../../workflow';

export function Transcript({ api, recordingId, verified }: { api: ApiClient; recordingId: string; verified: boolean }) {
  const path = `/api/recordings/${encodeURIComponent(recordingId)}/transcriptions`;
  const read = useRead<Collection<Transcription>>(api, path);
  const intent = useIntent<MutationResult>(`transcription:${recordingId}`, api);
  const jobs = read.data?.data ?? [];
  return <section className="feature-panel" aria-labelledby="transcript-heading">
    <div className="section-heading"><div><p className="eyebrow">02 / Listen in text</p><h3 id="transcript-heading">Transcription</h3></div><button className="text-button" onClick={read.refresh} disabled={read.loading} aria-label="Refresh transcription">Refresh <span aria-hidden="true">↻</span></button></div>
    <p className="muted">Read existing transcripts, or request one after the upload is verified.</p>
    {read.error ? <p className="error-note" role="alert">{read.error}</p> : null}
    {read.loading ? <p className="loading-note" role="status">Reading transcription…</p> : null}
    {jobs.map(job => <article className="transcript-result" key={job.id}><div className="result-label"><span className={`status-pill ${job.status === 'completed' ? 'success' : ''}`}>{stateLabel(job.status)}</span><code>{job.id}</code></div>
      {job.status === 'completed' && typeof job.full_text === 'string' ? <p className="transcript-text">{job.full_text}</p> : <p className="empty-note">{job.status === 'failed' ? 'This job failed. Review its recorded intent before requesting further processing.' : 'The transcript is not ready. Refresh to read its current state.'}</p>}
    </article>)}
    {!jobs.length && !read.loading && !read.error ? <div className="feature-empty"><span className="empty-symbol" aria-hidden="true">Aa</span><h4>Every useful thought starts here.</h4><p>Turn your recording into a transcript, then make notes or ask a question.</p></div> : null}
    <div className="action-row"><button className="primary-button" onClick={() => void intent.mutate(signal => api.post<MutationResult>(path, {}, signal))} disabled={!verified || read.loading || Boolean(read.error) || jobs.length > 0 || intent.busy || intent.locked}>{intent.busy ? 'Requesting…' : 'Start transcription'} <span aria-hidden="true">↗</span></button><small>{!verified ? 'Upload verification is required.' : jobs.length ? 'An existing job is already recorded.' : 'Starts one processing request.'}</small></div>
    <IntentNotice busy={intent.busy} locked={intent.locked} error={intent.error} operation={intent.result?.operation} refreshing={intent.refreshing} onRefresh={() => void intent.refreshRequest()} />
  </section>;
}
