import {
  SOVEREIGN_CI_REPOSITORY,
  SOVEREIGN_CI_STEPS,
  normalizeSovereignCiRef,
  normalizeSovereignCiRepository
} from '../../../packages/execution/src/sovereign-ci.ts';

const GITHUB_API = 'https://api.github.com';
const WORKFLOW_FILE = 'atlas-sovereign-ci.yml';

export class SovereignCiStartError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code);
  }
}

type StartContext = {
  userId: string;
  orgId: string;
  tenantId: string;
  permissions: string[];
};

type StartDependencies = {
  admin: any;
  context: StartContext;
  requestId: string;
  githubToken: string;
  fetchImpl?: typeof fetch;
  appendAudit: (input: {
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
  }) => Promise<void>;
};

function requireExecutionPermission(context: StartContext, permission: string) {
  if (!context.permissions.includes(permission) && !context.permissions.includes('execution.admin')) {
    throw new SovereignCiStartError('permission_required', 403);
  }
}

function normalizeInput(repository: unknown, requestedRef: unknown) {
  try {
    return {
      repository: normalizeSovereignCiRepository(repository),
      requestedRef: normalizeSovereignCiRef(requestedRef)
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_sovereign_ci_input';
    throw new SovereignCiStartError(code, 422);
  }
}

async function updateBlocked(deps: StartDependencies, workflow: any, task: any, reason: string) {
  const now = new Date().toISOString();
  const { error: taskError } = await deps.admin.from('execution_tasks').update({
    status: 'blocked',
    blocked_reason: reason,
    next_action: 'Restore GitHub Actions dispatch authorization, then start a new Sovereign CI verification.',
    updated_at: now,
    version: Number(task.version || 1) + 1
  }).eq('id', String(task.id)).eq('org_id', deps.context.orgId);
  const { error: workflowError } = await deps.admin.from('execution_workflows').update({
    status: 'blocked',
    updated_at: now,
    version: Number(workflow.version || 1) + 1
  }).eq('id', String(workflow.id)).eq('org_id', deps.context.orgId);
  if (taskError || workflowError) throw new SovereignCiStartError('persistence_error', 500);
  await deps.appendAudit({
    orgId: deps.context.orgId,
    tenantId: deps.context.tenantId,
    actorUserId: deps.context.userId,
    taskId: String(task.id),
    workflowId: String(workflow.id),
    module: 'manager',
    action: 'execution.manager.sovereign_ci_blocked',
    previousState: 'now',
    resultingState: 'blocked',
    correlationId: deps.requestId
  });
}

async function dispatchGitHub(deps: StartDependencies, input: {
  workflowId: string;
  taskId: string;
  repository: string;
  requestedRef: string;
}) {
  if (!deps.githubToken) throw new SovereignCiStartError('github_control_token_not_configured', 503);
  const fetchImpl = deps.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(
      `${GITHUB_API}/repos/${SOVEREIGN_CI_REPOSITORY}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${deps.githubToken}`,
          accept: 'application/vnd.github+json',
          'content-type': 'application/json',
          'x-github-api-version': '2022-11-28'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            workflow_id: input.workflowId,
            task_id: input.taskId,
            repository: input.repository,
            requested_ref: input.requestedRef
          }
        })
      }
    );
  } catch {
    throw new SovereignCiStartError('github_ci_dispatch_unavailable', 503);
  }
  if (response.status !== 204) {
    throw new SovereignCiStartError(`github_ci_dispatch_failed_${response.status}`, 502);
  }
}

