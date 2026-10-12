import { useEffect, useRef, useState } from 'react';
import type { ApiClient, Recording, RecordingPage } from '../../api';
import { dateLabel, durationLabel, stateLabel } from '../../format';
import { useRead } from '../../workflow';

export function Recordings({
  api,
  selected,
  onSelect,
  revision,
}: {
  api: ApiClient;
  selected: string | null;
  onSelect: (id: string) => void;
  revision: number;
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [rows, setRows] = useState<Recording[]>([]);
  const previousRevision = useRef(revision);
  const page = useRead<RecordingPage>(
    api,
    `/api/recordings${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
  );
  useEffect(() => {
    const data = page.data;
    if (!data) return;
    setRows((previous) =>
      cursor
        ? [...previous.filter((row) => !data.data.some((next) => next.id === row.id)), ...data.data]
        : data.data,
    );
  }, [page.data, cursor]);
  useEffect(() => {
    if (previousRevision.current === revision) return;
    previousRevision.current = revision;
    setCursor(null);
    setRows([]);
    page.refresh();
  }, [revision, page.refresh]);
  return (
    <section className="recordings-panel" aria-labelledby="recordings-heading">
      <div className="section-heading">
        <div>
          <h2 id="recordings-heading" tabIndex={-1}>
            Recordings <span className="count">{rows.length}</span>
          </h2>
        </div>
        <button
          className="text-button"
          onClick={() => {
            setCursor(null);
            setRows([]);
            page.refresh();
          }}
          disabled={page.loading}
          aria-label="Refresh recordings"
        >
          Refresh <span aria-hidden="true">↻</span>
        </button>
      </div>
      {page.error ? (
        <p className="error-note" role="alert">
          {page.error}
        </p>
      ) : null}
      <div className="recording-list" aria-busy={page.loading}>
        {rows.map((row) => (
          <button
            key={row.id}
            className={`recording-row ${selected === row.id ? 'is-selected' : ''}`}
            onClick={() => onSelect(row.id)}
            aria-pressed={selected === row.id}
          >
            <span className="recording-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M5 9v6m4-10v14m4-12v10m4-13v16m4-11v6" />
              </svg>
            </span>
            <span className="recording-copy">
              <strong>{row.name || 'Untitled recording'}</strong>
              <span>
                {dateLabel(row.created_at)} <span aria-hidden="true">·</span>{' '}
                {durationLabel(row.duration_seconds)}
              </span>
              <span className="row-state">
                {['processing', 'completed', 'failed'].includes(row.status)
                  ? `${stateLabel(row.status)} · `
                  : ''}
                {row.upload_verified ? 'Upload verified' : 'Verification pending'}
              </span>
            </span>
          </button>
        ))}
        {!rows.length && !page.loading && !page.error ? (
          <p className="empty-note">No recordings yet. Upload an audio file to get started.</p>
        ) : null}
        {page.loading ? (
          <p className="loading-note" role="status">
            Loading recordings…
          </p>
        ) : null}
      </div>
      {page.data?.has_more && page.data.next_cursor ? (
        <button
          className="secondary-button load-more"
          onClick={() => setCursor(page.data!.next_cursor)}
          disabled={page.loading}
        >
          Load more recordings
        </button>
      ) : null}
    </section>
  );
}
