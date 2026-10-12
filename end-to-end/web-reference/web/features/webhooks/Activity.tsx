import { useEffect, useRef, useState } from 'react';
import type { ApiClient, Collection, MutationResult, Operation, ResourceEvent } from '../../api';
import { ApiError, errorMessage, operationMetadata } from '../../api';
import { dateLabel, stateLabel } from '../../format';
import { useRead } from '../../workflow';

export function Activity({
  api,
  localOperations,
  onReviewed,
}: {
  api: ApiClient;
  localOperations: Operation[];
  onReviewed: (operation: Operation) => void;
}) {
  const operations = useRead<Collection<Operation>>(api, '/api/operations');
  const events = useRead<Collection<ResourceEvent>>(api, '/api/events');
  const [reviews, setReviews] = useState<Record<string, { busy: boolean; error: string }>>({});
  const controllers = useRef(new Map<string, AbortController>());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const requests = controllers.current;
    return () => {
      alive.current = false;
      requests.forEach((controller) => controller.abort());
    };
  }, []);
  const refreshOperation = async (saved: Operation) => {
    if (controllers.current.has(saved.id)) return;
    const controller = new AbortController();
    controllers.current.set(saved.id, controller);
    setReviews((previous) => ({ ...previous, [saved.id]: { busy: true, error: '' } }));
    try {
      const response = await api.get<MutationResult>(
        `/api/operations/${encodeURIComponent(saved.id)}`,
        controller.signal,
      );
      const operation = operationMetadata(response.operation);
      if (!operation || operation.id !== saved.id || operation.kind !== saved.kind) {
        throw new ApiError(
          502,
          'invalid_operation',
          'The refreshed request did not match the recorded request.',
        );
      }
      if (alive.current && !controller.signal.aborted) {
        // Activity retains metadata only, even when recovery also returns an answer or transcript.
        onReviewed(operation);
        setReviews((previous) => ({ ...previous, [saved.id]: { busy: false, error: '' } }));
      }
    } catch (error) {
      if (alive.current && !controller.signal.aborted) {
        const operation = error instanceof ApiError ? error.operation : undefined;
        if (operation?.id === saved.id && operation.kind === saved.kind) onReviewed(operation);
        setReviews((previous) => ({
          ...previous,
          [saved.id]: { busy: false, error: errorMessage(error) },
        }));
      }
    } finally {
      if (controllers.current.get(saved.id) === controller) controllers.current.delete(saved.id);
    }
  };
  const merged = new Map(
    (operations.data?.data ?? []).map((operation) => [operation.id, operation]),
  );
  localOperations.forEach((operation) => {
    const existing = merged.get(operation.id);
    if (!existing || operation.updated_at > existing.updated_at)
      merged.set(operation.id, operation);
  });
  const rows = [...merged.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return (
    <details className="activity-panel">
      <summary>
        <span>
          <span className="activity-dot" aria-hidden="true" /> Activity & request review
        </span>
        <span className="activity-count">
          {rows.length} {rows.length === 1 ? 'request' : 'requests'}{' '}
          <span aria-hidden="true">+</span>
        </span>
      </summary>
      <div className="activity-body">
        <div className="section-heading">
          <p className="muted">Read current request states and signed event receipts.</p>
          <button
            className="secondary-button"
            onClick={() => {
              operations.refresh();
              events.refresh();
            }}
            disabled={operations.loading || events.loading}
          >
            Refresh activity
          </button>
        </div>
        {operations.error || events.error ? (
          <p className="error-note" role="alert">
            {operations.error || events.error}
          </p>
        ) : null}
        <div className="activity-columns">
          <section aria-labelledby="requests-heading">
            <h3 id="requests-heading">Recorded requests</h3>
            {!rows.length ? (
              <p className="empty-note">No requests recorded yet.</p>
            ) : (
              <ul className="activity-list">
                {rows.map((operation) => (
                  <li key={operation.id}>
                    <span>
                      <strong>{stateLabel(operation.kind)}</strong>
                      <code>{operation.id}</code>
                      {operation.resource_id ? (
                        <code>Resource: {operation.resource_id}</code>
                      ) : (
                        <code>Resource not confirmed</code>
                      )}
                      <button
                        className="text-button activity-refresh"
                        disabled={reviews[operation.id]?.busy}
                        onClick={() => void refreshOperation(operation)}
                        aria-label={`Refresh ${stateLabel(operation.kind)} request ${operation.id}`}
                      >
                        {reviews[operation.id]?.busy ? 'Refreshing request…' : 'Refresh request'}{' '}
                        <span aria-hidden="true">↻</span>
                      </button>
                      {reviews[operation.id]?.error ? (
                        <p className="error-note" role="alert">
                          {reviews[operation.id].error}
                        </p>
                      ) : null}
                    </span>
                    <span
                      className={`status-pill ${operation.state === 'complete' ? 'success' : 'review'}`}
                    >
                      {stateLabel(operation.state)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="small-note">
              Refresh a saved request to reconcile its current resource through GET, including after
              reopening the app. An unknown resource stays uncertain. Activity never resends a write
              or displays recovered content.
            </p>
          </section>
          <section aria-labelledby="events-heading">
            <h3 id="events-heading">Webhook receipts</h3>
            {!events.data?.data.length ? (
              <p className="empty-note">No visible event receipts yet.</p>
            ) : (
              <ul className="activity-list">
                {events.data.data.map((event) => (
                  <li key={event.id}>
                    <span>
                      <strong>{stateLabel(event.type)}</strong>
                      <code>{event.id}</code>
                    </span>
                    <time dateTime={event.created_at}>{dateLabel(event.created_at)}</time>
                  </li>
                ))}
              </ul>
            )}
            <p className="small-note">
              Events are signals to refresh current state. They do not start processing.
            </p>
          </section>
        </div>
      </div>
    </details>
  );
}
