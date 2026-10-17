import { resolveCapability } from './capability-registry';
import type { ExecutionAuditEvent, ExecutionScope, ExecutionWorkflow } from './types';

export type AtlasMissionRunState =
  | 'pending'
  | 'running'
  | 'paused'
  | 'blocked'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface AtlasMissionProjection {
  missionId: string;
  workflowId: string;
  scope: ExecutionScope;
  ownerModule: string;
  requestedOutcome: string;
  capabilityIds: string[];
  state: AtlasMissionRunState;
  currentTaskId: string | null;
  correlationId: string | null;
  createdAt: string;
  updatedAt: string;
  warnings: string[];
}

export interface AtlasMissionEventProjection {
  eventId: string;
  missionId: string;
  workflowId: string;
  taskId: string | null;
  capabilityId: string | null;
  type: string;
  correlationId: string | null;
  evidenceIds: string[];
  createdAt: string;
}

function mapState(status: ExecutionWorkflow['status']): AtlasMissionRunState {
  switch (status) {
    case 'draft':
      return 'pending';
    case 'blocked':
    case 'awaiting_approval':
      return 'blocked';
    case 'completed':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'running';
  }
}

function stringContext(context: Record<string, unknown>, key: string): string | null {
  const value = context[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function capabilityContext(context: Record<string, unknown>) {
  const raw = Array.isArray(context.capabilityIds) ? context.capabilityIds : [];
  const capabilityIds: string[] = [];
  const warnings: string[] = [];

  for (const value of raw) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const id = value.trim();
    try {
      resolveCapability(id);
      if (!capabilityIds.includes(id)) capabilityIds.push(id);
    } catch {
      warnings.push(`unknown_capability:${id}`);
    }
  }

  return { capabilityIds, warnings };
}

export function projectMission(input: { workflow: ExecutionWorkflow }): AtlasMissionProjection {
  const { workflow } = input;
  const { capabilityIds, warnings } = capabilityContext(workflow.context);

  return {
    missionId: workflow.id,
    workflowId: workflow.id,
    scope: workflow.scope,
    ownerModule: workflow.ownerModule,
    requestedOutcome: stringContext(workflow.context, 'requestedOutcome') ?? workflow.workflowType,
    capabilityIds,
    state: mapState(workflow.status),
    currentTaskId: workflow.currentTaskId,
    correlationId: stringContext(workflow.context, 'correlationId'),
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    warnings
  };
}

function parseCapabilityAction(action: string): { capabilityId: string | null; type: string } {
  const match = /^capability:([^:]+):(.+)$/.exec(action);
  if (!match) return { capabilityId: null, type: action };

  try {
    resolveCapability(match[1]);
    return { capabilityId: match[1], type: match[2] };
  } catch {
    return { capabilityId: null, type: match[2] };
  }
}

export function projectMissionEvents(input: {
  workflow: ExecutionWorkflow;
  auditEvents: ExecutionAuditEvent[];
}): AtlasMissionEventProjection[] {
  return input.auditEvents
    .filter((event) => event.workflowId === input.workflow.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((event) => {
      const parsed = parseCapabilityAction(event.action);
      return {
        eventId: event.id,
        missionId: input.workflow.id,
        workflowId: input.workflow.id,
        taskId: event.taskId,
        capabilityId: parsed.capabilityId,
        type: parsed.type,
        correlationId: event.correlationId,
        evidenceIds: [...event.evidenceIds],
        createdAt: event.createdAt
      };
    });
}
