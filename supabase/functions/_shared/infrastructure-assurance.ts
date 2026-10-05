export type InfrastructureAssuranceStatus =
  | 'verified'
  | 'partially_verified'
  | 'unverified'
  | 'unknown'
  | 'degraded';

export type InfrastructureAssuranceFact<T> = {
  desired: T | null;
  observed: T | null;
  verified: T | null;
  status: InfrastructureAssuranceStatus;
  evidence_refs: string[];
};

export type SupabaseAssuranceInput = {
  providerId: string;
  organizationId: string;
  environment: 'staging' | 'production';
  project: {
    configured: boolean;
    reachable: boolean;
    region: string | null;
  };
  resilience: {
    readReplicaPresent: boolean | null;
    automaticCrossRegionFailoverSupported: boolean | null;
    failoverRunbookVerified: boolean | null;
    pitrConfigured: boolean | null;
    restoreDrillVerified: boolean | null;
  };
  networking: {
    privateLinkDatabase: boolean | null;
    apiPrivate: boolean | null;
    authPrivate: boolean | null;
    storagePrivate: boolean | null;
    realtimePrivate: boolean | null;
  };
  compliance: {
    providerCertificationEvidence: boolean;
    atlasControlEvidence: boolean;
    sharedControlEvidence: boolean;
  };
  probeFailures: string[];
  evidenceRefs?: string[];
};

export type AssurancePolicyRecord = {
  id: string;
  domain: string;
  requirement: string;
  severity: 'P0' | 'P1' | 'P2';
  required_status: string;
  blocking: boolean;
};

