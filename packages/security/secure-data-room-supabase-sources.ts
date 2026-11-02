import type { TrustedDataRoomSources } from './secure-data-room-trusted-adapter';

/**
 * Scoped user-client lookups for the (currently deny-all) Data Room schema.
 * Only user-scoped read clients may implement this interface. Never use a
 * service-role client here. Every lookup receives the request's bearer token;
 * do not cache a mutable token in a shared singleton.
 */
export type DataRoomScopedRead = (
  bearerToken: string,
  table: 'atlas_data_room_documents' | 'atlas_data_room_grants' | 'organization_members',
  columns: string,
  equals: Readonly<Record<string, string>>
) => Promise<Record<string, unknown> | null>;

const nonempty = (value: string) => typeof value === 'string' && value.trim().length > 0;
const same = (value: unknown, expected: string) => typeof value === 'string' && value === expected;

export function createScopedSupabaseDataRoomSources(
  readOne: DataRoomScopedRead,
  now: () => number = Date.now
): Pick<TrustedDataRoomSources, 'document' | 'membership' | 'grant'> {
  return {
    async document(documentId, userId, bearerToken) {
      if (![documentId, userId, bearerToken].every(nonempty)) return null;
      const row = await readOne(
        bearerToken,
        'atlas_data_room_documents',
        'id,organization_id,tenant_id,revoked_at',
        { id: documentId }
      );
      if (!row || !same(row.id, documentId) ||
          !nonempty(row.organization_id as string) ||
          !nonempty(row.tenant_id as string) ||
          !Object.prototype.hasOwnProperty.call(row, 'revoked_at')) return null;
      return {
        organizationId: row.organization_id as string,
        tenantId: row.tenant_id as string,
        revoked: row.revoked_at !== null
      };
    },

    async membership(userId, organizationId, tenantId, bearerToken) {
      if (![userId, organizationId, tenantId, bearerToken].every(nonempty)) return null;
      // Existing ATLAS Ride context uses tenant_id = organization_id for
      // this compatibility slice. Reject any other mapping until certified.
      if (organizationId !== tenantId) return null;
      const row = await readOne(
        bearerToken,
        'organization_members',
        'user_id,org_id,status',
        { user_id: userId, org_id: organizationId, status: 'active' }
      );
      if (!row || !same(row.user_id, userId) ||
          !same(row.org_id, organizationId) || row.status !== 'active') return null;
      return { tenantId, active: true };
    },

    async grant(userId, documentId, organizationId, tenantId, bearerToken) {
      if (![userId, documentId, organizationId, tenantId, bearerToken].every(nonempty)) return false;
      if (organizationId !== tenantId) return false;
      const row = await readOne(
        bearerToken,
        'atlas_data_room_grants',
        'document_id,grantee_user_id,organization_id,tenant_id,revoked_at,expires_at',
        {
          document_id: documentId,
          grantee_user_id: userId,
          organization_id: organizationId,
          tenant_id: tenantId
        }
      );
      if (!row ||
          !same(row.document_id, documentId) ||
          !same(row.grantee_user_id, userId) ||
          !same(row.organization_id, organizationId) ||
          !same(row.tenant_id, tenantId) ||
          row.revoked_at !== null ||
          !Object.prototype.hasOwnProperty.call(row, 'expires_at')) return false;
      if (row.expires_at !== null) {
        if (typeof row.expires_at !== 'string') return false;
        const expiry = Date.parse(row.expires_at);
        if (!Number.isFinite(expiry) || expiry <= now()) return false;
      }
      return true;
    }
  };
}
