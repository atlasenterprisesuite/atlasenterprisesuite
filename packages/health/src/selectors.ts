import type { TenantScope } from '../../core/src';
import type { HealthModuleId } from './types';

export function filterHealthRecords<T extends { title: string; status: string }>(
  records: readonly T[],
  query: string,
  status: string
) {
  const normalized = query.trim().toLowerCase();
  return records.filter((record) => {
    const matchesQuery = normalized.length === 0 || record.title.toLowerCase().includes(normalized);
    const matchesStatus = status === 'all' || record.status === status;
    return matchesQuery && matchesStatus;
  });
}

export function recordsForModule<T extends TenantScope & { moduleId: HealthModuleId }>(
  records: readonly T[],
  moduleId: HealthModuleId,
  scope?: TenantScope
) {
  return records.filter((record) => {
    const matchesModule = record.moduleId === moduleId;
    if (!scope) return matchesModule;
    return matchesModule && record.tenantId === scope.tenantId && record.organizationId === scope.organizationId;
  });
}

export function metricsForModule<T extends { moduleId: HealthModuleId }>(
  metrics: readonly T[],
  moduleId: HealthModuleId
) {
  return metrics.filter((metric) => metric.moduleId === moduleId);
}
