import type { TenantScope } from './scope';

export type AuditResult = 'success' | 'denied' | 'failed';

export type AtlasAuditEvent = {
  scope: TenantScope;
  actorId: string;
  action: string;
  resource: string;
  result: AuditResult;
  occurredAt: string;
  evidenceRef?: string;
};

export function createAuditEvent(event: AtlasAuditEvent): AtlasAuditEvent {
  return Object.freeze({ ...event, scope: Object.freeze({ ...event.scope }) });
}
