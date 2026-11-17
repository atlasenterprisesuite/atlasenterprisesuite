/**
 * Deterministic, fail-closed route decision for ATLAS Continuity Fabric.
 *
 * Pure policy only: never performs a provider request, permission mutation,
 * storage write, billing action, or automatic regional failover.
 * A caller must validate identity and tenant scope before invoking the route.
 */
export type ContinuityPriority = 'P0' | 'P1';
export type ContinuityProbe = 'healthy' | 'failed' | 'unverified';
export type ContinuityIntegrity = 'verified' | 'failed' | 'unverified' | 'not_required';
export type ContinuityAccess = 'verified' | 'denied' | 'unverified';

export type ContinuityFallback = {
  configured: boolean;
  tenantAccess: ContinuityAccess;
  probe: ContinuityProbe;
  integrity: ContinuityIntegrity;
  sameObjectVersion: boolean;
};

export type ContinuitySignal = {
  dependencyId: string;
  dependencyVerified: boolean;
  priority: ContinuityPriority;
  operation: 'read' | 'write';
  tenantAccess: ContinuityAccess;
  probe: ContinuityProbe;
  integrity: ContinuityIntegrity;
  providerIncidentActive: boolean;
  fallback?: ContinuityFallback;
};

export type ContinuityDecision = {
  gate: 'none' | 'warning' | 'blocked';
  action: 'observe' | 'primary' | 'degrade' | 'deny' | 'verified-read-fallback';
  priority: ContinuityPriority;
  reason: string;
};

export function evaluateContinuity(signal: ContinuitySignal): ContinuityDecision {
  if (!signal.dependencyId?.trim()) throw new Error('invalid_continuity_dependency_id');

  // An external status-page incident is not evidence of an ATLAS dependency.
  if (!signal.dependencyVerified) {
    return { gate: 'none', action: 'observe', priority: 'P1', reason: 'dependency_not_verified' };
  }

  // Unknown permissions must NEVER be replaced by a provider-health heuristic.
  if (signal.tenantAccess !== 'verified') {
    return { gate: 'blocked', action: 'deny', priority: 'P0',
      reason: signal.tenantAccess === 'denied' ? 'tenant_access_denied' : 'tenant_access_unverified' };
  }

  // Integrity failures are never candidates for failover.
  if (signal.integrity === 'failed') {
    return { gate: 'blocked', action: 'deny', priority: 'P0', reason: 'integrity_mismatch' };
  }

  // A healthy, authorized primary must not be redirected merely due to a
  // provider-wide incident banner. The caller must still verify data hashes.
  if (signal.probe === 'healthy' && signal.integrity !== 'unverified') {
    return { gate: 'none', action: 'primary', priority: signal.priority, reason: 'primary_verified' };
  }

  const secondary = signal.fallback;
  // Only an explicitly configured, scoped, *same-version* verified read may
  // use a secondary route. No writes or speculative failover.
  if (signal.operation === 'read' && secondary?.configured &&
      secondary.tenantAccess === 'verified' &&
      secondary.probe === 'healthy' &&
      secondary.integrity === 'verified' &&
      secondary.sameObjectVersion) {
    return { gate: 'none', action: 'verified-read-fallback',
      priority: signal.priority, reason: 'fallback_evidence_complete' };
  }

  if (signal.priority === 'P0') {
    return { gate: 'blocked', action: 'deny', priority: 'P0',
      reason: signal.probe === 'unverified' ? 'primary_unverified' : 'primary_unavailable' };
  }
  return { gate: 'warning', action: 'degrade', priority: 'P1',
    reason: signal.probe === 'unverified' ? 'optional_primary_unverified' : 'optional_primary_unavailable' };
}
