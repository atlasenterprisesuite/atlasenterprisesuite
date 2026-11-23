/**
 * ATLAS Spatial Forge enterprise admission policy. Original code.
 * IMPORTANT: This pure function grants no authority, creates no queue and spends no money.
 * All SpatialDispatchEvidence fields MUST be built by a trusted authenticated ATLAS server
 * using RBAC/RLS, entitlements, configured engine probes and authoritative usage ledgers;
 * never pass HTTP client JSON as this evidence.
 */
export type SpatialCapability =
  | 'procedural-obj' | 'text-to-3d' | 'image-to-3d'
  | 'retopology' | 'pbr-texture' | 'rigging';

export type SpatialJobIntent = {
  tenantId: string;
  orgId: string;
  actorId: string;
  idempotencyKey: string;
  fingerprint: string; // SHA-256 of canonical, tenant-scoped request bytes
  capability: SpatialCapability;
};

export type SpatialEnterprisePolicy = {
  enabled: boolean;
  allowedCapabilities: SpatialCapability[];
  allowedProviderIds: string[];
  allowExternalProcessing: boolean;
  permittedRegions: string[];
  maxConcurrentJobs: number;
  maxMonthlySpendCents: number;
  maxRetentionDays: number;
};

export type SpatialExistingJob = {
  tenantId: string;
  orgId: string;
  jobId: string;
  idempotencyKey: string;
  fingerprint: string;
};

/** Trusted server observations, not values a client may supply or attest. */
export type SpatialDispatchEvidence = {
  tenantId: string;
  orgId: string;
  actorId: string;
  permissions: string[];
  providerId: string;
  providerState: 'verified' | 'unverified' | 'unavailable';
  providerLicensed: boolean;
  providerExternal: boolean;
  executionRegion: string;
  encryptedAtRest: boolean;
  encryptedInTransit: boolean;
  activeJobs: number;
  monthlySpentCents: number;
  estimatedCostCents: number;
  approvedSpendCents: number;
  retentionDays: number;
  existingJob: SpatialExistingJob | null;
};

export type SpatialEnterpriseDenial =
  | 'invalid_job' | 'invalid_accounting' | 'scope_mismatch'
  | 'policy_disabled' | 'missing_permission' | 'missing_billable_permission'
  | 'capability_disallowed' | 'provider_disallowed'
  | 'provider_unverified' | 'provider_unlicensed'
  | 'external_processing_forbidden' | 'region_disallowed'
  | 'encryption_missing' | 'retention_disallowed'
  | 'idempotency_conflict' | 'concurrency_limit'
  | 'spend_not_approved' | 'budget_exceeded';

export type SpatialEnterpriseDecision =
  | { allowed: false; reason: SpatialEnterpriseDenial }
  | { allowed: true; action: 'enqueue'; providerId: string; billable: boolean }
  | { allowed: true; action: 'return-existing'; jobId: string; billable: false };

const CAPABILITIES: readonly SpatialCapability[] = [
  'procedural-obj', 'text-to-3d', 'image-to-3d',
  'retopology', 'pbr-texture', 'rigging'
];

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}
function integer(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

/** Pre-dispatch checks only. Never treats an approved request as a completed 3D asset. */
export function assessSpatialEnterpriseDispatch(
  job: SpatialJobIntent,
  policy: SpatialEnterprisePolicy,
  evidence: SpatialDispatchEvidence
): SpatialEnterpriseDecision {
  const deny = (reason: SpatialEnterpriseDenial): SpatialEnterpriseDecision => ({ allowed: false, reason });
  if (!job || !nonBlank(job.tenantId) || !nonBlank(job.orgId) || !nonBlank(job.actorId) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/.test(job.idempotencyKey ?? '') ||
      !/^sha256:[a-f0-9]{64}$/.test(job.fingerprint ?? '') ||
      !CAPABILITIES.includes(job.capability))
    return deny('invalid_job');
  if (!evidence || !policy || !Array.isArray(evidence.permissions) ||
      !Array.isArray(policy.allowedCapabilities) || !Array.isArray(policy.allowedProviderIds) ||
      !Array.isArray(policy.permittedRegions))
    return deny('invalid_accounting');
  if (job.tenantId !== evidence.tenantId || job.orgId !== evidence.orgId ||
      job.actorId !== evidence.actorId)
    return deny('scope_mismatch');
  if (policy.enabled !== true) return deny('policy_disabled');
  if (!evidence.permissions.includes('creator.spatial.generate')) return deny('missing_permission');
  if (!policy.allowedCapabilities.includes(job.capability)) return deny('capability_disallowed');
  if (!policy.allowedProviderIds.includes(evidence.providerId)) return deny('provider_disallowed');
  if (evidence.providerState !== 'verified') return deny('provider_unverified');
  if (evidence.providerLicensed !== true) return deny('provider_unlicensed');
  if (evidence.providerExternal === true && policy.allowExternalProcessing !== true)
    return deny('external_processing_forbidden');
  if (!policy.permittedRegions.includes(evidence.executionRegion)) return deny('region_disallowed');
  if (evidence.encryptedAtRest !== true || evidence.encryptedInTransit !== true)
    return deny('encryption_missing');
  if (!integer(policy.maxRetentionDays) || !integer(evidence.retentionDays) ||
      evidence.retentionDays < 1 || evidence.retentionDays > policy.maxRetentionDays)
    return deny('retention_disallowed');

  // Ledger lookup is server-scoped by (tenant, org, idempotency key). Never reuse
  // another organization's job, even when request bytes happen to match.
  if (evidence.existingJob) {
    const previous = evidence.existingJob;
    if (previous.tenantId !== job.tenantId || previous.orgId !== job.orgId ||
        previous.idempotencyKey !== job.idempotencyKey ||
        previous.fingerprint !== job.fingerprint || !nonBlank(previous.jobId))
      return deny('idempotency_conflict');
    return { allowed: true, action: 'return-existing', jobId: previous.jobId, billable: false };
  }

  if (![policy.maxConcurrentJobs, policy.maxMonthlySpendCents,
        evidence.activeJobs, evidence.monthlySpentCents,
        evidence.estimatedCostCents, evidence.approvedSpendCents].every(integer))
    return deny('invalid_accounting');
  if (evidence.activeJobs >= policy.maxConcurrentJobs) return deny('concurrency_limit');
  if (evidence.estimatedCostCents > 0) {
    if (!evidence.permissions.includes('creator.spatial.billable'))
      return deny('missing_billable_permission');
    if (evidence.approvedSpendCents < evidence.estimatedCostCents)
      return deny('spend_not_approved');
  }
  // Avoid integer overflow and infer no current budget from missing or stale data.
  if (evidence.monthlySpentCents > policy.maxMonthlySpendCents ||
      evidence.estimatedCostCents > policy.maxMonthlySpendCents - evidence.monthlySpentCents)
    return deny('budget_exceeded');
  return {
    allowed: true, action: 'enqueue', providerId: evidence.providerId,
    billable: evidence.estimatedCostCents > 0
  };
}
