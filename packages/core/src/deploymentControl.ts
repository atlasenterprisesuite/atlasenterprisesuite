export type AtlasDeployProvider =
  | 'atlas-edge'
  | 'cloudflare'
  | 'supabase'
  | 'vercel'
  | 'self-hosted'
  | 'custom';

export type AtlasDeployEnvironment = 'preview' | 'staging' | 'production';

export type AtlasDeployState =
  | 'queued'
  | 'building'
  | 'preview_ready'
  | 'awaiting_gates'
  | 'ready_to_promote'
  | 'promoting'
  | 'production'
  | 'blocked'
  | 'failed'
  | 'rolled_back'
  | 'cancelled';

export type AtlasDeploymentEvidence = {
  sourceSha: string;
  buildVerified: boolean;
  providerDeploymentId?: string;
  providerVerified: boolean;
  runtimeVerified: boolean;
  exactShaVerified: boolean;
  checkedAt?: string;
};

export type AtlasDeploymentTruth =
  | 'source_only'
  | 'build_verified'
  | 'provider_deployed'
  | 'runtime_verified'
  | 'verified_production';

export type AtlasDeployRequest = {
  id: string;
  project: string;
  sourceSha: string;
  environment: AtlasDeployEnvironment;
  provider: AtlasDeployProvider;
  requestedAt: number;
  priority?: number;
};

export type AtlasDeployQueuePolicy = {
  maxConcurrent: number;
  minProviderIntervalMs: number;
  coalesceSameSource: boolean;
};

export type AtlasDeployQueueDecision = {
  launch: AtlasDeployRequest[];
  deferred: AtlasDeployRequest[];
  coalesced: AtlasDeployRequest[];
};

export type AtlasDeploymentCapability =
  | 'immutable-manifests'
  | 'preview-environments'
  | 'deployment-checks'
  | 'rate-limit-aware-queue'
  | 'atomic-promotion'
  | 'canary-rollout'
  | 'verified-rollback'
  | 'edge-routing'
  | 'cache-control'
  | 'scheduled-jobs'
  | 'feature-flags'
  | 'runtime-observability'
  | 'security-policy'
  | 'provider-failover';

export const ATLAS_DEPLOY_CAPABILITIES: readonly AtlasDeploymentCapability[] = [
  'immutable-manifests',
  'preview-environments',
  'deployment-checks',
  'rate-limit-aware-queue',
  'atomic-promotion',
  'canary-rollout',
  'verified-rollback',
  'edge-routing',
  'cache-control',
  'scheduled-jobs',
  'feature-flags',
  'runtime-observability',
  'security-policy',
  'provider-failover'
] as const;

function normalizedPriority(request: AtlasDeployRequest): number {
  return Number.isFinite(request.priority) ? Number(request.priority) : 0;
}

function stableQueueSort(a: AtlasDeployRequest, b: AtlasDeployRequest): number {
  const byPriority = normalizedPriority(b) - normalizedPriority(a);
  if (byPriority !== 0) return byPriority;
  const byTime = a.requestedAt - b.requestedAt;
  if (byTime !== 0) return byTime;
  return a.id.localeCompare(b.id);
}

function coalesceKey(request: AtlasDeployRequest): string {
  return [
    request.project,
    request.sourceSha,
    request.environment,
    request.provider
  ].join(':');
}

export function planAtlasDeployQueue(input: {
  requests: readonly AtlasDeployRequest[];
  inFlight: readonly AtlasDeployRequest[];
  lastProviderLaunchAt?: Partial<Record<AtlasDeployProvider, number>>;
  now: number;
  policy: AtlasDeployQueuePolicy;
}): AtlasDeployQueueDecision {
  const { policy } = input;
  if (!Number.isInteger(policy.maxConcurrent) || policy.maxConcurrent < 1) {
    throw new Error('ATLAS deploy maxConcurrent must be at least 1');
  }
  if (!Number.isFinite(policy.minProviderIntervalMs) || policy.minProviderIntervalMs < 0) {
    throw new Error('ATLAS deploy provider interval must be non-negative');
  }
  if (!Number.isFinite(input.now) || input.now < 0) {
    throw new Error('ATLAS deploy clock is invalid');
  }

  const available = Math.max(0, policy.maxConcurrent - input.inFlight.length);
  const sorted = [...input.requests].sort(stableQueueSort);
  const seen = new Set<string>(policy.coalesceSameSource ? input.inFlight.map(coalesceKey) : []);
  const launch: AtlasDeployRequest[] = [];
  const deferred: AtlasDeployRequest[] = [];
  const coalesced: AtlasDeployRequest[] = [];

  for (const request of sorted) {
    const key = coalesceKey(request);
    if (policy.coalesceSameSource && seen.has(key)) {
      coalesced.push(request);
      continue;
    }
    seen.add(key);

    if (launch.length >= available) {
      deferred.push(request);
      continue;
    }

    const lastLaunch = input.lastProviderLaunchAt?.[request.provider];
    const providerCoolingDown =
      typeof lastLaunch === 'number' &&
      input.now - lastLaunch < policy.minProviderIntervalMs;

    const providerAlreadySelected = launch.some(
      candidate => candidate.provider === request.provider
    );

    if (providerCoolingDown || providerAlreadySelected) {
      deferred.push(request);
      continue;
    }

    launch.push(request);
  }

  return { launch, deferred, coalesced };
}

