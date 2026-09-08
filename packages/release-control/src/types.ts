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

export interface ReleaseModuleDefinition {
  readonly moduleCode: string;
  readonly moduleFamily: ReleaseModuleFamily;
  readonly releaseWave: ReleaseWave;
  readonly dependencies: readonly string[];
}
