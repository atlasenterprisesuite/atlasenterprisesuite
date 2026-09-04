import type { TenantScope } from './tenancy';

export type AuditEvent = TenantScope & {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  timestamp: string;
  correlationId: string;
};

export interface AuditSink {
  append(event: AuditEvent): void;
  list(scope: TenantScope): readonly AuditEvent[];
}

export class InMemoryAuditSink implements AuditSink {
  private readonly events: AuditEvent[] = [];

  append(event: AuditEvent) {
    this.events.push({ ...event });
  }

  list(scope: TenantScope) {
    return this.events
      .filter(
        (event) =>
          event.tenantId === scope.tenantId &&
          event.organizationId === scope.organizationId
      )
      .map((event) => ({ ...event }));
  }
}