export function resolveAtlasDeploymentTruth(
  evidence: AtlasDeploymentEvidence
): AtlasDeploymentTruth {
  if (!evidence.buildVerified) return 'source_only';
  if (!evidence.providerVerified || !evidence.providerDeploymentId) {
    return 'build_verified';
  }
  if (!evidence.runtimeVerified) return 'provider_deployed';
  if (!evidence.exactShaVerified) return 'runtime_verified';
  return 'verified_production';
}

export function canClaimAtlasProductionLive(
  evidence: AtlasDeploymentEvidence
): boolean {
  return resolveAtlasDeploymentTruth(evidence) === 'verified_production';
}

export function assertAtlasPromotionAllowed(input: {
  environment: AtlasDeployEnvironment;
  requiredChecksPassed: boolean;
  evidence: AtlasDeploymentEvidence;
}): void {
  if (!input.requiredChecksPassed) {
    throw new Error('ATLAS deployment checks are not green');
  }
  if (!input.evidence.buildVerified) {
    throw new Error('ATLAS build evidence is missing');
  }
  if (input.environment === 'production' && !input.evidence.providerVerified) {
    throw new Error('ATLAS provider deployment evidence is missing');
  }
}

export type AtlasProviderAdapter = {
  provider: AtlasDeployProvider;
  createPreview(input: AtlasDeployRequest): Promise<{ deploymentId: string }>;
  promote(input: {
    deploymentId: string;
    sourceSha: string;
  }): Promise<{ providerEvidenceRef: string }>;
  rollback(input: {
    deploymentId: string;
    previousDeploymentId: string;
  }): Promise<{ providerEvidenceRef: string }>;
  verify(input: {
    deploymentId: string;
    sourceSha: string;
  }): Promise<AtlasDeploymentEvidence>;
};

/**
 * ATLAS Deploy read-model (not a deployment runner). An owner-scoped release row
 * and a current ATLAS Manager snapshot are necessary to start release review.
 * Neither proves the exact release is live. Production truth is resolved by
 * the existing runtime verifier / master evidence registry, never by this UI.
 */
export type AtlasSovereignInfraSnapshot = {
  scope?: { organization_id?: string | null };
  canonical_repository?: string;
  production_readiness?: string;
  provider_requirements?: Partial<Record<'github' | 'supabase' | 'cloudflare' | 'production' | 'vercel', boolean>>;
  provider_status?: Partial<Record<'github' | 'supabase' | 'cloudflare' | 'production' | 'vercel', {
    state?: string;
    required?: boolean;
  }>>;
  blockers?: readonly { stage?: string; code?: string }[];
  evidence?: { generated_at?: string };
};

export type AtlasSovereignReleaseSummary = {
  id: string;
  release_key: string;
  status: string;
  channel: string;
  source_ref: string | null;
};

export type AtlasSovereignDeployReadiness = {
  status: 'blocked' | 'review_required';
  blockers: string[];
  targetSha: string | null;
  verifiedProduction: false;
  providerStates: Record<'github' | 'supabase' | 'cloudflare' | 'production' | 'vercel', string>;
};

const SOVEREIGN_REQUIRED_PROVIDERS = ['supabase', 'cloudflare', 'production'] as const;
const SHA40 = /^[a-f0-9]{40}$/i;

/**
 * Fail closed on missing, stale, cross-tenant or non-canonical evidence.
 * Vercel is not used as a production dependency. A review_required result
 * means only that a human may inspect release/evidence; not that deployment,
 * promotion or exact-SHA production verification occurred.
 */
