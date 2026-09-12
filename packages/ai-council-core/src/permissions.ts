import { hasPermission, type AtlasPermission, type TenantScope } from '../../core/src';

export type CouncilPermission =
  | 'ai_council.read'
  | 'ai_council.invoke'
  | 'ai_council.consensus'
  | 'ai_council.delegate'
  | 'ai_council.approve'
  | 'ai_council.admin';

export type CouncilActor = TenantScope & {
  userId: string;
  permissions: readonly AtlasPermission[];
};

export function hasCouncilPermission(
  granted: readonly AtlasPermission[],
  required: CouncilPermission,
): boolean {
  return hasPermission(granted, required) || granted.includes('ai_council.admin');
}
