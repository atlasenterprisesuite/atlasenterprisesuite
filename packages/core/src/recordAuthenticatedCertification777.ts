import { trustedCertificationStore777, type VerifiedMembership777 } from './trustedCertificationStore777';
import type { CertificationRpc777 } from './atomicCertificationStore777';
import type { ReadinessResult } from './integrationReadiness777';

/** Server-only dependency contract: user client must carry the request's verified JWT. */
export type CertificationAuthClient777 = {
  auth: { getUser: (jwt: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  from: (table: 'organization_members') => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            limit: (count: number) => Promise<{ data: VerifiedMembership777[] | null; error: unknown }>
          }
        }
      }
    }
  };
};
export type CertificationServerClients777 = {
  authenticated: CertificationAuthClient777;
  privilegedRpc: CertificationRpc777;
};
/** Never accepts tenant ID or an identity supplied by the request body. */
export async function recordAuthenticatedCertification777(
  bearerToken: string,
  requestedOrganizationId: string,
  evidence: ReadinessResult,
  clients: CertificationServerClients777
): Promise<void> {
  if (!bearerToken || !/^Bearer\s+\S+$/i.test(bearerToken))
    throw new Error('CERTIFICATION_AUTH_REQUIRED');
  const token = bearerToken.replace(/^Bearer\s+/i, '');
  const { data, error } = await clients.authenticated.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error('CERTIFICATION_AUTH_REQUIRED');
  const userId = data.user.id;
  const memberships = async (verifiedUserId: string) => {
    if (verifiedUserId !== userId) throw new Error('CERTIFICATION_IDENTITY_MISMATCH');
    const result = await clients.authenticated.from('organization_members')
      .select('org_id,role,status')
      .eq('user_id', userId)
      .eq('org_id', requestedOrganizationId)
      .eq('status', 'active')
      .limit(2);
    if (result.error || !result.data) throw new Error('CERTIFICATION_MEMBERSHIP_UNAVAILABLE');
    return result.data;
  };
  const store = await trustedCertificationStore777({ userId, memberships }, requestedOrganizationId, clients.privilegedRpc);
  await store.record(evidence);
}
