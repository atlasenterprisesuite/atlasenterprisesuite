import { transitionWorkflow, type AtlasWorkflowTransitionEvent } from '../../../packages/execution/src/state-machine.ts';
import { hasExecutionPermission, resolveExecutionContext } from './atlas-execution-auth.mjs';
import { createExecutionStore } from './atlas-execution-store.mjs';

export type ExecutionApiContext = {
  organization_id: string;
  user_id: string;
  permissions: string[];
  roles: string[];
  request_id: string;
};

export interface ExecutionApiStore {
  listWorkflows(context: ExecutionApiContext, limit?: number): Promise<Record<string, unknown>[]>;
  getWorkflow(context: ExecutionApiContext, taskId: string): Promise<Record<string, any>>;
  createWorkflow(context: ExecutionApiContext, input: Record<string, unknown>): Promise<Record<string, any>>;
  updateWorkflow(context: ExecutionApiContext, taskId: string, patch: Record<string, unknown>): Promise<Record<string, any>>;
  appendEvent(context: ExecutionApiContext, event: Record<string, unknown>): Promise<void>;
  getApproval(context: ExecutionApiContext, approvalId: string): Promise<Record<string, any>>;
  updateApproval(context: ExecutionApiContext, approvalId: string, patch: Record<string, unknown>): Promise<Record<string, any>>;
  listProviders(context: ExecutionApiContext): Promise<Record<string, unknown>[]>;
}

export type ExecutionApiHandlerDependencies = {
  resolveContext(request: Request): Promise<ExecutionApiContext | { context: ExecutionApiContext }>;
  store: ExecutionApiStore;
  randomUUID(): string;
  now?: () => string;
};

const SAFE_ADVANCE_EVENTS = new Set<AtlasWorkflowTransitionEvent>([
  'queue', 'start', 'block', 'request_approval', 'resume', 'fail', 'cancel'
]);

function headers(extra: Record<string, string> = {}) {
  return {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...extra
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers() });
}

function errorStatus(code: string): number {
  if (code === 'unauthenticated') return 401;
  if (code === 'forbidden') return 403;
  if (code === 'workflow_not_found' || code === 'approval_not_found') return 404;
  if (code === 'invalid_input' || code === 'invalid_transition') return 400;
  return 500;
}

function canonicalError(error: any): { code: string; status: number } {
  const raw = String(error?.code || error?.message || 'internal_error');
  if (raw === 'authentication_required') return { code: 'unauthenticated', status: 401 };
  if (raw === 'permission_denied') return { code: 'forbidden', status: 403 };
  const allowed = new Set([
    'unauthenticated', 'forbidden', 'invalid_input', 'invalid_transition', 'workflow_not_found',
    'approval_not_found', 'approval_required', 'validation_failed', 'budget_blocked',
    'provider_not_configured', 'provider_unverified', 'provider_unavailable', 'rate_limited'
  ]);
  if (!allowed.has(raw)) return { code: 'internal_error', status: Number(error?.status) >= 400 && Number(error?.status) < 500 ? Number(error.status) : 500 };
  return { code: raw, status: Number(error?.status) || errorStatus(raw) };
}

async function parseJson(request: Request): Promise<Record<string, any>> {
  try {
    const value = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_input');
    return value as Record<string, any>;
  } catch {
    throw Object.assign(new Error('invalid_input'), { code: 'invalid_input', status: 400 });
  }
}

function normalizeContext(value: ExecutionApiContext | { context: ExecutionApiContext }): ExecutionApiContext {
  return 'context' in value ? value.context : value;
}

function requirePermission(context: ExecutionApiContext, permission: string) {
  if (!hasExecutionPermission(context, permission)) {
    throw Object.assign(new Error('forbidden'), { code: 'forbidden', status: 403 });
  }
}

function traceIdOf(record: Record<string, any>, randomUUID: () => string): string {
  return String(record.trace_id || record.traceId || randomUUID());
}