export function evaluateAtlasSovereignDeployReadiness(input: {
  organizationId: string;
  infra: AtlasSovereignInfraSnapshot | null;
  release: AtlasSovereignReleaseSummary | null;
  now: number;
}): AtlasSovereignDeployReadiness {
  const { infra, release, organizationId, now } = input;
  const blockers: string[] = [];
  const providerStates = {
    github: infra?.provider_status?.github?.state ?? 'unknown',
    supabase: infra?.provider_status?.supabase?.state ?? 'unknown',
    cloudflare: infra?.provider_status?.cloudflare?.state ?? 'unknown',
    production: infra?.provider_status?.production?.state ?? 'unknown',
    vercel: 'optional'
  };

  if (!infra) blockers.push('infrastructure_evidence_missing');
  if (!organizationId.trim() || infra?.scope?.organization_id !== organizationId) {
    blockers.push('organization_scope_mismatch');
  }
  if (infra?.canonical_repository !== 'atlasenterprisesuite/atlasenterprisesuite') {
    blockers.push('canonical_repository_mismatch');
  }

  const generated = Date.parse(infra?.evidence?.generated_at ?? '');
  const ageMs = now - generated;
  if (!Number.isFinite(now) || !Number.isFinite(generated) || ageMs < -120_000 || ageMs > 15 * 60_000) {
    blockers.push('infrastructure_evidence_stale');
  }
  if (infra?.production_readiness !== 'ready') blockers.push('infrastructure_not_ready');

  for (const provider of SOVEREIGN_REQUIRED_PROVIDERS) {
    if (infra?.provider_requirements?.[provider] !== true || providerStates[provider] !== 'ready') {
      blockers.push(`required_${provider}_not_ready`);
    }
  }
  if (infra?.provider_requirements?.vercel === true || infra?.provider_status?.vercel?.required === true) {
    blockers.push('legacy_vercel_required');
  }

  for (const blocker of infra?.blockers ?? []) {
    const stage = typeof blocker.stage === 'string' ? blocker.stage : 'unknown';
    if (stage === 'vercel' && infra?.provider_requirements?.vercel !== true) continue;
    blockers.push(`infrastructure_blocker_${stage.replace(/[^a-z-]/gi, '').slice(0, 30) || 'unknown'}`);
  }

  let targetSha: string | null = null;
  if (!release) {
    blockers.push('release_not_selected');
  } else {
    const source = release.source_ref?.trim() ?? '';
    if (SHA40.test(source)) targetSha = source.toLowerCase();
    else blockers.push('release_source_sha_missing');
    if (release.status !== 'promoted' || release.channel !== 'production') {
      blockers.push('release_not_promoted');
    }
  }

  return {
    status: blockers.length ? 'blocked' : 'review_required',
    blockers: [...new Set(blockers)],
    targetSha,
    verifiedProduction: false,
    providerStates
  };
}

/**
 * Restricted write entry point: create a RELEASE DRAFT only. The caller must
 * supply the actual built artifact SHA-256 separately from its Git source SHA.
 * No fabricated artifact, deployment, CI result or verified evidence.
 */
export type AtlasSovereignReleaseDraftInput = {
  releaseKey: string;
  version: string;
  channel: 'development' | 'staging' | 'production';
  sourceSha: string;
  artifactSha256: string;
};

export function buildAtlasSovereignReleaseDraft(input: AtlasSovereignReleaseDraftInput) {
  const releaseKey = input.releaseKey.trim();
  const version = input.version.trim();
  const sourceSha = input.sourceSha.trim().toLowerCase();
  const artifactSha256 = input.artifactSha256.trim().toLowerCase();

  if (!/^[a-z0-9._-]{3,160}$/i.test(releaseKey)) throw new Error('invalid_release_key');
  if (!version || version.length > 100) throw new Error('invalid_release_version');
  if (!['development', 'staging', 'production'].includes(input.channel)) {
    throw new Error('invalid_release_channel');
  }
  if (!SHA40.test(sourceSha)) throw new Error('invalid_source_sha');
  if (!/^[a-f0-9]{64}$/.test(artifactSha256) || /^0+$/.test(artifactSha256)) {
    throw new Error('invalid_artifact_sha256');
  }

  return {
    release_key: releaseKey,
    version,
    channel: input.channel,
    source_ref: sourceSha,
    notes: 'Unverified artifact digest supplied for draft review. Not deployed or production verified.',
    metadata: { github_ci_required: true },
    components: [{
      component_type: 'web_bundle',
      component_key: 'atlas-enterprise-suite-web',
      artifact_ref: null,
      artifact_sha256: artifactSha256,
      target_version: version,
      provider: 'cloudflare',
      deployment_order: 100,
      rollback_strategy: 'manual_only',
      rollback_ref: null,
      requires_migration: false,
      migration_ref: null,
      metadata: {}
    }]
  };
}

/** Client defense-in-depth; the server rechecks authenticated releases.create. */
export function canWriteAtlasSovereignReleaseDraft(input: {
  organizationId: string;
  infra: AtlasSovereignInfraSnapshot | null;
  granted: boolean;
  now: number;
}): boolean {
  const { infra, organizationId, granted, now } = input;
  if (!granted || !organizationId.trim() || !infra) return false;
  if (infra.scope?.organization_id !== organizationId) return false;
  if (infra.canonical_repository !== 'atlasenterprisesuite/atlasenterprisesuite') return false;
  const checkedAt = Date.parse(infra.evidence?.generated_at ?? '');
  const age = now - checkedAt;
  if (!Number.isFinite(now) || !Number.isFinite(checkedAt) || age < -120_000 || age > 15 * 60_000) return false;
  // A blocked provider must not block local draft work; it still blocks deploy.
  return true;
}
