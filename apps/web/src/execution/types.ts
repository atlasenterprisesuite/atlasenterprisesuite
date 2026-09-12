import type { ApprovalStatus, ExecutionPriority, ExecutionStatus, StepStatus } from '../../../../packages/execution/src';

export type GuidedWorkflow = {
  id: string;
  organizationId: string;
  tenantId: string;
  workflowType: string;
  ownerModule: string;
  status: ExecutionStatus;
  currentTaskId: string | null;
  currentModule: string;
  context: Record<string, unknown>;
  version: number;
};

export type GuidedTask = {
  id: string;
  workflowId: string;
  module: string;
  title: string;
  goal: string;
  status: ExecutionStatus;
  priority: ExecutionPriority;
  currentStepId: string | null;
  nextAction: string | null;
  blockedReason: string | null;
  permissionsRequired: string[];
};

export type GuidedStep = {
  id: string;
  taskId: string;
  sequence: number;
  module: string;
  actionType: string;
  status: StepStatus;
  completionCriteria: string[];
  permissionsRequired: string[];
  evidenceRequirement: string[];
  startedAt: string | null;
  completedAt: string | null;
};

export type GuidedEvidence = {
  id: string;
  taskId: string;
  stepId: string | null;
  kind: string;
  reference: string;
  verified: boolean;
  createdAt: string;
};

export type GuidedApproval = {
  id: string;
  taskId: string;
  workflowId: string;
  module: string;
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

export type GuidedDependency = {
  id: string;
  taskId: string;
  stepId: string | null;
  dependsOnTaskId: string | null;
  dependsOnStepId: string | null;
  resolvedAt: string | null;
};

export type GuidedAuditEvent = {
  id: string;
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

export type GuidedExecutionState = {
  workflow: GuidedWorkflow;
  tasks: GuidedTask[];
  steps: GuidedStep[];
  dependencies: GuidedDependency[];
  evidence: GuidedEvidence[];
  approvals: GuidedApproval[];
};
