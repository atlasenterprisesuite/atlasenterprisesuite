import { sameScope, type TenantScope } from './tenancy';

export type AuditEvent = {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly actorId: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly timestamp: string;
  readonly correlationId: string;
};

export interface AuditSink {
  append(event: AuditEvent): void;
  list(scope: TenantScope): AuditEvent[];
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function cloneEvent(event: AuditEvent): AuditEvent {
  return {
    ...event,
    before: cloneValue(event.before),
    after: cloneValue(event.after),
  };
}

export class InMemoryAuditSink implements AuditSink {
  private readonly events: AuditEvent[] = [];

  append(event: AuditEvent): void {
    this.events.push(cloneEvent(event));
  }

  list(scope: TenantScope): AuditEvent[] {
    return this.events
      .filter((event) => sameScope(event, scope))
      .map(cloneEvent);
  }
}
