import type { CompliancePermission } from './types';

export function hasCompliancePermission(
  granted: readonly CompliancePermission[],
  required: CompliancePermission
) {
  return granted.includes('ride.compliance.manage') || granted.includes(required);
}

export function requireCompliancePermission(
  granted: readonly CompliancePermission[],
  required: CompliancePermission
) {
  if (!hasCompliancePermission(granted, required)) throw new Error('authorization_denied');
}
