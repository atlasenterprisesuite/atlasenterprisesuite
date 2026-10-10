import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import {
  SOVEREIGN_CI_COMMANDS,
  SOVEREIGN_CI_REPOSITORY,
  evaluateSovereignCiGate,
  normalizeSovereignCiRef,
  normalizeSovereignCiRepository,
  type SovereignCiCommandIdentifier
} from '../../../packages/execution/src/sovereign-ci.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const AUDIENCE = 'atlas-sovereign-ci';
const OWNER = 'atlasenterprisesuite';
const WORKFLOW_REF =
  SOVEREIGN_CI_REPOSITORY + '/.github/workflows/atlas-sovereign-ci.yml@refs/heads/main';
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_REQUEST_BYTES = 64 * 1024;

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

function fail(code: string, status = 400) {
  return Object.assign(new Error(code), { code, status });
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function b64u(input: string) {
  let value = input.replace(/-/g, '+').replace(/_/g, '/');
  while (value.length % 4) value += '=';
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function decodePart(input: string) {
  return JSON.parse(new TextDecoder().decode(b64u(input)));
}

function constantTimeTextEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

let jwksCache: { until: number; keys: Array<JsonWebKey & { kid?: string }> } | null = null;

async function githubKeys() {
  if (jwksCache && jwksCache.until > Date.now()) return jwksCache.keys;
  const configurationResponse = await fetch(
    'https://token.actions.githubusercontent.com/.well-known/openid-configuration',
    { cache: 'no-store' }
  );
  if (!configurationResponse.ok) throw fail('github_oidc_configuration_unavailable', 503);
  const configuration = await configurationResponse.json();
  const jwksUri = clean(configuration?.jwks_uri, 500);
  if (!jwksUri.startsWith('https://token.actions.githubusercontent.com/')) {
    throw fail('github_oidc_configuration_invalid', 503);
  }
  const jwksResponse = await fetch(jwksUri, { cache: 'no-store' });
  if (!jwksResponse.ok) throw fail('github_oidc_jwks_unavailable', 503);
  const data = await jwksResponse.json();
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  jwksCache = { until: Date.now() + 10 * 60 * 1000, keys };
  return keys;
}

async function verifyGitHubOIDC(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) throw fail('github_oidc_required', 401);

  let header: Record<string, unknown>;
  let payload: Record<string, any>;
  try {
    header = decodePart(parts[0]);
    payload = decodePart(parts[1]);
  } catch {
    throw fail('invalid_github_oidc', 401);
  }
  if (header.alg !== 'RS256' || !header.kid) throw fail('unsupported_github_oidc', 401);

  const jwk = (await githubKeys()).find((candidate) => candidate.kid === header.kid);
  if (!jwk) throw fail('github_oidc_key_not_found', 401);
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const signatureOk = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64u(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1])
  );

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const workflowRef = clean(payload.workflow_ref || payload.job_workflow_ref, 500);
  const now = Math.floor(Date.now() / 1000);
  if (
    !signatureOk ||
    payload.iss !== 'https://token.actions.githubusercontent.com' ||
    !audiences.includes(AUDIENCE) ||
    Number(payload.exp || 0) <= now ||
    Number(payload.nbf || 0) > now + 30 ||
    !constantTimeTextEqual(clean(payload.repository, 200), SOVEREIGN_CI_REPOSITORY) ||
    !constantTimeTextEqual(clean(payload.repository_owner, 100), OWNER) ||
    !constantTimeTextEqual(clean(payload.ref, 200), 'refs/heads/main') ||
    !constantTimeTextEqual(workflowRef, WORKFLOW_REF) ||
    clean(payload.event_name, 80) !== 'workflow_dispatch'
  ) throw fail('github_oidc_scope_denied', 403);

  return {
    runId: clean(payload.run_id, 80),
    actor: clean(payload.actor, 160),
    workflowSha: clean(payload.sha, 40)
  };
}

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw fail('server_runtime_not_configured', 503);
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function normalizeResult(value: unknown) {
  const raw = record(value);
  const commandIdentifier = clean(raw.command_identifier, 80) as SovereignCiCommandIdentifier;
  if (!SOVEREIGN_CI_COMMANDS.some((item) => item.id === commandIdentifier)) {
    throw fail('invalid_command_identifier', 422);
  }
  const exitCode = Number(raw.exit_code);
  if (!Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255) {
    throw fail('invalid_exit_code', 422);
  }
  const outputDigest = raw.output_digest == null ? null : clean(raw.output_digest, 64).toLowerCase();
  if (outputDigest && !SHA256.test(outputDigest)) throw fail('invalid_output_digest', 422);
  return {
    commandIdentifier,
    exitCode,
    outputDigest,
    startedAt: clean(raw.started_at, 80) || null,
    completedAt: clean(raw.completed_at, 80) || null
  };
}

