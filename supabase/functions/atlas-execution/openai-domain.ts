import { digestApprovalPayload } from '../../../packages/execution/src/approvals.ts';
import { evaluateTaskCompletion, canTransitionStep, canTransitionTask } from '../../../packages/execution/src/state-machine.ts';
import { normalizeDnsTxtAnswer, verifyDnsTxt } from '../../../packages/execution/src/dns-verification.ts';
import { getWorkTemplate } from '../../../packages/execution/src/work-templates.ts';
import { evaluateWorkActionPolicy } from '../../../packages/execution/src/work-policy.ts';
import { parseAtlasWorkContext } from '../../../packages/execution/src/work-types.ts';
import { selectWorkRuntime, type WorkRuntime } from '../../../packages/execution/src/work-runtime.ts';
import { sanitizeBrowserResult } from '../../../packages/execution/src/browser-executor.ts';
import { verifyPublicTxt } from './dns-public.ts';
import { enqueueWorkRuntimeJob } from './work-runtime.ts';

export class OpenAiDomainPilotError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code);
  }
}

export type PilotContext = {
  userId: string;
  orgId: string;
  tenantId: string;
  permissions: string[];
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

type PilotDeps = {
  admin: any;
  context: PilotContext;
  requestId: string;
  appendAudit: (input: AuditInput) => Promise<void>;
};

export type DnsMutationPort = {
  readTxt(input: { domain: string; name: string }): Promise<string[]>;
  createTxt(input: { domain: string; name: string; value: string }): Promise<{ providerRecordId: string }>;
};

export type PilotExecutionOptions = {
  dnsPort?: DnsMutationPort | null;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

const DNS_MUTATION_STEP = { action_type: 'create_dns_txt' } as const;
const OPENAI_DOMAIN = 'atlasenterprisesuite.com';

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function text(value: unknown, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function strings(value: unknown, max = 40) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, 240)).filter(Boolean))].slice(0, max);
}

function nowIso(options?: PilotExecutionOptions) {
  return (options?.now?.() ?? new Date()).toISOString();
}

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function reviewedAction(task: any, step: any) {
  return {
    taskId: String(task.id),
    workflowId: String(task.workflow_id),
    module: String(step.module),
    stepId: String(step.id),
    actionType: String(step.action_type),
    actionPayload: record(step.action_payload)
  };
}

function serverCapabilityFor(actionType: string, mutation: boolean, sensitivity: string) {
  const internalReadActions = new Set(['resolve_authoritative_dns_provider', 'inspect_dns_state', 'verify_provider_dns_state', 'verify_public_dns_txt', 'record_completion_evidence']);
  const openAiBrowserActions = new Set(['observe_openai_verification_requirement', 'open_openai_domain_verification', 'click_openai_check', 'verify_openai_domain_state']);
  return {
    api_available: internalReadActions.has(actionType),
    api_authorized: internalReadActions.has(actionType),
    browser_available: openAiBrowserActions.has(actionType),
    browser_authorized: false,
    runtime_available: false,
    browser_envelope_allowed: false,
    mutation,
    reversible: true,
    sensitivity,
    paid_cost: 0,
    regulated: false
  };
}

async function compensateCreation(admin: any, orgId: string, workflowId: string, taskId?: string | null) {
  if (taskId) {
    await admin.from('execution_steps').delete().eq('org_id', orgId).eq('task_id', taskId);
    await admin.from('execution_tasks').delete().eq('org_id', orgId).eq('id', taskId);
  }
  await admin.from('execution_workflows').delete().eq('org_id', orgId).eq('id', workflowId);
}

export async function createOpenAiDomainTemplate(
  deps: PilotDeps,
  templateId: string,
  inputs: Record<string, unknown>
) {
  if (templateId !== 'manager.openai_domain_verification') throw new OpenAiDomainPilotError('work_template_not_found', 404);
  const template = getWorkTemplate(templateId);
  if (!template) throw new OpenAiDomainPilotError('work_template_not_found', 404);
  const domain = text(inputs.domain, 253).toLowerCase();
  if (domain !== OPENAI_DOMAIN) throw new OpenAiDomainPilotError('pilot_domain_not_supported', 422);

  const work = { ...template.defaults, connectionRefs: [] as string[] };
  const { data: workflow, error: workflowError } = await deps.admin.from('execution_workflows').insert({
    org_id: deps.context.orgId,
    tenant_id: deps.context.tenantId,
    workflow_type: templateId,
    owner_module: template.ownerModule,
    status: 'now',
    current_task_id: null,
    current_module: template.ownerModule,
    context: { work, templateId, inputs: { domain } },
    created_by: deps.context.userId,
    version: 1
  }).select('*').single();
  if (workflowError || !workflow) throw new OpenAiDomainPilotError('persistence_error', 500);

  let taskId: string | null = null;
  try {
    const { data: task, error: taskError } = await deps.admin.from('execution_tasks').insert({
      org_id: deps.context.orgId,
      tenant_id: deps.context.tenantId,
      workflow_id: String(workflow.id),
      module: 'manager',
      owner_user_id: deps.context.userId,
      title: 'Verify atlasenterprisesuite.com with OpenAI',
      intent: 'Verify atlasenterprisesuite.com with OpenAI using the current live verification requirement',
      goal: 'OpenAI reports verified and required non-secret evidence is persisted',
      status: 'now',
      priority: 'high',
      current_step_id: null,
      next_action: template.steps[0]?.title || null,
      blocked_reason: null,
      permissions_required: ['execution.write'],
      version: 1
    }).select('*').single();
    if (taskError || !task) throw new OpenAiDomainPilotError('persistence_error', 500);
    taskId = String(task.id);

    const stepRows = template.steps.map((step, index) => ({
      org_id: deps.context.orgId,
      tenant_id: deps.context.tenantId,
      task_id: taskId,
      sequence: index + 1,
      module: 'manager',
      action_type: step.actionType,
      action_payload: {
        domain,
        execution_capabilities: serverCapabilityFor(step.actionType, step.mutation, step.sensitivity)
      },
      status: index === 0 ? 'ready' : 'pending',
      completion_criteria: step.completionCriteria,
      permissions_required: step.permissionsRequired,
      evidence_requirement: step.evidenceRequirement
    }));
    const { data: steps, error: stepsError } = await deps.admin.from('execution_steps').insert(stepRows).select('*');
    if (stepsError || !steps?.length) throw new OpenAiDomainPilotError('persistence_error', 500);
    const firstStep = steps.find((step: any) => Number(step.sequence) === 1) || steps[0];

    const [{ error: taskUpdateError }, { error: workflowUpdateError }] = await Promise.all([
      deps.admin.from('execution_tasks').update({ current_step_id: firstStep.id, updated_at: new Date().toISOString() }).eq('id', taskId).eq('org_id', deps.context.orgId),
      deps.admin.from('execution_workflows').update({ current_task_id: taskId, updated_at: new Date().toISOString() }).eq('id', workflow.id).eq('org_id', deps.context.orgId)
    ]);
    if (taskUpdateError || workflowUpdateError) throw new OpenAiDomainPilotError('persistence_error', 500);

    await deps.appendAudit({
      orgId: deps.context.orgId,
      tenantId: deps.context.tenantId,
      actorUserId: deps.context.userId,
      taskId,
      workflowId: String(workflow.id),
      module: 'manager',
      action: 'execution.workflow.created',
      previousState: null,
      resultingState: 'now',
      correlationId: deps.requestId
    });

    return { workflowId: String(workflow.id), taskId, firstStepId: String(firstStep.id) };
  } catch (error) {
    await compensateCreation(deps.admin, deps.context.orgId, String(workflow.id), taskId);
    if (error instanceof OpenAiDomainPilotError) throw error;
    throw new OpenAiDomainPilotError('persistence_error', 500);
  }
}

