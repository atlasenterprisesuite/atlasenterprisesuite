import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../lib/atlasSession';
import type {
  GuidedApproval,
  GuidedAuditEvent,
  GuidedDependency,
  GuidedEvidence,
  GuidedExecutionState,
  GuidedStep,
  GuidedTask,
  GuidedWorkflow
} from './types';

type RawRecord = Record<string, any>;

function record(value: unknown): RawRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RawRecord : {};
}

function rows(value: unknown): RawRecord[] {
  return Array.isArray(value) ? value.filter((item): item is RawRecord => Boolean(item && typeof item === 'object' && !Array.isArray(item))) : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value);
}

export async function parseExecutionResponse(response: Response): Promise<RawRecord> {
  const text = await response.text();
  let data: RawRecord = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: 'invalid_response' };
  }
  if (!response.ok) throw new Error(String(data.error || `execution_request_failed_${response.status}`));
  return data;
}

function normalizeWorkflow(rawValue: unknown): GuidedWorkflow {
  const raw = record(rawValue);
  const context = record(raw.context);
  return {
    id: String(raw.id || ''),
    organizationId: String(raw.org_id || ''),
    tenantId: String(raw.tenant_id || ''),
    workflowType: String(raw.workflow_type || ''),
    ownerModule: String(raw.owner_module || ''),
    status: String(raw.status || 'draft') as GuidedWorkflow['status'],
    currentTaskId: nullableString(raw.current_task_id),
    currentModule: String(raw.current_module || raw.owner_module || ''),
    context,
    version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : 1
  };
}

function normalizeTask(raw: RawRecord): GuidedTask {
  return {
    id: String(raw.id || ''), workflowId: String(raw.workflow_id || ''), module: String(raw.module || ''),
    title: String(raw.title || ''), goal: String(raw.goal || ''), status: String(raw.status || 'draft') as GuidedTask['status'],
    priority: String(raw.priority || 'normal') as GuidedTask['priority'], currentStepId: nullableString(raw.current_step_id),
    nextAction: nullableString(raw.next_action), blockedReason: nullableString(raw.blocked_reason),
    permissionsRequired: strings(raw.permissions_required)
  };
}

function normalizeStep(raw: RawRecord): GuidedStep {
  return {
    id: String(raw.id || ''), taskId: String(raw.task_id || ''), sequence: Number.isFinite(Number(raw.sequence)) ? Number(raw.sequence) : 0,
    module: String(raw.module || ''), actionType: String(raw.action_type || ''), status: String(raw.status || 'pending') as GuidedStep['status'],
    completionCriteria: strings(raw.completion_criteria), permissionsRequired: strings(raw.permissions_required),
    evidenceRequirement: strings(raw.evidence_requirement), startedAt: nullableString(raw.started_at), completedAt: nullableString(raw.completed_at)
  };
}

function normalizeDependency(raw: RawRecord): GuidedDependency {
  return {
    id: String(raw.id || ''), taskId: String(raw.task_id || ''), stepId: nullableString(raw.step_id),
    dependsOnTaskId: nullableString(raw.depends_on_task_id), dependsOnStepId: nullableString(raw.depends_on_step_id), resolvedAt: nullableString(raw.resolved_at)
  };
}

function normalizeEvidence(raw: RawRecord): GuidedEvidence {
  return {
    id: String(raw.id || ''), taskId: String(raw.task_id || ''), stepId: nullableString(raw.step_id), kind: String(raw.kind || ''),
    reference: String(raw.reference || ''), verified: raw.verified === true, createdAt: String(raw.created_at || '')
  };
}

function normalizeApproval(raw: RawRecord): GuidedApproval {
  const risk = String(raw.risk_level || 'medium');
  return {
    id: String(raw.id || ''), taskId: String(raw.task_id || ''), workflowId: String(raw.workflow_id || ''), module: String(raw.module || ''),
    approvalType: String(raw.approval_type || ''), requiredPermission: String(raw.required_permission || ''),
    riskLevel: (['low', 'medium', 'high', 'critical'].includes(risk) ? risk : 'medium') as GuidedApproval['riskLevel'],
    summary: String(raw.summary || ''), payloadVersion: Number.isFinite(Number(raw.payload_version)) ? Number(raw.payload_version) : 0,
    payloadDigest: String(raw.payload_digest || ''), status: String(raw.status || 'pending') as GuidedApproval['status'],
    decidedBy: nullableString(raw.decided_by), decisionReason: nullableString(raw.decision_reason),
    createdAt: String(raw.created_at || ''), decidedAt: nullableString(raw.decided_at)
  };
}

