/**
 * Secure Data Room 777 policy kernel.
 * Pure, dependency-free and fail-closed. The server must derive all inputs from
 * authenticated, trusted sources; never accept authorization flags from clients.
 */
export type DataRoomReadContext = Readonly<{
  actorId: string;
  tenantId: string;
  organizationId: string;
  documentTenantId: string;
  documentOrganizationId: string;
  membershipActive: boolean;
  sessionActive: boolean;
  grantActive: boolean;
  documentRevoked: boolean;
}>;

export function authorizeDocumentRead(input: DataRoomReadContext | null | undefined): boolean {
  if (!input) return false;
  return Boolean(
    input.actorId?.trim() &&
    input.tenantId?.trim() &&
    input.organizationId?.trim() &&
    input.documentTenantId?.trim() &&
    input.documentOrganizationId?.trim() &&
    input.documentTenantId === input.tenantId &&
    input.documentOrganizationId === input.organizationId &&
    input.membershipActive === true &&
    input.sessionActive === true &&
    input.grantActive === true &&
    input.documentRevoked === false
  );
}