export type AssuranceEvidenceRecord = {
  id: string;
  module: string | null;
  claim: string;
  source_type: string;
  evidence_level: 'P0' | 'P1' | 'P2';
  status: string;
  environment: string;
  verified_at: string | null;
  source_ref: string;
  supersedes_id: string | null;
  production_impact: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type BooleanFact = InfrastructureAssuranceFact<boolean>;

type NetworkingPaths = {
  database: BooleanFact;
  api: BooleanFact;
  auth: BooleanFact;
  storage: BooleanFact;
  realtime: BooleanFact;
};

export type SupabaseAssuranceSnapshot = {
  provider_profile: {
    provider_id: string;
    provider_kind: 'supabase';
    organization_id: string;
    environment: 'staging' | 'production';
    region: InfrastructureAssuranceFact<string>;
  };
  domains: {
    readiness: InfrastructureAssuranceFact<boolean>;
    resilience: {
      status: InfrastructureAssuranceStatus;
      checks: {
        read_replica_present: BooleanFact;
        backup_enabled: BooleanFact;
        recovery_verified: BooleanFact;
        failover_ready: BooleanFact;
      };
    };
    networking: {
      status: InfrastructureAssuranceStatus;
      paths: NetworkingPaths;
    };
    compliance: InfrastructureAssuranceFact<boolean>;
  };
  release_gate: {
    blocked: boolean;
    blockers: Array<{
      policy_id: string;
      domain: string;
      requirement: string;
      severity: 'P0' | 'P1' | 'P2';
      reason: string;
    }>;
    policy_count: number;
  };
  fitness_score: {
    score: number | null;
    classification: 'insufficient_evidence';
    confidence: 'low';
    missing_domains: string[];
  };
  evidence_summary: {
    count: number;
    current_verified: number;
    stale_or_unverified: number;
    refs: string[];
  };
  probe_failures: string[];
  generated_at: string;
};

function booleanFact(observed: boolean | null, evidenceRefs: string[] = []): BooleanFact {
  if (observed === true) {
    return {
      desired: true,
      observed: true,
      verified: true,
      status: 'verified',
      evidence_refs: evidenceRefs
    };
  }

  if (observed === false) {
    return {
      desired: true,
      observed: false,
      verified: false,
      status: 'unverified',
      evidence_refs: evidenceRefs
    };
  }

  return {
    desired: true,
    observed: null,
    verified: null,
    status: 'unknown',
    evidence_refs: evidenceRefs
  };
}

function aggregateStatus(statuses: InfrastructureAssuranceStatus[]): InfrastructureAssuranceStatus {
  if (statuses.includes('degraded')) return 'degraded';
  if (statuses.every((status) => status === 'verified')) return 'verified';
  if (statuses.some((status) => status === 'verified')) return 'partially_verified';
  if (statuses.some((status) => status === 'unverified')) return 'unverified';
  return 'unknown';
}

function complianceFact(
  input: SupabaseAssuranceInput['compliance'],
  evidenceRefs: string[]
): InfrastructureAssuranceFact<boolean> {
  if (
    input.providerCertificationEvidence &&
    input.atlasControlEvidence &&
    input.sharedControlEvidence
  ) {
    return {
      desired: true,
      observed: true,
      verified: true,
      status: 'verified',
      evidence_refs: evidenceRefs
    };
  }

  if (
    input.providerCertificationEvidence ||
    input.atlasControlEvidence ||
    input.sharedControlEvidence
  ) {
    return {
      desired: true,
      observed: null,
      verified: null,
      status: 'partially_verified',
      evidence_refs: evidenceRefs
    };
  }

  return {
    desired: true,
    observed: null,
    verified: null,
    status: 'unknown',
    evidence_refs: evidenceRefs
  };
}

export function evaluateAssurancePolicies(input: {
  policies: AssurancePolicyRecord[];
  snapshot: Pick<SupabaseAssuranceSnapshot, 'domains'>;
}) {
  const statusByRequirement: Record<string, InfrastructureAssuranceStatus> = {
    runtime_health_verified: input.snapshot.domains.readiness.status,
    read_replica_present:
      input.snapshot.domains.resilience.checks.read_replica_present.status,
    backup_enabled: input.snapshot.domains.resilience.checks.backup_enabled.status,
    recovery_verified: input.snapshot.domains.resilience.checks.recovery_verified.status,
    cross_region_failover_runbook_verified:
      input.snapshot.domains.resilience.checks.failover_ready.status,
    failover_ready: input.snapshot.domains.resilience.checks.failover_ready.status,
    provider_compliance_verified: input.snapshot.domains.compliance.status,
    database_private:
      input.snapshot.domains.networking.paths.database.status,
    api_private: input.snapshot.domains.networking.paths.api.status,
    auth_private: input.snapshot.domains.networking.paths.auth.status,
    storage_private: input.snapshot.domains.networking.paths.storage.status,
    realtime_private: input.snapshot.domains.networking.paths.realtime.status
  };

  const blockers = input.policies.flatMap((policy) => {
    if (!policy.blocking) return [];
    const observedStatus = statusByRequirement[policy.requirement] ?? 'unknown';
    if (observedStatus === policy.required_status) return [];
    return [{
      policy_id: policy.id,
      domain: policy.domain,
      requirement: policy.requirement,
      severity: policy.severity,
      reason: `required_${policy.required_status}_observed_${observedStatus}`
    }];
  });

  return {
    blocked: blockers.length > 0,
    blockers,
    policy_count: input.policies.length
  };
}

export function summarizeAssuranceEvidence(records: AssuranceEvidenceRecord[]) {
  const refs = records.map((record) => record.source_ref);
  const currentVerified = records.filter(
    (record) =>
      record.status === 'VIGENTE' &&
      record.verified_at !== null &&
      record.supersedes_id === null
  ).length;

  return {
    count: records.length,
    current_verified: currentVerified,
    stale_or_unverified: Math.max(0, records.length - currentVerified),
    refs
  };
}

export function buildSupabaseAssuranceSnapshot(
  input: SupabaseAssuranceInput,
  options: {
    policies?: AssurancePolicyRecord[];
    evidence?: AssuranceEvidenceRecord[];
    generatedAt?: string;
  } = {}
): SupabaseAssuranceSnapshot {
  const evidenceRefs = input.evidenceRefs ?? [];

  const readiness: InfrastructureAssuranceFact<boolean> = !input.project.reachable
    ? {
        desired: true,
        observed: false,
        verified: null,
        status: 'degraded',
        evidence_refs: evidenceRefs
      }
    : booleanFact(input.project.configured && input.project.reachable, evidenceRefs);

  const readReplica = booleanFact(input.resilience.readReplicaPresent, evidenceRefs);
  const backupEnabled = booleanFact(input.resilience.pitrConfigured, evidenceRefs);
  const recoveryVerified = booleanFact(input.resilience.restoreDrillVerified, evidenceRefs);

  const failoverReady =
    input.resilience.automaticCrossRegionFailoverSupported === true &&
    input.resilience.failoverRunbookVerified === true
      ? booleanFact(true, evidenceRefs)
      : {
          desired: true,
          observed:
            input.resilience.automaticCrossRegionFailoverSupported === false ||
            input.resilience.failoverRunbookVerified === false
              ? false
              : null,
          verified: null,
          status:
            input.resilience.automaticCrossRegionFailoverSupported === null ||
            input.resilience.failoverRunbookVerified === null
              ? ('unknown' as const)
              : ('unverified' as const),
          evidence_refs: evidenceRefs
        };

  const networkingPaths: NetworkingPaths = {
    database: booleanFact(input.networking.privateLinkDatabase, evidenceRefs),
    api: booleanFact(input.networking.apiPrivate, evidenceRefs),
    auth: booleanFact(input.networking.authPrivate, evidenceRefs),
    storage: booleanFact(input.networking.storagePrivate, evidenceRefs),
    realtime: booleanFact(input.networking.realtimePrivate, evidenceRefs)
  };

  const compliance = complianceFact(input.compliance, evidenceRefs);

  const baseSnapshot = {
    provider_profile: {
      provider_id: input.providerId,
      provider_kind: 'supabase' as const,
      organization_id: input.organizationId,
      environment: input.environment,
      region: input.project.region
        ? {
            desired: null,
            observed: input.project.region,
            verified: input.project.reachable ? input.project.region : null,
            status: input.project.reachable ? ('verified' as const) : ('degraded' as const),
            evidence_refs: evidenceRefs
          }
        : {
            desired: null,
            observed: null,
            verified: null,
            status: 'unknown' as const,
            evidence_refs: evidenceRefs
          }
    },
    domains: {
      readiness,
      resilience: {
        status: aggregateStatus([
          readReplica.status,
          backupEnabled.status,
          recoveryVerified.status,
          failoverReady.status
        ]),
        checks: {
          read_replica_present: readReplica,
          backup_enabled: backupEnabled,
          recovery_verified: recoveryVerified,
          failover_ready: failoverReady
        }
      },
      networking: {
        status: aggregateStatus(Object.values(networkingPaths).map((path) => path.status)),
        paths: networkingPaths
      },
      compliance
    }
  };

  const policies = options.policies ?? [];
  const evidence = options.evidence ?? [];
  const releaseGate = evaluateAssurancePolicies({ policies, snapshot: baseSnapshot });
  const evidenceSummary = summarizeAssuranceEvidence(evidence);

  return {
    ...baseSnapshot,
    release_gate: releaseGate,
    fitness_score: {
      score: null,
      classification: 'insufficient_evidence',
      confidence: 'low',
      missing_domains: [
        'reliability',
        'security',
        'compliance',
        'scalability',
        'operational_support',
        'cost_predictability',
        'portability',
        'developer_velocity'
      ]
    },
    evidence_summary: evidenceSummary,
    probe_failures: [...input.probeFailures],
    generated_at: options.generatedAt ?? new Date().toISOString()
  };
}

export class SupabaseProviderAdapter {
  buildSnapshot(
    input: SupabaseAssuranceInput,
    options: {
      policies?: AssurancePolicyRecord[];
      evidence?: AssuranceEvidenceRecord[];
      generatedAt?: string;
    } = {}
  ) {
    return buildSupabaseAssuranceSnapshot(input, options);
  }
}
