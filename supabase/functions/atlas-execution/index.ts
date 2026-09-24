import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import {
  EXECUTION_STATUSES,
  executionPermissionsForRole,
  type ExecutionPermission,
  type ExecutionStatus
} from '../../../packages/execution/src/types.ts';
import { canTransitionTask, evaluateTaskCompletion } from '../../../packages/execution/src/state-machine.ts';
import { digestApprovalPayload } from '../../../packages/execution/src/approvals.ts';
import { parseAtlasWorkContext } from '../../../packages/execution/src/work-types.ts';
import { selectWorkRuntime, type WorkRuntime } from '../../../packages/execution/src/work-runtime.ts';
import { ManagerReadinessError, syncManagerReadiness } from './manager-readiness.ts';
import { createWorkWorkflowPlan, listWorkWorkflows, WorkExecutionError } from './work.ts';
import { evaluateWorkStepServer, WorkPolicyResolutionError } from './work-policy.ts';
import {
  listWorkConnections,
  registerWorkConnectionRef,
  revokeWorkConnectionRef,
  WorkConnectionError
} from './work-connections.ts';
import {
  claimWorkRuntimeJob,
  completeWorkRuntimeJob,
  enrollWorkRuntime,
  enqueueWorkRuntimeJob,
  heartbeatWorkRuntime,
  listWorkRuntimes,
  resolveRuntimeContext,
  WorkRuntimeError
} from './work-runtime.ts';
import {
  createOpenAiDomainTemplate,
  executeOpenAiDomainStep,
  resumeOpenAiDomainStep,
  OpenAiDomainPilotError
} from './openai-domain.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ATLAS_PLATFORM_TENANT_ID = Deno.env.get('ATLAS_PLATFORM_TENANT_ID') || '';
const MAX_REQUEST_BYTES = 64 * 1024;

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

const RUNTIME_OPERATIONS = new Set([
  'heartbeat_work_runtime',
  'claim_work_runtime_job',
  'complete_work_runtime_job'
]);

const SUPPORTED_OPERATIONS = new Set([
  'get_state',
  'get_audit',
  'create_task',
  'transition_task',
  'record_evidence',
  'request_approval',
  'decide_approval',
  'create_workflow_plan',
  'list_workflows',
  'evaluate_work_step',
  'list_work_connections',
  'register_work_connection_ref',
  'revoke_work_connection_ref',
  'list_work_runtimes',
  'enroll_work_runtime',
  'enqueue_work_runtime_job',
  'create_work_template',
  'execute_work_step',
  'resume_work_step',
  'heartbeat_work_runtime',
  'claim_work_runtime_job',
  'complete_work_runtime_job',
  'sync_manager_readiness'
]);

const EXECUTION_PERMISSION_SET = new Set<ExecutionPermission>([
  'execution.read',
  'execution.write',
  'execution.approve',
  'execution.audit',
  'execution.admin'
]);

const SENSITIVE_INPUT_KEY = /token|secret|password|cookie|authorization|recovery/i;

class EdgeError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

type RequestContext = {
  userId: string;
  orgId: string;
  tenantId: string;
  role: string;
  permissions: ExecutionPermission[];
};

type JsonObject = Record<string, unknown>;

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atlasenterprisesuite.com',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-request-id, x-atlas-runtime-id',
    'access-control-allow-methods': 'POST, OPTIONS',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin',
    'x-content-type-options': 'nosniff'
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(req) });
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function requiredText(value: unknown, code: string, max = 500) {
  const result = clean(value, max);
  if (!result) throw new EdgeError(code, 422);
  return result;
}

function record(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function stringArray(value: unknown, maxItems = 40, maxItemLength = 120) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => clean(item, maxItemLength)).filter(Boolean))].slice(0, maxItems);
}

function executionStatus(value: unknown): ExecutionStatus | null {
  const status = clean(value, 40) as ExecutionStatus;
  return EXECUTION_STATUSES.includes(status) ? status : null;
}

function priority(value: unknown) {
  const result = clean(value, 20) || 'normal';
  if (!['low', 'normal', 'high', 'critical'].includes(result)) throw new EdgeError('invalid_priority', 422);
  return result;
}

function riskLevel(value: unknown) {
  const result = clean(value, 20) || 'medium';
  if (!['low', 'medium', 'high', 'critical'].includes(result)) throw new EdgeError('invalid_risk_level', 422);
  return result;
}

function containsSensitiveInputKey(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((item) => containsSensitiveInputKey(item, depth + 1));
  if (typeof value !== 'object') return false;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_INPUT_KEY.test(key)) return true;
    if (containsSensitiveInputKey(nested, depth + 1)) return true;
  }
  return false;
}