async function persistEvidence(admin: any, row: Record<string, unknown>) {
  const { data: existing, error: findError } = await admin
    .from('execution_evidence')
    .select('id')
    .eq('org_id', String(row.org_id))
    .eq('task_id', String(row.task_id))
    .eq('kind', String(row.kind))
    .eq('reference', String(row.reference))
    .limit(1)
    .maybeSingle();
  if (findError) throw fail('persistence_error', 500);
  if (existing?.id) return String(existing.id);
  const { data, error } = await admin.from('execution_evidence')
    .insert(row).select('id').single();
  if (error || !data) throw fail('persistence_error', 500);
  return String(data.id);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return json({ ok: false, error: 'payload_too_large' }, 413);
  }

  try {
    const claims = await verifyGitHubOIDC(req);
    const body = record(await req.json());
    if (new TextEncoder().encode(JSON.stringify(body)).byteLength > MAX_REQUEST_BYTES) {
      throw fail('payload_too_large', 413);
    }

    const workflowId = clean(body.workflow_id, 80);
    const taskId = clean(body.task_id, 80);
    if (!workflowId || !taskId) throw fail('workflow_and_task_required', 422);

    let repository: string;
    let requestedRef: string;
    try {
      repository = normalizeSovereignCiRepository(body.repository);
      requestedRef = normalizeSovereignCiRef(body.requested_ref);
    } catch (error) {
      throw fail(error instanceof Error ? error.message : 'invalid_sovereign_ci_input', 422);
    }

    const resolvedSha = clean(body.resolved_sha, 40).toLowerCase();
    if (!SHA40.test(resolvedSha)) throw fail('invalid_resolved_sha', 422);
    const results = Array.isArray(body.results) ? body.results.map(normalizeResult) : [];
    const gate = evaluateSovereignCiGate(results);

    const admin = adminClient();
    const { data: workflow, error: workflowError } = await admin.from('execution_workflows')
      .select('*').eq('id', workflowId).maybeSingle();
    if (workflowError || !workflow) throw fail('workflow_not_found', 404);
    const { data: task, error: taskError } = await admin.from('execution_tasks')
      .select('*').eq('id', taskId).eq('workflow_id', workflowId).maybeSingle();
    if (taskError || !task) throw fail('task_not_found', 404);
    if (String(workflow.workflow_type) !== 'manager.sovereign_ci') throw fail('workflow_type_mismatch', 409);

    const context = record(workflow.context);
    if (
      !constantTimeTextEqual(clean(context.repository, 200), repository) ||
      !constantTimeTextEqual(clean(context.requested_ref, 200), requestedRef)
    ) throw fail('execution_target_mismatch', 409);
    const priorSha = clean(context.resolved_sha, 40).toLowerCase();
    if (priorSha && !constantTimeTextEqual(priorSha, resolvedSha)) {
      throw fail('resolved_sha_immutable', 409);
    }

    const { data: steps, error: stepsError } = await admin.from('execution_steps')
      .select('*').eq('org_id', String(workflow.org_id)).eq('task_id', taskId).order('sequence');
    if (stepsError || !Array.isArray(steps) || steps.length < 8) throw fail('sovereign_ci_steps_missing', 500);
    const byAction = new Map(steps.map((step: any) => [String(step.action_type), step]));
    const targetStep = byAction.get('resolve_target');
    const sourceStep = byAction.get('acquire_source');
    const gateStep = byAction.get('evaluate_gate');
    const finalStep = byAction.get('finalize_evidence');
    if (!targetStep || !sourceStep || !gateStep || !finalStep) throw fail('sovereign_ci_steps_missing', 500);

    const now = new Date().toISOString();
    const evidenceIds: string[] = [];
    evidenceIds.push(await persistEvidence(admin, {
      org_id: workflow.org_id,
      tenant_id: workflow.tenant_id,
      task_id: taskId,
      step_id: targetStep.id,
      kind: 'manager.ci.target',
      reference: `github-actions:${claims.runId}:target:${resolvedSha}`,
      verified: true,
      metadata: {
        repository,
        requested_ref: requestedRef,
        resolved_sha: resolvedSha,
        runner_kind: 'github-actions',
        github_run_id: claims.runId
      }
    }));
    evidenceIds.push(await persistEvidence(admin, {
      org_id: workflow.org_id,
      tenant_id: workflow.tenant_id,
      task_id: taskId,
      step_id: sourceStep.id,
      kind: 'manager.ci.source',
      reference: `github-actions:${claims.runId}:source:${resolvedSha}`,
      verified: true,
      metadata: {
        repository,
        requested_ref: requestedRef,
        resolved_sha: resolvedSha,
        runner_kind: 'github-actions',
        github_run_id: claims.runId
      }
    }));

    const evidenceKindByCommand: Record<SovereignCiCommandIdentifier, string> = {
      install_dependencies: 'manager.ci.install',
      typecheck: 'manager.ci.typecheck',
      test: 'manager.ci.test',
      build: 'manager.ci.build'
    };
    for (const result of results) {
      const step = byAction.get(result.commandIdentifier);
      if (!step) throw fail('sovereign_ci_step_missing', 500);
      const digest = result.outputDigest || 'no-digest';
      evidenceIds.push(await persistEvidence(admin, {
        org_id: workflow.org_id,
        tenant_id: workflow.tenant_id,
        task_id: taskId,
        step_id: step.id,
        kind: evidenceKindByCommand[result.commandIdentifier],
        reference: `github-actions:${claims.runId}:${result.commandIdentifier}:${digest}`,
        verified: result.exitCode === 0,
        metadata: {
          repository,
          requested_ref: requestedRef,
          resolved_sha: resolvedSha,
          command_identifier: result.commandIdentifier,
          exit_code: result.exitCode,
          output_digest: result.outputDigest,
          started_at: result.startedAt,
          completed_at: result.completedAt,
          runner_kind: 'github-actions',
          github_run_id: claims.runId
        }
      }));
    }

    evidenceIds.push(await persistEvidence(admin, {
      org_id: workflow.org_id,
      tenant_id: workflow.tenant_id,
      task_id: taskId,
      step_id: gateStep.id,
      kind: 'manager.ci.gate',
      reference: `github-actions:${claims.runId}:gate:${gate.green ? 'green' : 'red'}:${resolvedSha}`,
      verified: gate.green,
      metadata: {
        repository,
        requested_ref: requestedRef,
        resolved_sha: resolvedSha,
        failure_class: gate.failureClass,
        command_identifier: gate.failedCommand,
        runner_kind: 'github-actions',
        github_run_id: claims.runId
      }
    }));

    const updates = [
      [targetStep, 'completed'],
      [sourceStep, 'completed'],
      ...results.map((result) => [
        byAction.get(result.commandIdentifier),
        result.exitCode === 0 ? 'completed' : 'failed'
      ]),
      [gateStep, gate.green ? 'completed' : 'failed'],
      [finalStep, 'completed']
    ] as Array<[any, string]>;
    for (const [step, status] of updates) {
      const { error } = await admin.from('execution_steps').update({
        status,
        started_at: step.started_at || now,
        completed_at: now,
        updated_at: now
      }).eq('id', String(step.id)).eq('org_id', String(workflow.org_id));
      if (error) throw fail('persistence_error', 500);
    }

    const nextContext = {
      ...context,
      resolved_sha: resolvedSha,
      runner_kind: 'github-actions',
      github_run_id: claims.runId,
      github_actor: claims.actor || null,
      runner_workflow_sha: SHA40.test(claims.workflowSha) ? claims.workflowSha : null
    };
    const taskStatus = gate.green ? 'completed' : 'blocked';
    const taskPatch = {
      status: taskStatus,
      current_step_id: gate.green ? null : gateStep.id,
      next_action: gate.green
        ? null
        : `Fix ${gate.failedCommand || 'verification'} failure and start a new Sovereign CI verification.`,
      blocked_reason: gate.green ? null : gate.failureClass,
      completed_at: gate.green ? now : null,
      updated_at: now,
      version: Number(task.version || 1) + 1
    };
    const workflowPatch = {
      status: taskStatus,
      current_task_id: task.id,
      current_module: 'manager',
      context: nextContext,
      completed_at: gate.green ? now : null,
      updated_at: now,
      version: Number(workflow.version || 1) + 1
    };
    const [taskUpdate, workflowUpdate] = await Promise.all([
      admin.from('execution_tasks').update(taskPatch).eq('id', taskId).eq('org_id', String(workflow.org_id)),
      admin.from('execution_workflows').update(workflowPatch).eq('id', workflowId).eq('org_id', String(workflow.org_id))
    ]);
    if (taskUpdate.error || workflowUpdate.error) throw fail('persistence_error', 500);

    const { error: auditError } = await admin.from('execution_audit_events').insert({
      org_id: workflow.org_id,
      tenant_id: workflow.tenant_id,
      actor_user_id: workflow.created_by,
      task_id: taskId,
      workflow_id: workflowId,
      module: 'manager',
      action: 'execution.manager.sovereign_ci_reported',
      previous_state: String(task.status),
      resulting_state: taskStatus,
      evidence_ids: evidenceIds,
      correlation_id: `github-actions:${claims.runId}`
    });
    if (auditError) throw fail('audit_write_failed', 500);

    return json({
      ok: true,
      workflow_id: workflowId,
      task_id: taskId,
      resolved_sha: resolvedSha,
      gate: gate.green ? 'green' : 'red',
      failure_class: gate.failureClass,
      failed_command: gate.failedCommand,
      evidence_ids: evidenceIds,
      secrets_returned: false
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'internal_error';
    const status = Number((error as any)?.status || 500);
    return json({ ok: false, error: code, secrets_returned: false }, status);
  }
});
