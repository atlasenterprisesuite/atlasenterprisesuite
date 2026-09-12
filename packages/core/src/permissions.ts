import type { TenantScope } from './scope';

export type AccountingPermission =
  | 'accounting.read'
  | 'accounting.write'
  | 'accounting.post'
  | 'accounting.close'
  | 'accounting.admin';

export type VoicePermission =
  | 'voice.personal.read'
  | 'voice.personal.create'
  | 'voice.personal.record'
  | 'voice.personal.generate'
  | 'voice.personal.use'
  | 'voice.personal.delete'
  | 'voice.apple.request'
  | 'voice.apple.use'
  | 'voice.integration.manage'
  | 'voice.transcript.read';

export type IntegrationPermission =
  | 'integrations.read'
  | 'integrations.write'
  | 'integrations.admin';

export type AgentPermission =
  | 'agents.read'
  | 'agents.write'
  | 'agents.publish'
  | 'agents.admin';

export type SecurityPermission = 'security.admin';
export type AuditPermission = 'audit.read';

export type AtlasPermission =
  | AccountingPermission
  | VoicePermission
  | IntegrationPermission
  | AgentPermission
  | SecurityPermission
  | AuditPermission;

export function hasPermission(
  granted: readonly AtlasPermission[],
  required: AtlasPermission
) {
  if (granted.includes(required)) return true;
  const namespace = required.split('.')[0];
  const admin = `${namespace}.admin` as AtlasPermission;
  return granted.includes(admin);
}

export type AuthorizationContext = {
  scope: TenantScope;
  permissions: readonly AtlasPermission[];
};

export function authorize(
  actor: AuthorizationContext,
  request: { scope: TenantScope; permission: AtlasPermission }
): { ok: true } | { ok: false; reason: 'scope_mismatch' | 'permission_denied' } {
  if (
    actor.scope.tenantId !== request.scope.tenantId ||
    actor.scope.organizationId !== request.scope.organizationId
  ) {
    return { ok: false, reason: 'scope_mismatch' };
  }

  return hasPermission(actor.permissions, request.permission)
    ? { ok: true }
    : { ok: false, reason: 'permission_denied' };
}