function userClient(req: Request) {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('authorization') || '' } }
  });
}

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new EdgeError('server_runtime_not_configured', 503);
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function resolveContext(req: Request, orgId: string): Promise<RequestContext> {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new EdgeError('supabase_runtime_not_configured', 503);
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new EdgeError('authentication_required', 401);

  const sb = userClient(req);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new EdgeError('invalid_session', 401);

  const { data: membership, error: membershipError } = await sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', data.user.id)
    .eq('org_id', orgId)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError || !membership?.org_id) throw new EdgeError('membership_required', 403);
  const role = String(membership.role || 'member');
  const resolvedOrgId = String(membership.org_id);
  return {
    userId: data.user.id,
    orgId: resolvedOrgId,
    // Compatibility rule for the current canonical execution schema: tenant scope equals organization scope.
    tenantId: resolvedOrgId,
    role,
    permissions: executionPermissionsForRole(role)
  };
}

function requireExecutionPermission(context: RequestContext, required: ExecutionPermission) {
  if (!context.permissions.includes(required) && !context.permissions.includes('execution.admin')) {
    throw new EdgeError('permission_required', 403);
  }
}

function correlationId(req: Request, body: JsonObject) {
  return clean(body.correlation_id, 160)
    || clean(req.headers.get('x-request-id'), 160)
    || crypto.randomUUID();
}