async function loadPilotState(deps: PilotDeps, taskId: string) {
  const { data: task, error: taskError } = await deps.admin
    .from('execution_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('org_id', deps.context.orgId)
    .eq('tenant_id', deps.context.tenantId)
    .maybeSingle();
  if (taskError) throw new OpenAiDomainPilotError('persistence_error', 500);
  if (!task) throw new OpenAiDomainPilotError('task_not_found', 404);

  const { data: workflow, error: workflowError } = await deps.admin
    .from('execution_workflows')
    .select('*')
    .eq('id', String(task.workflow_id))
    .eq('org_id', deps.context.orgId)
    .eq('tenant_id', deps.context.tenantId)
    .maybeSingle();
  if (workflowError) throw new OpenAiDomainPilotError('persistence_error', 500);
  if (!workflow || String(workflow.workflow_type) !== 'manager.openai_domain_verification') {
    throw new OpenAiDomainPilotError('pilot_workflow_required', 409);
  }

  const { data: steps, error: stepsError } = await deps.admin
    .from('execution_steps')
    .select('*')
    .eq('task_id', taskId)
    .eq('org_id', deps.context.orgId)
    .eq('tenant_id', deps.context.tenantId)
    .order('sequence', { ascending: true });
  if (stepsError) throw new OpenAiDomainPilotError('persistence_error', 500);
  const current = (steps || []).find((step: any) => String(step.id) === String(task.current_step_id));
  if (!current) throw new OpenAiDomainPilotError('current_action_required', 409);
  return { task, workflow, steps: steps || [], step: current };
}

function requireStepPermissions(deps: PilotDeps, step: any) {
  const required = strings(step.permissions_required);
  const allowed = required.every((permission) => deps.context.permissions.includes(permission) || deps.context.permissions.includes('execution.admin'));
  if (!allowed) throw new OpenAiDomainPilotError('permission_required', 403);
}

async function setStepStatus(deps: PilotDeps, step: any, target: string, options?: PilotExecutionOptions) {
  const current = String(step.status);
  if (current === target) return step;
  if (!canTransitionStep(current as any, target as any)) throw new OpenAiDomainPilotError('invalid_step_transition', 409);
  const updates: Record<string, unknown> = { status: target, updated_at: nowIso(options) };
  if (target === 'running') updates.started_at = nowIso(options);
  if (target === 'completed') updates.completed_at = nowIso(options);
  const { data, error } = await deps.admin
    .from('execution_steps')
    .update(updates)
    .eq('id', String(step.id))
    .eq('task_id', String(step.task_id))
    .eq('org_id', deps.context.orgId)
    .eq('tenant_id', deps.context.tenantId)
    .eq('status', current)
    .select('*')
    .maybeSingle();
  if (error) throw new OpenAiDomainPilotError('persistence_error', 500);
  if (!data) throw new OpenAiDomainPilotError('step_state_conflict', 409);
  return data;
}

async function finishStepAndAdvance(deps: PilotDeps, state: any, options?: PilotExecutionOptions) {
  const completed = await setStepStatus(deps, state.step, 'completed', options);
  const next = state.steps.find((candidate: any) => Number(candidate.sequence) === Number(state.step.sequence) + 1) || null;
  if (next) {
    if (String(next.status) !== 'pending') throw new OpenAiDomainPilotError('next_step_state_conflict', 409);
    const { data: ready, error: readyError } = await deps.admin
      .from('execution_steps')
      .update({ status: 'ready', updated_at: nowIso(options) })
      .eq('id', String(next.id))
      .eq('task_id', String(state.task.id))
      .eq('org_id', deps.context.orgId)
      .eq('tenant_id', deps.context.tenantId)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    if (readyError || !ready) throw new OpenAiDomainPilotError('persistence_error', 500);
  }

  const currentStatus = String(state.task.status);
  const taskStatus = ['blocked', 'awaiting_approval', 'failed'].includes(currentStatus) ? 'now' : currentStatus;
  const version = Number(state.task.version || 1) + 1;
  const { error: taskError } = await deps.admin
    .from('execution_tasks')
    .update({
      status: taskStatus,
      current_step_id: next ? String(next.id) : null,
      next_action: next ? String(next.action_type) : null,
      blocked_reason: null,
      version,
      updated_at: nowIso(options)
    })
    .eq('id', String(state.task.id))
    .eq('org_id', deps.context.orgId)
    .eq('tenant_id', deps.context.tenantId);
  if (taskError) throw new OpenAiDomainPilotError('persistence_error', 500);

  await deps.appendAudit({
    orgId: deps.context.orgId,
    tenantId: deps.context.tenantId,
    actorUserId: deps.context.userId,
    taskId: String(state.task.id),
    workflowId: String(state.workflow.id),
    module: 'manager',
    action: 'execution.step.completed',
    previousState: String(state.step.status),
    resultingState: 'completed',
    correlationId: deps.requestId
  });
  return { completed, nextStepId: next ? String(next.id) : null };
}

async function blockCurrentStep(deps: PilotDeps, state: any, reason: string, options?: PilotExecutionOptions) {
  let step = state.step;
  if (String(step.status) === 'running' || String(step.status) === 'ready' || String(step.status) === 'awaiting_approval') {
    step = await setStepStatus(deps, step, 'blocked', options);
  }
  const currentStatus = String(state.task.status);
  if (currentStatus !== 'blocked') {
    if (!canTransitionTask(currentStatus as any, 'blocked')) throw new OpenAiDomainPilotError('invalid_transition', 409);
    const { error } = await deps.admin.from('execution_tasks').update({
      status: 'blocked', blocked_reason: reason, version: Number(state.task.version || 1) + 1, updated_at: nowIso(options)
    }).eq('id', String(state.task.id)).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId);
    if (error) throw new OpenAiDomainPilotError('persistence_error', 500);
  }
  return { state: 'blocked' as const, reason };
}

