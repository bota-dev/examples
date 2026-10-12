import type { ApiClient, Collection, Operation, ResourceEvent } from '../../api';
import { dateLabel, stateLabel } from '../../format';
import { useRead } from '../../workflow';

export function Activity({ api, localOperations }: { api: ApiClient; localOperations: Operation[] }) {
  const operations = useRead<Collection<Operation>>(api, '/api/operations');
  const events = useRead<Collection<ResourceEvent>>(api, '/api/events');
  const merged = new Map((operations.data?.data ?? []).map(operation => [operation.id, operation]));
  localOperations.forEach(operation => {
    const existing = merged.get(operation.id);
    if (!existing || operation.updated_at > existing.updated_at) merged.set(operation.id, operation);
  });
  const rows = [...merged.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return <details className="activity-panel">
    <summary><span><span className="activity-dot" aria-hidden="true" /> Activity & request review</span><span className="activity-count">{rows.length} {rows.length === 1 ? 'request' : 'requests'} <span aria-hidden="true">+</span></span></summary>
    <div className="activity-body"><div className="section-heading"><p className="muted">Read current request states and signed event receipts.</p><button className="secondary-button" onClick={() => { operations.refresh(); events.refresh(); }} disabled={operations.loading || events.loading}>Refresh activity</button></div>
      {operations.error || events.error ? <p className="error-note" role="alert">{operations.error || events.error}</p> : null}
      <div className="activity-columns"><section aria-labelledby="requests-heading"><h3 id="requests-heading">Recorded requests</h3>{!rows.length ? <p className="empty-note">No requests recorded yet.</p> : <ul className="activity-list">{rows.map(operation => <li key={operation.id}><span><strong>{stateLabel(operation.kind)}</strong><code>{operation.id}</code>{operation.resource_id ? <code>Resource: {operation.resource_id}</code> : <code>Resource not confirmed</code>}</span><span className={`status-pill ${operation.state === 'complete' ? 'success' : 'review'}`}>{stateLabel(operation.state)}</span></li>)}</ul>}
        <p className="small-note">Unknown outcomes require review. Refresh reads to reconcile them; activity never resends a request.</p></section>
        <section aria-labelledby="events-heading"><h3 id="events-heading">Webhook receipts</h3>{!events.data?.data.length ? <p className="empty-note">No visible event receipts yet.</p> : <ul className="activity-list">{events.data.data.map(event => <li key={event.id}><span><strong>{stateLabel(event.type)}</strong><code>{event.id}</code></span><time dateTime={event.created_at}>{dateLabel(event.created_at)}</time></li>)}</ul>}<p className="small-note">Events are signals to refresh current state. They do not start processing.</p></section></div>
    </div>
  </details>;
}
