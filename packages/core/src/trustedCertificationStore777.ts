/**
 * Trusted server boundary for atomic certification.
 * A requested organization is only a selector, never authorization.
 * Inject a user-authenticated membership lookup, not a service-role lookup.
 */
import { atomicCertificationStore777, type CertificationRpc777 } from './atomicCertificationStore777';
import type { ReadinessResult } from './integrationReadiness777';

export type VerifiedMembership777 = {
  org_id: string; role: string; status: string;
};
export type CertificationIdentity777 = {
  userId: string;
  memberships: (userId: string) => Promise<readonly VerifiedMembership777[]>;
};
export async function trustedCertificationStore777(
  identity: CertificationIdentity777,
  requestedOrganizationId: string,
  rpc: CertificationRpc777
) {
  if (!identity.userId || !/^[0-9a-f-]{36}$/i.test(requestedOrganizationId))
    throw new Error('CERTIFICATION_IDENTITY_REQUIRED');
  const memberships = await identity.memberships(identity.userId);
  const active = memberships.filter(m => m.org_id === requestedOrganizationId && m.status === 'active');
  if (active.length !== 1 || !['owner', 'admin', 'platform_admin'].includes(active[0].role))
    throw new Error('CERTIFICATION_MEMBERSHIP_REQUIRED');
  // Existing Ride compliance contract: tenant_id equals verified organization_id.
  const store = atomicCertificationStore777({
    organizationId: active[0].org_id, tenantId: active[0].org_id
  }, rpc);
  return { record: (evidence: ReadinessResult) => store.record(evidence) };
}