async function findStep(state: any, actionType: string) {
  const step = state.steps.find((candidate: any) => String(candidate.action_type) === actionType);
  if (!step) throw new OpenAiDomainPilotError('pilot_step_missing', 500);
  return step;
}

async function updateStepPayload(deps: PilotDeps, step: any, payload: Record<string, unknown>) {
  const { data, error } = await deps.admin.from('execution_steps').update({
    action_payload: payload,
    updated_at: new Date().toISOString()
  }).eq('id', String(step.id)).eq('task_id', String(step.task_id)).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId).select('*').maybeSingle();
  if (error || !data) throw new OpenAiDomainPilotError('persistence_error', 500);
  return data;
}

async function requestExactApproval(deps: PilotDeps, state: any, approvalType: string, options?: PilotExecutionOptions) {
  let task = state.task;
  let step = state.step;
  const nextVersion = String(task.status) === 'awaiting_approval' ? Number(task.version) : Number(task.version) + 1;

  if (String(step.status) === 'ready') step = await setStepStatus(deps, step, 'awaiting_approval', options);
  if (String(task.status) !== 'awaiting_approval') {
    const update = { status: 'awaiting_approval', version: nextVersion, updated_at: nowIso(options) };
    const { data: updatedTask, error } = await deps.admin.from('execution_tasks').update(update)
      .eq('id', String(task.id)).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId)
      .eq('version', Number(task.version)).select('*').maybeSingle();
    if (error || !updatedTask) throw new OpenAiDomainPilotError('version_conflict', 409);
    task = updatedTask;
  }

  const payloadDigest = await digestApprovalPayload({ payloadVersion: nextVersion, payload: reviewedAction(task, step) });
  await deps.admin.from('execution_approvals').update({ status: 'expired' })
    .eq('task_id', String(task.id)).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId)
    .eq('status', 'pending').neq('payload_digest', payloadDigest);

  const { data: existing, error: existingError } = await deps.admin.from('execution_approvals').select('*')
    .eq('task_id', String(task.id)).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId)
    .eq('status', 'pending').eq('payload_version', nextVersion).eq('payload_digest', payloadDigest).limit(1).maybeSingle();
  if (existingError) throw new OpenAiDomainPilotError('persistence_error', 500);
  if (existing) return existing;

  const { data: approval, error } = await deps.admin.from('execution_approvals').insert({
    org_id: deps.context.orgId,
    tenant_id: deps.context.tenantId,
    task_id: String(task.id),
    workflow_id: String(task.workflow_id),
    module: 'manager',
    requested_by: deps.context.userId,
    approval_type: approvalType,
    required_permission: 'execution.approve',
    risk_level: 'high',
    summary: `Approve ${String(step.action_type)} for ${OPENAI_DOMAIN}`,
    payload_version: nextVersion,
    payload_digest: payloadDigest,
    status: 'pending'
  }).select('*').single();
  if (error || !approval) throw new OpenAiDomainPilotError('persistence_error', 500);
  return approval;
}

async function requireExactApprovedApproval(deps: PilotDeps, state: any) {
  const expectedDigest = await digestApprovalPayload({
    payloadVersion: Number(state.task.version),
    payload: reviewedAction(state.task, state.step)
  });
  const { data, error } = await deps.admin.from('execution_approvals').select('*')
    .eq('task_id', String(state.task.id)).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId)
    .eq('status', 'approved').order('decided_at', { ascending: false });
  if (error) throw new OpenAiDomainPilotError('persistence_error', 500);
  const approvals = data || [];
  const match = approvals.find((approval: any) => Number(approval.payload_version) === Number(state.task.version) && String(approval.payload_digest) === expectedDigest);
  if (match) return match;
  if (approvals.length) throw new OpenAiDomainPilotError('approval_binding_mismatch', 409);
  return null;
}

async function listEligibleBrowserRuntimes(deps: PilotDeps): Promise<WorkRuntime[]> {
  const { data, error } = await deps.admin.from('execution_runtime_registrations')
    .select('id,kind,status,capabilities,last_seen_at')
    .eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId).eq('status', 'online');
  if (error) throw new OpenAiDomainPilotError('persistence_error', 500);
  return (data || []).map((runtime: any) => ({
    id: String(runtime.id), kind: runtime.kind, status: runtime.status,
    capabilities: strings(runtime.capabilities), lastSeenAt: runtime.last_seen_at ? String(runtime.last_seen_at) : null
  }));
}

