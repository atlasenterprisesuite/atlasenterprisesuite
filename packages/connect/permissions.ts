import type { AtlasPermission } from './types';

export interface PermissionAdapter {
  has(permission: AtlasPermission): boolean;
}

const developmentPermissions = new Set<AtlasPermission>([
  'studio.draft.create',
  'studio.draft.edit',
  'connect.destination.read',
  'connect.publish.request',
  'connect.publish.confirm_manual',
  'connect.publish.retry',
  'connect.audit.read'
]);

export function createDevelopmentPermissionAdapter(): PermissionAdapter {
  return {
    has(permission: AtlasPermission): boolean {
      return developmentPermissions.has(permission);
    }
  };
}

export function requirePermission(adapter: PermissionAdapter, permission: AtlasPermission): void {
  if (!adapter.has(permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}
