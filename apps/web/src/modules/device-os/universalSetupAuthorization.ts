/** Contract-only authorization preflight. Never issues migration permission.
 * Actual authorization requires server-side authenticated actor, RLS, consent
 * verification, an atomic idempotency claim and an audited adapter operation.
 */
export type MigrationEvidence = Readonly<{
  actorId: string;
  tenantId: string;
  deviceId: string;
  permissionGranted: boolean;
  tenantMembershipVerified: boolean;
  consent: null | Readonly<{ actorId: string; tenantId: string; deviceId: string; status: 'active' | 'revoked' }>;
  adapter: null | Readonly<{ tenantId: string; deviceId: string; status: 'verified' | 'unverified' }>;
  idempotency: null | Readonly<{ tenantId: string; deviceId: string; status: 'reserved' | 'replayed' }>;
  source?: 'client' | 'server';
}>;
export function authorizeMigrationEvidence(evidence: MigrationEvidence): { allowed: false; blockers: string[] } {
  const blockers: string[] = [];
  if (evidence.source !== 'server') blockers.push('untrusted-source');
  if (!evidence.actorId || !evidence.tenantId || !evidence.deviceId ||
      !evidence.permissionGranted || !evidence.tenantMembershipVerified) blockers.push('identity-or-membership');
  if (!evidence.consent || evidence.consent.status !== 'active' ||
      evidence.consent.actorId !== evidence.actorId ||
      evidence.consent.tenantId !== evidence.tenantId ||
      evidence.consent.deviceId !== evidence.deviceId) blockers.push('consent');
  if (!evidence.adapter || evidence.adapter.status !== 'verified' ||
      evidence.adapter.tenantId !== evidence.tenantId ||
      evidence.adapter.deviceId !== evidence.deviceId) blockers.push('adapter');
  if (!evidence.idempotency || evidence.idempotency.status !== 'reserved' ||
      evidence.idempotency.tenantId !== evidence.tenantId ||
      evidence.idempotency.deviceId !== evidence.deviceId) blockers.push('idempotency');
  // Never grant permission from browser-supplied data, including claimed server evidence.
  blockers.push('server-authorization-not-implemented');
  return { allowed: false, blockers };
}