export async function startManagerSovereignCi(
  deps: StartDependencies,
  input: { repository: unknown; requestedRef: unknown }
) {
  requireExecutionPermission(deps.context, 'execution.write');
  const normalized = normalizeInput(input.repository, input.requestedRef);

  const { data: workflow, error: workflowError } = await deps.admin.from('execution_workflows').insert({
    org_id: deps.context.orgId,
    tenant_id: deps.context.tenantId,
    workflow_type: 'manager.sovereign_ci',
    owner_module: 'manager',
    status: 'now',
    current_task_id: null,
    current_module: 'manager',
    context: {
      source: 'atlas-manager',
      mutation_policy: 'read_only_source',
      repository: normalized.repository,
      requested_ref: normalized.requestedRef,
      resolved_sha: null,
      runner_kind: 'github-actions',
      return_path: '/execution/manager/sovereign-ci'
    },
    created_by: deps.context.userId,
    version: 1
  }).select('*').single();
  if (workflowError || !workflow) throw new SovereignCiStartError('persistence_error', 500);

  const { data: task, error: taskError } = await deps.admin.from('execution_tasks').insert({
    org_id: deps.context.orgId,
    tenant_id: deps.context.tenantId,
    workflow_id: String(workflow.id),
    module: 'manager',
    owner_user_id: deps.context.userId,
    title: 'Verify repository with Sovereign CI',
    intent: 'Run the canonical read-only ATLAS verification gate for an explicit Git ref',
    goal: 'Produce immutable-SHA, command, gate, and audit evidence without source mutation or deployment',
    status: 'now',
    priority: 'high',
    current_step_id: null,
    next_action: 'Resolve the requested ref to an immutable SHA and run the verification gate.',
    blocked_reason: null,
    permissions_required: ['execution.write'],
    version: 1
  }).select('*').single();
  if (taskError || !task) throw new SovereignCiStartError('persistence_error', 500);

  const now = new Date().toISOString();
  const stepRows = SOVEREIGN_CI_STEPS.map((step) => ({
    org_id: deps.context.orgId,
    tenant_id: deps.context.tenantId,
    task_id: String(task.id),
    sequence: step.sequence,
    module: 'manager',
    action_type: step.actionType,
    action_payload: {
      repository: normalized.repository,
      requested_ref: normalized.requestedRef,
      mutation_policy: 'read_only_source'
    },
    status: step.sequence === 1 ? 'ready' : 'pending',
    completion_criteria: [
      step.actionType === 'evaluate_gate'
        ? 'all required Sovereign CI commands pass'
        : `${step.actionType} produces bounded verifiable evidence`
    ],
    permissions_required: ['execution.read'],
    evidence_requirement: step.actionType === 'finalize_evidence' ? [] : [step.evidenceKind],
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now
  }));
  const { data: steps, error: stepsError } = await deps.admin
    .from('execution_steps')
    .insert(stepRows)
    .select('id,sequence');
  if (stepsError || !Array.isArray(steps) || steps.length !== SOVEREIGN_CI_STEPS.length) {
    throw new SovereignCiStartError('persistence_error', 500);
  }
  const ordered = [...steps].sort((a: any, b: any) => Number(a.sequence) - Number(b.sequence));
  const firstStepId = String(ordered[0].id);

  const [taskUpdate, workflowUpdate] = await Promise.all([
    deps.admin.from('execution_tasks').update({
      current_step_id: firstStepId,
      updated_at: now,
      version: 2
    }).eq('id', String(task.id)).eq('org_id', deps.context.orgId),
    deps.admin.from('execution_workflows').update({
      current_task_id: String(task.id),
      updated_at: now,
      version: 2
    }).eq('id', String(workflow.id)).eq('org_id', deps.context.orgId)
  ]);
  if (taskUpdate.error || workflowUpdate.error) throw new SovereignCiStartError('persistence_error', 500);

  await deps.appendAudit({
    orgId: deps.context.orgId,
    tenantId: deps.context.tenantId,
    actorUserId: deps.context.userId,
    taskId: String(task.id),
    workflowId: String(workflow.id),
    module: 'manager',
    action: 'execution.manager.sovereign_ci_started',
    previousState: null,
    resultingState: 'now',
    correlationId: deps.requestId
  });

  try {
    await dispatchGitHub(deps, {
      workflowId: String(workflow.id),
      taskId: String(task.id),
      repository: normalized.repository,
      requestedRef: normalized.requestedRef
    });
  } catch (error) {
    const reason = error instanceof SovereignCiStartError ? error.code : 'github_ci_dispatch_failed';
    await updateBlocked(deps, { ...workflow, version: 2 }, { ...task, version: 2 }, reason);
    return {
      workflow_id: String(workflow.id),
      task_id: String(task.id),
      status: 'blocked',
      blocking_reason: reason
    };
  }

  await deps.appendAudit({
    orgId: deps.context.orgId,
    tenantId: deps.context.tenantId,
    actorUserId: deps.context.userId,
    taskId: String(task.id),
    workflowId: String(workflow.id),
    module: 'manager',
    action: 'execution.manager.sovereign_ci_dispatched',
    previousState: 'now',
    resultingState: 'now',
    correlationId: deps.requestId
  });

  return {
    workflow_id: String(workflow.id),
    task_id: String(task.id),
    status: 'now',
    repository: normalized.repository,
    requested_ref: normalized.requestedRef
  };
}
