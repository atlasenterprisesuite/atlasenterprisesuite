import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ||
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
  '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const TASK_CODES = [
  'physical_site',
  'radio_commissioned',
  'spectrum_authorized',
  'sas_coordinated',
  'core_reachable',
  'backhaul_operational',
  'subscriber_identity_ready',
  'device_attach',
  'data_path',
  'observability',
  'emergency_boundary',
  'rf_safety'
] as const;

type TaskCode = (typeof TASK_CODES)[number];
type RequestContext = { userId: string; orgId: string; role: string };

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);

class CommissioningError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    readonly details: Record<string, unknown> = {}
  ) {
    super(code);
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...corsHeaders(req.headers.get('origin'))
    }
  });
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function validEvidence(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => clean(item, 1000))
    .filter(Boolean)
    .slice(0, 20);
}

function userClient(req: Request) {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('authorization') || '' } }
  });
}

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new CommissioningError('service_role_not_configured', 503);
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function resolveContext(req: Request): Promise<RequestContext> {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new CommissioningError('supabase_runtime_not_configured', 503);

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new CommissioningError('authentication_required', 401);

  const sb = userClient(req);
  const { data: authData, error: authError } = await sb.auth.getUser(token);
  if (authError || !authData.user) throw new CommissioningError('invalid_session', 401);

  const requestedOrg = clean(req.headers.get('x-atlas-org-id'), 80);
  let query = sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');

  if (requestedOrg) query = query.eq('org_id', requestedOrg);
  const { data, error } = await query.limit(1);
  if (error || !data?.[0]?.org_id) throw new CommissioningError('active_organization_required', 403);

  return {
    userId: authData.user.id,
    orgId: String(data[0].org_id),
    role: String(data[0].role || 'member')
  };
}

async function requirePermission(req: Request, ctx: RequestContext, permission: string) {
  const sb = userClient(req);
  const { data, error } = await sb.rpc('has_identity_permission', { o: ctx.orgId, p: permission });
  if (error || data !== true) throw new CommissioningError('authorization_denied', 403);
}

async function audit(
  ctx: RequestContext,
  action: string,
  tableName: string,
  recordId: string | null,
  newData: Record<string, unknown>
) {
  try {
    const admin = adminClient();
    await admin.from('audit_logs').insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      action,
      table_name: tableName,
      record_id: recordId,
      new_data: newData
    });
  } catch {
    // Audit failure never promotes commissioning state.
  }
}

async function listRuns(ctx: RequestContext) {
  const admin = adminClient();
  const { data: runs, error } = await admin
    .from('wireless_commissioning_runs')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false });
  if (error) throw new CommissioningError('commissioning_runs_unavailable', 503);

  const runIds = (runs || []).map((run) => run.id);
  let tasks: unknown[] = [];
  if (runIds.length) {
    const result = await admin
      .from('wireless_commissioning_tasks')
      .select('*')
      .eq('org_id', ctx.orgId)
      .in('run_id', runIds)
      .order('task_code');
    if (result.error) throw new CommissioningError('commissioning_tasks_unavailable', 503);
    tasks = result.data || [];
  }

  return { runs: runs || [], tasks };
}

