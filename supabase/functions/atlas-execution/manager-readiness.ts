import { canTransitionTask, evaluateTaskCompletion } from '../../../packages/execution/src/state-machine.ts';

export class ManagerReadinessError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code);
  }
}

type ProviderKey = 'github' | 'supabase' | 'cloudflare' | 'production';
type ProviderStatus = { state: string; required: true };
type OptionalProviderStatus = { state: string; required: false } | null;

type InfraBlocker = { stage: string; code: string; detail: string };

export type ManagerInfraStatus = {
  providers: Record<ProviderKey, ProviderStatus> & { vercel?: OptionalProviderStatus };
  blockers: InfraBlocker[];
  organizationId: string | null;
};

export const REQUIRED_MANAGER_STEPS = [
  { key: 'github', sequence: 1, actionType: 'verify_github', title: 'Verify canonical GitHub state', evidenceKind: 'infra_verification.github' },
  { key: 'supabase', sequence: 2, actionType: 'verify_supabase', title: 'Verify Supabase control plane', evidenceKind: 'infra_verification.supabase' },
  { key: 'cloudflare', sequence: 3, actionType: 'verify_cloudflare', title: 'Verify Cloudflare public edge', evidenceKind: 'infra_verification.cloudflare' },
  { key: 'production', sequence: 4, actionType: 'verify_production', title: 'Verify public production route', evidenceKind: 'infra_verification.production' }
] as const;

function plainRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function normalizeRequiredProvider(value: unknown, requirement: unknown): ProviderStatus {
  const raw = plainRecord(value);
  const required = raw.required === true || (raw.required === undefined && requirement === true);
  if (typeof raw.state !== 'string' || !raw.state.trim() || !required || raw.required === false) {
    throw new ManagerReadinessError('infra_status_contract_invalid', 502);
  }
  return { state: raw.state.trim(), required: true };
}

export function normalizeManagerInfraStatus(value: unknown): ManagerInfraStatus {
  const raw = plainRecord(value);
  if (raw.ok !== true) throw new ManagerReadinessError('infra_status_contract_invalid', 502);
  const providerStatus = plainRecord(raw.provider_status);
  const providerRequirements = plainRecord(raw.provider_requirements);
  const vercelRaw = plainRecord(providerStatus.vercel);
  const blockers = Array.isArray(raw.blockers)
    ? raw.blockers.map((item) => plainRecord(item)).filter((item) => typeof item.stage === 'string' && typeof item.code === 'string').map((item) => ({
        stage: String(item.stage), code: String(item.code), detail: typeof item.detail === 'string' ? item.detail : ''
      }))
    : [];
  const scope = plainRecord(raw.scope);

  const providers: ManagerInfraStatus['providers'] = {
    github: normalizeRequiredProvider(providerStatus.github, providerRequirements.github),
    supabase: normalizeRequiredProvider(providerStatus.supabase, providerRequirements.supabase),
    cloudflare: normalizeRequiredProvider(providerStatus.cloudflare, providerRequirements.cloudflare),
    production: normalizeRequiredProvider(providerStatus.production, providerRequirements.production)
  };
  if (typeof vercelRaw.state === 'string' && vercelRaw.state.trim() && vercelRaw.required === false) {
    providers.vercel = { state: vercelRaw.state.trim(), required: false };
  }

  return {
    providers,
    blockers,
    organizationId: typeof scope.organization_id === 'string' && scope.organization_id ? scope.organization_id : null
  };
}

export type ProjectedManagerReadiness = {
  taskStatus: 'blocked' | 'completed';
  allRequiredReady: boolean;
  nextAction: string | null;
  blockedReason: string | null;
  steps: Array<{
    key: ProviderKey;
    sequence: number;
    actionType: string;
    title: string;
    evidenceKind: string;
    providerState: string;
    status: 'completed' | 'blocked';
  }>;
};

export function projectManagerReadiness(status: ManagerInfraStatus): ProjectedManagerReadiness {
  const steps = REQUIRED_MANAGER_STEPS.map((definition) => {
    const provider = status.providers[definition.key];
    return {
      ...definition,
      providerState: provider.state,
      status: provider.state === 'ready' ? 'completed' as const : 'blocked' as const
    };
  });
  const firstBlocked = steps.find((step) => step.status === 'blocked') ?? null;
  const blocker = firstBlocked
    ? status.blockers.find((item) => item.stage === firstBlocked.key) ?? null
    : null;
  return {
    taskStatus: firstBlocked ? 'blocked' : 'completed',
    allRequiredReady: !firstBlocked,
    nextAction: firstBlocked?.title ?? null,
    blockedReason: firstBlocked ? blocker?.code || firstBlocked.providerState : null,
    steps
  };
}

