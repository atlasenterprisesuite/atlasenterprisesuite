import { atlasAuthorizedJson } from '../lib/atlasSession';
import { ATLAS_MODULES, type AtlasModuleDefinition } from '../modules/registry';

export type AtlasModuleAccessReason =
  | 'allowed'
  | 'entitlement_required'
  | 'entitlement_inactive'
  | 'permission_denied';

export type AtlasModuleAccessRow = {
  module_id: string;
  allowed: boolean;
  reason: AtlasModuleAccessReason;
  entitlement_status: string | null;
  permission_granted: boolean;
};

export function resolveAtlasModuleForPath(pathname: string): AtlasModuleDefinition | null {
  const normalizedPath = pathname.split(/[?#]/, 1)[0] || '/';
  const candidates = [...ATLAS_MODULES].sort((left, right) => right.route.length - left.route.length);
  return candidates.find((module) =>
    normalizedPath === module.route || normalizedPath.startsWith(`${module.route}/`)
  ) || null;
}

export async function getAtlasModuleAccessSnapshot(): Promise<AtlasModuleAccessRow[]> {
  return atlasAuthorizedJson<AtlasModuleAccessRow[]>('/rest/v1/rpc/atlas_module_access_snapshot', {
    method: 'POST',
    body: '{}'
  });
}

export async function canAccessAtlasModule(moduleId: string): Promise<AtlasModuleAccessRow | null> {
  const rows = await getAtlasModuleAccessSnapshot();
  return rows.find((row) => row.module_id === moduleId) || null;
}
