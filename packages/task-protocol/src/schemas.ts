import type { AtlasTask, AtlasTaskState } from './types';

export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: string[] } };

const states = new Set<AtlasTaskState>([
  'draft', 'queued', 'planning', 'implementation', 'review', 'qa', 'ci',
  'awaiting_human_approval', 'approved', 'deploying', 'verified', 'completed',
  'blocked', 'failed', 'cancelled'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validateTask(value: unknown): SafeParseResult<AtlasTask> {
  const issues: string[] = [];
  if (!isRecord(value)) return { success: false, error: { issues: ['task must be an object'] } };

  if (value.schemaVersion !== 1) issues.push('schemaVersion must equal 1');
  for (const key of ['taskId', 'objective', 'requestedBy'] as const) {
    if (!nonEmptyString(value[key])) issues.push(`${key} is required`);
  }

  const scope = value.scope;
  if (!isRecord(scope) || !nonEmptyString(scope.tenantId) || !nonEmptyString(scope.organizationId)) {
    issues.push('scope.tenantId and scope.organizationId are required');
  }

  if (!Array.isArray(value.assignedAgents) || !value.assignedAgents.every(nonEmptyString)) {
    issues.push('assignedAgents must be an array of non-empty strings');
  }
  if (!nonEmptyString(value.state) || !states.has(value.state as AtlasTaskState)) issues.push('state is invalid');

  for (const key of ['artifacts', 'findings', 'commits', 'tests', 'approvals', 'events'] as const) {
    if (!Array.isArray(value[key])) issues.push(`${key} must be an array`);
  }

  if (!(value.traceId === null || nonEmptyString(value.traceId))) issues.push('traceId must be null or a non-empty string');
  if (!(value.deployment === null || isRecord(value.deployment))) issues.push('deployment must be null or an object');
  if (!isIsoDate(value.createdAt)) issues.push('createdAt must be an ISO-compatible date');
  if (!isIsoDate(value.updatedAt)) issues.push('updatedAt must be an ISO-compatible date');

  if (issues.length) return { success: false, error: { issues } };
  return { success: true, data: value as unknown as AtlasTask };
}

export const AtlasTaskSchema = {
  safeParse: validateTask,
  parse(value: unknown): AtlasTask {
    const result = validateTask(value);
    if (!result.success) throw new Error(result.error.issues.join('; '));
    return result.data;
  }
};
