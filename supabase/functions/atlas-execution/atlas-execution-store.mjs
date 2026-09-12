function fail(code, status = 500) {
  return Object.assign(new Error(code), { code, status });
}

function requireContext(context) {
  if (!context?.organization_id || !context?.user_id) throw fail('invalid_context', 400);
  return context;
}

function enc(value) {
  return encodeURIComponent(String(value));
}

function sensitiveKey(key) {
  const normalized = String(key || '').toLowerCase();
  return normalized === 'authorization'
    || normalized === 'service_role'
    || normalized === 'service_role_key'
    || normalized === 'access_token'
    || normalized === 'refresh_token'
    || normalized === 'cvv'
    || normalized === 'cvc'
    || normalized === 'pan'
    || normalized === 'password'
    || normalized.endsWith('_secret')
    || normalized.endsWith('_token');
}

export function redactExecutionMetadata(value) {
  if (Array.isArray(value)) return value.map(redactExecutionMetadata);
  if (!value || typeof value !== 'object') return value;
  const clean = {};
  for (const [key, nested] of Object.entries(value)) {
    if (sensitiveKey(key)) continue;
    clean[key] = redactExecutionMetadata(nested);
  }
  return clean;
}

async function parse(response, code = 'storage_unavailable') {
  if (!response.ok) throw fail(code, response.status === 404 ? 404 : response.status >= 500 ? 502 : response.status);
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

export function createExecutionStore({ supabaseUrl, serviceRoleKey, fetchFn = fetch } = {}) {
  if (!supabaseUrl || !serviceRoleKey) throw new TypeError('storage_dependencies_required');
  const headers = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json',
    prefer: 'return=representation'
  };

  async function rest(path, init = {}) {
    try {
      return await fetchFn(`${supabaseUrl}/rest/v1/${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers || {}) },
        cache: 'no-store'
      });
    } catch {
      throw fail('storage_unavailable', 502);
    }
  }

  async function listWorkflows(context, limit = 50) {
    const ctx = requireContext(context);
    const n = Math.min(100, Math.max(1, Number(limit) || 50));
    const response = await rest(`atlas_workflows?select=*&org_id=eq.${enc(ctx.organization_id)}&order=updated_at.desc&limit=${n}`);
    const rows = await parse(response);
    return Array.isArray(rows) ? rows : [];
  }

  async function getWorkflow(context, taskId) {
    const ctx = requireContext(context);
    const response = await rest(`atlas_workflows?select=*&org_id=eq.${enc(ctx.organization_id)}&task_id=eq.${enc(taskId)}&limit=1`);
    const rows = await parse(response);
    if (!rows?.[0]) throw fail('workflow_not_found', 404);
    return rows[0];
  }

  async function createWorkflow(context, input) {
    const ctx = requireContext(context);
    const row = {
      task_id: input.task_id,
      workflow_type: input.workflow_type,
      module: input.module,
      tenant_id: input.tenant_id || ctx.organization_id,
      org_id: ctx.organization_id,
      owner_id: ctx.user_id,
      status: input.status || 'next',
      priority: input.priority || 'normal',
      current_step: input.current_step || null,
      next_action: input.next_action || null,
      dependencies: Array.isArray(input.dependencies) ? input.dependencies : [],
      blocked_reason: null,
      permissions_required: Array.isArray(input.permissions_required) ? input.permissions_required : [],
      trace_id: input.trace_id
    };
    const response = await rest('atlas_workflows', { method: 'POST', body: JSON.stringify(row) });
    const rows = await parse(response);
    return rows?.[0] || rows;
  }

  async function updateWorkflow(context, taskId, patch) {
    const ctx = requireContext(context);
    const allowed = {};
    for (const key of ['status', 'current_step', 'next_action', 'blocked_reason', 'completed_at', 'updated_at', 'evidence_ids']) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) allowed[key] = patch[key];
    }
    const response = await rest(`atlas_workflows?org_id=eq.${enc(ctx.organization_id)}&task_id=eq.${enc(taskId)}`, {
      method: 'PATCH', body: JSON.stringify(allowed)
    });
    const rows = await parse(response);
    if (!rows?.[0]) throw fail('workflow_not_found', 404);
    return rows[0];
  }

  async function appendEvent(context, event) {
    const ctx = requireContext(context);
    const row = {
      org_id: ctx.organization_id,
      task_id: event.task_id,
      step_id: event.step_id || null,
      trace_id: event.trace_id,
      actor_id: ctx.user_id,
      event_type: event.event_type,
      authorization_result: event.authorization_result || null,
      approval_state: event.approval_state || null,
      result_state: event.result_state || null,
      evidence_refs: Array.isArray(event.evidence_refs) ? event.evidence_refs : [],
      error_category: event.error_category || null,
      metadata: redactExecutionMetadata(event.metadata && typeof event.metadata === 'object' ? event.metadata : {})
    };
    const response = await rest('atlas_workflow_events', { method: 'POST', body: JSON.stringify(row) });
    await parse(response);
  }

  async function getApproval(context, approvalId) {
    const ctx = requireContext(context);
    const response = await rest(`atlas_approval_requests?select=*&org_id=eq.${enc(ctx.organization_id)}&id=eq.${enc(approvalId)}&limit=1`);
    const rows = await parse(response);
    if (!rows?.[0]) throw fail('approval_not_found', 404);
    return rows[0];
  }

  async function updateApproval(context, approvalId, patch) {
    const ctx = requireContext(context);
    const allowed = {};
    for (const key of ['status', 'approver_id', 'decided_at', 'decision_reason', 'updated_at']) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) allowed[key] = patch[key];
    }
    const response = await rest(`atlas_approval_requests?org_id=eq.${enc(ctx.organization_id)}&id=eq.${enc(approvalId)}`, {
      method: 'PATCH', body: JSON.stringify(allowed)
    });
    const rows = await parse(response);
    if (!rows?.[0]) throw fail('approval_not_found', 404);
    return rows[0];
  }

  async function listProviders(context) {
    const ctx = requireContext(context);
    const response = await rest(`atlas_provider_registry?select=provider_key,state,capabilities,last_verified_at&org_id=eq.${enc(ctx.organization_id)}&order=provider_key.asc`);
    const rows = await parse(response);
    return Array.isArray(rows) ? rows : [];
  }

  return Object.freeze({
    listWorkflows,
    getWorkflow,
    createWorkflow,
    updateWorkflow,
    appendEvent,
    getApproval,
    updateApproval,
    listProviders
  });
}
