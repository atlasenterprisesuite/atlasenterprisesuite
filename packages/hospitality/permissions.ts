import type { HospitalityActorContext, HospitalityPermission } from './types';

export function hasHospitalityPermission(
  context: HospitalityActorContext,
  permission: HospitalityPermission
) {
  return context.permissions.includes('hospitality.access.admin') || context.permissions.includes(permission);
}

export function requireHospitalityPermission(
  context: HospitalityActorContext,
  permission: HospitalityPermission
) {
  if (!hasHospitalityPermission(context, permission)) {
    throw new Error('authorization_denied');
  }
}
