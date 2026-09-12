import { describe, expect, it } from 'vitest';
import { createAtlasExecutionHandler, type ExecutionApiContext, type ExecutionApiStore } from '../../supabase/functions/atlas-execution/index';
import {
  createExecutionRuntime,
  ProviderRegistry,
  ToolRegistry,
  type AtlasEvidence,
  type AtlasWorkflow,
  type AtlasWorkflowEvent,
  type AtlasWorkflowStep,
  type ExecutionStore
} from '../../packages/execution/src/index';

const ORG = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const TRACE = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-09-12T13:30:00.000Z';

function context(): ExecutionApiContext {
  return {
    organization_id: ORG,
    user_id: USER,
    permissions: ['workflow.read', 'workflow.manage', 'workflow.approve', 'agent.execute'],
    roles: ['admin'],
    request_id: 'request-1'
  };
}

function createApiHarness() {
  let workflow: Record<string, any> | null = null;
  let approval: Record<string, any> = {
    id: 'approval-1',
    task_id: 'task-1',
    step_id: 'step-1',
    status: 'pending'
  };
  const events: Record<string, any>[] = [];

  const store: ExecutionApiStore = {
    async listWorkflows() { return workflow ? [workflow] : []; },
    async getWorkflow(_ctx, taskId) {
      if (!workflow || workflow.task_id !== taskId) throw Object.assign(new Error('workflow_not_found'), { code: 'workflow_not_found', status: 404 });
      return workflow;
    },
    async createWorkflow(ctx, input) {
      workflow = {
        ...input,
        org_id: ctx.organization_id,
        owner_id: ctx.user_id,
        evidence_ids: [],
        blocked_reason: null,
        created_at: NOW,
        updated_at: NOW,
        completed_at: null
      };
      return workflow;
    },
    async updateWorkflow(_ctx, taskId, patch) {
      if (!workflow || workflow.task_id !== taskId) throw Object.assign(new Error('workflow_not_found'), { code: 'workflow_not_found', status: 404 });
      workflow = { ...workflow, ...patch };
      return workflow;
    },
    async appendEvent(_ctx, event) { events.push(event); },
    async getApproval(_ctx, approvalId) {
      if (approval.id !== approvalId) throw Object.assign(new Error('approval_not_found'), { code: 'approval_not_found', status: 404 });
      return approval;
    },
    async updateApproval(_ctx, approvalId, patch) {
      if (approval.id !== approvalId) throw Object.assign(new Error('approval_not_found'), { code: 'approval_not_found', status: 404 });
      approval = { ...approval, ...patch };
      return approval;
    },
    async listProviders() { return []; }
  };

  return {
    store,
    events,
    get workflow() { return workflow; },
    get approval() { return approval; }
  };
}

function toDomainWorkflow(row: Record<string, any>): AtlasWorkflow {
  return {
    taskId: String(row.task_id),
    workflowType: String(row.workflow_type),
    module: String(row.module),
    tenantId: String(row.tenant_id),
    organizationId: String(row.org_id),
    ownerId: String(row.owner_id),
    status: row.status,
    priority: row.priority,
    currentStep: row.current_step ?? null,
    nextAction: row.next_action ?? null,
    dependencies: Array.isArray(row.dependencies) ? row.dependencies : [],
    blockedReason: row.blocked_reason ?? null,
    permissionsRequired: Array.isArray(row.permissions_required) ? row.permissions_required : [],
    evidenceIds: Array.isArray(row.evidence_ids) ? row.evidence_ids : [],
    traceId: String(row.trace_id),
    createdAt: String(row.created_at || NOW),
    updatedAt: String(row.updated_at || NOW),
    completedAt: row.completed_at ?? null
  };
}

