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

export type AtlasPermission =
  | AccountingPermission
  | 'workflow.read'
  | 'workflow.manage'
  | 'workflow.approve'
  | 'workflow.admin'
  | 'agent.execute'
  | 'provider.read'
  | 'provider.manage'
  | 'evidence.read'
  | 'evidence.write'
  | 'usage.read'
  | 'usage.manage'
  | 'creator.generate'
  | 'creator.publish'
  | 'tax.prepare'
  | 'tax.review'
  | 'tax.file'
  | 'pay.card.add'
  | 'pay.card.manage'
  | 'weather.read';

export function sameScope(a: TenantScope, b: TenantScope) {
  return a.tenantId === b.tenantId && a.organizationId === b.organizationId;
}

export function permissionDomain(permission: AtlasPermission): string {
  return permission.split('.', 1)[0];
}

export function hasPermission(
  granted: readonly AtlasPermission[],
  required: AtlasPermission
) {
  if (granted.includes(required)) return true;
  const domainAdmin = `${permissionDomain(required)}.admin`;
  return granted.some((permission) => permission === domainAdmin);
}

export const demoAtlasContext = {
  scope: { tenantId: 'tenant-demo', organizationId: 'org-demo' } satisfies TenantScope,
  actorId: 'demo-user',
  permissions: ['accounting.read'] as AccountingPermission[],
  environment: 'demo' as const
};