async function hasBrowserConnection(deps: PilotDeps, provider: string) {
  const candidates = [provider.toLowerCase(), provider.toLowerCase() === 'openai' ? 'chatgpt' : provider.toLowerCase()];
  const { data, error } = await deps.admin.from('execution_connection_refs').select('id,provider,mechanism,status,capabilities')
    .eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId).eq('status', 'active').in('provider', candidates);
  if (error) throw new OpenAiDomainPilotError('persistence_error', 500);
  return (data || []).some((connection: any) => ['session', 'oauth', 'vault'].includes(String(connection.mechanism)));
}

async function queueBrowserAction(deps: PilotDeps, state: any, input: {
  provider: string;
  domain: string;
  action: any;
  allowedActions: string[];
  deniedActions?: string[];
  options?: PilotExecutionOptions;
}) {
  if (!await hasBrowserConnection(deps, input.provider)) return null;
  const work = parseAtlasWorkContext({ work: record(state.workflow.context).work });
  const runtimes = await listEligibleBrowserRuntimes(deps);
  const selection = selectWorkRuntime({ preference: work.runtimePreference, requiredCapabilities: ['browser'], runtimes }, input.options?.now?.() ?? new Date());
  if (selection.state !== 'ready' || !selection.runtimeKind) return null;
  const expiresAt = new Date((input.options?.now?.() ?? new Date()).getTime() + 15 * 60_000).toISOString();
  const envelope = {
    workflowId: String(state.workflow.id), stepId: String(state.step.id), tenantId: deps.context.tenantId, organizationId: deps.context.orgId,
    allowedDomains: [input.domain], allowedActions: input.allowedActions,
    deniedActions: input.deniedActions || ['delete_dns_record', 'change_nameservers', 'purchase'],
    autonomyLevel: work.autonomyLevel, expiresAt
  };
  const job = await enqueueWorkRuntimeJob(deps.admin, deps.context, {
    workflowId: String(state.workflow.id), taskId: String(state.task.id), stepId: String(state.step.id),
    runtimeKind: selection.runtimeKind, envelope, action: input.action,
    route: { state: 'ready', mechanism: 'browser' }, policy: { outcome: 'allow' }
  });
  return job;
}

async function latestRuntimeJob(deps: PilotDeps, state: any) {
  const { data, error } = await deps.admin.from('execution_runtime_jobs').select('*')
    .eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId)
    .eq('workflow_id', String(state.workflow.id)).eq('task_id', String(state.task.id)).eq('step_id', String(state.step.id))
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new OpenAiDomainPilotError('persistence_error', 500);
  return data || null;
}

async function consumeVerificationRequirement(deps: PilotDeps, state: any, result: any) {
  const raw = record(result);
  const domain = text(raw.domain, 253).toLowerCase();
  const hostname = text(raw.hostname || raw.name || domain, 253).toLowerCase();
  const recordType = text(raw.recordType || raw.type, 20).toUpperCase();
  const verificationValue = text(raw.verificationValue || raw.value, 1000);
  if (domain !== OPENAI_DOMAIN || !hostname || recordType !== 'TXT' || !verificationValue) {
    throw new OpenAiDomainPilotError('openai_requirement_invalid', 422);
  }
  const valueDigest = await sha256Text(verificationValue);
  const prepareStep = await findStep(state, 'prepare_dns_txt_mutation');
  await updateStepPayload(deps, prepareStep, {
    domain, hostname, type: 'TXT', value: verificationValue,
    value_digest: valueDigest,
    observed_at: text(raw.observedAt || nowIso(), 80),
    execution_capabilities: serverCapabilityFor('prepare_dns_txt_mutation', false, 'high')
  });
  const job = await latestRuntimeJob(deps, state);
  if (job) {
    await deps.admin.from('execution_runtime_jobs').update({
      sanitized_result: { domain, recordType: 'TXT', valueDigest, observedAt: text(raw.observedAt || nowIso(), 80) },
      updated_at: new Date().toISOString()
    }).eq('id', String(job.id)).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId);
  }
}

async function resolveDnsProvider(domain: string, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`, { headers: { accept: 'application/dns-json' } });
  if (!response.ok) throw new OpenAiDomainPilotError('dns_provider_resolution_unavailable', 502);
  let body: any;
  try { body = await response.json(); } catch { throw new OpenAiDomainPilotError('dns_provider_resolution_unavailable', 502); }
  const nameservers = Array.isArray(body?.Answer)
    ? body.Answer.filter((answer: any) => Number(answer?.type) === 2 && typeof answer?.data === 'string').map((answer: any) => String(answer.data).toLowerCase().replace(/\.$/, ''))
    : [];
  const joined = nameservers.join(' ');
  if (joined.includes('cloudflare.com')) return { provider: 'cloudflare', browserDomain: 'dash.cloudflare.com', nameservers };
  if (joined.includes('domaincontrol.com')) return { provider: 'godaddy', browserDomain: 'godaddy.com', nameservers };
  if (joined.includes('registrar-servers.com')) return { provider: 'namecheap', browserDomain: 'namecheap.com', nameservers };
  return { provider: 'unknown', browserDomain: null, nameservers };
}

async function readPublicTxt(hostname: string, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=TXT`, { headers: { accept: 'application/dns-json' } });
  if (!response.ok) throw new OpenAiDomainPilotError('dns_resolver_unavailable', 502);
  let body: any;
  try { body = await response.json(); } catch { throw new OpenAiDomainPilotError('dns_resolver_unavailable', 502); }
  return Array.isArray(body?.Answer)
    ? body.Answer.filter((answer: any) => Number(answer?.type) === 16 && typeof answer?.data === 'string').map((answer: any) => normalizeDnsTxtAnswer(String(answer.data)))
    : [];
}

