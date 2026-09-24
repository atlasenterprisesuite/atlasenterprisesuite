import type { HospitalityActorContext, HospitalityPermission } from './types';

function isRoomAccessPermission(permission: HospitalityPermission) {
  return permission.startsWith('hospitality.access.');
}

export function hasHospitalityPermission(
  context: HospitalityActorContext,
  permission: HospitalityPermission
) {
  if (context.permissions.includes(permission)) {
    return true;
  }

  return isRoomAccessPermission(permission) && context.permissions.includes('hospitality.access.admin');
}

export function requireHospitalityPermission(
  context: HospitalityActorContext,
  permission: HospitalityPermission
) {
  if (!hasHospitalityPermission(context, permission)) {
    throw new Error('authorization_denied');
  }
}
