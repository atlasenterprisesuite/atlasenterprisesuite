export type HealthPermission =
  | 'health.read'
  | 'health.executive.read'
  | 'health.operations.read'
  | 'health.operations.write'
  | 'health.clinical.read'
  | 'health.patient_experience.read'
  | 'health.finance.read'
  | 'health.workforce.read'
  | 'health.pharmacy.read'
  | 'health.supply_chain.read'
  | 'health.facilities.read'
  | 'health.facilities.write'
  | 'health.security.read'
  | 'health.security.write'
  | 'health.research.read'
  | 'health.research.write'
  | 'health.integrations.admin'
  | 'audit.read'
  | 'health.admin';

export function canUseHealthPermission(
  granted: readonly HealthPermission[],
  required: HealthPermission
) {
  return granted.includes(required) || granted.includes('health.admin');
}