async function recordVerifiedEvidence(deps: PilotDeps, state: any, kind: string, reference: Record<string, unknown>) {
  const existingResult = await deps.admin.from('execution_evidence').select('id')
    .eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId).eq('task_id', String(state.task.id)).eq('kind', kind).eq('verified', true).limit(1).maybeSingle();
  if (existingResult.error) throw new OpenAiDomainPilotError('persistence_error', 500);
  if (existingResult.data) return String(existingResult.data.id);
  const { data, error } = await deps.admin.from('execution_evidence').insert({
    org_id: deps.context.orgId,
    tenant_id: deps.context.tenantId,
    task_id: String(state.task.id),
    step_id: String(state.step.id),
    kind,
    reference: JSON.stringify(sanitizeBrowserResult(reference)),
    verified: true
  }).select('id').single();
  if (error || !data) throw new OpenAiDomainPilotError('persistence_error', 500);
  await deps.appendAudit({
    orgId: deps.context.orgId, tenantId: deps.context.tenantId, actorUserId: deps.context.userId,
    taskId: String(state.task.id), workflowId: String(state.workflow.id), module: 'manager',
    action: 'execution.evidence.verified', previousState: String(state.step.status), resultingState: String(state.step.status),
    evidenceIds: [String(data.id)], correlationId: deps.requestId
  });
  return String(data.id);
}

async function currentDnsMutation(deps: PilotDeps, state: any) {
  const step = state.steps.find((candidate: any) => String(candidate.action_type) === DNS_MUTATION_STEP.action_type);
  if (!step) throw new OpenAiDomainPilotError('pilot_step_missing', 500);
  const payload = record(step.action_payload);
  const domain = text(payload.domain, 253).toLowerCase();
  const name = text(payload.name || payload.hostname, 253).toLowerCase();
  const value = text(payload.value, 1000);
  if (domain !== OPENAI_DOMAIN || !name || text(payload.type, 20).toUpperCase() !== 'TXT' || !value) throw new OpenAiDomainPilotError('dns_mutation_not_prepared', 409);
  return { step, domain, name, value, valueDigest: text(payload.value_digest, 64), provider: text(payload.provider, 100).toLowerCase(), browserDomain: text(payload.browser_domain, 253).toLowerCase() || null };
}

async function prepareDnsMutation(deps: PilotDeps, state: any, options?: PilotExecutionOptions) {
  const payload = record(state.step.action_payload);
  const domain = text(payload.domain, 253).toLowerCase();
  const hostname = text(payload.hostname, 253).toLowerCase();
  const value = text(payload.value, 1000);
  const valueDigest = text(payload.value_digest, 64) || await sha256Text(value);
  if (domain !== OPENAI_DOMAIN || !hostname || text(payload.type, 20).toUpperCase() !== 'TXT' || !value) throw new OpenAiDomainPilotError('openai_requirement_missing', 409);

  const providerStep = await findStep(state, 'resolve_authoritative_dns_provider');
  const providerPayload = record(providerStep.action_payload);
  const provider = text(providerPayload.provider, 100).toLowerCase();
  const browserDomain = text(providerPayload.browser_domain, 253).toLowerCase() || null;
  const mutationStep = await findStep(state, DNS_MUTATION_STEP.action_type);
  const canBrowser = Boolean(browserDomain && await hasBrowserConnection(deps, provider));
  const runtimes = canBrowser ? await listEligibleBrowserRuntimes(deps) : [];
  const work = parseAtlasWorkContext({ work: record(state.workflow.context).work });
  const runtime = selectWorkRuntime({ preference: work.runtimePreference, requiredCapabilities: ['browser'], runtimes }, options?.now?.() ?? new Date());
  await updateStepPayload(deps, mutationStep, {
    domain, name: hostname, type: 'TXT', value, value_digest: valueDigest, provider, browser_domain: browserDomain,
    execution_capabilities: {
      api_available: Boolean(options?.dnsPort), api_authorized: Boolean(options?.dnsPort),
      browser_available: canBrowser, browser_authorized: canBrowser, runtime_available: runtime.state === 'ready',
      browser_envelope_allowed: canBrowser && runtime.state === 'ready', mutation: true, reversible: true,
      sensitivity: 'high', paid_cost: 0, regulated: false
    }
  });
  await updateStepPayload(deps, state.step, { domain, type: 'TXT', value_digest: valueDigest, prepared: true, execution_capabilities: serverCapabilityFor('prepare_dns_txt_mutation', false, 'high') });
  return finishStepAndAdvance(deps, state, options);
}

async function executeDnsMutation(deps: PilotDeps, state: any, options?: PilotExecutionOptions) {
  const mutation = await currentDnsMutation(deps, state);
  const work = parseAtlasWorkContext({ work: record(state.workflow.context).work });
  const permissionsSatisfied = strings(state.step.permissions_required).every((permission) => deps.context.permissions.includes(permission) || deps.context.permissions.includes('execution.admin'));
  const policy = evaluateWorkActionPolicy({
    autonomyLevel: work.autonomyLevel, sensitivity: 'high', reversible: true, mutation: true,
    paidCost: 0, budgetLimit: work.budgetLimit, permissionsSatisfied, envelopeAllowed: true, regulated: false
  });
  if (policy.outcome === 'deny') throw new OpenAiDomainPilotError(policy.reason, 403);

  if (policy.outcome === 'require_approval') {
    const approved = await requireExactApprovedApproval(deps, state);
    if (!approved) {
      const approval = await requestExactApproval(deps, state, 'dns_txt_mutation', options);
      return { state: 'awaiting_approval' as const, approvalId: String(approval.id) };
    }
  }

  const fresh = await loadPilotState(deps, String(state.task.id));
  if (String(fresh.task.status) === 'awaiting_approval') {
    const { data: updated, error } = await deps.admin.from('execution_tasks').update({
      status: 'now', version: Number(fresh.task.version) + 1, updated_at: nowIso(options)
    }).eq('id', String(fresh.task.id)).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId)
      .eq('version', Number(fresh.task.version)).select('*').maybeSingle();
    if (error || !updated) throw new OpenAiDomainPilotError('version_conflict', 409);
    if (String(fresh.step.status) === 'awaiting_approval') fresh.step = await setStepStatus(deps, fresh.step, 'ready', options);
    fresh.task = updated;
  }
  if (String(fresh.step.status) === 'ready') fresh.step = await setStepStatus(deps, fresh.step, 'running', options);

  if (options?.dnsPort) {
    const existing = await options.dnsPort.readTxt({ domain: mutation.domain, name: mutation.name });
    if (verifyDnsTxt(mutation.value, existing).verified) {
      await recordVerifiedEvidence(deps, fresh, 'dns_txt_write', { domain: mutation.domain, hostname: mutation.name, valueDigest: mutation.valueDigest, mechanism: 'provider_readback', reconciled: true, observedAt: nowIso(options) });
      await finishStepAndAdvance(deps, fresh, options);
      return { state: 'completed' as const, reason: 'dns_record_already_present' };
    }
    const result = await options.dnsPort.createTxt({ domain: mutation.domain, name: mutation.name, value: mutation.value });
    await recordVerifiedEvidence(deps, fresh, 'dns_txt_write', { domain: mutation.domain, hostname: mutation.name, valueDigest: mutation.valueDigest, mechanism: 'api', providerRecordId: result.providerRecordId, observedAt: nowIso(options) });
    await finishStepAndAdvance(deps, fresh, options);
    return { state: 'completed' as const, mechanism: 'api' };
  }

  if (mutation.provider && mutation.browserDomain && await hasBrowserConnection(deps, mutation.provider)) {
    const job = await queueBrowserAction(deps, fresh, {
      provider: mutation.provider,
      domain: mutation.browserDomain,
      allowedActions: ['create_dns_txt'],
      deniedActions: ['delete_dns_record', 'change_nameservers', 'purchase'],
      action: { type: 'create_dns_txt', domain: mutation.browserDomain, metadata: { zone: mutation.domain, name: mutation.name, type: 'TXT' }, value: mutation.value },
      options
    });
    if (job) return { state: 'running' as const, mechanism: 'browser', jobId: String(job.id) };
  }

  return blockCurrentStep(deps, fresh, 'dns_execution_capability_missing', options);
}

