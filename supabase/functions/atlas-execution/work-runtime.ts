import { prepareBrowserJob, sanitizeBrowserResult } from '../../../packages/execution/src/browser-executor.ts';
import type { BrowserExecutionEnvelope } from '../../../packages/execution/src/browser-envelope.ts';
import type { WorkRuntimeKind } from '../../../packages/execution/src/work-runtime.ts';

export class WorkRuntimeError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code);
  }
}

type UserContext = {
  userId: string;
  orgId: string;
  tenantId: string;
};

export type RuntimeAuthContext = {
  runtimeId: string;
  orgId: string;
  tenantId: string;
  kind: WorkRuntimeKind;
  capabilities: string[];
};

function text(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function strings(value: unknown, max = 40) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, 120)).filter(Boolean))].slice(0, max);
}

function runtimeKind(value: unknown): WorkRuntimeKind {
  const kind = text(value, 40) as WorkRuntimeKind;
  if (!['local', 'self_hosted', 'cloud_ephemeral'].includes(kind)) throw new WorkRuntimeError('invalid_runtime_kind', 422);
  return kind;
}

function hex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexBytes(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) return new Uint8Array();
  return new Uint8Array(value.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)));
}

function encodeBase64Url(bytes: Uint8Array) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return hex(new Uint8Array(digest));
}

export function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length || left.length === 0) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function listWorkRuntimes(admin: any, context: UserContext) {
  const { data, error } = await admin
    .from('execution_runtime_registrations')
    .select('id,kind,label,status,capabilities,last_seen_at,created_at,updated_at')
    .eq('org_id', context.orgId)
    .eq('tenant_id', context.tenantId)
    .order('updated_at', { ascending: false });
  if (error) throw new WorkRuntimeError('persistence_error', 500);
  return data || [];
}

export async function enrollWorkRuntime(admin: any, context: UserContext, input: {
  kind: unknown;
  label: unknown;
  capabilities: unknown;
}) {
  const kind = runtimeKind(input.kind);
  const label = text(input.label, 160);
  const capabilities = strings(input.capabilities);
  if (!label) throw new WorkRuntimeError('runtime_label_required', 422);

  const raw = crypto.getRandomValues(new Uint8Array(32));
  const runtimeToken = encodeBase64Url(raw);
  const authTokenHash = await sha256(runtimeToken);
  const { data, error } = await admin.from('execution_runtime_registrations').insert({
    org_id: context.orgId,
    tenant_id: context.tenantId,
    kind,
    label,
    status: 'offline',
    capabilities,
    auth_token_hash: authTokenHash,
    created_by_user_id: context.userId
  }).select('id,kind,label,status,capabilities,last_seen_at,created_at,updated_at').single();
  if (error || !data) throw new WorkRuntimeError('persistence_error', 500);
  return { runtime: data, runtimeToken };
}

export async function resolveRuntimeContext(admin: any, runtimeId: string, bearerToken: string): Promise<RuntimeAuthContext> {
  const id = text(runtimeId, 80);
  if (!id || !bearerToken) throw new WorkRuntimeError('runtime_authentication_required', 401);
  const { data, error } = await admin
    .from('execution_runtime_registrations')
    .select('id,org_id,tenant_id,kind,status,capabilities,auth_token_hash')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new WorkRuntimeError('persistence_error', 500);
  if (!data || data.status === 'revoked') throw new WorkRuntimeError('invalid_runtime_session', 401);

  const suppliedHash = await sha256(bearerToken);
  if (!constantTimeEqual(hexBytes(suppliedHash), hexBytes(String(data.auth_token_hash || '')))) {
    throw new WorkRuntimeError('invalid_runtime_session', 401);
  }
  return {
    runtimeId: String(data.id),
    orgId: String(data.org_id),
    tenantId: String(data.tenant_id),
    kind: runtimeKind(data.kind),
    capabilities: strings(data.capabilities)
  };
}

export async function heartbeatWorkRuntime(admin: any, context: RuntimeAuthContext) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('execution_runtime_registrations')
    .update({ status: 'online', last_seen_at: now, updated_at: now })
    .eq('id', context.runtimeId)
    .eq('org_id', context.orgId)
    .eq('tenant_id', context.tenantId)
    .neq('status', 'revoked')
    .select('id,kind,label,status,capabilities,last_seen_at,updated_at')
    .maybeSingle();
  if (error) throw new WorkRuntimeError('persistence_error', 500);
  if (!data) throw new WorkRuntimeError('runtime_revoked', 403);
  return data;
}

