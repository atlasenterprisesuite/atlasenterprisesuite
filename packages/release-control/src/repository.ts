import { RELEASE_CATALOG } from './catalog';
import { unmetDependencies } from './lifecycle';
import type {
  ReleaseDevelopmentStatus,
  ReleaseEvidenceSummary,
  ReleaseExceptionState,
  ReleaseQueueRecord,
  ReleaseRuntimeModuleState,
} from './types';

export interface ReleaseRepository {
  isOperator(): Promise<boolean>;
  getRuntimeState(): Promise<ReleaseRuntimeModuleState[]>;
  listQueue(): Promise<ReleaseQueueRecord[]>;
  listEvidence(candidateId: string, moduleCode?: string | null): Promise<ReleaseEvidenceSummary[]>;
  setDevelopmentStatus(moduleCode: string, status: ReleaseDevelopmentStatus, reason: string): Promise<string>;
  setDevelopmentException(
    moduleCode: string,
    exceptionState: 'blocked' | 'provider_required' | null,
    reason: string,
  ): Promise<string>;
  freezeCandidate(candidateSha: string, sourceBranch: string): Promise<string>;
  queueModule(candidateId: string, moduleCode: string): Promise<string>;
  setException(
    candidateId: string,
    moduleCode: string,
    exceptionState: ReleaseExceptionState,
    reason: string,
  ): Promise<string>;
  setLock(open: boolean, reason: string): Promise<boolean>;
  beginActivation(candidateId: string, releaseWave: number, reason: string): Promise<number>;
  markLive(candidateId: string, moduleCode: string, productionSha: string): Promise<string>;
  markProdVerified(candidateId: string, moduleCode: string, productionSha: string): Promise<string>;
  deactivateWave(candidateId: string, releaseWave: number, reason: string): Promise<number>;
}

const FULL_GIT_SHA = /^[0-9a-f]{40}$/;

function requireReason(reason: string, label: string): string {
  const normalized = reason.trim();
  if (!normalized) throw new Error(`${label} reason is required`);
  return normalized;
}

function requireSha(sha: string): string {
  if (!FULL_GIT_SHA.test(sha)) {
    throw new Error('Candidate SHA must be a full 40-character lowercase Git SHA');
  }
  return sha;
}

export class ReleaseControllerService {
  private readonly repository: ReleaseRepository;

  constructor(repository: ReleaseRepository) {
    this.repository = repository;
  }

  isOperator(): Promise<boolean> {
    return this.repository.isOperator();
  }

  getRuntimeState(): Promise<ReleaseRuntimeModuleState[]> {
    return this.repository.getRuntimeState();
  }

  listQueue(): Promise<ReleaseQueueRecord[]> {
    return this.repository.listQueue();
  }

  listEvidence(candidateId: string, moduleCode?: string | null): Promise<ReleaseEvidenceSummary[]> {
    return this.repository.listEvidence(candidateId, moduleCode);
  }

  setDevelopmentStatus(
    moduleCode: string,
    status: ReleaseDevelopmentStatus,
    reason: string,
  ): Promise<string> {
    return this.repository.setDevelopmentStatus(
      moduleCode,
      status,
      requireReason(reason, 'Development status'),
    );
  }

  setDevelopmentException(
    moduleCode: string,
    exceptionState: 'blocked' | 'provider_required' | null,
    reason: string,
  ): Promise<string> {
    const normalizedReason = exceptionState === null
      ? reason.trim()
      : requireReason(reason, 'Development exception');
    return this.repository.setDevelopmentException(moduleCode, exceptionState, normalizedReason);
  }

  async freezeCandidate(candidateSha: string, sourceBranch: string): Promise<string> {
    const branch = sourceBranch.trim();
    if (!branch) throw new Error('Source branch is required');
    return this.repository.freezeCandidate(requireSha(candidateSha), branch);
  }

  queueModule(candidateId: string, moduleCode: string): Promise<string> {
    return this.repository.queueModule(candidateId, moduleCode);
  }

  setException(
    candidateId: string,
    moduleCode: string,
    exceptionState: ReleaseExceptionState,
    reason: string,
  ): Promise<string> {
    const normalizedReason = exceptionState === null
      ? reason.trim()
      : requireReason(reason, 'Release exception');
    return this.repository.setException(candidateId, moduleCode, exceptionState, normalizedReason);
  }

  setLock(open: boolean, reason: string): Promise<boolean> {
    return this.repository.setLock(open, requireReason(reason, 'Release lock change'));
  }

  async beginActivation(candidateId: string, releaseWave: number, reason: string): Promise<number> {
    if (!Number.isInteger(releaseWave) || releaseWave < 0 || releaseWave > 7) {
      throw new Error('Release wave must be an integer between 0 and 7');
    }

    const rows = await this.repository.listQueue();
    const candidateRows = rows.filter((row) => row.candidateId === candidateId);
    const queuedRows = candidateRows.filter(
      (row) => row.releaseWave === releaseWave && row.lifecycleStatus === 'queued',
    );

    if (queuedRows.length === 0) {
      throw new Error('No queued modules are available for this wave');
    }

    const statuses = new Map(
      candidateRows
        .filter(
          (row): row is ReleaseQueueRecord & {
            lifecycleStatus: NonNullable<ReleaseQueueRecord['lifecycleStatus']>;
          } => row.lifecycleStatus !== null,
        )
        .map((row) => [row.moduleCode, row.lifecycleStatus]),
    );
    const activatingTogether = new Set(queuedRows.map((row) => row.moduleCode));

    for (const row of queuedRows) {
      const definition = RELEASE_CATALOG.find((item) => item.moduleCode === row.moduleCode);
      if (!definition) throw new Error(`Unknown release module: ${row.moduleCode}`);
      const missing = unmetDependencies(definition.dependencies, statuses, activatingTogether);
      if (missing.length > 0) {
        throw new Error(`Unmet release dependencies for ${row.moduleCode}: ${missing.join(', ')}`);
      }
    }

    return this.repository.beginActivation(
      candidateId,
      releaseWave,
      requireReason(reason, 'Activation'),
    );
  }

  markLive(candidateId: string, moduleCode: string, productionSha: string): Promise<string> {
    return this.repository.markLive(candidateId, moduleCode, requireSha(productionSha));
  }

  markProdVerified(candidateId: string, moduleCode: string, productionSha: string): Promise<string> {
    return this.repository.markProdVerified(candidateId, moduleCode, requireSha(productionSha));
  }

  deactivateWave(candidateId: string, releaseWave: number, reason: string): Promise<number> {
    if (!Number.isInteger(releaseWave) || releaseWave < 0 || releaseWave > 7) {
      throw new Error('Release wave must be an integer between 0 and 7');
    }
    return this.repository.deactivateWave(
      candidateId,
      releaseWave,
      requireReason(reason, 'Rollback'),
    );
  }
}