function normalizeAuditEvent(raw: RawRecord): GuidedAuditEvent {
  return {
    id: String(raw.id || ''),
    actorUserId: String(raw.actor_user_id || ''),
    taskId: nullableString(raw.task_id),
    workflowId: nullableString(raw.workflow_id),
    module: String(raw.module || ''),
    action: String(raw.action || ''),
    previousState: nullableString(raw.previous_state),
    resultingState: nullableString(raw.resulting_state),
    evidenceIds: strings(raw.evidence_ids),
    correlationId: nullableString(raw.correlation_id),
    createdAt: String(raw.created_at || '')
  };
}

export function normalizeExecutionState(rawValue: unknown): GuidedExecutionState {
  const raw = record(rawValue);
  return {
    workflow: normalizeWorkflow(raw.workflow),
    tasks: rows(raw.tasks).map(normalizeTask),
    steps: rows(raw.steps).map(normalizeStep),
    dependencies: rows(raw.dependencies).map(normalizeDependency),
    evidence: rows(raw.evidence).map(normalizeEvidence),
    approvals: rows(raw.approvals).map(normalizeApproval)
  };
}

export function normalizeExecutionAudit(rawValue: unknown): GuidedAuditEvent[] {
  return rows(record(rawValue).audit).map(normalizeAuditEvent);
}

async function executionPost(body: Record<string, unknown>) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-execution', {
    method: 'POST',
    body: JSON.stringify({ ...body, organization_id: organization.id })
  });
  return parseExecutionResponse(response);
}

export async function loadGuidedExecutionState(workflowId: string): Promise<GuidedExecutionState> {
  return normalizeExecutionState(await executionPost({ operation: 'get_state', workflow_id: workflowId }));
}

export async function loadGuidedExecutionAudit(workflowId: string): Promise<GuidedAuditEvent[]> {
  return normalizeExecutionAudit(await executionPost({ operation: 'get_audit', workflow_id: workflowId }));
}

export type RequestExecutionApprovalInput = {
  taskId: string;
  approvalType: string;
  requiredPermission: string;
  riskLevel: GuidedApproval['riskLevel'];
  summary: string;
};

export async function requestExecutionApproval(input: RequestExecutionApprovalInput) {
  return executionPost({
    operation: 'request_approval', task_id: input.taskId, approval_type: input.approvalType,
    required_permission: input.requiredPermission, risk_level: input.riskLevel, summary: input.summary
  });
}

export type DecideExecutionApprovalInput = {
  approvalId: string;
  decision: 'approved' | 'rejected';
  reason?: string;
};

export async function decideExecutionApproval(input: DecideExecutionApprovalInput) {
  return executionPost({
    operation: 'decide_approval', approval_id: input.approvalId, decision: input.decision, decision_reason: input.reason || ''
  });
}

export type WorkStepExecutionDecision = {
  route: { state: 'ready' | 'blocked'; mechanism: 'api' | 'browser' | null; reason: string };
  policy: { outcome: 'allow' | 'require_approval' | 'deny'; reason: string };
  approvalRequired: boolean;
};

export async function evaluateWorkStep(taskId: string): Promise<WorkStepExecutionDecision> {
  const data = await executionPost({ operation: 'evaluate_work_step', task_id: taskId });
  const route = record(data.route);
  const policy = record(data.policy);
  const mechanism = route.mechanism === 'api' || route.mechanism === 'browser' ? route.mechanism : null;
  const routeState = route.state === 'ready' ? 'ready' : 'blocked';
  const policyOutcome = policy.outcome === 'allow' || policy.outcome === 'require_approval' ? policy.outcome : 'deny';
  return {
    route: { state: routeState, mechanism, reason: String(route.reason || 'execution_route_unavailable') },
    policy: { outcome: policyOutcome, reason: String(policy.reason || 'policy_unavailable') },
    approvalRequired: data.approvalRequired === true
  };
}

export async function syncManagerReadiness() {
  const data = await executionPost({ operation: 'sync_manager_readiness' });
  if (!data.workflow_id) throw new Error('manager_readiness_workflow_missing');
  return { workflowId: String(data.workflow_id) };
}
