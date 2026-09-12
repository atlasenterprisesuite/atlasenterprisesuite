export const USER_FACING_EXECUTION_STATUSES = [
  'now',
  'next',
  'blocked',
  'awaiting_approval',
  'completed'
] as const;

export const EXECUTION_STATUSES = [
  'draft',
  ...USER_FACING_EXECUTION_STATUSES,
  'delegated',
  'automatable',
  'discarded',
  'failed',
  'cancelled'
] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];
export type ExecutionPriority = 'low' | 'normal' | 'high' | 'critical';
export type StepStatus = 'pending' | 'ready' | 'running' | 'blocked' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

export type ExecutionPermission =
  | 'execution.read'
  | 'execution.write'
  | 'execution.approve'
  | 'execution.audit'
  | 'execution.admin';

export function executionPermissionsForRole(role: string): ExecutionPermission[] {
  if (['owner', 'admin', 'platform_admin'].includes(role)) {
    return [
      'execution.read',
      'execution.write',
      'execution.approve',
      'execution.audit',
      'execution.admin'
    ];
  }
  return ['execution.read'];
}

export type ExecutionScope = {
  tenantId: string;
  organizationId: string;
};

export type ExecutionActor = {
  userId: string;
  scope: ExecutionScope;
  permissions: readonly string[];
};

export type DomainReference = {
  type: string;
  id: string;
};

export type ExecutionTask = {
  id: string;
  scope: ExecutionScope;
  module: string;
  ownerUserId: string | null;
  title: string;
  intent: string;
  goal: string;
  status: ExecutionStatus;
  priority: ExecutionPriority;
  currentStepId: string | null;
  nextAction: string | null;
  blockedReason: string | null;
  permissionsRequired: string[];
  source: DomainReference | null;
  parentTaskId: string | null;
  workflowId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ExecutionStep = {
  id: string;
  taskId: string;
  sequence: number;
  module: string;
  actionType: string;
  actionPayload: Record<string, unknown>;
  status: StepStatus;
  completionCriteria: string[];
  permissionsRequired: string[];
  dependencyIds: string[];
  evidenceRequirement: string[];
  startedAt: string | null;
  completedAt: string | null;
};

export type ExecutionWorkflow = {
  id: string;
  scope: ExecutionScope;
  workflowType: string;
  ownerModule: string;
  status: ExecutionStatus;
  currentTaskId: string | null;
  currentModule: string;
  context: Record<string, unknown>;
  createdByUserId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ExecutionEvidence = {
  id: string;
  taskId: string;
  stepId: string | null;
  kind: string;
  reference: string;
  verified: boolean;
  createdAt: string;
};

export type ExecutionApproval = {
  id: string;
  taskId: string;
  workflowId: string;
  module: string;
  requestedBy: string;
  approvalType: string;
  requiredPermission: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  payloadVersion: number;
  payloadDigest: string;
  status: ApprovalStatus;
  decidedBy: string | null;
  decisionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type ExecutionAuditEvent = {
  id: string;
  scope: ExecutionScope;
  actorUserId: string;
  taskId: string | null;
  workflowId: string | null;
  module: string;
  action: string;
  previousState: string | null;
  resultingState: string | null;
  evidenceIds: string[];
  correlationId: string | null;
  createdAt: string;
};
