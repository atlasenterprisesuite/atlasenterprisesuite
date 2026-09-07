export type TenantScope = {
  tenantId: string;
  organizationId: string;
};

export type AccountingPermission =
  | 'accounting.read'
  | 'accounting.write'
  | 'accounting.post'
  | 'accounting.close'
  | 'accounting.admin'
  | 'audit.read';

export type VoicePermission =
  | 'voice.personal.read'
  | 'voice.personal.create'
  | 'voice.personal.record'
  | 'voice.personal.generate'
  | 'voice.personal.use'
  | 'voice.personal.delete'
  | 'voice.apple.request'
  | 'voice.apple.use'
  | 'voice.integration.manage';

export type AtlasPermission = AccountingPermission | VoicePermission;

export function sameScope(a: TenantScope, b: TenantScope) {
  return a.tenantId === b.tenantId && a.organizationId === b.organizationId;
}

export function hasPermission(
  granted: readonly AtlasPermission[],
  required: AtlasPermission
) {
  if (granted.includes(required)) return true;
  if (required.startsWith('accounting.') && granted.includes('accounting.admin')) return true;
  return false;
}

export const demoAtlasContext = {
  scope: { tenantId: 'tenant-demo', organizationId: 'org-demo' } satisfies TenantScope,
  actorId: 'demo-user',
  permissions: ['accounting.read'] as AtlasPermission[],
  environment: 'demo' as const
};
