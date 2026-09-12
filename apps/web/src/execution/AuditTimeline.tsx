import type { GuidedAuditEvent } from './types';

function label(value: string | null) {
  if (!value) return '—';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AuditTimeline({ events, error }: { events: GuidedAuditEvent[] | null; error?: string | null }) {
  return (
    <section className="execution-panel execution-audit" aria-labelledby="execution-audit-title">
      <h3 id="execution-audit-title">Audit timeline</h3>
      {error ? <div role="alert">Audit unavailable: {error}</div> : null}
      {!error && events === null ? <p>Audit history is not available for this identity.</p> : null}
      {!error && events?.length === 0 ? <p>No audit events are persisted for this workflow.</p> : null}
      {!error && events && events.length > 0 ? (
        <ol>
          {events.map((event) => (
            <li key={event.id}>
              <div className="execution-audit-heading">
                <strong>{event.action}</strong>
                {event.createdAt ? <time dateTime={event.createdAt}>{event.createdAt}</time> : null}
              </div>
              <dl>
                <div><dt>Module</dt><dd>{event.module}</dd></div>
                <div><dt>State</dt><dd>{label(event.previousState)} → {label(event.resultingState)}</dd></div>
                <div><dt>Actor</dt><dd><code>{event.actorUserId}</code></dd></div>
                {event.correlationId ? <div><dt>Correlation</dt><dd><code>{event.correlationId}</code></dd></div> : null}
              </dl>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
