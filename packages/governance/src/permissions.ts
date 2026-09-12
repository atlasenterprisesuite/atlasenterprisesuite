import { sameScope, type TenantScope } from '../../core/src/index';

export type AiPermission =
  | 'ai.task.read'
  | 'ai.task.create'
  | 'ai.task.update'
  | 'ai.delegate'
  | 'ai.repo.read'
  | 'ai.code.write'
  | 'ai.test.execute'
  | 'ai.review.submit'
  | 'ai.pr.create'
  | 'ai.ci.read'
  | 'ai.deploy.request'
  | 'ai.approval.read'
  | 'ai.audit.read'
  | 'release.approve'
  | 'release.deploy';

export interface AtlasActor {
  actorId: string;
  kind: 'human' | 'agent' | 'service';
  scope: TenantScope;
  permissions: readonly AiPermission[];
}

export type AuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: 'scope_mismatch' | 'permission_denied' };

export function authorize(
  actor: AtlasActor,
  permission: AiPermission,
  targetScope: TenantScope
): AuthorizationDecision {
  if (!sameScope(actor.scope, targetScope)) return { allowed: false, reason: 'scope_mismatch' };
  if (!actor.permissions.includes(permission)) return { allowed: false, reason: 'permission_denied' };
  return { allowed: true };
}
