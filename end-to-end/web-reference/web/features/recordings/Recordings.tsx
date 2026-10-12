import { useEffect, useRef, useState } from 'react';
import type { ApiClient, Recording, RecordingPage } from '../../api';
import { dateLabel, durationLabel, stateLabel } from '../../format';
import { useRead } from '../../workflow';

export function Recordings({ api, selected, onSelect, revision }: { api: ApiClient; selected: string | null; onSelect: (id: string) => void; revision: number }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [rows, setRows] = useState<Recording[]>([]);
  const previousRevision = useRef(revision);
  const page = useRead<RecordingPage>(api, `/api/recordings${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
  useEffect(() => {
    const data = page.data;
    if (!data) return;
    setRows(previous => cursor ? [...previous.filter(row => !data.data.some(next => next.id === row.id)), ...data.data] : data.data);
  }, [page.data, cursor]);
  useEffect(() => {
    if (previousRevision.current === revision) return;
    previousRevision.current = revision;
    setCursor(null); setRows([]); page.refresh();
  }, [revision, page.refresh]);
  return <section className="recordings-panel" aria-labelledby="recordings-heading">
    <div className="section-heading"><div><p className="eyebrow">01 / Your collection</p><h2 id="recordings-heading">Recordings <span className="count">{rows.length}</span></h2></div>
      <button className="text-button" onClick={() => { setCursor(null); setRows([]); page.refresh(); }} disabled={page.loading} aria-label="Refresh recordings">Refresh <span aria-hidden="true">↻</span></button>
    </div>
    {page.error ? <p className="error-note" role="alert">{page.error}</p> : null}
    <div className="recording-list" aria-busy={page.loading}>
      {rows.map((row, index) => <button key={row.id} className={`recording-row ${selected === row.id ? 'is-selected' : ''}`} onClick={() => onSelect(row.id)} aria-pressed={selected === row.id}>
        <span className="recording-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <span className="recording-copy"><strong>{row.name || 'Untitled recording'}</strong><span>{dateLabel(row.created_at)} <span aria-hidden="true">·</span> {durationLabel(row.duration_seconds)}</span><span className="row-state">{row.upload_verified ? 'Upload verified' : 'Verification pending'} <span aria-hidden="true">/</span> {stateLabel(row.status)}</span></span>
        <span className="row-arrow" aria-hidden="true">↗</span>
      </button>)}
      {!rows.length && !page.loading && !page.error ? <p className="empty-note">Your collection starts with a recording. Upload an audio file below.</p> : null}
      {page.loading ? <p className="loading-note" role="status">Reading your collection…</p> : null}
    </div>
    {page.data?.has_more && page.data.next_cursor ? <button className="secondary-button load-more" onClick={() => setCursor(page.data!.next_cursor)} disabled={page.loading}>Load more recordings</button> : null}
  </section>;
}
