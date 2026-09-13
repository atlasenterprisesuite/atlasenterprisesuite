import { parseAtlasWorkContext } from '../../../packages/execution/src/work-types.ts';
import { selectExecutionRoute } from '../../../packages/execution/src/work-routing.ts';
import { evaluateWorkActionPolicy, type WorkActionSensitivity } from '../../../packages/execution/src/work-policy.ts';

export class WorkPolicyResolutionError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code);
  }
}

type ServerContext = {
  orgId: string;
  userId: string;
  permissions: string[];
};

type EvaluateDeps = {
  admin: any;
  context: ServerContext;
  taskId: string;
};

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function bool(value: unknown) {
  return value === true;
}

function nonnegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function sensitivity(value: unknown): WorkActionSensitivity {
  const normalized = String(value || '').toLowerCase();
  return ['low', 'medium', 'high', 'critical'].includes(normalized)
    ? normalized as WorkActionSensitivity
    : 'high';
}

export async function evaluateWorkStepServer({ admin, context, taskId }: EvaluateDeps) {
  const { data: task, error: taskError } = await admin
    .from('execution_tasks')
    .select('id,org_id,workflow_id,current_step_id,permissions_required')
    .eq('id', taskId)
    .eq('org_id', context.orgId)
    .maybeSingle();
  if (taskError) throw new WorkPolicyResolutionError('persistence_error', 500);
  if (!task) throw new WorkPolicyResolutionError('task_not_found', 404);
  if (!task.current_step_id) throw new WorkPolicyResolutionError('current_action_required', 409);

  const [{ data: workflow, error: workflowError }, { data: step, error: stepError }] = await Promise.all([
    admin
      .from('execution_workflows')
      .select('id,org_id,context')
      .eq('id', String(task.workflow_id))
      .eq('org_id', context.orgId)
      .maybeSingle(),
    admin
      .from('execution_steps')
      .select('id,org_id,task_id,action_type,action_payload,permissions_required')
      .eq('id', String(task.current_step_id))
      .eq('task_id', taskId)
      .eq('org_id', context.orgId)
      .maybeSingle()
  ]);
  if (workflowError || stepError) throw new WorkPolicyResolutionError('persistence_error', 500);
  if (!workflow) throw new WorkPolicyResolutionError('workflow_not_found', 404);
  if (!step) throw new WorkPolicyResolutionError('current_action_required', 409);

  const workflowContext = record(workflow.context);
  const work = parseAtlasWorkContext({ work: workflowContext.work });
  const payload = record(step.action_payload);
  const execution = record(payload.execution_capabilities);

  const route = selectExecutionRoute({
    requestedMode: work.executionMode,
    apiCapability: {
      available: bool(execution.api_available),
      authorized: bool(execution.api_authorized),
      reason: typeof execution.api_reason === 'string' ? execution.api_reason.slice(0, 160) : undefined
    },
    browserCapability: {
      available: bool(execution.browser_available),
      authorized: bool(execution.browser_authorized),
      reason: typeof execution.browser_reason === 'string' ? execution.browser_reason.slice(0, 160) : undefined
    },
    runtimeAvailable: bool(execution.runtime_available)
  });

  if (route.state === 'blocked') {
    return {
      route,
      policy: { outcome: 'deny' as const, reason: 'execution_route_blocked' },
      approvalRequired: false
    };
  }

  const requiredPermissions = Array.isArray(step.permissions_required)
    ? step.permissions_required.map(String).filter(Boolean)
    : [];
  const permissionsSatisfied = requiredPermissions.every((permission: string) =>
    context.permissions.includes(permission) || context.permissions.includes('execution.admin')
  );
  const mutation = bool(execution.mutation);
  const envelopeAllowed = route.mechanism === 'browser'
    ? bool(execution.browser_envelope_allowed)
    : true;

  const policy = evaluateWorkActionPolicy({
    autonomyLevel: work.autonomyLevel,
    sensitivity: sensitivity(execution.sensitivity),
    reversible: mutation ? bool(execution.reversible) : true,
    mutation,
    paidCost: nonnegativeNumber(execution.paid_cost),
    budgetLimit: work.budgetLimit,
    permissionsSatisfied,
    envelopeAllowed,
    regulated: bool(execution.regulated)
  });

  return {
    route,
    policy,
    approvalRequired: policy.outcome === 'require_approval'
  };
}
