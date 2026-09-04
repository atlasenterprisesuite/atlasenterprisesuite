import type { TenantScope } from '../../core/src/tenancy';
import type { HealthMetric, HealthModuleId, HealthOperationalRecord } from './types';

export function recordsForModule(
  records: readonly HealthOperationalRecord[],
  moduleId: HealthModuleId,
  scope: TenantScope
) {
  return records.filter(record =>
    record.moduleId === moduleId &&
    record.tenantId === scope.tenantId &&
    record.organizationId === scope.organizationId
  );
}

export function filterHealthRecords<T extends { title: string; status: string }>(
  records: readonly T[],
  query: string,
  status: string
) {
  const normalized = query.trim().toLowerCase();
  return records.filter(record => {
    const matchesQuery = normalized.length === 0 || record.title.toLowerCase().includes(normalized);
    const matchesStatus = status === 'all' || record.status === status;
    return matchesQuery && matchesStatus;
  });
}

export function metricsForModule(metrics: readonly HealthMetric[], moduleId: HealthModuleId) {
  return metrics.filter(metric => metric.moduleId === moduleId);
}
