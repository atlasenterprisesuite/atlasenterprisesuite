import type { DataRoomReadContext } from './secure-data-room-policy';
import { resolveDataRoomRead } from './secure-data-room-read-boundary';

/**
 * Adapter boundary for authoritative server-side sources.
 * No client-provided org, tenant, membership, or grant flags are accepted.
 * The document repository must be RLS protected and scoped to authenticated user.
 */
export type TrustedDataRoomSources = {
  authenticate: (bearerToken: string) => Promise<{ userId: string; sessionActive: boolean } | null>;
  document: (documentId: string, userId: string, bearerToken: string) => Promise<{
    tenantId: string; organizationId: string; revoked: boolean;
  } | null>;
  membership: (userId: string, organizationId: string, tenantId: string, bearerToken: string) => Promise<{
    tenantId: string; active: boolean;
  } | null>;
  grant: (userId: string, documentId: string, organizationId: string, tenantId: string, bearerToken: string) => Promise<boolean>;
};

export async function authorizeTrustedDataRoomRead(
  request: Readonly<{ bearerToken?: string | null; documentId?: string | null }>,
  sources: TrustedDataRoomSources
) {
  return resolveDataRoomRead(request, async ({ bearerToken, documentId }): Promise<DataRoomReadContext | null> => {
    const actor = await sources.authenticate(bearerToken);
    if (!actor?.userId || actor.sessionActive !== true) return null;
    const doc = await sources.document(documentId, actor.userId, bearerToken);
    if (!doc?.tenantId || !doc.organizationId || doc.revoked) return null;
    const membership = await sources.membership(actor.userId, doc.organizationId, doc.tenantId, bearerToken);
    if (!membership?.tenantId || membership.active !== true || membership.tenantId !== doc.tenantId) return null;
    const grantActive = await sources.grant(actor.userId, documentId, doc.organizationId, doc.tenantId, bearerToken);
    return {
      actorId: actor.userId,
      tenantId: membership.tenantId,
      organizationId: doc.organizationId,
      documentTenantId: doc.tenantId,
      documentOrganizationId: doc.organizationId,
      membershipActive: membership.active,
      sessionActive: actor.sessionActive,
      grantActive,
      documentRevoked: doc.revoked
    };
  });
}
