export type ReleaseLifecycleStatus =
  | 'developing'
  | 'integrated'
  | 'test_pending'
  | 'verified'
  | 'release_ready'
  | 'queued'
  | 'activating'
  | 'live'
  | 'prod_verified';

export type ReleaseExceptionState = 'blocked' | 'provider_required' | 'rollback' | null;

export type ReleaseEvidenceKind =
  | 'typecheck'
  | 'unit'
  | 'integration'
  | 'security'
  | 'build'
  | 'migration'
  | 'deployment'
  | 'smoke'
  | 'provider'
  | 'health_safety'
  | 'payment_reconciliation'
  | 'mobility_safety'
  | 'recovery';

export type ReleaseModuleFamily =
  | 'foundation'
  | 'finance'
  | 'people'
  | 'revenue-operations'
  | 'platform-services'
  | 'health'
  | 'mobility-physical-operations'
  | 'financial-rails-specialized';

export type ReleaseWave = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type ReleaseDevelopmentStatus = 'developing' | 'integrated' | 'test_pending';
export type ReleaseCiStatus = 'pending' | 'passed' | 'failed';
export type ReleaseMigrationStatus = 'pending' | 'not_required' | 'replay_verified' | 'applied' | 'failed';
export type ReleaseProviderStatus = 'pending' | 'not_required' | 'provider_required' | 'verified' | 'failed';
export type ReleaseSecurityStatus = 'pending' | 'passed' | 'failed';

export interface ReleaseModuleDefinition {
  readonly moduleCode: string;
  readonly moduleFamily: ReleaseModuleFamily;
  readonly releaseWave: ReleaseWave;
  readonly dependencies: readonly string[];
}

export interface ReleaseRuntimeModuleState {
  readonly moduleCode: string;
  readonly moduleFamily: string;
  readonly releaseWave: number;
  readonly activationEnabled: boolean;
  readonly candidateSha: string | null;
  readonly productionSha: string | null;
  readonly productionVerified: boolean;
  readonly exceptionState: ReleaseExceptionState;
  readonly updatedAt: string;
}

export interface ReleaseQueueRecord {
  readonly moduleCode: string;
  readonly moduleFamily: string;
  readonly releaseWave: number;
  readonly developmentStatus: ReleaseDevelopmentStatus;
  readonly developmentException: 'blocked' | 'provider_required' | null;
  readonly candidateId: string | null;
  readonly candidateSha: string | null;
  readonly lifecycleStatus: ReleaseLifecycleStatus | null;
  readonly exceptionState: ReleaseExceptionState;
  readonly ciStatus: ReleaseCiStatus | null;
  readonly migrationStatus: ReleaseMigrationStatus | null;
  readonly providerStatus: ReleaseProviderStatus | null;
  readonly securityStatus: ReleaseSecurityStatus | null;
  readonly queuePosition: number | null;
  readonly activationEnabled: boolean;
  readonly productionSha: string | null;
  readonly productionVerified: boolean;
  readonly blockerReason: string | null;
  readonly releaseLockOpen: boolean;
  readonly activeWave: number | null;
  readonly deployedCandidateSha: string | null;
}

export interface ReleaseEvidenceSummary {
  readonly evidenceKind: ReleaseEvidenceKind;
  readonly source: string;
  readonly sourceRef: string;
  readonly passed: boolean;
  readonly recordedAt: string;
}
