import type { ReadinessLedger, CertificationAuditEvent } from './certificationAudit777';
import type { ReadinessResult } from './integrationReadiness777';

/** Server-only adapter boundary. Implement transaction against an isolated, RLS-protected store. */
export type ScopedReadinessStore = {
  load: (organizationId: string, moduleId: string) => Promise<ReadinessResult | null>;
  appendIfAbsent: (organizationId: string, event: CertificationAuditEvent) => Promise<boolean>;
  save: (organizationId: string, current: ReadinessResult) => Promise<void>;
};

/** Tenant scope is captured by the trusted server, never supplied by an event payload. */
export function scopedReadinessLedger(organizationId: string, store: ScopedReadinessStore): ReadinessLedger {
  if (!organizationId || organizationId.trim() !== organizationId)
    throw new Error('INVALID_ORGANIZATION_SCOPE');
  return {
    load: (moduleId) => store.load(organizationId, moduleId),
    appendIfAbsent: (event) => store.appendIfAbsent(organizationId, {
      ...event, eventId: [organizationId, event.eventId].join(':')
    }),
    save: (current) => store.save(organizationId, current)
  };
}
