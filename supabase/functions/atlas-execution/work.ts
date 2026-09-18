import { parseAtlasWorkContext, type AtlasWorkContext } from '../../../packages/execution/src/work-types.ts';

export class WorkExecutionError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code);
  }
}

type WorkRequestContext = {
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

type CreateWorkWorkflowPlanInput = {
  admin: any;
  context: WorkRequestContext;
  requestId: string;
  ownerModule: string;
  intent: string;
  work: AtlasWorkContext;
  appendAudit: (input: AuditInput) => Promise<void>;
};

type ListWorkWorkflowsInput = {
  admin: any;
  context: WorkRequestContext;
};

async function compensateWorkCreation(
  admin: any,
  context: WorkRequestContext,
  workflowId: string,
  taskId: string | null
) {
  if (taskId) {
    try {
      await admin.from('execution_steps').delete().eq('org_id', context.orgId).eq('task_id', taskId);
    } catch {
      // Best-effort compensation continues to the next owned row.
    }
    try {
      await admin.from('execution_tasks').delete().eq('org_id', context.orgId).eq('id', taskId);
    } catch {
      // Best-effort compensation continues to the workflow row.
    }
  }
  try {
    await admin.from('execution_workflows').delete().eq('org_id', context.orgId).eq('id', workflowId);
  } catch {
    // The caller still surfaces persistence_error; reconciliation can inspect leftovers.
  }
}

export async function createWorkWorkflowPlan(input: CreateWorkWorkflowPlanInput) {
  let workflowId: string | null = null;
  let taskId: string | null = null;

  try {
    const { data: workflow, error: workflowError } = await input.admin.from('execution_workflows').insert({
      org_id: input.context.orgId,
      tenant_id: input.context.orgId,
      workflow_type: 'work.sovereign',
      owner_module: input.ownerModule,
      status: 'now',
      current_task_id: null,
      current_module: input.ownerModule,
      context: { work: input.work, intent: input.intent },
      created_by: input.context.userId,
      version: 1
    }).select('id,tenant_id').single();

    if (workflowError || !workflow?.id) throw new WorkExecutionError('persistence_error', 500);
    workflowId = String(workflow.id);
    const tenantId = String(workflow.tenant_id || input.context.orgId);

    const { data: task, error: taskError } = await input.admin.from('execution_tasks').insert({
      org_id: input.context.orgId,
      tenant_id: tenantId,
      workflow_id: workflowId,
      module: input.ownerModule,
      owner_user_id: input.context.userId,
      title: `ATLAS Work: ${input.intent.slice(0, 240)}`,
      intent: input.intent,
      goal: input.intent,
      status: 'now',
      priority: 'normal',
      current_step_id: null,
      next_action: 'Prepare execution plan',
      blocked_reason: null,
      permissions_required: ['execution.write'],
      source_type: null,
      source_id: null,
      parent_task_id: null,
      version: 1
    }).select('id').single();

    if (taskError || !task?.id) throw new WorkExecutionError('persistence_error', 500);
    taskId = String(task.id);

    const { data: step, error: stepError } = await input.admin.from('execution_steps').insert({
      org_id: input.context.orgId,
      tenant_id: tenantId,
      task_id: taskId,
      sequence: 1,
      module: input.ownerModule,
      action_type: 'prepare_execution_plan',
      action_payload: {},
      status: 'ready',
      completion_criteria: ['executable work plan compiled'],
      permissions_required: ['execution.write'],
      evidence_requirement: ['work_plan_compiled']
    }).select('id').single();

    if (stepError || !step?.id) throw new WorkExecutionError('persistence_error', 500);

    const { data: updatedTask, error: taskUpdateError } = await input.admin
      .from('execution_tasks')
      .update({ current_step_id: String(step.id), updated_at: new Date().toISOString() })
      .eq('org_id', input.context.orgId)
      .eq('id', taskId)
      .select('id')
      .maybeSingle();
    if (taskUpdateError || !updatedTask) throw new WorkExecutionError('persistence_error', 500);

    const { data: updatedWorkflow, error: workflowUpdateError } = await input.admin
      .from('execution_workflows')
      .update({ current_task_id: taskId, updated_at: new Date().toISOString() })
      .eq('org_id', input.context.orgId)
      .eq('id', workflowId)
      .select('id')
      .maybeSingle();
    if (workflowUpdateError || !updatedWorkflow) throw new WorkExecutionError('persistence_error', 500);

    await input.appendAudit({
      orgId: input.context.orgId,
      tenantId,
      actorUserId: input.context.userId,
      taskId,
      workflowId,
      module: input.ownerModule,
      action: 'execution.workflow.created',
      previousState: null,
      resultingState: 'now',
      correlationId: input.requestId
    });

    return { workflowId, taskId };
  } catch (error) {
    if (workflowId) await compensateWorkCreation(input.admin, input.context, workflowId, taskId);
    if (error instanceof WorkExecutionError) throw error;
    throw new WorkExecutionError('persistence_error', 500);
  }
}

export async function listWorkWorkflows(input: ListWorkWorkflowsInput) {
  const { data, error } = await input.admin
    .from('execution_workflows')
    .select('id,org_id,owner_module,status,current_task_id,current_module,context,created_at,updated_at,completed_at')
    .eq('org_id', input.context.orgId)
    .eq('workflow_type', 'work.sovereign')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new WorkExecutionError('persistence_error', 500);

  return (data || []).map((row: any) => ({
    id: String(row.id),
    organization_id: String(row.org_id),
    owner_module: String(row.owner_module),
    status: String(row.status),
    current_task_id: row.current_task_id ? String(row.current_task_id) : null,
    current_module: String(row.current_module),
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    work: parseAtlasWorkContext(row.context)
  }));
}