async function queueOpenAiStep(deps: PilotDeps, state: any, actionType: string, options?: PilotExecutionOptions) {
  const action = actionType === 'click_openai_check'
    ? { type: 'click_openai_check', domain: 'chatgpt.com', target: 'domain-verification-check', metadata: { domain: OPENAI_DOMAIN } }
    : actionType === 'open_openai_domain_verification'
      ? { type: 'navigate', domain: 'chatgpt.com', target: 'domain-verification', metadata: { domain: OPENAI_DOMAIN } }
      : { type: 'read_text', domain: 'chatgpt.com', target: actionType, metadata: { domain: OPENAI_DOMAIN } };

  const allowedActions = action.type === 'click_openai_check' ? ['click_openai_check'] : action.type === 'navigate' ? ['navigate'] : ['read_text'];

  if (!await hasBrowserConnection(deps, 'openai')) {
    return blockCurrentStep(deps, state, 'openai_authorized_session_missing', options);
  }

  const work = parseAtlasWorkContext({ work: record(state.workflow.context).work });
  const runtimes = await listEligibleBrowserRuntimes(deps);
  const selection = selectWorkRuntime(
    { preference: work.runtimePreference, requiredCapabilities: ['browser'], runtimes },
    options?.now?.() ?? new Date()
  );
  if (selection.state !== 'ready') {
    return blockCurrentStep(deps, state, 'openai_browser_runtime_missing', options);
  }

  const job = await queueBrowserAction(deps, state, { provider: 'openai', domain: 'chatgpt.com', action, allowedActions, options });
  if (!job) return blockCurrentStep(deps, state, 'openai_browser_execution_unavailable', options);
  if (String(state.step.status) === 'ready') await setStepStatus(deps, state.step, 'running', options);
  return { state: 'running' as const, mechanism: 'browser', jobId: String(job.id) };
}