async function loadWorkflow(admin: ReturnType<typeof createClient>, orgId: string, workflowId: string) {
  const { data, error } = await admin
    .from('execution_workflows')
    .select('*')
    .eq('id', workflowId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw new EdgeError('persistence_error', 500);
  if (!data) throw new EdgeError('workflow_not_found', 404);
  return data;
}

async function loadTask(admin: ReturnType<typeof createClient>, orgId: string, taskId: string) {
  const { data, error } = await admin
    .from('execution_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw new EdgeError('persistence_error', 500);
  if (!data) throw new EdgeError('task_not_found', 404);
  return data;
}

async function loadCurrentStep(admin: ReturnType<typeof createClient>, orgId: string, task: Record<string, unknown>) {
  const stepId = clean(task.current_step_id, 80);
  if (!stepId) throw new EdgeError('current_action_required', 409);
  const { data, error } = await admin
    .from('execution_steps')
    .select('*')
    .eq('id', stepId)
    .eq('task_id', String(task.id))
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw new EdgeError('persistence_error', 500);
  if (!data) throw new EdgeError('current_action_required', 409);
  return data;
}

async function appendAudit(
  admin: ReturnType<typeof createClient>,
  input: {
    orgId: string;
    tenantId: string;
    actorUserId: string;
    taskId: string | null;
    workflowId: string | null;
    module: string;
    action: string;
    previousState: string | null;
    resultingState: string | null;
    evidenceIds?: string[];
    correlationId: string;
  }
) {
  const { error } = await admin.from('execution_audit_events').insert({
    org_id: input.orgId,
    tenant_id: input.tenantId,
    actor_user_id: input.actorUserId,
    task_id: input.taskId,
    workflow_id: input.workflowId,
    module: input.module,
    action: input.action,
    previous_state: input.previousState,
    resulting_state: input.resultingState,
    evidence_ids: input.evidenceIds || [],
    correlation_id: input.correlationId
  });
  if (error) throw new EdgeError('audit_write_failed', 500);
}

function reviewedAction(task: Record<string, unknown>, step: Record<string, unknown>) {
  return {
    taskId: String(task.id),
    workflowId: String(task.workflow_id),
    module: String(step.module),
    stepId: String(step.id),
    actionType: String(step.action_type),
    actionPayload: step.action_payload && typeof step.action_payload === 'object' ? step.action_payload : {}
  };
}

async function completionGate(admin: ReturnType<typeof createClient>, orgId: string, taskId: string) {
  const [stepsResult, evidenceResult, approvalsResult, dependenciesResult] = await Promise.all([
    admin.from('execution_steps').select('id,status,evidence_requirement').eq('org_id', orgId).eq('task_id', taskId),
    admin.from('execution_evidence').select('id,kind,verified').eq('org_id', orgId).eq('task_id', taskId),
    admin.from('execution_approvals').select('status,payload_version,payload_digest').eq('org_id', orgId).eq('task_id', taskId),
    admin.from('execution_dependencies').select('id,resolved_at').eq('org_id', orgId).eq('task_id', taskId).is('resolved_at', null)
  ]);

  if (stepsResult.error || evidenceResult.error || approvalsResult.error || dependenciesResult.error) {
    throw new EdgeError('persistence_error', 500);
  }

  return evaluateTaskCompletion({
    steps: (stepsResult.data || []).map((step: any) => ({
      id: String(step.id),
      status: step.status,
      evidenceRequirement: Array.isArray(step.evidence_requirement) ? step.evidence_requirement : []
    })),
    evidence: (evidenceResult.data || []).map((item: any) => ({
      id: String(item.id),
      kind: String(item.kind),
      verified: item.verified === true
    })),
    approvals: (approvalsResult.data || []).map((approval: any) => ({
      status: approval.status,
      payloadVersion: Number(approval.payload_version),
      payloadDigest: String(approval.payload_digest)
    })),
    unresolvedDependencies: (dependenciesResult.data || []).map((dependency: any) => String(dependency.id))
  });
}

async function getState(req: Request, body: JsonObject, context: RequestContext) {
  requireExecutionPermission(context, 'execution.read');
  const workflowId = requiredText(body.workflow_id, 'workflow_id_required', 80);
  const admin = adminClient();
  const workflow = await loadWorkflow(admin, context.orgId, workflowId);

  const tasksResult = await admin
    .from('execution_tasks')
    .select('*')
    .eq('org_id', context.orgId)
    .eq('workflow_id', workflowId)
    .order('created_at', { ascending: true });
  if (tasksResult.error) throw new EdgeError('persistence_error', 500);
  const tasks = tasksResult.data || [];
  const taskIds = tasks.map((task: any) => String(task.id));

  if (taskIds.length === 0) {
    return json(req, { ok: true, workflow, tasks: [], steps: [], dependencies: [], evidence: [], approvals: [] });
  }

  const [steps, dependencies, evidence, approvals] = await Promise.all([
    admin.from('execution_steps')
      .select('id,org_id,tenant_id,task_id,sequence,module,action_type,status,completion_criteria,permissions_required,evidence_requirement,started_at,completed_at,created_at,updated_at')
      .eq('org_id', context.orgId).in('task_id', taskIds).order('sequence'),
    admin.from('execution_dependencies').select('*').eq('org_id', context.orgId).in('task_id', taskIds),
    admin.from('execution_evidence').select('*').eq('org_id', context.orgId).in('task_id', taskIds).order('created_at'),
    admin.from('execution_approvals').select('*').eq('org_id', context.orgId).in('task_id', taskIds).order('created_at')
  ]);
  if (steps.error || dependencies.error || evidence.error || approvals.error) throw new EdgeError('persistence_error', 500);

  return json(req, {
    ok: true,
    workflow,
    tasks,
    steps: steps.data || [],
    dependencies: dependencies.data || [],
    evidence: evidence.data || [],
    approvals: approvals.data || []
  });
}

async function getAudit(req: Request, body: JsonObject, context: RequestContext) {
  requireExecutionPermission(context, 'execution.audit');
  const workflowId = requiredText(body.workflow_id, 'workflow_id_required', 80);
  const admin = adminClient();
  await loadWorkflow(admin, context.orgId, workflowId);
  const { data, error } = await admin
    .from('execution_audit_events')
    .select('id,actor_user_id,task_id,workflow_id,module,action,previous_state,resulting_state,evidence_ids,correlation_id,created_at')
    .eq('org_id', context.orgId)
    .eq('workflow_id', workflowId)
    .order('created_at', { ascending: true });
  if (error) throw new EdgeError('persistence_error', 500);
  return json(req, { ok: true, audit: data || [] });
}

async function createTask(req: Request, body: JsonObject, context: RequestContext, requestId: string) {
  requireExecutionPermission(context, 'execution.write');
  const workflowId = requiredText(body.workflow_id, 'workflow_id_required', 80);
  const module = requiredText(body.module, 'module_required', 80);
  const title = requiredText(body.title, 'title_required', 300);
  const intent = requiredText(body.intent, 'intent_required', 2000);
  const goal = requiredText(body.goal, 'goal_required', 2000);
  const status = executionStatus(body.status || 'draft');
  if (!status) throw new EdgeError('invalid_status', 422);
  if (status === 'completed' || status === 'failed') throw new EdgeError('invalid_initial_status', 422);
  if (body.version !== undefined && Number(body.version) !== 1) throw new EdgeError('invalid_version', 422);

  const admin = adminClient();
  const workflow = await loadWorkflow(admin, context.orgId, workflowId);
  const source = body.source && typeof body.source === 'object' ? body.source as Record<string, unknown> : null;
  const sourceType = source ? clean(source.type, 120) : '';
  const sourceId = source ? clean(source.id, 200) : '';
  if ((sourceType && !sourceId) || (!sourceType && sourceId)) throw new EdgeError('invalid_source_reference', 422);
  const parentTaskId = clean(body.parent_task_id, 80);
  if (parentTaskId) {
    const parentTask = await loadTask(admin, context.orgId, parentTaskId);
    if (String(parentTask.workflow_id) !== workflowId) throw new EdgeError('parent_task_workflow_mismatch', 409);
  }

  const { data: task, error } = await admin.from('execution_tasks').insert({
    org_id: context.orgId,
    tenant_id: String(workflow.tenant_id),
    workflow_id: workflowId,
    module,
    owner_user_id: clean(body.owner_user_id, 80) || null,
    title,
    intent,
    goal,
    status,
    priority: priority(body.priority),
    current_step_id: null,
    next_action: clean(body.next_action, 1000) || null,
    blocked_reason: clean(body.blocked_reason, 1000) || null,
    permissions_required: stringArray(body.permissions_required),
    source_type: sourceType || null,
    source_id: sourceId || null,
    parent_task_id: parentTaskId || null,
    version: 1
  }).select('*').single();
  if (error || !task) throw new EdgeError('persistence_error', 500);

  await appendAudit(admin, {
    orgId: context.orgId,
    tenantId: String(workflow.tenant_id),
    actorUserId: context.userId,
    taskId: String(task.id),
    workflowId,
    module,
    action: 'execution.task.created',
    previousState: null,
    resultingState: status,
    correlationId: requestId
  });
  return json(req, { ok: true, task }, 201);
}

async function transitionTask(req: Request, body: JsonObject, context: RequestContext, requestId: string) {
  requireExecutionPermission(context, 'execution.write');
  const taskId = requiredText(body.task_id, 'task_id_required', 80);
  const target = executionStatus(body.status);
  if (!target) throw new EdgeError('invalid_status', 422);
  const expectedVersion = Number(body.expected_version);
  if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) throw new EdgeError('expected_version_required', 422);

  const admin = adminClient();
  const task = await loadTask(admin, context.orgId, taskId);
  if (Number(task.version) !== expectedVersion) throw new EdgeError('version_conflict', 409);
  const current = String(task.status) as ExecutionStatus;
  if (!canTransitionTask(current, target)) throw new EdgeError('invalid_transition', 409);

  if (target === 'completed') {
    const gate = await completionGate(admin, context.orgId, taskId);
    if (!gate.eligible) {
      return json(req, { ok: false, error: 'completion_requirements_not_met', reasons: gate.reasons }, 409);
    }
  }

  const updatedAt = new Date().toISOString();
  const { data: updated, error } = await admin
    .from('execution_tasks')
    .update({
      status: target,
      blocked_reason: target === 'blocked' ? clean(body.blocked_reason, 1000) || 'blocked' : null,
      version: expectedVersion + 1,
      updated_at: updatedAt,
      completed_at: target === 'completed' ? updatedAt : null
    })
    .eq('id', taskId)
    .eq('org_id', context.orgId)
    .eq('version', expectedVersion)
    .select('*')
    .maybeSingle();
  if (error) throw new EdgeError('persistence_error', 500);
  if (!updated) throw new EdgeError('version_conflict', 409);

  await appendAudit(admin, {
    orgId: context.orgId,
    tenantId: String(task.tenant_id),
    actorUserId: context.userId,
    taskId,
    workflowId: String(task.workflow_id),
    module: String(task.module),
    action: 'execution.task.transitioned',
    previousState: current,
    resultingState: target,
    correlationId: requestId
  });
  return json(req, { ok: true, task: updated });
}

async function recordEvidence(req: Request, body: JsonObject, context: RequestContext, requestId: string) {
  requireExecutionPermission(context, 'execution.write');
  const taskId = requiredText(body.task_id, 'task_id_required', 80);
  const stepId = clean(body.step_id, 80) || null;
  const kind = requiredText(body.kind, 'evidence_kind_required', 120);
  const reference = requiredText(body.reference, 'evidence_reference_required', 600);
  if (body.verified === true) throw new EdgeError('verified_evidence_resolver_required', 409);
  const admin = adminClient();
  const task = await loadTask(admin, context.orgId, taskId);

  if (stepId) {
    const { data: step, error: stepError } = await admin
      .from('execution_steps')
      .select('id')
      .eq('id', stepId)
      .eq('task_id', taskId)
      .eq('org_id', context.orgId)
      .maybeSingle();
    if (stepError) throw new EdgeError('persistence_error', 500);
    if (!step) throw new EdgeError('step_not_found', 404);
  }

  const { data: evidence, error } = await admin.from('execution_evidence').insert({
    org_id: context.orgId,
    tenant_id: String(task.tenant_id),
    task_id: taskId,
    step_id: stepId,
    kind,
    reference,
    verified: false
  }).select('*').single();
  if (error || !evidence) throw new EdgeError('persistence_error', 500);

  await appendAudit(admin, {
    orgId: context.orgId,
    tenantId: String(task.tenant_id),
    actorUserId: context.userId,
    taskId,
    workflowId: String(task.workflow_id),
    module: String(task.module),
    action: 'execution.evidence.recorded',
    previousState: String(task.status),
    resultingState: String(task.status),
    evidenceIds: [String(evidence.id)],
    correlationId: requestId
  });
  return json(req, { ok: true, evidence }, 201);
}

async function requestApproval(req: Request, body: JsonObject, context: RequestContext, requestId: string) {
  requireExecutionPermission(context, 'execution.write');
  const taskId = requiredText(body.task_id, 'task_id_required', 80);
  const approvalType = requiredText(body.approval_type, 'approval_type_required', 120);
  const requiredPermission = requiredText(body.required_permission, 'required_permission_required', 160);
  const summary = requiredText(body.summary, 'approval_summary_required', 2000);
  const admin = adminClient();
  const task = await loadTask(admin, context.orgId, taskId);
  const step = await loadCurrentStep(admin, context.orgId, task);
  const current = String(task.status) as ExecutionStatus;
  const statusChangeRequired = current !== 'awaiting_approval';
  if (statusChangeRequired && !canTransitionTask(current, 'awaiting_approval')) throw new EdgeError('invalid_transition', 409);

  const bindingVersion = Number(task.version) + (statusChangeRequired ? 1 : 0);
  const reviewedPayload = reviewedAction(task, step);
  const payloadDigest = await digestApprovalPayload({ payloadVersion: bindingVersion, payload: reviewedPayload });

  const { data: approval, error: approvalError } = await admin.from('execution_approvals').insert({
    org_id: context.orgId,
    tenant_id: String(task.tenant_id),
    task_id: taskId,
    workflow_id: String(task.workflow_id),
    module: String(task.module),
    requested_by: context.userId,
    approval_type: approvalType,
    required_permission: requiredPermission,
    risk_level: riskLevel(body.risk_level),
    summary,
    payload_version: bindingVersion,
    payload_digest: payloadDigest,
    status: 'pending'
  }).select('*').single();
  if (approvalError || !approval) throw new EdgeError('persistence_error', 500);

  if (statusChangeRequired) {
    const { data: updated, error: updateError } = await admin
      .from('execution_tasks')
      .update({ status: 'awaiting_approval', version: bindingVersion, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('org_id', context.orgId)
      .eq('version', Number(task.version))
      .select('id')
      .maybeSingle();
    if (updateError || !updated) {
      await admin.from('execution_approvals').delete().eq('id', approval.id).eq('org_id', context.orgId);
      if (updateError) throw new EdgeError('persistence_error', 500);
      throw new EdgeError('version_conflict', 409);
    }
  }

  await appendAudit(admin, {
    orgId: context.orgId,
    tenantId: String(task.tenant_id),
    actorUserId: context.userId,
    taskId,
    workflowId: String(task.workflow_id),
    module: String(task.module),
    action: 'execution.approval.requested',
    previousState: current,
    resultingState: 'awaiting_approval',
    correlationId: requestId
  });
  return json(req, { ok: true, approval }, 201);
}

async function decideApproval(req: Request, body: JsonObject, context: RequestContext, requestId: string) {
  requireExecutionPermission(context, 'execution.approve');
  const approvalId = requiredText(body.approval_id, 'approval_id_required', 80);
  const decision = clean(body.decision, 30);
  if (!['approved', 'rejected'].includes(decision)) throw new EdgeError('invalid_approval_decision', 422);
  const admin = adminClient();

  const { data: approval, error: approvalError } = await admin
    .from('execution_approvals')
    .select('*')
    .eq('id', approvalId)
    .eq('org_id', context.orgId)
    .eq('status', 'pending')
    .maybeSingle();
  if (approvalError) throw new EdgeError('persistence_error', 500);
  if (!approval) throw new EdgeError('approval_not_found', 404);

  const requiredPermission = String(approval.required_permission);
  if (!requiredPermission.startsWith('execution.')) throw new EdgeError('domain_permission_resolver_required', 409);
  if (!EXECUTION_PERMISSION_SET.has(requiredPermission as ExecutionPermission)) throw new EdgeError('permission_required', 403);
  requireExecutionPermission(context, requiredPermission as ExecutionPermission);

  const task = await loadTask(admin, context.orgId, String(approval.task_id));
  const step = await loadCurrentStep(admin, context.orgId, task);
  const currentVersion = Number(task.version);
  const currentDigest = await digestApprovalPayload({ payloadVersion: currentVersion, payload: reviewedAction(task, step) });
  if (Number(approval.payload_version) !== currentVersion || String(approval.payload_digest) !== currentDigest) {
    throw new EdgeError('approval_binding_mismatch', 409);
  }

  const decidedAt = new Date().toISOString();
  const { data: decided, error: decisionError } = await admin
    .from('execution_approvals')
    .update({ status: decision, decided_by: context.userId, decision_reason: clean(body.decision_reason, 1000) || null, decided_at: decidedAt })
    .eq('id', approvalId).eq('org_id', context.orgId).eq('status', 'pending').select('*').maybeSingle();
  if (decisionError) throw new EdgeError('persistence_error', 500);
  if (!decided) throw new EdgeError('approval_already_decided', 409);

  await appendAudit(admin, {
    orgId: context.orgId, tenantId: String(task.tenant_id), actorUserId: context.userId,
    taskId: String(task.id), workflowId: String(task.workflow_id), module: String(task.module),
    action: `execution.approval.${decision}`, previousState: 'pending', resultingState: decision, correlationId: requestId
  });
  return json(req, { ok: true, approval: decided });
}

async function createWorkPlan(req: Request, body: JsonObject, context: RequestContext, requestId: string) {
  requireExecutionPermission(context, 'execution.write');
  const ownerModule = requiredText(body.owner_module, 'owner_module_required', 80);
  const intent = requiredText(body.intent, 'work_intent_required', 2000);
  const work = parseAtlasWorkContext({ work: body.work });
  const admin = adminClient();
  try {
    const result = await createWorkWorkflowPlan({
      admin, context: { userId: context.userId, orgId: context.orgId }, requestId, ownerModule, intent, work,
      appendAudit: (input) => appendAudit(admin, input)
    });
    return json(req, { ok: true, workflow_id: result.workflowId, task_id: result.taskId }, 201);
  } catch (error) {
    if (error instanceof WorkExecutionError) throw new EdgeError(error.code, error.status);
    throw error;
  }
}

async function listWorkflows(req: Request, context: RequestContext) {
  requireExecutionPermission(context, 'execution.read');
  const admin = adminClient();
  try {
    const workflows = await listWorkWorkflows({ admin, context: { userId: context.userId, orgId: context.orgId } });
    return json(req, { ok: true, workflows });
  } catch (error) {
    if (error instanceof WorkExecutionError) throw new EdgeError(error.code, error.status);
    throw error;
  }
}

async function evaluateWorkStep(req: Request, body: JsonObject, context: RequestContext) {
  requireExecutionPermission(context, 'execution.read');
  const taskId = requiredText(body.task_id, 'task_id_required', 80);
  try {
    const decision = await evaluateWorkStepServer({ admin: adminClient(), context, taskId });
    return json(req, { ok: true, ...decision });
  } catch (error) {
    if (error instanceof WorkPolicyResolutionError) throw new EdgeError(error.code, error.status);
    throw error;
  }
}

async function connectionOperation(req: Request, operation: string, body: JsonObject, context: RequestContext) {
  const admin = adminClient();
  try {
    if (operation === 'list_work_connections') {
      requireExecutionPermission(context, 'execution.read');
      return json(req, { ok: true, connections: await listWorkConnections(admin, context) });
    }
    requireExecutionPermission(context, 'execution.admin');
    if (operation === 'register_work_connection_ref') {
      if (containsSensitiveInputKey(body)) throw new EdgeError('secret_material_not_allowed', 422);
      const connection = await registerWorkConnectionRef(admin, context, {
        provider: body.provider, mechanism: body.mechanism, externalRef: body.external_ref, capabilities: body.capabilities
      });
      return json(req, { ok: true, connection }, 201);
    }
    const connection = await revokeWorkConnectionRef(admin, context, requiredText(body.connection_id, 'connection_id_required', 80));
    return json(req, { ok: true, connection });
  } catch (error) {
    if (error instanceof WorkConnectionError) throw new EdgeError(error.code, error.status);
    throw error;
  }
}

async function runtimeUserOperation(req: Request, operation: string, body: JsonObject, context: RequestContext) {
  const admin = adminClient();
  try {
    if (operation === 'list_work_runtimes') {
      requireExecutionPermission(context, 'execution.read');
      return json(req, { ok: true, runtimes: await listWorkRuntimes(admin, context) });
    }
    if (operation === 'enroll_work_runtime') {
      requireExecutionPermission(context, 'execution.admin');
      const result = await enrollWorkRuntime(admin, context, { kind: body.kind, label: body.label, capabilities: body.capabilities });
      return json(req, { ok: true, runtime: result.runtime, runtime_token: result.runtimeToken }, 201);
    }
    if (operation === 'enqueue_work_runtime_job') {
      requireExecutionPermission(context, 'execution.write');
      const taskId = requiredText(body.task_id, 'task_id_required', 80);
      const decision = await evaluateWorkStepServer({ admin, context, taskId });
      if (decision.route.state !== 'ready' || decision.route.mechanism !== 'browser') throw new EdgeError('browser_route_not_ready', 409);
      if (decision.approvalRequired || decision.policy.outcome !== 'allow') throw new EdgeError('approval_or_policy_required', 409);
      const task = await loadTask(admin, context.orgId, taskId);
      const step = await loadCurrentStep(admin, context.orgId, task);
      const workflow = await loadWorkflow(admin, context.orgId, String(task.workflow_id));
      const payload = record(step.action_payload);
      const rawEnvelope = record(payload.execution_envelope);
      const rawAction = record(payload.browser_action);
      const work = parseAtlasWorkContext({ work: record(workflow.context).work });
      const { data: runtimeRows, error: runtimeError } = await admin.from('execution_runtime_registrations')
        .select('id,kind,status,capabilities,last_seen_at').eq('org_id', context.orgId).eq('tenant_id', context.tenantId).eq('status', 'online');
      if (runtimeError) throw new EdgeError('persistence_error', 500);
      const runtimes: WorkRuntime[] = (runtimeRows || []).map((runtime: any) => ({
        id: String(runtime.id), kind: runtime.kind, status: runtime.status,
        capabilities: stringArray(runtime.capabilities), lastSeenAt: runtime.last_seen_at ? String(runtime.last_seen_at) : null
      }));
      const selection = selectWorkRuntime({ preference: work.runtimePreference, requiredCapabilities: ['browser'], runtimes });
      if (selection.state !== 'ready' || !selection.runtimeKind) throw new EdgeError('runtime_unavailable', 409);
      const envelope = {
        workflowId: String(workflow.id), stepId: String(step.id), tenantId: context.tenantId, organizationId: context.orgId,
        allowedDomains: stringArray(rawEnvelope.allowedDomains ?? rawEnvelope.allowed_domains, 20, 253),
        allowedActions: stringArray(rawEnvelope.allowedActions ?? rawEnvelope.allowed_actions, 40, 120),
        deniedActions: stringArray(rawEnvelope.deniedActions ?? rawEnvelope.denied_actions, 40, 120),
        autonomyLevel: work.autonomyLevel,
        expiresAt: requiredText(rawEnvelope.expiresAt ?? rawEnvelope.expires_at, 'execution_envelope_required', 80)
      };
      const job = await enqueueWorkRuntimeJob(admin, context, {
        workflowId: String(workflow.id), taskId, stepId: String(step.id), runtimeKind: selection.runtimeKind,
        envelope, action: rawAction as any, route: decision.route, policy: decision.policy
      });
      return json(req, { ok: true, job }, 201);
    }
  } catch (error) {
    if (error instanceof WorkRuntimeError) throw new EdgeError(error.code, error.status);
    if (error instanceof WorkPolicyResolutionError) throw new EdgeError(error.code, error.status);
    throw error;
  }
  throw new EdgeError('unsupported_operation', 400);
}

async function pilotOperation(req: Request, operation: string, body: JsonObject, context: RequestContext, requestId: string) {
  requireExecutionPermission(context, 'execution.write');
  const admin = adminClient();
  const deps = {
    admin, context, requestId,
    appendAudit: (input: any) => appendAudit(admin, input)
  };
  try {
    if (operation === 'create_work_template') {
      const templateId = requiredText(body.template_id, 'template_id_required', 120);
      const result = await createOpenAiDomainTemplate(deps, templateId, record(body.inputs));
      return json(req, { ok: true, workflow_id: result.workflowId, task_id: result.taskId }, 201);
    }
    const taskId = requiredText(body.task_id, 'task_id_required', 80);
    const result = operation === 'execute_work_step'
      ? await executeOpenAiDomainStep(deps, taskId)
      : await resumeOpenAiDomainStep(deps, taskId);
    return json(req, { ok: true, result });
  } catch (error) {
    if (error instanceof OpenAiDomainPilotError) throw new EdgeError(error.code, error.status);
    throw error;
  }
}

async function syncReadiness(req: Request, context: RequestContext, requestId: string) {
  requireExecutionPermission(context, 'execution.write');
  const admin = adminClient();
  try {
    const result = await syncManagerReadiness({
      req,
      context: { userId: context.userId, orgId: context.orgId },
      requestId,
      admin,
      supabaseUrl: SUPABASE_URL,
      publishableKey: PUBLISHABLE_KEY,
      platformTenantId: ATLAS_PLATFORM_TENANT_ID,
      appendAudit: (input) => appendAudit(admin, input)
    });
    return json(req, { ok: true, ...result });
  } catch (error) {
    if (error instanceof ManagerReadinessError) throw new EdgeError(error.code, error.status);
    throw error;
  }
}

function errorResponse(req: Request, error: unknown) {
  if (error instanceof EdgeError) return json(req, { ok: false, error: error.code }, error.status);
  if (error instanceof WorkRuntimeError) return json(req, { ok: false, error: error.code }, error.status);
  if (error instanceof WorkConnectionError) return json(req, { ok: false, error: error.code }, error.status);
  if (error instanceof WorkPolicyResolutionError) return json(req, { ok: false, error: error.code }, error.status);
  if (error instanceof OpenAiDomainPilotError) return json(req, { ok: false, error: error.code }, error.status);
  return json(req, { ok: false, error: 'internal_error' }, 500);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { ok: false, error: 'method_not_allowed' }, 405);
  if (!req.headers.get('authorization')) return json(req, { ok: false, error: 'authentication_required' }, 401);
  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return json(req, { ok: false, error: 'payload_too_large' }, 413);

  let body: JsonObject;
  try {
    body = await req.json();
  } catch {
    return json(req, { ok: false, error: 'invalid_json' }, 400);
  }
  const bodyBytes = new TextEncoder().encode(JSON.stringify(body)).byteLength;
  if (bodyBytes > MAX_REQUEST_BYTES) return json(req, { ok: false, error: 'payload_too_large' }, 413);

  const operation = clean(body.operation, 80);
  if (!SUPPORTED_OPERATIONS.has(operation)) return json(req, { ok: false, error: 'unsupported_operation' }, 400);

  if (RUNTIME_OPERATIONS.has(operation)) {
    try {
      const runtimeId = requiredText(req.headers.get('x-atlas-runtime-id'), 'runtime_id_required', 80);
      const runtimeToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const admin = adminClient();
      const context = await resolveRuntimeContext(admin, runtimeId, runtimeToken);
      if (operation === 'heartbeat_work_runtime') return json(req, { ok: true, runtime: await heartbeatWorkRuntime(admin, context) });
      if (operation === 'claim_work_runtime_job') return json(req, { ok: true, job: await claimWorkRuntimeJob(admin, context) });
      const state = clean(body.state, 40);
      if (!['completed', 'waiting_human', 'failed'].includes(state)) throw new EdgeError('invalid_runtime_job_state', 422);
      const job = await completeWorkRuntimeJob(admin, context, {
        jobId: requiredText(body.job_id, 'runtime_job_id_required', 80),
        leaseId: requiredText(body.lease_id, 'runtime_lease_required', 80),
        state: state as 'completed' | 'waiting_human' | 'failed',
        result: body.result
      });
      return json(req, { ok: true, job });
    } catch (error) {
      return errorResponse(req, error);
    }
  }

  const orgId = clean(body.organization_id, 80);
  if (!orgId) return json(req, { ok: false, error: 'organization_id_required' }, 422);

  try {
    const context = await resolveContext(req, orgId);
    const requestId = correlationId(req, body);
    if (operation === 'get_state') return await getState(req, body, context);
    if (operation === 'get_audit') return await getAudit(req, body, context);
    if (operation === 'create_task') return await createTask(req, body, context, requestId);
    if (operation === 'transition_task') return await transitionTask(req, body, context, requestId);
    if (operation === 'record_evidence') return await recordEvidence(req, body, context, requestId);
    if (operation === 'request_approval') return await requestApproval(req, body, context, requestId);
    if (operation === 'decide_approval') return await decideApproval(req, body, context, requestId);
    if (operation === 'create_workflow_plan') return await createWorkPlan(req, body, context, requestId);
    if (operation === 'list_workflows') return await listWorkflows(req, context);
    if (operation === 'evaluate_work_step') return await evaluateWorkStep(req, body, context);
    if (['list_work_connections', 'register_work_connection_ref', 'revoke_work_connection_ref'].includes(operation)) return await connectionOperation(req, operation, body, context);
    if (['list_work_runtimes', 'enroll_work_runtime', 'enqueue_work_runtime_job'].includes(operation)) return await runtimeUserOperation(req, operation, body, context);
    if (['create_work_template', 'execute_work_step', 'resume_work_step'].includes(operation)) return await pilotOperation(req, operation, body, context, requestId);
    if (operation === 'sync_manager_readiness') return await syncReadiness(req, context, requestId);
    return json(req, { ok: false, error: 'unsupported_operation' }, 400);
  } catch (error) {
    return errorResponse(req, error);
  }
});
