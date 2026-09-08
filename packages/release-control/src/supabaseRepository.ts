import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReleaseRepository } from './repository';
import type {
  ReleaseDevelopmentStatus,
  ReleaseEvidenceKind,
  ReleaseEvidenceSummary,
  ReleaseExceptionState,
  ReleaseLifecycleStatus,
  ReleaseMigrationStatus,
  ReleaseProviderStatus,
  ReleaseQueueRecord,
  ReleaseRuntimeModuleState,
  ReleaseSecurityStatus,
} from './types';

type RpcClient = Pick<SupabaseClient, 'rpc'>;
type RpcRow = Record<string, unknown>;

const LIFECYCLE = new Set<ReleaseLifecycleStatus>([
  'developing', 'integrated', 'test_pending', 'verified', 'release_ready',
  'queued', 'activating', 'live', 'prod_verified',
]);
const DEVELOPMENT = new Set<ReleaseDevelopmentStatus>(['developing', 'integrated', 'test_pending']);
const MIGRATION = new Set<ReleaseMigrationStatus>(['pending', 'not_required', 'replay_verified', 'applied', 'failed']);
const PROVIDER = new Set<ReleaseProviderStatus>(['pending', 'not_required', 'provider_required', 'verified', 'failed']);
const SECURITY = new Set<ReleaseSecurityStatus>(['pending', 'passed', 'failed']);
const EVIDENCE = new Set<ReleaseEvidenceKind>([
  'typecheck', 'unit', 'integration', 'security', 'build', 'migration', 'deployment',
  'smoke', 'provider', 'health_safety', 'payment_reconciliation', 'mobility_safety', 'recovery',
]);

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Malformed release-control response: ${label}`);
  }
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`Malformed release-control response: ${label}`);
  return value;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Malformed release-control response: ${label}`);
  return value;
}

function requireInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Malformed release-control response: ${label}`);
  }
  return value;
}

function nullableInteger(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  return requireInteger(value, label);
}

function nullableEnum<T extends string>(value: unknown, allowed: ReadonlySet<T>, label: string): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new Error(`Malformed release-control response: ${label}`);
  }
  return value as T;
}

function exceptionState(value: unknown): ReleaseExceptionState {
  if (value === null || value === undefined) return null;
  if (value === 'blocked' || value === 'provider_required' || value === 'rollback') return value;
  throw new Error('Malformed release-control response: exception_state');
}

function developmentException(value: unknown): 'blocked' | 'provider_required' | null {
  if (value === null || value === undefined) return null;
  if (value === 'blocked' || value === 'provider_required') return value;
  throw new Error('Malformed release-control response: development_exception');
}

function requireRows(data: unknown, label: string): RpcRow[] {
  if (!Array.isArray(data)) throw new Error(`Malformed release-control response: ${label}`);
  return data.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`Malformed release-control response: ${label} row`);
    }
    return row as RpcRow;
  });
}

function mapRuntimeRow(row: RpcRow): ReleaseRuntimeModuleState {
  return {
    moduleCode: requireString(row.module_code, 'module_code'),
    moduleFamily: requireString(row.module_family, 'module_family'),
    releaseWave: requireInteger(row.release_wave, 'release_wave'),
    activationEnabled: requireBoolean(row.activation_enabled, 'activation_enabled'),
    candidateSha: nullableString(row.candidate_sha, 'candidate_sha'),
    productionSha: nullableString(row.production_sha, 'production_sha'),
    productionVerified: requireBoolean(row.production_verified, 'production_verified'),
    exceptionState: exceptionState(row.exception_state),
    updatedAt: requireString(row.updated_at, 'updated_at'),
  };
}

function mapQueueRow(row: RpcRow): ReleaseQueueRecord {
  const developmentStatus = nullableEnum(row.development_status, DEVELOPMENT, 'development_status');
  if (developmentStatus === null) {
    throw new Error('Malformed release-control response: development_status');
  }

  return {
    moduleCode: requireString(row.module_code, 'module_code'),
    moduleFamily: requireString(row.module_family, 'module_family'),
    releaseWave: requireInteger(row.release_wave, 'release_wave'),
    developmentStatus,
    developmentException: developmentException(row.development_exception),
    candidateId: nullableString(row.candidate_id, 'candidate_id'),
    candidateSha: nullableString(row.candidate_sha, 'candidate_sha'),
    lifecycleStatus: nullableEnum(row.lifecycle_status, LIFECYCLE, 'lifecycle_status'),
    exceptionState: exceptionState(row.exception_state),
    ciStatus: nullableEnum(row.ci_status, new Set(['pending', 'passed', 'failed'] as const), 'ci_status'),
    migrationStatus: nullableEnum(row.migration_status, MIGRATION, 'migration_status'),
    providerStatus: nullableEnum(row.provider_status, PROVIDER, 'provider_status'),
    securityStatus: nullableEnum(row.security_status, SECURITY, 'security_status'),
    queuePosition: nullableInteger(row.queue_position, 'queue_position'),
    activationEnabled: requireBoolean(row.activation_enabled, 'activation_enabled'),
    productionSha: nullableString(row.production_sha, 'production_sha'),
    productionVerified: requireBoolean(row.production_verified, 'production_verified'),
    blockerReason: nullableString(row.blocker_reason, 'blocker_reason'),
    releaseLockOpen: requireBoolean(row.release_lock_open, 'release_lock_open'),
    activeWave: nullableInteger(row.active_wave, 'active_wave'),
    deployedCandidateSha: nullableString(row.deployed_candidate_sha, 'deployed_candidate_sha'),
  };
}

function mapEvidenceRow(row: RpcRow): ReleaseEvidenceSummary {
  const evidenceKind = nullableEnum(row.evidence_kind, EVIDENCE, 'evidence_kind');
  if (evidenceKind === null) throw new Error('Malformed release-control response: evidence_kind');
  return {
    evidenceKind,
    source: requireString(row.source, 'source'),
    sourceRef: requireString(row.source_ref, 'source_ref'),
    passed: requireBoolean(row.passed, 'passed'),
    recordedAt: requireString(row.recorded_at, 'recorded_at'),
  };
}

export class SupabaseReleaseRepository implements ReleaseRepository {
  private readonly client: RpcClient;

  constructor(client: RpcClient) {
    this.client = client;
  }

  private async rpc(functionName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const { data, error } = await this.client.rpc(functionName, args);
    if (error) throw new Error(`Release control RPC ${functionName} failed: ${error.message}`);
    return data;
  }

  private async stringRpc(functionName: string, args: Record<string, unknown>): Promise<string> {
    return requireString(await this.rpc(functionName, args), functionName);
  }

  private async numberRpc(functionName: string, args: Record<string, unknown>): Promise<number> {
    return requireInteger(await this.rpc(functionName, args), functionName);
  }

  async isOperator(): Promise<boolean> {
    return requireBoolean(await this.rpc('atlas_release_operator_status'), 'atlas_release_operator_status');
  }

  async getRuntimeState(): Promise<ReleaseRuntimeModuleState[]> {
    return requireRows(await this.rpc('atlas_release_runtime_state'), 'runtime state').map(mapRuntimeRow);
  }

  async listQueue(): Promise<ReleaseQueueRecord[]> {
    return requireRows(await this.rpc('atlas_release_controller_state'), 'controller state').map(mapQueueRow);
  }

  async listEvidence(candidateId: string, moduleCode?: string | null): Promise<ReleaseEvidenceSummary[]> {
    return requireRows(await this.rpc('atlas_release_evidence_summary', {
      p_candidate_id: candidateId,
      p_module_code: moduleCode ?? null,
    }), 'evidence summary').map(mapEvidenceRow);
  }

  setDevelopmentStatus(moduleCode: string, status: ReleaseDevelopmentStatus, reason: string): Promise<string> {
    return this.stringRpc('atlas_release_set_development_status', {
      p_module_code: moduleCode,
      p_status: status,
      p_reason: reason,
    });
  }

  setDevelopmentException(
    moduleCode: string,
    exceptionStateValue: 'blocked' | 'provider_required' | null,
    reason: string,
  ): Promise<string> {
    return this.stringRpc('atlas_release_set_development_exception', {
      p_module_code: moduleCode,
      p_exception_state: exceptionStateValue,
      p_reason: reason,
    });
  }

  freezeCandidate(candidateSha: string, sourceBranch: string): Promise<string> {
    return this.stringRpc('atlas_release_freeze_candidate', {
      p_candidate_sha: candidateSha,
      p_source_branch: sourceBranch,
    });
  }

  queueModule(candidateId: string, moduleCode: string): Promise<string> {
    return this.stringRpc('atlas_release_queue_module', {
      p_candidate_id: candidateId,
      p_module_code: moduleCode,
    });
  }

  setException(
    candidateId: string,
    moduleCode: string,
    exceptionStateValue: ReleaseExceptionState,
    reason: string,
  ): Promise<string> {
    return this.stringRpc('atlas_release_set_exception', {
      p_candidate_id: candidateId,
      p_module_code: moduleCode,
      p_exception_state: exceptionStateValue,
      p_reason: reason,
    });
  }

  async setLock(open: boolean, reason: string): Promise<boolean> {
    return requireBoolean(await this.rpc('atlas_release_set_lock', {
      p_open: open,
      p_reason: reason,
    }), 'atlas_release_set_lock');
  }

  beginActivation(candidateId: string, releaseWave: number, reason: string): Promise<number> {
    return this.numberRpc('atlas_release_begin_activation', {
      p_candidate_id: candidateId,
      p_release_wave: releaseWave,
      p_reason: reason,
    });
  }

  markLive(candidateId: string, moduleCode: string, productionSha: string): Promise<string> {
    return this.stringRpc('atlas_release_mark_live', {
      p_candidate_id: candidateId,
      p_module_code: moduleCode,
      p_production_sha: productionSha,
    });
  }

  markProdVerified(candidateId: string, moduleCode: string, productionSha: string): Promise<string> {
    return this.stringRpc('atlas_release_mark_prod_verified', {
      p_candidate_id: candidateId,
      p_module_code: moduleCode,
      p_production_sha: productionSha,
    });
  }

  deactivateWave(candidateId: string, releaseWave: number, reason: string): Promise<number> {
    return this.numberRpc('atlas_release_deactivate_wave', {
      p_candidate_id: candidateId,
      p_release_wave: releaseWave,
      p_reason: reason,
    });
  }
}

export function createSupabaseReleaseRepository(client: SupabaseClient): ReleaseRepository {
  return new SupabaseReleaseRepository(client);
}
