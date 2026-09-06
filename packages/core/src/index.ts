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

export type IntegrationPermission =
  | 'integrations.admin'
  | 'google.gmail.read'
  | 'google.gmail.write'
  | 'google.calendar.read'
  | 'google.calendar.write'
  | 'google.drive.read'
  | 'google.drive.write';

export function sameScope(a: TenantScope, b: TenantScope) {
  return a.tenantId === b.tenantId && a.organizationId === b.organizationId;
}

export function hasPermission(
  granted: readonly AccountingPermission[],
  required: AccountingPermission
) {
  return granted.includes(required) || granted.includes('accounting.admin');
}

export function hasIntegrationPermission(
  granted: readonly string[],
  required: IntegrationPermission
) {
  return granted.includes(required) || granted.includes('integrations.admin');
}

export const demoAtlasContext = {
  scope: { tenantId: 'tenant-demo', organizationId: 'org-demo' } satisfies TenantScope,
  actorId: 'demo-user',
  permissions: ['accounting.read'] as AccountingPermission[],
  environment: 'demo' as const
};