async function createRun(req: Request, ctx: RequestContext, body: Record<string, unknown>) {
  await requirePermission(req, ctx, 'wireless.network.commissioning.write');
  const siteCode = clean(body.site_code, 80).toUpperCase();
  const displayName = clean(body.display_name, 160);
  const targetMode = clean(body.target_mode, 40) || 'atlas-owned';

  if (!siteCode || !displayName) throw new CommissioningError('site_code_and_display_name_required', 422);
  if (!['atlas-owned', 'hybrid'].includes(targetMode)) throw new CommissioningError('invalid_target_mode', 422);

  const admin = adminClient();
  const { data: run, error } = await admin
    .from('wireless_commissioning_runs')
    .insert({
      org_id: ctx.orgId,
      site_code: siteCode,
      display_name: displayName,
      target_mode: targetMode,
      created_by: ctx.userId,
      state: 'evidence_collection'
    })
    .select('*')
    .single();

  if (error || !run) {
    if (String(error?.code || '') === '23505') throw new CommissioningError('site_code_already_exists', 409);
    throw new CommissioningError('commissioning_run_create_failed', 503);
  }

  const taskRows = TASK_CODES.map((taskCode) => ({
    org_id: ctx.orgId,
    run_id: run.id,
    task_code: taskCode,
    state: 'pending',
    evidence_refs: []
  }));
  const taskInsert = await admin.from('wireless_commissioning_tasks').insert(taskRows);
  if (taskInsert.error) {
    await admin.from('wireless_commissioning_runs').delete().eq('id', run.id).eq('org_id', ctx.orgId);
    throw new CommissioningError('commissioning_tasks_create_failed', 503);
  }

  await audit(ctx, 'wireless.network.commissioning.created', 'wireless_commissioning_runs', run.id, {
    site_code: siteCode,
    target_mode: targetMode
  });
  return run;
}

