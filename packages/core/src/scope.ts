export type TenantScope = {
  tenantId: string;
  organizationId: string;
};

export const sameScope = (a: TenantScope, b: TenantScope) =>
  a.tenantId === b.tenantId && a.organizationId === b.organizationId;