describe('ATLAS universal execution core flow', () => {
  it('moves create -> approval -> approved execution -> verified evidence -> completed with one trace id', async () => {
    const api = createApiHarness();
    const handler = createAtlasExecutionHandler({
      resolveContext: async () => context(),
      store: api.store,
      randomUUID: () => TRACE,
      now: () => NOW
    });

    const created = await handler(new Request('https://example.test/functions/v1/atlas-execution?api=create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        task_id: 'task-1',
        workflow_type: 'regulated-demo',
        module: 'core',
        current_step: 'step-1',
        next_action: 'Start governed execution'
      })
    }));
    expect(created.status).toBe(201);
    expect(api.workflow?.status).toBe('next');

    const started = await handler(new Request('https://example.test/functions/v1/atlas-execution?api=advance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task_id: 'task-1', step_id: 'step-1', event: 'start' })
    }));
    expect(started.status).toBe(200);
    expect(api.workflow?.status).toBe('now');

    const approvalRequested = await handler(new Request('https://example.test/functions/v1/atlas-execution?api=advance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task_id: 'task-1', step_id: 'step-1', event: 'request_approval' })
    }));
    expect(approvalRequested.status).toBe(200);
    expect(api.workflow?.status).toBe('awaiting_approval');

    const approved = await handler(new Request('https://example.test/functions/v1/atlas-execution?api=approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ approval_id: 'approval-1', reason: 'Explicit test approval' })
    }));
    expect(approved.status).toBe(200);
    expect(api.approval.status).toBe('approved');
    expect(api.workflow?.status).toBe('now');

    const runtimeEvents: AtlasWorkflowEvent[] = [];
    let savedWorkflow: AtlasWorkflow | null = null;
    const evidenceRecords: AtlasEvidence[] = [];
    let toolCalls = 0;

    const runtimeStore: ExecutionStore = {
      async getWorkflow() { return api.workflow ? toDomainWorkflow(api.workflow) : null; },
      async saveWorkflow(value) { savedWorkflow = value; },
      async listSteps() { return []; },
      async appendEvent(event) { runtimeEvents.push(event); }
    };

    const tool = {
      id: 'regulated-fake-tool',
      capabilityId: 'regulated.fake.execute',
      executionClass: 'execute' as const,
      permission: 'agent.execute' as const,
      risk: 'regulated' as const,
      providerId: null,
      providerCapability: null,
      idempotency: 'required' as const,
      evidenceTypes: ['provider_reference'],
      async execute() {
        toolCalls += 1;
        return {
          ok: true,
          resultRefs: ['result://local-only'],
          evidence: [{
            evidenceId: 'ev-1',
            organizationId: ORG,
            taskId: 'task-1',
            stepId: 'step-1',
            evidenceType: 'provider_reference',
            sourceType: 'fake_local_tool',
            sourceReference: 'local://receipt-1',
            verificationState: 'verified' as const,
            immutableDigest: 'sha256:test-only',
            createdAt: NOW
          }]
        };
      }
    };

    const runtime = createExecutionRuntime({
      store: runtimeStore,
      tools: new ToolRegistry([tool]),
      providers: new ProviderRegistry(),
      authorize: async ({ organizationId, actorId }) => organizationId === ORG && actorId === USER,
      approvals: {
        async getApproval() {
          return { status: api.approval.status, expiresAt: null } as any;
        }
      },
      usage: {
        async evaluate() {
          return { allowed: true, reason: 'allowed' as const, estimatedCost: 0, remainingBudget: 0 };
        }
      },
      evidence: {
        async list() { return [...evidenceRecords]; },
        async append(records) { evidenceRecords.push(...records); }
      }
    });

    const step: AtlasWorkflowStep = {
      stepId: 'step-1',
      taskId: 'task-1',
      module: 'core',
      actionType: 'regulated_fake',
      executionClass: 'execute',
      status: 'running',
      dependencies: [],
      permissionsRequired: ['agent.execute'],
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
      timeoutMs: 30000,
      idempotencyKey: 'idem-task-1-step-1',
      inputRefs: [],
      resultRefs: [],
      evidenceRequirements: [{ evidenceId: 'ev-1', required: true, mustBeVerified: true }],
      blockedReason: null,
      nextAction: null,
      createdAt: NOW,
      updatedAt: NOW
    };

    const result = await runtime.runStep({
      workflow: toDomainWorkflow(api.workflow!),
      step,
      actorId: USER,
      capabilityId: 'regulated.fake.execute',
      input: { local: true }
    });

    expect(result.ok).toBe(true);
    expect(result.workflowStatus).toBe('completed');
    expect(result.evidenceSatisfied).toBe(true);
    expect(toolCalls).toBe(1);
    expect(savedWorkflow?.status).toBe('completed');
    expect(savedWorkflow?.evidenceIds).toEqual(['ev-1']);

    const runtimeEventTypes = runtimeEvents.map((event) => event.eventType);
    expect(runtimeEventTypes).toEqual([
      'authorization',
      'usage_policy',
      'approval',
      'execution',
      'validation',
      'evidence',
      'completion'
    ]);

    expect(api.events.map((event) => event.event_type)).toEqual([
      'workflow_created',
      'workflow_start',
      'workflow_request_approval',
      'approval_granted'
    ]);
    expect(api.events.every((event) => event.trace_id === TRACE)).toBe(true);
    expect(runtimeEvents.every((event) => event.traceId === TRACE)).toBe(true);
  });
});