export async function executeOpenAiDomainStep(deps: PilotDeps, taskId: string, options: PilotExecutionOptions = {}) {
  const state = await loadPilotState(deps, taskId);
  requireStepPermissions(deps, state.step);
  const actionType = String(state.step.action_type);
  if (!['ready', 'blocked', 'awaiting_approval'].includes(String(state.step.status))) throw new OpenAiDomainPilotError('step_not_executable', 409);

  if (String(state.step.status) === 'blocked') {
    state.step = await setStepStatus(deps, state.step, 'ready', options);
    if (String(state.task.status) === 'blocked') {
      const { data, error } = await deps.admin.from('execution_tasks').update({ status: 'now', blocked_reason: null, version: Number(state.task.version) + 1, updated_at: nowIso(options) })
        .eq('id', String(state.task.id)).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId).select('*').maybeSingle();
      if (error || !data) throw new OpenAiDomainPilotError('persistence_error', 500);
      state.task = data;
    }
  }

  if (actionType === 'observe_openai_verification_requirement' || actionType === 'open_openai_domain_verification' || actionType === 'verify_openai_domain_state') {
    return queueOpenAiStep(deps, state, actionType, options);
  }

  if (actionType === 'click_openai_check') {
    const work = parseAtlasWorkContext({ work: record(state.workflow.context).work });
    const policy = evaluateWorkActionPolicy({ autonomyLevel: work.autonomyLevel, sensitivity: 'high', reversible: true, mutation: true, paidCost: 0, budgetLimit: work.budgetLimit, permissionsSatisfied: true, envelopeAllowed: true, regulated: false });
    if (policy.outcome === 'require_approval') {
      const approved = await requireExactApprovedApproval(deps, state);
      if (!approved) {
        const approval = await requestExactApproval(deps, state, 'openai_verification_check', options);
        return { state: 'awaiting_approval' as const, approvalId: String(approval.id) };
      }
      const fresh = await loadPilotState(deps, taskId);
      if (String(fresh.task.status) === 'awaiting_approval') {
        const { data, error } = await deps.admin.from('execution_tasks').update({ status: 'now', version: Number(fresh.task.version) + 1, updated_at: nowIso(options) })
          .eq('id', String(fresh.task.id)).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId).eq('version', Number(fresh.task.version)).select('*').maybeSingle();
        if (error || !data) throw new OpenAiDomainPilotError('version_conflict', 409);
        fresh.task = data;
        if (String(fresh.step.status) === 'awaiting_approval') fresh.step = await setStepStatus(deps, fresh.step, 'ready', options);
      }
      return queueOpenAiStep(deps, fresh, actionType, options);
    }
    return queueOpenAiStep(deps, state, actionType, options);
  }

  if (actionType === 'resolve_authoritative_dns_provider') {
    state.step = await setStepStatus(deps, state.step, 'running', options);
    const result = await resolveDnsProvider(OPENAI_DOMAIN, options.fetchImpl ?? fetch);
    await updateStepPayload(deps, state.step, { domain: OPENAI_DOMAIN, provider: result.provider, browser_domain: result.browserDomain, nameservers: result.nameservers, execution_capabilities: serverCapabilityFor(actionType, false, 'medium') });
    state.step.action_payload = { domain: OPENAI_DOMAIN, provider: result.provider, browser_domain: result.browserDomain, nameservers: result.nameservers };
    await finishStepAndAdvance(deps, state, options);
    return { state: 'completed' as const, provider: result.provider };
  }

  if (actionType === 'inspect_dns_state') {
    state.step = await setStepStatus(deps, state.step, 'running', options);
    const prepare = await findStep(state, 'prepare_dns_txt_mutation');
    const requirement = record(prepare.action_payload);
    const hostname = text(requirement.hostname || OPENAI_DOMAIN, 253).toLowerCase();
    const answers = options.dnsPort ? await options.dnsPort.readTxt({ domain: OPENAI_DOMAIN, name: hostname }) : await readPublicTxt(hostname, options.fetchImpl ?? fetch);
    await updateStepPayload(deps, state.step, { domain: OPENAI_DOMAIN, hostname, answer_count: answers.length, inspected_at: nowIso(options), execution_capabilities: serverCapabilityFor(actionType, false, 'medium') });
    await finishStepAndAdvance(deps, state, options);
    return { state: 'completed' as const, answerCount: answers.length };
  }

  if (actionType === 'prepare_dns_txt_mutation') {
    state.step = await setStepStatus(deps, state.step, 'running', options);
    return prepareDnsMutation(deps, state, options);
  }

  if (actionType === 'create_dns_txt') return executeDnsMutation(deps, state, options);

  if (actionType === 'verify_provider_dns_state') {
    state.step = await setStepStatus(deps, state.step, 'running', options);
    const mutation = await currentDnsMutation(deps, state);
    const answers = options.dnsPort ? await options.dnsPort.readTxt({ domain: mutation.domain, name: mutation.name }) : await readPublicTxt(mutation.name, options.fetchImpl ?? fetch);
    if (!verifyDnsTxt(mutation.value, answers).verified) return blockCurrentStep(deps, state, 'dns_provider_readback_missing', options);
    await finishStepAndAdvance(deps, state, options);
    return { state: 'completed' as const };
  }

  if (actionType === 'verify_public_dns_txt') {
    state.step = await setStepStatus(deps, state.step, 'running', options);
    const mutation = await currentDnsMutation(deps, state);
    const result = await verifyPublicTxt({ hostname: mutation.name, expectedValue: mutation.value, fetchImpl: options.fetchImpl, attempts: options.fetchImpl ? 1 : 12, delayMs: options.fetchImpl ? 0 : 5000 });
    if (!result.verified) return blockCurrentStep(deps, state, 'dns_propagation_pending', options);
    await recordVerifiedEvidence(deps, state, 'dns_public_txt', { hostname: mutation.name, valueDigest: mutation.valueDigest, resolver: 'cloudflare-doh', observedAt: nowIso(options) });
    await finishStepAndAdvance(deps, state, options);
    return { state: 'completed' as const, attemptsUsed: result.attemptsUsed };
  }

  if (actionType === 'record_completion_evidence') {
    state.step = await setStepStatus(deps, state.step, 'running', options);
    await finishStepAndAdvance(deps, state, options);
    const taskResult = await completePilotTaskIfEligible(deps, taskId, options);
    if (!taskResult.completed) throw new OpenAiDomainPilotError('completion_requirements_not_met', 409);
    await completeWorkWorkflowIfEligible(deps, String(state.workflow.id), options);
    return { state: 'completed' as const, workflowCompleted: true };
  }

  throw new OpenAiDomainPilotError('unsupported_pilot_action', 409);
}

export async function resumeOpenAiDomainStep(deps: PilotDeps, taskId: string, options: PilotExecutionOptions = {}) {
  const state = await loadPilotState(deps, taskId);
  requireStepPermissions(deps, state.step);
  const actionType = String(state.step.action_type);

  if (actionType === 'create_dns_txt') {
    const mutation = await currentDnsMutation(deps, state);
    if (options.dnsPort) {
      const answers = await options.dnsPort.readTxt({ domain: mutation.domain, name: mutation.name });
      if (verifyDnsTxt(mutation.value, answers).verified) {
        await recordVerifiedEvidence(deps, state, 'dns_txt_write', { domain: mutation.domain, hostname: mutation.name, valueDigest: mutation.valueDigest, mechanism: 'provider_readback', reconciled: true, observedAt: nowIso(options) });
        if (String(state.step.status) === 'blocked') state.step = await setStepStatus(deps, state.step, 'ready', options);
        if (String(state.step.status) === 'ready') state.step = await setStepStatus(deps, state.step, 'running', options);
        await finishStepAndAdvance(deps, state, options);
        return { state: 'completed' as const, reason: 'dns_record_already_present' };
      }
    }
    const publicResult = await verifyPublicTxt({ hostname: mutation.name, expectedValue: mutation.value, fetchImpl: options.fetchImpl, attempts: 1, delayMs: 0 });
    if (publicResult.verified) {
      await recordVerifiedEvidence(deps, state, 'dns_txt_write', { domain: mutation.domain, hostname: mutation.name, valueDigest: mutation.valueDigest, mechanism: 'public_reconciliation', reconciled: true, observedAt: nowIso(options) });
      if (String(state.step.status) === 'blocked') state.step = await setStepStatus(deps, state.step, 'ready', options);
      if (String(state.step.status) === 'ready') state.step = await setStepStatus(deps, state.step, 'running', options);
      await finishStepAndAdvance(deps, state, options);
      return { state: 'completed' as const, reason: 'dns_record_already_present' };
    }
    return executeDnsMutation(deps, state, options);
  }

  const job = await latestRuntimeJob(deps, state);
  if (!job) {
    if (String(state.step.status) === 'blocked' || String(state.step.status) === 'ready' || String(state.step.status) === 'awaiting_approval') {
      return executeOpenAiDomainStep(deps, taskId, options);
    }
    throw new OpenAiDomainPilotError('runtime_job_missing', 409);
  }
  if (String(job.state) === 'waiting_human') return blockCurrentStep(deps, state, 'human_interaction_required', options);
  if (String(job.state) === 'failed' || String(job.state) === 'cancelled') return blockCurrentStep(deps, state, 'runtime_job_failed', options);
  if (String(job.state) !== 'completed') return { state: 'running' as const, jobId: String(job.id) };

  const result = record(job.sanitized_result);
  if (actionType === 'observe_openai_verification_requirement') {
    await consumeVerificationRequirement(deps, state, result);
    await finishStepAndAdvance(deps, state, options);
    return { state: 'completed' as const };
  }
  if (actionType === 'open_openai_domain_verification' || actionType === 'click_openai_check') {
    await finishStepAndAdvance(deps, state, options);
    return { state: 'completed' as const };
  }
  if (actionType === 'verify_openai_domain_state') {
    const domain = text(result.domain, 253).toLowerCase();
    const verifiedState = text(result.state, 40).toLowerCase();
    if (domain !== OPENAI_DOMAIN || !['verified', 'not_verified'].includes(verifiedState)) throw new OpenAiDomainPilotError('openai_verification_result_invalid', 422);
    if (verifiedState !== 'verified') return blockCurrentStep(deps, state, 'openai_domain_not_verified', options);
    await recordVerifiedEvidence(deps, state, 'openai_domain_verified', { domain, state: 'verified', observedAt: text(result.observedAt || nowIso(options), 80) });
    await finishStepAndAdvance(deps, state, options);
    return { state: 'completed' as const, verified: true };
  }

  return executeOpenAiDomainStep(deps, taskId, options);
}

