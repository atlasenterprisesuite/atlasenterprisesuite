import { parseAtlasWorkContext } from '../../../packages/execution/src/work-types.ts';
import { selectExecutionRoute } from '../../../packages/execution/src/work-routing.ts';
import { evaluateWorkActionPolicy, type WorkActionSensitivity } from '../../../packages/execution/src/work-policy.ts';
import { runtimeIsHealthy } from '../../../packages/execution/src/work-runtime.ts';

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

function browserProvider(actionType: string, payload: Record<string, any>) {
  if (['observe_openai_verification_requirement', 'open_openai_domain_verification', 'click_openai_check', 'verify_openai_domain_state'].includes(actionType)) {
    return { providers: ['openai', 'chatgpt'], domain: 'chatgpt.com' };
  }
  if (actionType === 'create_dns_txt') {
    const provider = String(payload.provider || '').trim().toLowerCase();
    const domain = String(payload.browser_domain || '').trim().toLowerCase();
    return provider && domain ? { providers: [provider], domain } : null;
  }
  return null;
}

async function liveBrowserCapability(admin: any, context: ServerContext, actionType: string, payload: Record<string, any>) {
  const requirement = browserProvider(actionType, payload);
  if (!requirement) return { available: false, authorized: false, runtimeAvailable: false, envelopeAllowed: false };

  const [connectionsResult, runtimesResult] = await Promise.all([
    admin.from('execution_connection_refs')
      .select('id,provider,status')
      .eq('org_id', context.orgId)
      .eq('tenant_id', context.orgId)
      .eq('status', 'active')
      .in('provider', requirement.providers),
    admin.from('execution_runtime_registrations')
      .select('id,kind,status,capabilities,last_seen_at')
      .eq('org_id', context.orgId)
      .eq('tenant_id', context.orgId)
      .eq('status', 'online')
  ]);
  if (connectionsResult.error || runtimesResult.error) throw new WorkPolicyResolutionError('persistence_error', 500);
  const authorized = Boolean(connectionsResult.data?.length);
  const runtimeAvailable = (runtimesResult.data || []).some((runtime: any) => runtimeIsHealthy({
    id: String(runtime.id),
    kind: runtime.kind,
    status: runtime.status,
    capabilities: Array.isArray(runtime.capabilities) ? runtime.capabilities.map(String) : [],
    lastSeenAt: runtime.last_seen_at ? String(runtime.last_seen_at) : null
  }) && Array.isArray(runtime.capabilities) && runtime.capabilities.map(String).includes('browser'));
  return {
    available: true,
    authorized,
    runtimeAvailable,
    envelopeAllowed: authorized && runtimeAvailable && Boolean(requirement.domain)
  };
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
    admin.from('execution_workflows')
      .select('id,org_id,context')
      .eq('id', String(task.workflow_id))
      .eq('org_id', context.orgId)
      .maybeSingle(),
    admin.from('execution_steps')
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
  const liveBrowser = await liveBrowserCapability(admin, context, String(step.action_type), payload);

  const route = selectExecutionRoute({
    requestedMode: work.executionMode,
    apiCapability: {
      available: bool(execution.api_available),
      authorized: bool(execution.api_authorized),
      reason: typeof execution.api_reason === 'string' ? execution.api_reason.slice(0, 160) : undefined
    },
    browserCapability: {
      available: liveBrowser.available || bool(execution.browser_available),
      authorized: liveBrowser.authorized,
      reason: liveBrowser.authorized ? 'authorized_connection_available' : 'authorized_connection_missing'
    },
    runtimeAvailable: liveBrowser.runtimeAvailable
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
  const envelopeAllowed = route.mechanism === 'browser' ? liveBrowser.envelopeAllowed : true;

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
