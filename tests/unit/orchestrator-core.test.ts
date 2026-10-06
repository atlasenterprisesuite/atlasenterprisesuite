import { describe, expect, it } from 'vitest';
import { AtlasOrchestrator, InMemoryPersistence, type ProviderAdapter } from '../../packages/ai-core/src';
import type { AtlasActor } from '../../packages/governance/src';
import type { AtlasTask } from '../../packages/task-protocol/src';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };
const human: AtlasActor = {
  actorId: 'winder', kind: 'human', scope,
  permissions: ['ai.task.create', 'ai.task.read', 'ai.task.update', 'ai.delegate', 'ai.deploy.request', 'release.approve']
};
const agent: AtlasActor = {
  actorId: 'atlas-openai-engineer', kind: 'agent', scope,
  permissions: ['ai.task.read', 'ai.task.update', 'ai.delegate']
};

function task(state: AtlasTask['state'] = 'draft'): AtlasTask {
  return {
    schemaVersion: 1, taskId: 'ATL-2026-000002', objective: 'Coordinate shared AI work', requestedBy: 'user', scope,
    assignedAgents: [], state, artifacts: [], findings: [], commits: [], tests: [], approvals: [], events: [],
    traceId: null, deployment: null, createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z'
  };
}

function completionReadyTask(overrides: Partial<Pick<AtlasTask, 'tests' | 'approvals' | 'deployment'>> = {}): AtlasTask {
  return {
    ...task('verified'),
    tests: [{ name: 'ATLAS verification suite', status: 'passed', evidence: 'ci://run/123' }],
    approvals: [{ actorId: 'winder', result: 'approved', target: 'commit-sha', createdAt: '2026-10-06T18:00:00.000Z' }],
    deployment: { id: 'deploy-1', status: 'verified', url: 'https://www.atlasenterprisesuite.com/' },
    ...overrides
  };
}

const provider: ProviderAdapter = {
  providerId: 'openai',
  async invoke(input) {
    return { finalOutput: `handled:${input.agentId}`, traceId: 'trace-1', findings: [] };
  }
};

describe('ATLAS orchestrator', () => {
  it('creates and transitions tasks only through governed commands', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence, providers: [provider] });
    await orchestrator.createTask(task(), human);
    const queued = await orchestrator.transitionTask(scope, 'ATL-2026-000002', 'queued', human);
    expect(queued.state).toBe('queued');
    await expect(orchestrator.transitionTask(scope, 'ATL-2026-000002', 'completed', human)).rejects.toThrow(/Illegal ATLAS task transition/);
  });

  it('fails closed when completion is requested without verified evidence', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence, providers: [provider] });
    await orchestrator.createTask(task('verified'), human);

    await expect(orchestrator.transitionTask(scope, 'ATL-2026-000002', 'completed', human))
      .rejects.toThrow(/completion evidence/i);
  });

  it('blocks completion when any verification test failed', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence, providers: [provider] });
    await orchestrator.createTask(completionReadyTask({
      tests: [{ name: 'ATLAS verification suite', status: 'failed', evidence: 'ci://run/failed' }]
    }), human);

    await expect(orchestrator.transitionTask(scope, 'ATL-2026-000002', 'completed', human))
      .rejects.toThrow(/failed_test/);
  });

  it('blocks completion when a passing test has no evidence reference', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence, providers: [provider] });
    await orchestrator.createTask(completionReadyTask({
      tests: [{ name: 'ATLAS verification suite', status: 'passed', evidence: null }]
    }), human);

    await expect(orchestrator.transitionTask(scope, 'ATL-2026-000002', 'completed', human))
      .rejects.toThrow(/missing_test_evidence/);
  });

  it('blocks completion when human approval is absent or denied', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence, providers: [provider] });
    await orchestrator.createTask(completionReadyTask({
      approvals: [{ actorId: 'winder', result: 'denied', target: 'commit-sha', createdAt: '2026-10-06T18:00:00.000Z' }]
    }), human);

    await expect(orchestrator.transitionTask(scope, 'ATL-2026-000002', 'completed', human))
      .rejects.toThrow(/approval_not_satisfied/);
  });

  it('blocks completion until deployment evidence is verified', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence, providers: [provider] });
    await orchestrator.createTask(completionReadyTask({
      deployment: { id: 'deploy-1', status: 'requested', url: null }
    }), human);

    await expect(orchestrator.transitionTask(scope, 'ATL-2026-000002', 'completed', human))
      .rejects.toThrow(/deployment_not_verified/);
  });

  it('allows completion only after tests, approval, and deployment are verified', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence, providers: [provider] });
    await orchestrator.createTask(completionReadyTask(), human);

    const completed = await orchestrator.transitionTask(scope, 'ATL-2026-000002', 'completed', human);
    expect(completed.state).toBe('completed');
  });

  it('delegates through the registered provider without granting release permissions', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence, providers: [provider] });
    await orchestrator.createTask(task('planning'), human);
    const result = await orchestrator.delegate(scope, 'ATL-2026-000002', 'atlas-architect', 'Review architecture', agent);
    expect(result.traceId).toBe('trace-1');
  });

  it('rejects release approval from an agent actor', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence, providers: [provider] });
    await orchestrator.createTask(task('awaiting_human_approval'), human);
    await expect(orchestrator.approveRelease(scope, 'ATL-2026-000002', 'commit-sha', agent)).rejects.toThrow(/human approval/i);
  });

  it('records a deployment request but does not execute deployment', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence, providers: [provider] });
    await orchestrator.createTask(task('approved'), human);
    const updated = await orchestrator.requestDeployment(scope, 'ATL-2026-000002', human);
    expect(updated.deployment?.status).toBe('requested');
    expect(updated.state).toBe('approved');
  });
});
