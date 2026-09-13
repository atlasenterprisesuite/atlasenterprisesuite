import { digestApprovalPayload } from '../../../packages/execution/src/approvals.ts';
import { evaluateTaskCompletion, canTransitionStep, canTransitionTask } from '../../../packages/execution/src/state-machine.ts';
import { verifyDnsTxt } from '../../../packages/execution/src/dns-verification.ts';
import { getWorkTemplate } from '../../../packages/execution/src/work-templates.ts';
import { evaluateWorkActionPolicy } from '../../../packages/execution/src/work-policy.ts';
import { selectWorkRuntime } from '../../../packages/execution/src/work-runtime.ts';
import { prepareBrowserJob, sanitizeBrowserResult } from '../../../packages/execution/src/browser-executor.ts';
import { verifyPublicTxt } from './dns-public.ts';

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

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function text(value: unknown, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
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
    reversible: actionType !== 'change_nameservers',
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
  if (domain !== 'atlasenterprisesuite.com') throw new OpenAiDomainPilotError('pilot_domain_not_supported', 422);

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

// Execution and completion helpers are intentionally exported from this same pilot module so
// all later mutations operate on the canonical workflow/task/step rows created above.
export const __pilotInternals = { record, text, verifyDnsTxt, evaluateWorkActionPolicy, selectWorkRuntime, prepareBrowserJob, sanitizeBrowserResult, verifyPublicTxt, digestApprovalPayload, evaluateTaskCompletion, canTransitionStep, canTransitionTask };
