export type TenantScope = {
  tenantId: string;
  organizationId: string;
};

export function sameScope(a: TenantScope, b: TenantScope) {
  return a.tenantId === b.tenantId && a.organizationId === b.organizationId;
}