export function createAtlasExecutionHandler(dependencies: ExecutionApiHandlerDependencies) {
  const now = dependencies.now ?? (() => new Date().toISOString());

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const api = url.searchParams.get('api') || 'status';
    let traceId = dependencies.randomUUID();

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: headers({ 'access-control-allow-methods': 'GET, POST, OPTIONS' }) });
    }

    try {
      const context = normalizeContext(await dependencies.resolveContext(request));

      if (api === 'status') {
        const providers = await dependencies.store.listProviders(context);
        return json({ ok: true, authenticated: true, organization_id: context.organization_id, providers });
      }

      if (api === 'workflows') {
        if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed', trace_id: traceId }, 405);
        requirePermission(context, 'workflow.read');
        const workflows = await dependencies.store.listWorkflows(context);
        return json({ ok: true, workflows });
      }

      if (api === 'workflow') {
        if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed', trace_id: traceId }, 405);
        requirePermission(context, 'workflow.read');
        const taskId = String(url.searchParams.get('task_id') || '').trim();
        if (!taskId) throw Object.assign(new Error('invalid_input'), { code: 'invalid_input', status: 400 });
        const workflow = await dependencies.store.getWorkflow(context, taskId);
        traceId = traceIdOf(workflow, dependencies.randomUUID);
        return json({ ok: true, workflow });
      }

      if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed', trace_id: traceId }, 405);
      const body = await parseJson(request);

      if (api === 'create') {
        requirePermission(context, 'workflow.manage');
        const workflowType = String(body.workflow_type || '').trim();
        const module = String(body.module || '').trim();
        if (!workflowType || !module) throw Object.assign(new Error('invalid_input'), { code: 'invalid_input', status: 400 });
        traceId = dependencies.randomUUID();
        const taskId = String(body.task_id || dependencies.randomUUID());
        const workflow = await dependencies.store.createWorkflow(context, {
          task_id: taskId,
          workflow_type: workflowType,
          module,
          tenant_id: String(body.tenant_id || context.organization_id),
          status: 'next',
          priority: ['low', 'normal', 'high', 'critical'].includes(String(body.priority)) ? String(body.priority) : 'normal',
          current_step: body.current_step ? String(body.current_step) : null,
          next_action: body.next_action ? String(body.next_action) : null,
          dependencies: Array.isArray(body.dependencies) ? body.dependencies.map(String) : [],
          permissions_required: Array.isArray(body.permissions_required) ? body.permissions_required.map(String) : [],
          trace_id: traceId
        });
        await dependencies.store.appendEvent(context, {
          task_id: taskId,
          trace_id: traceId,
          event_type: 'workflow_created',
          authorization_result: 'allowed',
          result_state: 'next',
          metadata: { workflow_type: workflowType, module }
        });
        return json({ ok: true, workflow }, 201);
      }

      if (api === 'advance') {
        requirePermission(context, 'workflow.manage');
        const taskId = String(body.task_id || '').trim();
        const event = String(body.event || '') as AtlasWorkflowTransitionEvent;
        if (!taskId || !SAFE_ADVANCE_EVENTS.has(event)) throw Object.assign(new Error('invalid_input'), { code: 'invalid_input', status: 400 });
        const workflow = await dependencies.store.getWorkflow(context, taskId);
        traceId = traceIdOf(workflow, dependencies.randomUUID);
        const nextStatus = transitionWorkflow(String(workflow.status) as any, event);
        const patch: Record<string, unknown> = { status: nextStatus, updated_at: now() };
        if (event === 'block') patch.blocked_reason = String(body.blocked_reason || 'dependency_blocked');
        if (event === 'resume' || event === 'start') patch.blocked_reason = null;
        if (event === 'cancel' || event === 'fail') patch.next_action = null;
        const updated = await dependencies.store.updateWorkflow(context, taskId, patch);
        await dependencies.store.appendEvent(context, {
          task_id: taskId,
          step_id: body.step_id ? String(body.step_id) : null,
          trace_id: traceId,
          event_type: `workflow_${event}`,
          authorization_result: 'allowed',
          result_state: nextStatus,
          error_category: event === 'fail' ? String(body.error_category || 'internal_error') : null,
          metadata: {}
        });
        return json({ ok: true, workflow: updated });
      }

      if (api === 'approve' || api === 'deny') {
        requirePermission(context, 'workflow.approve');
        const approvalId = String(body.approval_id || '').trim();
        if (!approvalId) throw Object.assign(new Error('invalid_input'), { code: 'invalid_input', status: 400 });
        const approval = await dependencies.store.getApproval(context, approvalId);
        if (approval.status !== 'pending') throw Object.assign(new Error('invalid_transition'), { code: 'invalid_transition', status: 400 });
        const taskId = String(approval.task_id || '').trim();
        if (!taskId) throw Object.assign(new Error('invalid_input'), { code: 'invalid_input', status: 400 });
        const workflow = await dependencies.store.getWorkflow(context, taskId);
        traceId = traceIdOf(workflow, dependencies.randomUUID);
        const approved = api === 'approve';
        const decisionStatus = approved ? 'approved' : 'denied';
        const nextStatus = transitionWorkflow(String(workflow.status) as any, approved ? 'approval_granted' : 'approval_denied');
        const updatedApproval = await dependencies.store.updateApproval(context, approvalId, {
          status: decisionStatus,
          approver_id: context.user_id,
          decided_at: now(),
          decision_reason: body.reason ? String(body.reason) : null,
          updated_at: now()
        });
        const updatedWorkflow = await dependencies.store.updateWorkflow(context, taskId, {
          status: nextStatus,
          next_action: approved ? 'Continue approved execution' : 'Resolve denied approval',
          blocked_reason: approved ? null : 'approval_denied',
          updated_at: now()
        });
        await dependencies.store.appendEvent(context, {
          task_id: taskId,
          step_id: approval.step_id || null,
          trace_id: traceId,
          event_type: approved ? 'approval_granted' : 'approval_denied',
          authorization_result: 'allowed',
          approval_state: decisionStatus,
          result_state: nextStatus,
          metadata: { approval_id: approvalId }
        });
        return json({ ok: true, approval: updatedApproval, workflow: updatedWorkflow });
      }

      return json({ ok: false, error: 'not_found', trace_id: traceId }, 404);
    } catch (error: any) {
      const normalized = canonicalError(error);
      return json({ ok: false, error: normalized.code, trace_id: traceId }, normalized.status);
    }
  };
}

function environment(name: string): string {
  const deno = (globalThis as any).Deno;
  return deno?.env?.get?.(name) || '';
}

const deno = (globalThis as any).Deno;
if (deno?.serve) {
  const supabaseUrl = environment('SUPABASE_URL') || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
  const publishableKey = environment('SUPABASE_PUBLISHABLE_KEY') || environment('SUPABASE_ANON_KEY') || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';
  const serviceRoleKey = environment('SUPABASE_SERVICE_ROLE_KEY');
  const store = createExecutionStore({ supabaseUrl, serviceRoleKey, fetchFn: fetch }) as ExecutionApiStore;
  const handler = createAtlasExecutionHandler({
    resolveContext: async (request) => (await resolveExecutionContext({ request, supabaseUrl, publishableKey, fetchFn: fetch })).context,
    store,
    randomUUID: () => crypto.randomUUID()
  });
  deno.serve(handler);
}
