import type { AuditSink } from '../../core/src/audit';
import { canUseHealthPermission, type HealthPermission } from './permissions';
import type { HealthOperationalRecord } from './types';

export type DemoHealthActionError = 'record_not_found' | 'permission_denied' | 'read_only_module';

export function updateDemoHealthRecordStatus(input: {
  records: HealthOperationalRecord[];
  auditSink: AuditSink;
  recordId: string;
  nextStatus: HealthOperationalRecord['status'];
  granted: readonly HealthPermission[];
  actorId: string;
}) {
  const record = input.records.find(item => item.id === input.recordId);
  if (!record) return { ok: false as const, error: 'record_not_found' as DemoHealthActionError };

  const required = record.moduleId === 'safety-security'
    ? 'health.security.write' as const
    : record.moduleId === 'smart-facilities'
      ? 'health.facilities.write' as const
      : null;

  if (!required) return { ok: false as const, error: 'read_only_module' as DemoHealthActionError };
  if (!canUseHealthPermission(input.granted, required)) {
    return { ok: false as const, error: 'permission_denied' as DemoHealthActionError };
  }

  const before = { status: record.status };
  record.status = input.nextStatus;
  const suffix = `${Date.now()}-${record.id}`;
  input.auditSink.append({
    id: `audit-${suffix}`,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    actorId: input.actorId,
    action: 'health.record.status.update',
    entityType: record.moduleId,
    entityId: record.id,
    before,
    after: { status: record.status },
    timestamp: new Date().toISOString(),
    correlationId: `corr-${suffix}`
  });
  return { ok: true as const, record };
}
