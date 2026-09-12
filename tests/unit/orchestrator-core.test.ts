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
