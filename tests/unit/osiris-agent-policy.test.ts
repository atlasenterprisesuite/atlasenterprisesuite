import { describe, expect, it } from 'vitest';
import { defaultAgents, getAgent, listAgents } from '../../packages/agent-registry/src';
import { AtlasOrchestrator, InMemoryPersistence } from '../../packages/ai-core/src';
import { authorize, type AtlasActor } from '../../packages/governance/src';
import type { AtlasTask } from '../../packages/task-protocol/src';

const scope = { tenantId: 'tenant-osiris-a', organizationId: 'org-osiris-a' };
const owner: AtlasActor = {
  actorId: 'osiris-test-owner',
  kind: 'human',
  scope,
  permissions: ['ai.task.create', 'ai.task.read', 'ai.delegate']
};

function task(state: AtlasTask['state'] = 'ci'): AtlasTask {
  return {
    schemaVersion: 1,
    taskId: 'ATL-2026-OSIRIS-01',
    objective: 'Synthetic OSIRIS research-only authorization check',
    requestedBy: 'osiris-test-owner',
    scope,
    assignedAgents: [],
    state,
    artifacts: [],
    findings: [],
    commits: [],
    tests: [],
    approvals: [],
    events: [],
    traceId: null,
    deployment: null,
    createdAt: '2026-11-06T12:00:00.000Z',
    updatedAt: '2026-11-06T12:00:00.000Z'
  };
}

function osiris(): AtlasActor {
  return {
    actorId: 'atlas-osiris',
    kind: 'agent',
    scope,
    permissions: [...getAgent('atlas-osiris').permissions]
  };
}

describe('OSIRIS research agent authorization — P0 fail closed', () => {
  it('registers an existing-orchestrator research profile with no mutation or production authority', () => {
    const profile = getAgent('atlas-osiris');
    expect(profile.providerId).toBe('openai');
    expect(profile.capabilities).toEqual(['research']);
    expect(profile.maxDelegationDepth).toBe(0);
    expect(profile.allowedEnvironments).toEqual(['development', 'test']);
    expect(profile.allowedTools).toEqual([
      'atlas.task.read', 'atlas.repo.inspect', 'atlas.ci.verify', 'atlas.audit.read'
    ]);
    expect(profile.permissions).toEqual([
      'ai.task.read', 'ai.repo.read', 'ai.ci.read', 'ai.audit.read'
    ]);
    expect(profile.permissions).not.toContain('ai.task.update');
    expect(profile.permissions).not.toContain('ai.deploy.request');
    expect(profile.allowedStates).not.toContain('approved');
    expect(profile.allowedStates).not.toContain('deploying');
    expect(profile.allowedTools).not.toContain('atlas.deploy.request');
    expect(new Set(defaultAgents.map(agent => agent.id)).size).toBe(defaultAgents.length);
  });

  it('denies cross-tenant access and unrequested write capabilities', () => {
    const actor = osiris();
    expect(authorize(actor, 'ai.task.read', scope)).toEqual({ allowed: true });
    expect(authorize(actor, 'ai.code.write', scope)).toEqual({ allowed: false, reason: 'permission_denied' });
    expect(authorize(actor, 'ai.task.update', scope)).toEqual({ allowed: false, reason: 'permission_denied' });
    expect(authorize(actor, 'ai.task.read', { tenantId: 'tenant-osiris-b', organizationId: scope.organizationId }))
      .toEqual({ allowed: false, reason: 'scope_mismatch' });
    expect(authorize(actor, 'ai.task.read', { tenantId: scope.tenantId, organizationId: 'org-osiris-b' }))
      .toEqual({ allowed: false, reason: 'scope_mismatch' });
  });

  it('does not allow callers to mutate canonical registry authorization through returned arrays', () => {
    const copy = getAgent('atlas-osiris');
    copy.permissions.push('ai.code.write');
    copy.allowedTools.push('atlas.deploy.request');
    copy.capabilities.push('implement');
    copy.allowedStates.push('approved');
    copy.allowedEnvironments.push('production');
    const fromList = listAgents().find(agent => agent.id === 'atlas-osiris');
    expect(fromList).toBeDefined();
    fromList?.permissions.push('release.deploy');
    fromList?.allowedTools.push('atlas.deploy.request');
    expect(getAgent('atlas-osiris').permissions).not.toContain('ai.code.write');
    expect(getAgent('atlas-osiris').permissions).not.toContain('release.deploy');
    expect(getAgent('atlas-osiris').allowedTools).not.toContain('atlas.deploy.request');
    expect(getAgent('atlas-osiris').capabilities).toEqual(['research']);
    expect(getAgent('atlas-osiris').allowedStates).not.toContain('approved');
    expect(getAgent('atlas-osiris').allowedEnvironments).not.toContain('production');
  });

  it('does not turn read-only CI access into permission to attest CI success', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence });
    await orchestrator.createTask(task('ci'), owner);
    await expect(orchestrator.recordCiSuccess(scope, task().taskId, 'ci://unverified', osiris()))
      .rejects.toThrow(/permission_denied/);
    const unchanged = await orchestrator.readTask(scope, task().taskId, owner);
    expect(unchanged.state).toBe('ci');
    expect(unchanged.tests).toEqual([]);
  });

  it('fails closed without an explicitly configured AI provider', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence });
    await orchestrator.createTask(task('planning'), owner);
    await expect(orchestrator.delegate(scope, task().taskId, 'atlas-osiris', 'Inspect evidence', owner))
      .rejects.toThrow(/provider is not configured/);
  });

  it('denies delegation in a release state before provider invocation', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence });
    await orchestrator.createTask(task('approved'), owner);
    await expect(orchestrator.delegate(scope, task().taskId, 'atlas-osiris', 'Attempt release work', owner))
      .rejects.toThrow(/not allowed in task state approved/);
  });
});
