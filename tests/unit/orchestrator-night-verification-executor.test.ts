import { describe, expect, it } from 'vitest';
import { AtlasOrchestrator, InMemoryPersistence } from '../../packages/ai-core/src';
import type { AtlasActor } from '../../packages/governance/src';
import type { AtlasTask, NightQueueItem } from '../../packages/task-protocol/src';
import { createVerificationNightExecutor } from '../../apps/atlas-orchestrator/src/workers/verificationNightExecutor';

const scope = { tenantId: 'tenant-night', organizationId: 'org-night' };
const actor: AtlasActor = {
  actorId: 'atlas-night-supervisor', kind: 'service', scope,
  permissions: ['ai.task.create', 'ai.task.read', 'ai.task.update', 'ai.ci.read'],
};

function makeTask(state: AtlasTask['state']): AtlasTask {
  return {
    schemaVersion: 1, taskId: `ATL-NIGHT-${state}`, objective: 'Verify governed night close', requestedBy: 'user', scope,
    assignedAgents: [], state, artifacts: [], findings: [], commits: [],
    tests: [{ name: 'ATLAS 3-of-3 Consensus', status: 'passed', evidence: 'github-actions://consensus/1' }],
    approvals: [], events: [], traceId: null,
    deployment: state === 'verified' ? { id: 'deploy-1', status: 'verified', url: 'https://atlas.example/healthz' } : null,
    createdAt: '2026-09-16T07:00:00.000Z', updatedAt: '2026-09-16T07:00:00.000Z',
  };
}

function item(task: AtlasTask): NightQueueItem {
  return {
    schemaVersion: 1, queueItemId: `NQ-${task.taskId}`, taskId: task.taskId, sourceThreadId: null, scope,
    status: 'leased', priority: 1, attempt: 1, maxAttempts: 5, leaseOwner: 'worker',
    leaseExpiresAt: '2026-09-16T07:10:00.000Z', heartbeatAt: '2026-09-16T07:05:00.000Z', checkpointId: null,
    archivePolicy: 'eligible_on_verified_completion', archiveEligible: false, nextEligibleAt: null,
    createdAt: '2026-09-16T07:00:00.000Z', updatedAt: '2026-09-16T07:05:00.000Z',
  };
}

describe('night verification executor', () => {
  it('closes verified work only when recorded evidence exists and no blockers remain', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence });
    const task = makeTask('verified');
    await orchestrator.createTask(task, actor);
    const execute = createVerificationNightExecutor(orchestrator);

    const result = await execute({
      task, item: item(task), checkpoint: null, actor,
      makeIdempotencyKey: (operation, stepKey) => `${operation}:${stepKey}`,
    });

    expect(result.status).toBe('completed');
    expect((await orchestrator.readTask(scope, task.taskId, actor)).state).toBe('completed');
  });

  it('records verified CI evidence then stops at the human approval gate', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence });
    const task = makeTask('ci');
    await orchestrator.createTask(task, actor);
    const execute = createVerificationNightExecutor(orchestrator);

    const result = await execute({
      task, item: item(task), checkpoint: null, actor,
      makeIdempotencyKey: (operation, stepKey) => `${operation}:${stepKey}`,
    });

    expect(result).toMatchObject({ status: 'requires_attention', cause: 'human_approval_required' });
    expect((await orchestrator.readTask(scope, task.taskId, actor)).state).toBe('awaiting_human_approval');
  });

  it('does not pretend active implementation can run without a configured execution provider', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence });
    const task = makeTask('implementation');
    await orchestrator.createTask(task, actor);
    const execute = createVerificationNightExecutor(orchestrator);

    const result = await execute({
      task, item: item(task), checkpoint: null, actor,
      makeIdempotencyKey: (operation, stepKey) => `${operation}:${stepKey}`,
    });

    expect(result).toMatchObject({ status: 'requires_attention', cause: 'execution_provider_required' });
  });
});
