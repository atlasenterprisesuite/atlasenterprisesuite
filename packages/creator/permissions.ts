import type { CreatorPermission } from './types';

const ALL: CreatorPermission[] = [
  'creator.read', 'creator.write', 'creator.generate',
  'creator.manage_providers', 'creator.publish', 'creator.admin'
];

export function creatorPermissionsForRole(role: string): CreatorPermission[] {
  return ['owner', 'admin', 'platform_admin'].includes(role) ? [...ALL] : ['creator.read'];
}

export function hasCreatorPermission(permissions: readonly CreatorPermission[], permission: CreatorPermission) {
  return permissions.includes('creator.admin') || permissions.includes(permission);
}

export function requireCreatorPermission(permissions: readonly CreatorPermission[], permission: CreatorPermission) {
  if (!hasCreatorPermission(permissions, permission)) throw new Error('authorization_denied');
}
