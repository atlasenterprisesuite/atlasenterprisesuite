import { describe, expect, it } from 'vitest';
import type { AtlasEvidence, AtlasWorkflow, AtlasWorkflowEvent, AtlasWorkflowStep, ExecutionStore } from '../../packages/execution/src/index';
import { createExecutionRuntime, ProviderRegistry, ToolRegistry } from '../../packages/execution/src/index';

const workflow = (): AtlasWorkflow => ({
  taskId: 'task-1', workflowType: 'demo', module: 'core', tenantId: 'tenant-1', organizationId: 'org-1', ownerId: 'user-1',
  status: 'now', priority: 'normal', currentStep: 'step-1', nextAction: 'Run step', dependencies: [], blockedReason: null,
  permissionsRequired: [], evidenceIds: [], traceId: 'trace-1', createdAt: '2026-09-12T00:00:00Z', updatedAt: '2026-09-12T00:00:00Z', completedAt: null
});

const step = (executionClass: AtlasWorkflowStep['executionClass']): AtlasWorkflowStep => ({
  stepId: 'step-1', taskId: 'task-1', module: 'core', actionType: 'demo', executionClass, status: 'running', dependencies: [], permissionsRequired: [],
  retryPolicy: { maxAttempts: 1, backoffMs: 0 }, timeoutMs: 30000, idempotencyKey: null, inputRefs: [], resultRefs: [], evidenceRequirements: [],
  blockedReason: null, nextAction: null, createdAt: '2026-09-12T00:00:00Z', updatedAt: '2026-09-12T00:00:00Z'
});

function deps(tool: Parameters<ToolRegistry['register']>[0], approval: { status: 'approved'; expiresAt: null } | null = null) {
  const events: AtlasWorkflowEvent[] = [];
  const saved: AtlasWorkflow[] = [];
  const evidenceRecords: AtlasEvidence[] = [];
  const store: ExecutionStore = {
    async getWorkflow() { return workflow(); },
    async saveWorkflow(value) { saved.push(value); },
    async listSteps() { return []; },
    async appendEvent(event) { events.push(event); }
  };
  return {
    events, saved, evidenceRecords,
    runtime: createExecutionRuntime({
      store,
      tools: new ToolRegistry([tool]),
      providers: new ProviderRegistry(),
      authorize: async () => true,
      approvals: { async getApproval() { return approval; } },
      usage: { async evaluate() { return { allowed: true, reason: 'allowed' as const, estimatedCost: 0, remainingBudget: 100 }; } },
      evidence: {
        async list() { return [...evidenceRecords]; },
        async append(records) { evidenceRecords.push(...records); }
      }
    })
  };
}

describe('governed execution runtime', () => {
  it('executes observe with permission and no approval', async () => {
    let calls = 0;
    const tool = {
      id: 'inspect', capabilityId: 'workflow.inspect', executionClass: 'observe' as const, permission: 'workflow.read' as const, risk: 'low' as const,
      providerId: null, providerCapability: null, idempotency: 'none' as const, evidenceTypes: [],
      async execute() { calls += 1; return { ok: true, resultRefs: [], evidence: [] }; }
    };
    const { runtime } = deps(tool);
    const result = await runtime.runStep({ workflow: workflow(), step: step('observe'), actorId: 'user-1', capabilityId: 'workflow.inspect', input: null });
    expect(result.ok).toBe(true);
    expect(calls).toBe(1);
  });

  it('blocks regulated execution before tool call when approval is missing', async () => {
    let calls = 0;
    const tool = {
      id: 'regulated', capabilityId: 'tax.file', executionClass: 'execute' as const, permission: 'tax.file' as const, risk: 'regulated' as const,
      providerId: null, providerCapability: null, idempotency: 'required' as const, evidenceTypes: [],
      async execute() { calls += 1; return { ok: true, resultRefs: [], evidence: [] }; }
    };
    const { runtime } = deps(tool);
    const result = await runtime.runStep({ workflow: workflow(), step: { ...step('execute'), idempotencyKey: 'idem-1' }, actorId: 'user-1', capabilityId: 'tax.file', input: null });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('approval_required');
    expect(result.workflowStatus).toBe('awaiting_approval');
    expect(calls).toBe(0);
  });

  it('does not complete when required evidence is absent', async () => {
    const tool = {
      id: 'provider-action', capabilityId: 'provider.action', executionClass: 'execute' as const, permission: 'agent.execute' as const, risk: 'low' as const,
      providerId: null, providerCapability: null, idempotency: 'supported' as const, evidenceTypes: ['provider_reference'],
      async execute() { return { ok: true, resultRefs: ['result-1'], evidence: [] }; }
    };
    const { runtime } = deps(tool);
    const result = await runtime.runStep({ workflow: workflow(), step: step('execute'), actorId: 'user-1', capabilityId: 'provider.action', input: null });
    expect(result.ok).toBe(true);
    expect(result.workflowStatus).not.toBe('completed');
    expect(result.evidenceSatisfied).toBe(false);
  });
});
