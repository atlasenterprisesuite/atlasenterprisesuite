export type AtlasIdentityContextRow = {
  tenant_id: unknown;
  tenant_name: unknown;
  organization_id: unknown;
  organization_name: unknown;
  role: unknown;
  permissions: unknown;
};

export type AtlasIdentityContractState =
  | {
      status: 'ready';
      userId: string;
      tenantId: string;
      tenantName: string;
      organizationId: string;
      organizationName: string;
      role: string;
      permissions: string[];
    }
  | { status: 'error'; message: string };

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function mapAtlasIdentityContextRow(
  userId: string,
  row: AtlasIdentityContextRow,
): AtlasIdentityContractState {
  if (
    !nonEmptyString(row.tenant_id) ||
    !nonEmptyString(row.tenant_name) ||
    !nonEmptyString(row.organization_id) ||
    !nonEmptyString(row.organization_name) ||
    !nonEmptyString(row.role)
  ) {
    return {
      status: 'error',
      message: 'Unable to resolve a complete ATLAS tenant scope.',
    };
  }

  if (!Array.isArray(row.permissions) || row.permissions.some((permission) => !nonEmptyString(permission))) {
    return {
      status: 'error',
      message: 'Unable to resolve ATLAS permissions for the active organization.',
    };
  }

  return {
    status: 'ready',
    userId,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    role: row.role,
    permissions: [...new Set(row.permissions)].sort(),
  };
}
