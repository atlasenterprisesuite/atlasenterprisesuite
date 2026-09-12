export type AtlasWorkflowStatus =
  | 'now'
  | 'next'
  | 'blocked'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AtlasExecutionClass = 'observe' | 'prepare' | 'execute' | 'validate';

export type AtlasWorkflowPriority = 'low' | 'normal' | 'high' | 'critical';

export type AtlasWorkflow = {
  taskId: string;
  workflowType: string;
  module: string;
  tenantId: string;
  organizationId: string;
  ownerId: string;
  status: AtlasWorkflowStatus;
  priority: AtlasWorkflowPriority;
  currentStep: string | null;
  nextAction: string | null;
  dependencies: string[];
  blockedReason: string | null;
  permissionsRequired: string[];
  evidenceIds: string[];
  traceId: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type AtlasEvidenceRequirement = {
  evidenceId: string;
  required: boolean;
  mustBeVerified: boolean;
};

export type AtlasRetryPolicy = {
  maxAttempts: number;
  backoffMs: number;
};

export type AtlasWorkflowStepStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'blocked'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AtlasWorkflowStep = {
  stepId: string;
  taskId: string;
  module: string;
  actionType: string;
  executionClass: AtlasExecutionClass;
  status: AtlasWorkflowStepStatus;
  dependencies: string[];
  permissionsRequired: string[];
  retryPolicy: AtlasRetryPolicy;
  timeoutMs: number;
  idempotencyKey: string | null;
  inputRefs: string[];
  resultRefs: string[];
  evidenceRequirements: AtlasEvidenceRequirement[];
  createdAt: string;
  updatedAt: string;
};

export type AtlasWorkflowEvent = {
  eventId: string;
  taskId: string;
  stepId: string | null;
  organizationId: string;
  traceId: string;
  eventType: string;
  actorId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type CompletionEvidenceState = {
  requiredEvidenceIds: readonly string[];
  verifiedEvidenceIds: readonly string[];
};