export async function completePilotTaskIfEligible(deps: PilotDeps, taskId: string, options: PilotExecutionOptions = {}) {
  const { data: task, error: taskError } = await deps.admin.from('execution_tasks').select('*')
    .eq('id', taskId).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId).maybeSingle();
  if (taskError || !task) throw new OpenAiDomainPilotError(taskError ? 'persistence_error' : 'task_not_found', taskError ? 500 : 404);
  const [stepsResult, evidenceResult, approvalsResult, dependenciesResult] = await Promise.all([
    deps.admin.from('execution_steps').select('id,status,evidence_requirement').eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId).eq('task_id', taskId),
    deps.admin.from('execution_evidence').select('id,kind,verified').eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId).eq('task_id', taskId),
    deps.admin.from('execution_approvals').select('status,payload_version,payload_digest').eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId).eq('task_id', taskId),
    deps.admin.from('execution_dependencies').select('id,resolved_at').eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId).eq('task_id', taskId).is('resolved_at', null)
  ]);
  if (stepsResult.error || evidenceResult.error || approvalsResult.error || dependenciesResult.error) throw new OpenAiDomainPilotError('persistence_error', 500);
  const gate = evaluateTaskCompletion({
    steps: (stepsResult.data || []).map((step: any) => ({ id: String(step.id), status: step.status, evidenceRequirement: strings(step.evidence_requirement) })),
    evidence: (evidenceResult.data || []).map((item: any) => ({ id: String(item.id), kind: String(item.kind), verified: item.verified === true })),
    approvals: (approvalsResult.data || []).map((approval: any) => ({ status: approval.status, payloadVersion: Number(approval.payload_version), payloadDigest: String(approval.payload_digest) })),
    unresolvedDependencies: (dependenciesResult.data || []).map((dependency: any) => String(dependency.id))
  });
  if (!gate.eligible) return { completed: false, reasons: gate.reasons };
  if (String(task.status) === 'completed') return { completed: true, reasons: [] };
  if (!canTransitionTask(String(task.status) as any, 'completed')) throw new OpenAiDomainPilotError('invalid_transition', 409);
  const completedAt = nowIso(options);
  const { data: completed, error } = await deps.admin.from('execution_tasks').update({
    status: 'completed', completed_at: completedAt, current_step_id: null, next_action: null, blocked_reason: null,
    version: Number(task.version) + 1, updated_at: completedAt
  }).eq('id', taskId).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId).select('*').maybeSingle();
  if (error || !completed) throw new OpenAiDomainPilotError('persistence_error', 500);
  return { completed: true, reasons: [] };
}

export async function completeWorkWorkflowIfEligible(deps: PilotDeps, workflowId: string, options: PilotExecutionOptions = {}) {
  const { data: tasks, error: taskError } = await deps.admin.from('execution_tasks').select('id,status')
    .eq('workflow_id', workflowId).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId);
  if (taskError) throw new OpenAiDomainPilotError('persistence_error', 500);
  if (!tasks?.length || tasks.some((task: any) => !['completed', 'cancelled'].includes(String(task.status)))) return { completed: false };
  const completedAt = nowIso(options);
  const { data: workflow, error } = await deps.admin.from('execution_workflows').update({
    status: 'completed', completed_at: completedAt, current_task_id: null, updated_at: completedAt
  }).eq('id', workflowId).eq('org_id', deps.context.orgId).eq('tenant_id', deps.context.tenantId)
    .not('status', 'in', '(completed,cancelled,discarded)').select('*').maybeSingle();
  if (error) throw new OpenAiDomainPilotError('persistence_error', 500);
  if (!workflow) return { completed: false };
  await deps.appendAudit({
    orgId: deps.context.orgId, tenantId: deps.context.tenantId, actorUserId: deps.context.userId,
    taskId: null, workflowId, module: 'manager', action: 'execution.workflow.completed', previousState: null, resultingState: 'completed', correlationId: deps.requestId
  });
  return { completed: true };
}

export const __pilotInternals = {
  record, text, verifyDnsTxt, evaluateWorkActionPolicy, selectWorkRuntime, sanitizeBrowserResult,
  verifyPublicTxt, digestApprovalPayload, evaluateTaskCompletion, canTransitionStep, canTransitionTask,
  resolveDnsProvider, readPublicTxt, sha256Text
};