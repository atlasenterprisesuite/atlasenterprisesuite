import type { IntegrationActorContext, IntegrationPermission } from './types';

export function hasIntegrationPermission(
  context: IntegrationActorContext,
  permission: IntegrationPermission
) {
  return context.permissions.includes(permission);
}

export function requireIntegrationPermission(
  context: IntegrationActorContext,
  permission: IntegrationPermission
) {
  if (!hasIntegrationPermission(context, permission)) {
    throw new Error('authorization_denied');
  }
}
