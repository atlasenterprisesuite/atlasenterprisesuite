import type { ComplianceAuditEvent } from '../../../../../packages/compliance/types';

function eventLabel(eventType: string) {
  return eventType
    .replaceAll('.', ' · ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ComplianceTimeline({ events }: { events: ComplianceAuditEvent[] }) {
  return (
    <section className="ride-timeline" aria-labelledby="compliance-timeline-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h2 id="compliance-timeline-title">Compliance timeline</h2>
        </div>
        <span>{events.length}</span>
      </div>
      {events.length === 0 ? (
        <div className="empty-state"><strong>No recorded timeline events</strong><span>ATLAS will show only persisted audit events.</span></div>
      ) : (
        <ol className="ride-timeline-list">
          {events.map((event) => (
            <li key={event.id}>
              <strong>{eventLabel(event.eventType)}</strong>
              <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