async function recordTask(req: Request, ctx: RequestContext, body: Record<string, unknown>) {
  await requirePermission(req, ctx, 'wireless.network.commissioning.write');

  const runId = clean(body.run_id, 80);
  const taskCode = clean(body.task_code, 80) as TaskCode;
  const state = clean(body.state, 40);
  const evidence = validEvidence(body.evidence_refs);
  const notes = clean(body.notes, 2000) || null;

  if (!runId || !TASK_CODES.includes(taskCode)) throw new CommissioningError('invalid_run_or_task', 422);
  if (!['passed', 'failed', 'not_applicable'].includes(state)) throw new CommissioningError('invalid_task_state', 422);
  if ((state === 'passed' || state === 'not_applicable') && evidence.length === 0) {
    throw new CommissioningError('evidence_required', 422);
  }

  const admin = adminClient();
  const { data: run } = await admin
    .from('wireless_commissioning_runs')
    .select('id,state')
    .eq('id', runId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();
  if (!run) throw new CommissioningError('commissioning_run_not_found', 404);
  if (run.state === 'commissioned') throw new CommissioningError('commissioned_run_immutable', 409);

  const { data: task, error } = await admin
    .from('wireless_commissioning_tasks')
    .update({
      state,
      evidence_refs: evidence,
      verified_by: ctx.userId,
      verified_at: new Date().toISOString(),
      notes,
      updated_at: new Date().toISOString()
    })
    .eq('org_id', ctx.orgId)
    .eq('run_id', runId)
    .eq('task_code', taskCode)
    .select('*')
    .single();

  if (error || !task) throw new CommissioningError('commissioning_task_update_failed', 503);

  await admin
    .from('wireless_commissioning_runs')
    .update({ state: 'validation', updated_at: new Date().toISOString() })
    .eq('id', runId)
    .eq('org_id', ctx.orgId)
    .neq('state', 'commissioned');

  await audit(ctx, 'wireless.network.commissioning.task_recorded', 'wireless_commissioning_tasks', task.id, {
    run_id: runId,
    task_code: taskCode,
    state,
    evidence_count: evidence.length
  });
  return task;
}

async function prepareApproval(req: Request, ctx: RequestContext, body: Record<string, unknown>) {
  await requirePermission(req, ctx, 'wireless.network.commissioning.write');
  const runId = clean(body.run_id, 80);
  if (!runId) throw new CommissioningError('run_id_required', 422);

  const admin = adminClient();
  const { data: tasks, error } = await admin
    .from('wireless_commissioning_tasks')
    .select('task_code,state,evidence_refs,verified_by,verified_at')
    .eq('org_id', ctx.orgId)
    .eq('run_id', runId);

  if (error) throw new CommissioningError('commissioning_tasks_unavailable', 503);
  const byCode = new Map((tasks || []).map((task) => [task.task_code, task]));
  const blockers: string[] = [];

  for (const taskCode of TASK_CODES) {
    const task = byCode.get(taskCode);
    if (!task) {
      blockers.push(`missing_task:${taskCode}`);
      continue;
    }
    if (!['passed', 'not_applicable'].includes(String(task.state))) {
      blockers.push(`task_not_passed:${taskCode}:${task.state}`);
      continue;
    }
    if (!task.verified_by || !task.verified_at || validEvidence(task.evidence_refs).length === 0) {
      blockers.push(`task_evidence_invalid:${taskCode}`);
    }
  }

  if (blockers.length) throw new CommissioningError('commissioning_not_ready_for_approval', 409, { blockers });

  const { data: run, error: updateError } = await admin
    .from('wireless_commissioning_runs')
    .update({ state: 'ready_for_approval', updated_at: new Date().toISOString() })
    .eq('id', runId)
    .eq('org_id', ctx.orgId)
    .neq('state', 'commissioned')
    .select('*')
    .single();

  if (updateError || !run) throw new CommissioningError('commissioning_run_update_failed', 503);
  await audit(ctx, 'wireless.network.commissioning.ready_for_approval', 'wireless_commissioning_runs', runId, {
    task_count: TASK_CODES.length
  });
  return run;
}

async function approveRun(req: Request, ctx: RequestContext, body: Record<string, unknown>) {
  await requirePermission(req, ctx, 'wireless.network.commissioning.approve');
  const runId = clean(body.run_id, 80);
  const approvalEvidence = validEvidence(body.evidence_refs);
  if (!runId) throw new CommissioningError('run_id_required', 422);
  if (!approvalEvidence.length) throw new CommissioningError('approval_evidence_required', 422);

  const admin = adminClient();
  const { data: run } = await admin
    .from('wireless_commissioning_runs')
    .select('id,state')
    .eq('id', runId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!run) throw new CommissioningError('commissioning_run_not_found', 404);
  if (run.state !== 'ready_for_approval') throw new CommissioningError('commissioning_not_ready_for_approval', 409);

  const { data: approved, error } = await admin
    .from('wireless_commissioning_runs')
    .update({
      state: 'commissioned',
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
      approval_evidence_refs: approvalEvidence,
      updated_at: new Date().toISOString()
    })
    .eq('id', runId)
    .eq('org_id', ctx.orgId)
    .eq('state', 'ready_for_approval')
    .select('*')
    .single();

  if (error || !approved) throw new CommissioningError('commissioning_approval_failed', 503);
  await audit(ctx, 'wireless.network.commissioning.approved', 'wireless_commissioning_runs', runId, {
    approval_evidence_count: approvalEvidence.length
  });
  return approved;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
  }

  try {
    const ctx = await resolveContext(req);
    const operation = new URL(req.url).searchParams.get('api') || 'list';

    if (req.method === 'GET' && operation === 'list') {
      await requirePermission(req, ctx, 'wireless.network.commissioning.read');
      return json(req, { ok: true, service: 'atlas-wireless-commissioning', ...(await listRuns(ctx)) });
    }

    if (req.method !== 'POST') throw new CommissioningError('method_not_allowed', 405);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    if (operation === 'create') return json(req, { ok: true, run: await createRun(req, ctx, body) }, 201);
    if (operation === 'task') return json(req, { ok: true, task: await recordTask(req, ctx, body) });
    if (operation === 'prepare-approval') return json(req, { ok: true, run: await prepareApproval(req, ctx, body) });
    if (operation === 'approve') return json(req, { ok: true, run: await approveRun(req, ctx, body) });

    throw new CommissioningError('not_found', 404);
  } catch (error) {
    if (error instanceof CommissioningError) {
      return json(req, { ok: false, error: error.code, ...error.details }, error.status);
    }
    return json(req, { ok: false, error: 'internal_error' }, 500);
  }
});
