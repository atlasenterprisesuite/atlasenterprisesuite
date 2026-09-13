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

async function workPost(body: Record<string, unknown>) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-execution', {
    method: 'POST',
    body: JSON.stringify({ ...body, organization_id: organization.id })
  });
  return parseWorkResponse(response);
}

export async function listWorkflows(): Promise<WorkWorkflow[]> {
  const data = await workPost({ operation: 'list_workflows' });
  return rows(record(data).workflows).map(normalizeWorkWorkflow);
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
