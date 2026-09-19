import type { TenantScope } from '../../core/src/index';
import { getAgent } from '../../agent-registry/src';
import {
  authorize,
  canHumanApproveRelease,
  redactAuditPayload,
  type AiPermission,
  type AtlasActor
} from '../../governance/src';
import {
  AtlasTaskSchema,
  assertTransition,
  type AtlasCommitRef,
  type AtlasEvent,
  type AtlasFinding,
  type AtlasTask,
  type AtlasTaskState,
  type AtlasTestResult
} from '../../task-protocol/src';
import type { PersistencePort } from './persistence';
import type { ProviderAdapter, ProviderResult } from './providers';

function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class AtlasOrchestrator {
  private readonly providers: Map<string, ProviderAdapter>;
  private readonly options: { persistence: PersistencePort; providers?: ProviderAdapter[] };

  constructor(options: { persistence: PersistencePort; providers?: ProviderAdapter[] }) {
    this.options = options;
    this.providers = new Map((options.providers ?? []).map((provider) => [provider.providerId, provider]));
  }

  private require(actor: AtlasActor, permission: AiPermission, scope: TenantScope): void {
    const decision = authorize(actor, permission, scope);
    if (!decision.allowed) throw new Error(`ATLAS authorization denied: ${decision.reason}`);
  }

  private async load(scope: TenantScope, taskId: string): Promise<AtlasTask> {
    const task = await this.options.persistence.getTask(scope, taskId);
    if (!task) throw new Error(`ATLAS task not found in scope: ${taskId}`);
    return task;
  }

  private async event(task: AtlasTask, actor: AtlasActor, type: string, outcome: AtlasEvent['outcome'], payload: Record<string, unknown> = {}): Promise<void> {
    await this.options.persistence.appendEvent({
      eventId: id('evt'), taskId: task.taskId, scope: task.scope, type,
      actorId: actor.actorId, agentId: actor.kind === 'agent' ? actor.actorId : null,
      providerId: null, outcome, correlationId: id('corr'),
      payload: redactAuditPayload(payload) as Record<string, unknown>,
      createdAt: new Date().toISOString()
    });
  }

  async createTask(task: AtlasTask, actor: AtlasActor): Promise<AtlasTask> {
    this.require(actor, 'ai.task.create', task.scope);
    const validated = AtlasTaskSchema.parse(task);
    await this.options.persistence.createTask(validated);
    await this.event(validated, actor, 'task.created', 'success');
    return this.load(task.scope, task.taskId);
  }

  async readTask(scope: TenantScope, taskId: string, actor: AtlasActor): Promise<AtlasTask> {
    this.require(actor, 'ai.task.read', scope);
    return this.load(scope, taskId);
  }

  async transitionTask(scope: TenantScope, taskId: string, next: AtlasTaskState, actor: AtlasActor): Promise<AtlasTask> {
    this.require(actor, 'ai.task.update', scope);
    const task = await this.load(scope, taskId);
    try {
      assertTransition(task.state, next);
    } catch (error) {
      await this.event(task, actor, 'task.state_changed', 'failed', { from: task.state, to: next });
      throw error;
    }
    const updated = { ...task, state: next, updatedAt: new Date().toISOString() };
    await this.options.persistence.saveTask(updated);
    await this.event(updated, actor, 'task.state_changed', 'success', { from: task.state, to: next });
    return updated;
  }

  async delegate(scope: TenantScope, taskId: string, agentId: string, prompt: string, actor: AtlasActor): Promise<ProviderResult> {
    this.require(actor, 'ai.delegate', scope);
    const task = await this.load(scope, taskId);
    const agent = getAgent(agentId);
    if (!agent.allowedStates.includes(task.state)) throw new Error(`Agent ${agentId} is not allowed in task state ${task.state}`);
    const provider = this.providers.get(agent.providerId);
    if (!provider) throw new Error(`ATLAS provider is not configured: ${agent.providerId}`);
    const correlationId = id('invoke');
    await this.event(task, actor, 'agent.invocation_started', 'success', { agentId, correlationId });
    try {
      const result = await provider.invoke({ taskId, agentId, prompt, allowedTools: [...agent.allowedTools], correlationId });
      const updated = {
        ...task,
        assignedAgents: task.assignedAgents.includes(agentId) ? task.assignedAgents : [...task.assignedAgents, agentId],
        traceId: result.traceId ?? task.traceId,
        findings: [...task.findings, ...result.findings],
        updatedAt: new Date().toISOString()
      };
      await this.options.persistence.saveTask(updated);
      await this.event(updated, actor, 'agent.invocation_completed', 'success', { agentId, correlationId, traceId: result.traceId });
      return result;
    } catch (error) {
      await this.event(task, actor, 'agent.invocation_failed', 'failed', { agentId, correlationId, error: error instanceof Error ? error.message : 'unknown error' });
      throw error;
    }
  }

  async recordFinding(scope: TenantScope, taskId: string, finding: AtlasFinding, actor: AtlasActor): Promise<AtlasTask> {
    this.require(actor, 'ai.review.submit', scope);
    const task = await this.load(scope, taskId);
    const updated = { ...task, findings: [...task.findings, finding], updatedAt: new Date().toISOString() };
    await this.options.persistence.saveTask(updated);
    await this.event(updated, actor, 'finding.recorded', 'success', { findingId: finding.id });
    return updated;
  }

  async linkCommit(scope: TenantScope, taskId: string, commit: AtlasCommitRef, actor: AtlasActor): Promise<AtlasTask> {
    this.require(actor, 'ai.code.write', scope);
    const task = await this.load(scope, taskId);
    const updated = { ...task, commits: [...task.commits, commit], updatedAt: new Date().toISOString() };
    await this.options.persistence.saveTask(updated);
    await this.event(updated, actor, 'commit.linked', 'success', { sha: commit.sha, repo: commit.repo });
    return updated;
  }

  async recordTest(scope: TenantScope, taskId: string, test: AtlasTestResult, actor: AtlasActor): Promise<AtlasTask> {
    this.require(actor, 'ai.test.execute', scope);
    const task = await this.load(scope, taskId);
    const updated = { ...task, tests: [...task.tests, test], updatedAt: new Date().toISOString() };
    await this.options.persistence.saveTask(updated);
    await this.event(updated, actor, 'test.recorded', test.status === 'passed' ? 'success' : 'failed', { name: test.name, evidence: test.evidence });
    return updated;
  }

  async recordCiSuccess(scope: TenantScope, taskId: string, evidence: string, actor: AtlasActor): Promise<AtlasTask> {
    this.require(actor, 'ai.ci.read', scope);
    const task = await this.load(scope, taskId);
    if (task.state !== 'ci') throw new Error('CI success can only be recorded while task state is ci');
    const updated: AtlasTask = {
      ...task,
      tests: [...task.tests, { name: 'ATLAS 3-of-3 Consensus', status: 'passed', evidence }],
      state: 'awaiting_human_approval',
      updatedAt: new Date().toISOString()
    };
    await this.options.persistence.saveTask(updated);
    await this.event(updated, actor, 'ci.recorded', 'success', { evidence });
    return updated;
  }

  async approveRelease(scope: TenantScope, taskId: string, target: string, actor: AtlasActor): Promise<AtlasTask> {
    const task = await this.load(scope, taskId);
    if (!canHumanApproveRelease(actor, scope, task.state)) {
      await this.event(task, actor, 'approval.denied', 'denied', { target });
      throw new Error('ATLAS production release requires explicit authorized human approval');
    }
    const approval = { actorId: actor.actorId, result: 'approved' as const, target, createdAt: new Date().toISOString() };
    const updated: AtlasTask = { ...task, approvals: [...task.approvals, approval], state: 'approved', updatedAt: new Date().toISOString() };
    await this.options.persistence.saveTask(updated);
    await this.event(updated, actor, 'approval.granted', 'success', { target });
    return updated;
  }

  async requestDeployment(scope: TenantScope, taskId: string, actor: AtlasActor): Promise<AtlasTask> {
    this.require(actor, 'ai.deploy.request', scope);
    const task = await this.load(scope, taskId);
    if (task.state !== 'approved') throw new Error('Deployment can only be requested from approved state');
    const updated: AtlasTask = {
      ...task,
      deployment: { id: id('deploy'), status: 'requested', url: null },
      updatedAt: new Date().toISOString()
    };
    await this.options.persistence.saveTask(updated);
    await this.event(updated, actor, 'deployment.requested', 'success', { deploymentId: updated.deployment?.id });
    return updated;
  }
}
