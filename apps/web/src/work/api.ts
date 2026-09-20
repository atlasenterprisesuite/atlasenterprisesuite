import { parseAtlasWorkContext } from '../../../../packages/execution/src/work-types';
import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../lib/atlasSession';
import type { CreateWorkWorkflowInput, WorkWorkflow } from './types';

type RawRecord = Record<string, any>;

function record(value: unknown): RawRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RawRecord : {};
}

function rows(value: unknown): RawRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is RawRecord => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 40) : [];
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value);
}

export async function parseWorkResponse(response: Response): Promise<RawRecord> {
  const text = await response.text();
  let data: RawRecord = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: 'invalid_response' };
  }
  if (!response.ok) throw new Error(String(data.error || `work_request_failed_${response.status}`));
  return data;
}

export function normalizeWorkWorkflow(rawValue: unknown): WorkWorkflow {
  const raw = record(rawValue);
  const ownerModule = String(raw.owner_module ?? raw.ownerModule ?? '');
  const rawContext = record(raw.context);
  const rawWork = raw.work ?? rawContext.work;

  return {
    id: String(raw.id || ''),
    organizationId: String(raw.organization_id ?? raw.org_id ?? raw.organizationId ?? ''),
    ownerModule,
    status: String(raw.status || 'draft') as WorkWorkflow['status'],
    currentTaskId: nullableString(raw.current_task_id ?? raw.currentTaskId),
    currentModule: String(raw.current_module ?? raw.currentModule ?? ownerModule),
    createdAt: nullableString(raw.created_at ?? raw.createdAt),
    updatedAt: nullableString(raw.updated_at ?? raw.updatedAt),
    completedAt: nullableString(raw.completed_at ?? raw.completedAt),
    work: parseAtlasWorkContext({ work: rawWork })
  };
}

async function scopedWorkPost(body: Record<string, unknown>) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-execution', {
    method: 'POST',
    body: JSON.stringify({ ...body, organization_id: organization.id })
  });
  return { data: await parseWorkResponse(response), organizationId: organization.id };
}

async function workPost(body: Record<string, unknown>) {
  return (await scopedWorkPost(body)).data;
}

export async function listWorkflows(): Promise<WorkWorkflow[]> {
  const { data, organizationId } = await scopedWorkPost({ operation: 'list_workflows' });
  return rows(record(data).workflows)
    .filter((row) => String(row.organization_id ?? row.org_id ?? '') === organizationId)
    .map(normalizeWorkWorkflow);
}

export async function createWorkWorkflow(input: CreateWorkWorkflowInput) {
  const data = await workPost({
    operation: 'create_workflow_plan',
    owner_module: input.ownerModule,
    intent: input.intent,
    work: {
      executionMode: input.executionMode,
      autonomyLevel: input.autonomyLevel,
      runtimePreference: input.runtimePreference,
      budgetLimit: input.budgetLimit,
      connectionRefs: input.connectionRefs
    }
  });

  if (!data.workflow_id) throw new Error('work_workflow_missing');
  return {
    workflowId: String(data.workflow_id),
    taskId: data.task_id ? String(data.task_id) : null
  };
}

export async function createWorkTemplate(templateId: string, inputs: Record<string, string>) {
  const data = await workPost({ operation: 'create_work_template', template_id: templateId, inputs });
  if (!data.workflow_id) throw new Error('work_template_workflow_missing');
  return { workflowId: String(data.workflow_id), taskId: data.task_id ? String(data.task_id) : null };
}

export type WorkConnectionSummary = {
  id: string;
  provider: string;
  mechanism: 'oauth' | 'session' | 'vault';
  status: 'active' | 'revoked' | 'expired' | 'error';
  capabilities: string[];
};

export type WorkRuntimeSummary = {
  id: string;
  kind: 'local' | 'self_hosted' | 'cloud_ephemeral';
  label: string;
  status: 'online' | 'offline' | 'degraded' | 'revoked';
  capabilities: string[];
  lastSeenAt: string | null;
};

function normalizeConnection(value: unknown): WorkConnectionSummary | null {
  const raw = record(value);
  const mechanism = String(raw.mechanism || '');
  const status = String(raw.status || '');
  if (!raw.id || !raw.provider || !['oauth', 'session', 'vault'].includes(mechanism) || !['active', 'revoked', 'expired', 'error'].includes(status)) return null;
  return {
    id: String(raw.id),
    provider: String(raw.provider),
    mechanism: mechanism as WorkConnectionSummary['mechanism'],
    status: status as WorkConnectionSummary['status'],
    capabilities: strings(raw.capabilities)
  };
}

function normalizeRuntime(value: unknown): WorkRuntimeSummary | null {
  const raw = record(value);
  const kind = String(raw.kind || '');
  const status = String(raw.status || '');
  if (!raw.id || !['local', 'self_hosted', 'cloud_ephemeral'].includes(kind) || !['online', 'offline', 'degraded', 'revoked'].includes(status)) return null;
  return {
    id: String(raw.id),
    kind: kind as WorkRuntimeSummary['kind'],
    label: String(raw.label || 'ATLAS runtime'),
    status: status as WorkRuntimeSummary['status'],
    capabilities: strings(raw.capabilities),
    lastSeenAt: nullableString(raw.last_seen_at ?? raw.lastSeenAt)
  };
}

export async function listWorkConnections(): Promise<WorkConnectionSummary[]> {
  const data = await workPost({ operation: 'list_work_connections' });
  return rows(data.connections).map(normalizeConnection).filter((item): item is WorkConnectionSummary => Boolean(item));
}

export async function listWorkRuntimes(): Promise<WorkRuntimeSummary[]> {
  const data = await workPost({ operation: 'list_work_runtimes' });
  return rows(data.runtimes).map(normalizeRuntime).filter((item): item is WorkRuntimeSummary => Boolean(item));
}

export async function registerWorkConnectionRef(input: { provider: string; mechanism: WorkConnectionSummary['mechanism']; externalRef: string; capabilities: string[] }) {
  const data = await workPost({
    operation: 'register_work_connection_ref',
    provider: input.provider,
    mechanism: input.mechanism,
    external_ref: input.externalRef,
    capabilities: input.capabilities
  });
  const normalized = normalizeConnection(data.connection);
  if (!normalized) throw new Error('work_connection_response_invalid');
  return normalized;
}

export async function revokeWorkConnectionRef(connectionId: string) {
  return workPost({ operation: 'revoke_work_connection_ref', connection_id: connectionId });
}

export async function enrollWorkRuntime(input: { kind: WorkRuntimeSummary['kind']; label: string; capabilities: string[] }) {
  const data = await workPost({ operation: 'enroll_work_runtime', kind: input.kind, label: input.label, capabilities: input.capabilities });
  const runtime = normalizeRuntime(data.runtime);
  const runtimeToken = String(data.runtime_token || '');
  if (!runtime || !runtimeToken) throw new Error('work_runtime_enroll_response_invalid');
  return { runtime, runtimeToken };
}
