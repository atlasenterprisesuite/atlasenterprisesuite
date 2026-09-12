import { hasPermission, type AtlasPermission } from '../../../../../packages/core/src';
import type { AtlasModuleDefinition } from './moduleCatalog';

export type AtlasModuleAvailability =
  | 'available'
  | 'partial'
  | 'blocked'
  | 'configuration_required'
  | 'not_enabled'
  | 'unauthorized'
  | 'organization_state_unknown';

export function resolveAtlasModuleAvailability(
  module: AtlasModuleDefinition,
  permissions: readonly AtlasPermission[],
  enabledModuleCodes?: ReadonlySet<string>,
): AtlasModuleAvailability {
  if (module.permissions?.length && !module.permissions.some((permission) => hasPermission(permissions, permission))) {
    return 'unauthorized';
  }

  if (module.implementationState === 'blocked') return 'blocked';
  if (module.implementationState === 'configuration_required') return 'configuration_required';

  if (module.moduleCodes.length > 0) {
    if (!enabledModuleCodes) return 'organization_state_unknown';
    if (!module.moduleCodes.some((code) => enabledModuleCodes.has(code))) return 'not_enabled';
  }

  if (module.implementationState === 'partial') return 'partial';
  return 'available';
}
