import type { ApprovalStatus, ExecutionStatus, StepStatus } from '../../packages/execution/src';
import type { GuidedApproval, GuidedExecutionState } from '../../apps/web/src/execution/types';

export type GuidedFixtureOptions = {
  workflowStatus?: ExecutionStatus;
  taskStatus?: ExecutionStatus;
  currentStepId?: string | null;
  blockedReason?: string | null;
  stepStatuses?: StepStatus[];
  currentActionType?: string;
  approvals?: GuidedApproval[];
};

export function makeApproval(overrides: Partial<GuidedApproval> = {}): GuidedApproval {
  return {
    id: 'approval-1',
    taskId: 'task-1',
    workflowId: 'wf-1',
    module: 'manager',
    approvalType: 'infrastructure_review',
    requiredPermission: 'execution.approve',
    riskLevel: 'high',
    summary: 'Review infrastructure action',
    payloadVersion: 1,
    payloadDigest: 'a'.repeat(64),
    status: 'pending' as ApprovalStatus,
    decidedBy: null,
    decisionReason: null,
    createdAt: '2026-09-12T12:00:00Z',
    decidedAt: null,
    ...overrides
  };
}

export function makeGuidedState(options: GuidedFixtureOptions = {}): GuidedExecutionState {
  const statuses = options.stepStatuses ?? ['completed', 'ready', 'blocked'];
  return {
    workflow: {
      id: 'wf-1',
      organizationId: 'org-1',
      tenantId: 'tenant-1',
      workflowType: 'manager.infrastructure_readiness',
      ownerModule: 'manager',
      status: options.workflowStatus ?? 'now',
      currentTaskId: 'task-1',
      currentModule: 'manager',
      context: { return_path: '/' },
      version: 1
    },
    tasks: [{
      id: 'task-1',
      workflowId: 'wf-1',
      module: 'manager',
      title: 'Verify infrastructure readiness',
      goal: 'Produce evidence-backed readiness',
      status: options.taskStatus ?? 'now',
      priority: 'high',
      currentStepId: options.currentStepId === undefined ? 'step-2' : options.currentStepId,
      nextAction: 'Verify Cloudflare',
      blockedReason: options.blockedReason ?? null,
      permissionsRequired: ['execution.read']
    }],
    steps: [
      {
        id: 'step-1', taskId: 'task-1', sequence: 1, module: 'manager', actionType: 'verify_github',
        status: statuses[0] ?? 'completed', completionCriteria: ['github verified'], permissionsRequired: ['execution.read'],
        evidenceRequirement: ['infra_verification'], startedAt: null,
        completedAt: statuses[0] === 'completed' ? '2026-09-12T12:01:00Z' : null
      },
      {
        id: 'step-2', taskId: 'task-1', sequence: 2, module: 'manager', actionType: options.currentActionType ?? 'verify_cloudflare',
        status: statuses[1] ?? 'ready', completionCriteria: ['cloudflare verified'], permissionsRequired: ['execution.read'],
        evidenceRequirement: ['infra_verification'], startedAt: null, completedAt: null
      },
      {
        id: 'step-3', taskId: 'task-1', sequence: 3, module: 'manager', actionType: 'verify_production',
        status: statuses[2] ?? 'blocked', completionCriteria: ['production verified'], permissionsRequired: ['execution.read'],
        evidenceRequirement: ['infra_verification'], startedAt: null, completedAt: null
      }
    ],
    dependencies: [],
    evidence: [],
    approvals: options.approvals ?? []
  };
}
