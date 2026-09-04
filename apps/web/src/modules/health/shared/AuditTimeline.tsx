import type { AuditEvent } from '../healthDomain';

export function AuditTimeline({ events }: { events: readonly AuditEvent[] }) {
  if (events.length === 0) return <div className="empty-state"><strong>No audit events</strong><span>No demo mutations have been recorded for this module and organization.</span></div>;
  return <ol className="audit-timeline">{events.map(event => <li key={event.id}><strong>{event.action}</strong><span>{event.entityType} · {event.entityId}</span><small>{event.timestamp}</small></li>)}</ol>;
}