type ReadinessContext = {
  userId: string;
  orgId: string;
};

type AuditInput = {
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
};

type SyncDependencies = {
  req: Request;
  context: ReadinessContext;
  requestId: string;
  admin: any;
  supabaseUrl: string;
  publishableKey: string;
  platformTenantId: string;
  appendAudit: (input: AuditInput) => Promise<void>;
};

async function digestEvidence(input: { provider: string; state: string; checkedAt: string }) {
  const payload = JSON.stringify({ provider: input.provider, state: input.state, required: true, checkedAt: input.checkedAt });
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchInfrastructureStatus(deps: SyncDependencies) {
  const response = await fetch(`${deps.supabaseUrl}/functions/v1/atlas-infra-status`, {
    method: 'GET',
    headers: {
      apikey: deps.publishableKey,
      authorization: deps.req.headers.get('authorization') || ''
    }
  });
  if (!response.ok) throw new ManagerReadinessError(`infra_status_${response.status}`, response.status);
  const status = normalizeManagerInfraStatus(await response.json());
  if (status.organizationId && status.organizationId !== deps.context.orgId) {
    throw new ManagerReadinessError('infra_status_scope_mismatch', 403);
  }
  return status;
}

async function findActiveWorkflow(admin: any, orgId: string) {
  const { data, error } = await admin
    .from('execution_workflows')
    .select('*')
    .eq('org_id', orgId)
    .eq('workflow_type', 'manager.infrastructure_readiness')
    .in('status', ['draft', 'now', 'next', 'blocked', 'awaiting_approval', 'delegated', 'automatable', 'failed'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new ManagerReadinessError('persistence_error', 500);
  return data || null;
}

async function createOrLoadWorkflow(deps: SyncDependencies) {
  const existing = await findActiveWorkflow(deps.admin, deps.context.orgId);
  if (existing) return existing;
  const tenantId = deps.platformTenantId.trim();
  if (!tenantId) throw new ManagerReadinessError('platform_tenant_not_configured', 503);

  const { data, error } = await deps.admin.from('execution_workflows').insert({
    org_id: deps.context.orgId,
    tenant_id: tenantId,
    workflow_type: 'manager.infrastructure_readiness',
    owner_module: 'manager',
    status: 'now',
    current_task_id: null,
    current_module: 'manager',
    context: { source: 'atlas-infra-status', mutation_policy: 'read_only', return_path: '/' },
    created_by: deps.context.userId,
    version: 1
  }).select('*').single();

  if (error?.code === '23505') {
    const raced = await findActiveWorkflow(deps.admin, deps.context.orgId);
    if (raced) return raced;
  }
  if (error || !data) throw new ManagerReadinessError('persistence_error', 500);
  return data;
}

async function createOrLoadTask(deps: SyncDependencies, workflow: any) {
  const { data: existing, error: findError } = await deps.admin
    .from('execution_tasks')
    .select('*')
    .eq('org_id', deps.context.orgId)
    .eq('workflow_id', String(workflow.id))
    .eq('module', 'manager')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) throw new ManagerReadinessError('persistence_error', 500);
  if (existing) return existing;

  const { data, error } = await deps.admin.from('execution_tasks').insert({
    org_id: deps.context.orgId,
    tenant_id: String(workflow.tenant_id),
    workflow_id: String(workflow.id),
    module: 'manager',
    owner_user_id: deps.context.userId,
    title: 'Verify infrastructure readiness',
    intent: 'Verify the active ATLAS production path using existing read-only probes',
    goal: 'Produce evidence-backed readiness for GitHub, Supabase, Cloudflare, and public production',
    status: 'now',
    priority: 'high',
    current_step_id: null,
    next_action: null,
    blocked_reason: null,
    permissions_required: ['execution.read'],
    version: 1
  }).select('*').single();
  if (error || !data) throw new ManagerReadinessError('persistence_error', 500);
  return data;
}

async function updateTaskState(deps: SyncDependencies, task: any, status: string, values: Record<string, unknown>, action: string) {
  const previous = String(task.status);
  const nextVersion = Number(task.version || 1) + 1;
  const { data, error } = await deps.admin.from('execution_tasks').update({
    ...values,
    status,
    version: nextVersion,
    updated_at: new Date().toISOString(),
    completed_at: status === 'completed' ? new Date().toISOString() : null
  }).eq('id', String(task.id)).eq('org_id', deps.context.orgId).eq('version', Number(task.version || 1)).select('*').maybeSingle();
  if (error || !data) throw new ManagerReadinessError(error ? 'persistence_error' : 'version_conflict', error ? 500 : 409);
  await deps.appendAudit({
    orgId: deps.context.orgId,
    tenantId: String(task.tenant_id),
    actorUserId: deps.context.userId,
    taskId: String(task.id),
    workflowId: String(task.workflow_id),
    module: 'manager',
    action,
    previousState: previous,
    resultingState: status,
    correlationId: deps.requestId
  });
  return data;
}

async function normalizeTaskForSync(deps: SyncDependencies, task: any) {
  if (String(task.status) !== 'blocked') return task;
  if (!canTransitionTask('blocked', 'now')) throw new ManagerReadinessError('invalid_transition', 409);
  return updateTaskState(deps, task, 'now', { blocked_reason: null }, 'execution.manager.readiness_transition');
}

async function upsertSteps(deps: SyncDependencies, workflow: any, task: any, projection: ProjectedManagerReadiness) {
  const now = new Date().toISOString();
  const rows = projection.steps.map((step) => ({
    org_id: deps.context.orgId,
    tenant_id: String(workflow.tenant_id),
    task_id: String(task.id),
    sequence: step.sequence,
    module: 'manager',
    action_type: step.actionType,
    action_payload: { provider: step.key, source: 'atlas-infra-status', mutation_policy: 'read_only' },
    status: step.status,
    completion_criteria: [`${step.title} is reported ready by atlas-infra-status`],
    permissions_required: ['execution.read'],
    evidence_requirement: [step.evidenceKind],
    completed_at: step.status === 'completed' ? now : null,
    updated_at: now
  }));
  const { data, error } = await deps.admin.from('execution_steps').upsert(rows, { onConflict: 'task_id,sequence' }).select('*');
  if (error || !Array.isArray(data)) throw new ManagerReadinessError('persistence_error', 500);
  return data.sort((a: any, b: any) => Number(a.sequence) - Number(b.sequence));
}

async function recordProviderEvidence(deps: SyncDependencies, workflow: any, task: any, steps: any[], status: ManagerInfraStatus, checkedAt: string) {
  const evidenceIds: string[] = [];
  for (const definition of REQUIRED_MANAGER_STEPS) {
    const step = steps.find((item) => Number(item.sequence) === definition.sequence);
    if (!step) throw new ManagerReadinessError('readiness_step_missing', 500);
    const provider = status.providers[definition.key];
    const digest = await digestEvidence({ provider: definition.key, state: provider.state, checkedAt });
    const reference = `atlas-infra-status:${definition.key}:${digest}`;
    const { data: existing, error: findError } = await deps.admin
      .from('execution_evidence')
      .select('id')
      .eq('org_id', deps.context.orgId)
      .eq('task_id', String(task.id))
      .eq('step_id', String(step.id))
      .eq('kind', definition.evidenceKind)
      .eq('reference', reference)
      .limit(1)
      .maybeSingle();
    if (findError) throw new ManagerReadinessError('persistence_error', 500);
    if (existing?.id) {
      evidenceIds.push(String(existing.id));
      continue;
    }
    const { data: inserted, error } = await deps.admin.from('execution_evidence').insert({
      org_id: deps.context.orgId,
      tenant_id: String(workflow.tenant_id),
      task_id: String(task.id),
      step_id: String(step.id),
      kind: definition.evidenceKind,
      reference,
      verified: provider.state === 'ready'
    }).select('id').single();
    if (error || !inserted) throw new ManagerReadinessError('persistence_error', 500);
    evidenceIds.push(String(inserted.id));
  }
  return evidenceIds;
}

async function completionEligibility(deps: SyncDependencies, task: any, steps: any[]) {
  const [evidenceResult, dependenciesResult] = await Promise.all([
    deps.admin.from('execution_evidence').select('id,kind,verified').eq('org_id', deps.context.orgId).eq('task_id', String(task.id)),
    deps.admin.from('execution_dependencies').select('id').eq('org_id', deps.context.orgId).eq('task_id', String(task.id)).is('resolved_at', null)
  ]);
  if (evidenceResult.error || dependenciesResult.error) throw new ManagerReadinessError('persistence_error', 500);
  return evaluateTaskCompletion({
    steps: steps.map((step: any) => ({
      id: String(step.id),
      status: step.status,
      evidenceRequirement: Array.isArray(step.evidence_requirement) ? step.evidence_requirement : []
    })),
    evidence: (evidenceResult.data || []).map((item: any) => ({ id: String(item.id), kind: String(item.kind), verified: item.verified === true })),
    approvals: [],
    unresolvedDependencies: (dependenciesResult.data || []).map((item: any) => String(item.id))
  });
}

async function mirrorWorkflowState(deps: SyncDependencies, workflow: any, task: any, status: 'now' | 'blocked' | 'completed') {
  const patch: Record<string, unknown> = {
    status,
    current_task_id: String(task.id),
    current_module: 'manager',
    updated_at: new Date().toISOString(),
    version: Number(workflow.version || 1) + 1,
    completed_at: status === 'completed' ? new Date().toISOString() : null
  };
  const { data, error } = await deps.admin.from('execution_workflows').update(patch)
    .eq('id', String(workflow.id)).eq('org_id', deps.context.orgId).eq('version', Number(workflow.version || 1)).select('*').maybeSingle();
  if (error || !data) throw new ManagerReadinessError(error ? 'persistence_error' : 'version_conflict', error ? 500 : 409);
  return data;
}

export async function syncManagerReadiness(deps: SyncDependencies) {
  const checkedAt = new Date().toISOString();
  const status = await fetchInfrastructureStatus(deps);
  const projection = projectManagerReadiness(status);
  let workflow = await createOrLoadWorkflow(deps);
  let task = await createOrLoadTask(deps, workflow);
  task = await normalizeTaskForSync(deps, task);
  const steps = await upsertSteps(deps, workflow, task, projection);
  const current = projection.steps.find((step) => step.status === 'blocked')
    ? steps.find((step: any) => step.status === 'blocked')
    : steps[steps.length - 1];

  const evidenceIds = await recordProviderEvidence(deps, workflow, task, steps, status, checkedAt);

  if (!projection.allRequiredReady) {
    if (String(task.status) !== 'blocked') {
      if (!canTransitionTask(String(task.status) as any, 'blocked')) throw new ManagerReadinessError('invalid_transition', 409);
      task = await updateTaskState(deps, task, 'blocked', {
        current_step_id: String(current?.id || ''),
        next_action: projection.nextAction,
        blocked_reason: projection.blockedReason
      }, 'execution.manager.readiness_transition');
    }
    workflow = await mirrorWorkflowState(deps, workflow, task, 'blocked');
  } else {
    if (String(task.status) !== 'now') {
      if (!canTransitionTask(String(task.status) as any, 'now')) throw new ManagerReadinessError('invalid_transition', 409);
      task = await updateTaskState(deps, task, 'now', {
        current_step_id: String(current?.id || ''), next_action: null, blocked_reason: null
      }, 'execution.manager.readiness_transition');
    } else {
      const { data: refreshed, error } = await deps.admin.from('execution_tasks').update({
        current_step_id: String(current?.id || ''), next_action: null, blocked_reason: null, updated_at: new Date().toISOString()
      }).eq('id', String(task.id)).eq('org_id', deps.context.orgId).select('*').single();
      if (error || !refreshed) throw new ManagerReadinessError('persistence_error', 500);
      task = refreshed;
    }

    const gate = await completionEligibility(deps, task, steps);
    if (gate.eligible) {
      if (!canTransitionTask('now', 'completed')) throw new ManagerReadinessError('invalid_transition', 409);
      task = await updateTaskState(deps, task, 'completed', { next_action: null, blocked_reason: null }, 'execution.manager.readiness_transition');
      workflow = await mirrorWorkflowState(deps, workflow, task, 'completed');
    } else {
      workflow = await mirrorWorkflowState(deps, workflow, task, 'now');
    }
  }

  await deps.appendAudit({
    orgId: deps.context.orgId,
    tenantId: String(workflow.tenant_id),
    actorUserId: deps.context.userId,
    taskId: String(task.id),
    workflowId: String(workflow.id),
    module: 'manager',
    action: 'execution.manager.readiness_synced',
    previousState: null,
    resultingState: String(task.status),
    evidenceIds,
    correlationId: deps.requestId
  });

  return {
    workflow_id: String(workflow.id),
    task_id: String(task.id),
    status: String(task.status),
    checked_at: checkedAt,
    provider_status: Object.fromEntries(REQUIRED_MANAGER_STEPS.map((item) => [item.key, status.providers[item.key].state]))
  };
}