export async function enqueueWorkRuntimeJob(admin: any, context: UserContext, input: {
  workflowId: string;
  taskId: string;
  stepId: string;
  runtimeKind: WorkRuntimeKind;
  envelope: BrowserExecutionEnvelope;
  action: any;
  route: { state: 'ready' | 'blocked'; mechanism: 'api' | 'browser' | null };
  policy: { outcome: 'allow' | 'require_approval' | 'deny' };
}) {
  if (input.route.state !== 'ready' || input.route.mechanism !== 'browser' || input.policy.outcome !== 'allow') {
    throw new WorkRuntimeError('runtime_job_not_authorized', 409);
  }
  if (
    input.envelope.workflowId !== input.workflowId ||
    input.envelope.stepId !== input.stepId ||
    input.envelope.organizationId !== context.orgId ||
    input.envelope.tenantId !== context.tenantId
  ) throw new WorkRuntimeError('execution_scope_mismatch', 403);

  const prepared = prepareBrowserJob(input.envelope, input.action);
  const { data, error } = await admin.from('execution_runtime_jobs').insert({
    org_id: context.orgId,
    tenant_id: context.tenantId,
    workflow_id: input.workflowId,
    task_id: input.taskId,
    step_id: input.stepId,
    runtime_id: null,
    runtime_kind: input.runtimeKind,
    state: 'queued',
    execution_envelope: prepared.executionEnvelope,
    action: prepared.action,
    sanitized_result: null,
    lease_id: null,
    lease_expires_at: null
  }).select('id,workflow_id,task_id,step_id,runtime_kind,state,created_at').single();
  if (error || !data) throw new WorkRuntimeError('persistence_error', 500);
  return data;
}

export async function claimWorkRuntimeJob(admin: any, context: RuntimeAuthContext) {
  const { data: candidate, error: candidateError } = await admin
    .from('execution_runtime_jobs')
    .select('id')
    .eq('org_id', context.orgId)
    .eq('tenant_id', context.tenantId)
    .eq('runtime_kind', context.kind)
    .eq('state', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (candidateError) throw new WorkRuntimeError('persistence_error', 500);
  if (!candidate) return null;

  const leaseId = crypto.randomUUID();
  const leaseExpiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const { data: job, error } = await admin
    .from('execution_runtime_jobs')
    .update({ runtime_id: context.runtimeId, state: 'claimed', lease_id: leaseId, lease_expires_at: leaseExpiresAt, updated_at: new Date().toISOString() })
    .eq('id', String(candidate.id))
    .eq('org_id', context.orgId)
    .eq('tenant_id', context.tenantId)
    .eq('runtime_kind', context.kind)
    .eq('state', 'queued')
    .select('id,workflow_id,task_id,step_id,runtime_kind,state,execution_envelope,action,lease_id,lease_expires_at')
    .maybeSingle();
  if (error) throw new WorkRuntimeError('persistence_error', 500);
  return job || null;
}

export async function completeWorkRuntimeJob(admin: any, context: RuntimeAuthContext, input: {
  jobId: string;
  leaseId: string;
  state: 'completed' | 'waiting_human' | 'failed';
  result: unknown;
}) {
  const jobId = text(input.jobId, 80);
  const leaseId = text(input.leaseId, 80);
  if (!jobId || !leaseId) throw new WorkRuntimeError('runtime_lease_required', 422);

  const { data: current, error: loadError } = await admin
    .from('execution_runtime_jobs')
    .select('id,state,lease_id,lease_expires_at')
    .eq('id', jobId)
    .eq('runtime_id', context.runtimeId)
    .eq('org_id', context.orgId)
    .eq('tenant_id', context.tenantId)
    .maybeSingle();
  if (loadError) throw new WorkRuntimeError('persistence_error', 500);
  if (!current || String(current.lease_id || '') !== leaseId) throw new WorkRuntimeError('runtime_lease_mismatch', 409);
  if (!['claimed', 'running'].includes(String(current.state))) throw new WorkRuntimeError('runtime_job_not_claimed', 409);
  const expiry = new Date(String(current.lease_expires_at || '')).getTime();
  if (!Number.isFinite(expiry) || Date.now() >= expiry) throw new WorkRuntimeError('runtime_lease_expired', 409);

  const sanitized = sanitizeBrowserResult(input.result);
  const { data, error } = await admin
    .from('execution_runtime_jobs')
    .update({ state: input.state, sanitized_result: sanitized, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('runtime_id', context.runtimeId)
    .eq('org_id', context.orgId)
    .eq('tenant_id', context.tenantId)
    .eq('lease_id', leaseId)
    .in('state', ['claimed', 'running'])
    .select('id,workflow_id,task_id,step_id,state,sanitized_result,updated_at')
    .maybeSingle();
  if (error) throw new WorkRuntimeError('persistence_error', 500);
  if (!data) throw new WorkRuntimeError('runtime_lease_mismatch', 409);
  return data;
}
