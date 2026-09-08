import { describe, expect, it } from 'vitest';
import {
  ReleaseControllerService,
  type ReleaseQueueRecord,
  type ReleaseRepository,
} from '../../packages/release-control/src';

function queueRow(overrides: Partial<ReleaseQueueRecord> & Pick<ReleaseQueueRecord, 'moduleCode'>): ReleaseQueueRecord {
  return {
    moduleCode: overrides.moduleCode,
    moduleFamily: overrides.moduleFamily ?? 'foundation',
    releaseWave: overrides.releaseWave ?? 0,
    developmentStatus: overrides.developmentStatus ?? 'test_pending',
    developmentException: overrides.developmentException ?? null,
    candidateId: overrides.candidateId ?? 'candidate-a',
    candidateSha: overrides.candidateSha ?? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    lifecycleStatus: overrides.lifecycleStatus ?? 'queued',
    exceptionState: overrides.exceptionState ?? null,
    ciStatus: overrides.ciStatus ?? 'passed',
    migrationStatus: overrides.migrationStatus ?? 'not_required',
    providerStatus: overrides.providerStatus ?? 'not_required',
    securityStatus: overrides.securityStatus ?? 'passed',
    queuePosition: overrides.queuePosition ?? 1,
    activationEnabled: overrides.activationEnabled ?? false,
    productionSha: overrides.productionSha ?? null,
    productionVerified: overrides.productionVerified ?? false,
    blockerReason: overrides.blockerReason ?? null,
    releaseLockOpen: overrides.releaseLockOpen ?? true,
    activeWave: overrides.activeWave ?? null,
    deployedCandidateSha: overrides.deployedCandidateSha ?? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };
}

class FakeReleaseRepository implements ReleaseRepository {
  beginActivationCalls = 0;
  constructor(private rows: ReleaseQueueRecord[]) {}

  async isOperator() { return true; }
  async getRuntimeState() { return []; }
  async listQueue() { return this.rows; }
  async listEvidence() { return []; }
  async setDevelopmentStatus(moduleCode: string) { return moduleCode; }
  async setDevelopmentException(moduleCode: string) { return moduleCode; }
  async freezeCandidate() { return 'candidate-a'; }
  async queueModule(_candidateId: string, moduleCode: string) { return moduleCode; }
  async setException(_candidateId: string, moduleCode: string) { return moduleCode; }
  async setLock(open: boolean) { return open; }
  async beginActivation(_candidateId: string, _releaseWave: number) {
    this.beginActivationCalls += 1;
    return 1;
  }
  async markLive(_candidateId: string, moduleCode: string) { return moduleCode; }
  async markProdVerified(_candidateId: string, moduleCode: string) { return moduleCode; }
  async deactivateWave() { return 1; }
}

describe('ReleaseControllerService', () => {
  it('rejects an invalid candidate SHA before calling the repository', async () => {
    const repository = new FakeReleaseRepository([]);
    const service = new ReleaseControllerService(repository);

    await expect(service.freezeCandidate('short-sha', 'release/atlas-a-z'))
      .rejects.toThrow('40-character lowercase Git SHA');
  });

  it('blocks activation when a dependency is not production verified or activating in the same wave', async () => {
    const repository = new FakeReleaseRepository([
      queueRow({ moduleCode: 'core', lifecycleStatus: 'live', productionVerified: false }),
      queueRow({ moduleCode: 'identity', lifecycleStatus: 'queued' }),
    ]);
    const service = new ReleaseControllerService(repository);

    await expect(service.beginActivation('candidate-a', 0, 'activate foundation'))
      .rejects.toThrow('Unmet release dependencies');
    expect(repository.beginActivationCalls).toBe(0);
  });

  it('allows same-wave dependencies to activate together after upstream dependencies are production verified', async () => {
    const foundation = ['core', 'identity', 'rbac', 'audit', 'release-controller']
      .map((moduleCode) => queueRow({ moduleCode, lifecycleStatus: 'prod_verified', productionVerified: true }));
    const repository = new FakeReleaseRepository([
      ...foundation,
      queueRow({ moduleCode: 'finance', moduleFamily: 'finance', releaseWave: 1, lifecycleStatus: 'queued' }),
      queueRow({ moduleCode: 'accounting', moduleFamily: 'finance', releaseWave: 1, lifecycleStatus: 'queued' }),
    ]);
    const service = new ReleaseControllerService(repository);

    await expect(service.beginActivation('candidate-a', 1, 'activate finance')).resolves.toBe(1);
    expect(repository.beginActivationCalls).toBe(1);
  });

  it('does not expose a client evidence-ingestion method', () => {
    const service = new ReleaseControllerService(new FakeReleaseRepository([]));
    expect('recordEvidence' in service).toBe(false);
  });
});
