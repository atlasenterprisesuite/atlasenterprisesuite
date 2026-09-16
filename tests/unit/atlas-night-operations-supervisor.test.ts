import { describe, expect, it } from 'vitest';
import {
  AtlasOrchestrator,
  InMemoryNightOperationsPersistence,
  InMemoryPersistence,
} from '../../packages/ai-core/src';
import type { AtlasActor } from '../../packages/governance/src';
import type { AtlasTask, NightQueueItem } from '../../packages/task-protocol/src';
import { NightOperationsSupervisor } from '../../apps/atlas-orchestrator/src/workers/nightOperationsSupervisor';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };
const human: AtlasActor = {
  actorId: 'winder', kind: 'human', scope,
  permissions: ['ai.task.create', 'ai.task.read', 'ai.task.update'],
};
const worker: AtlasActor = {
  actorId: 'atlas-night-worker', kind: 'service', scope,
  permissions: ['ai.task.read'],
};

function task(taskId: string): AtlasTask {
  return {
    schemaVersion: 1,
    taskId,
    objective: 'Process an authorized overnight task',
    requestedBy: 'user',
    scope,
    assignedAgents: [],
    state: 'implementation',
    artifacts: [], findings: [], commits: [], tests: [], approvals: [], events: [],
    traceId: null, deployment: null,
    createdAt: '2026-09-16T03:00:00.000Z', updatedAt: '2026-09-16T03:00:00.000Z',
  };
}

function queueItem(taskId: string, queueItemId = `NQ-${taskId}`): NightQueueItem {
  return {
    schemaVersion: 1, queueItemId, taskId, sourceThreadId: null, scope,
    status: 'queued', priority: 100, attempt: 0, maxAttempts: 3,
    leaseOwner: null, leaseExpiresAt: null, heartbeatAt: null, checkpointId: null,
    archivePolicy: 'eligible_on_verified_completion', archiveEligible: false,
    nextEligibleAt: null,
    createdAt: '2026-09-16T03:00:00.000Z', updatedAt: '2026-09-16T03:00:00.000Z',
  };
}

async function setup() {
  const persistence = new InMemoryPersistence();
  const orchestrator = new AtlasOrchestrator({ persistence });
  const nightPersistence = new InMemoryNightOperationsPersistence();
  return { persistence, orchestrator, nightPersistence };
}

describe('ATLAS Night Operations Supervisor', () => {
  it('marks verified work completed autonomously and archive-eligible', async () => {
    const { orchestrator, nightPersistence } = await setup();
    await orchestrator.createTask(task('ATL-1'), human);
    await nightPersistence.enqueueNightItem(queueItem('ATL-1'));

    const supervisor = new NightOperationsSupervisor({
      orchestrator,
      persistence: nightPersistence,
      actor: worker,
      workerId: 'night-worker-1',
      clock: () => '2026-09-16T03:01:00.000Z',
      execute: async () => ({
        status: 'completed',
        stepKey: 'verify-final',
        completedOperations: ['load-task', 'verify-final'],
        evidenceRefs: ['evidence:ci:123'],
        lastSuccessfulOperation: 'verify-final',
        verificationPassed: true,
        openBlockers: 0,
      }),
    });

    const result = await supervisor.processNext(scope);
    expect(result?.status).toBe('completed_autonomous');
    expect(result?.archiveEligible).toBe(true);
    expect(result?.checkpointId).toBeTruthy();
  });

  it('records requires_attention instead of fabricating success', async () => {
    const { orchestrator, nightPersistence } = await setup();
    await orchestrator.createTask(task('ATL-2'), human);
    await nightPersistence.enqueueNightItem(queueItem('ATL-2'));

    const supervisor = new NightOperationsSupervisor({
      orchestrator,
      persistence: nightPersistence,
      actor: worker,
      workerId: 'night-worker-1',
      clock: () => '2026-09-16T03:01:00.000Z',
      execute: async () => ({
        status: 'requires_attention',
        stepKey: 'deploy',
        completedOperations: ['verify-ci'],
        evidenceRefs: ['evidence:ci:123'],
        lastSuccessfulOperation: 'verify-ci',
        cause: 'human_approval_required',
      }),
    });

    const result = await supervisor.processNext(scope);
    expect(result?.status).toBe('requires_attention');
    expect(result?.archiveEligible).toBe(false);
  });

  it('fails closed when lease ownership is lost before final persistence', async () => {
    const { orchestrator, nightPersistence } = await setup();
    await orchestrator.createTask(task('ATL-3'), human);
    await nightPersistence.enqueueNightItem(queueItem('ATL-3'));

    const originalRenew = nightPersistence.renewNightLease.bind(nightPersistence);
    nightPersistence.renewNightLease = async () => false;

    const supervisor = new NightOperationsSupervisor({
      orchestrator,
      persistence: nightPersistence,
      actor: worker,
      workerId: 'night-worker-1',
      clock: () => '2026-09-16T03:01:00.000Z',
      execute: async () => ({
        status: 'completed', stepKey: 'verify', completedOperations: ['verify'],
        evidenceRefs: ['evidence:1'], lastSuccessfulOperation: 'verify', verificationPassed: true, openBlockers: 0,
      }),
    });

    await expect(supervisor.processNext(scope)).rejects.toThrow(/lease/i);
    nightPersistence.renewNightLease = originalRenew;
  });
});