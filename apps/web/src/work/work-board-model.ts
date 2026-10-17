import type { ExecutionStatus } from '../../../../packages/execution/src/types';
import type { WorkWorkflow } from './types';

/**
 * A read-only projection of the existing, organization-scoped ATLAS Work API.
 * This is NOT an independent workflow store or status engine.
 */
export const WORK_BOARD_LANES = [
  { id: 'planned', title: 'Planned' },
  { id: 'in_progress', title: 'In progress' },
  { id: 'approval', title: 'Awaiting approval' },
  { id: 'blocked', title: 'Blocked' },
  { id: 'closed', title: 'Closed / history' }
] as const;

export type WorkBoardLaneId = (typeof WORK_BOARD_LANES)[number]['id'];

export const WORK_STATUS_LANE: Record<ExecutionStatus, WorkBoardLaneId> = {
  draft: 'planned',
  next: 'planned',
  automatable: 'planned',
  now: 'in_progress',
  delegated: 'in_progress',
  awaiting_approval: 'approval',
  blocked: 'blocked',
  completed: 'closed',
  failed: 'closed',
  cancelled: 'closed',
  discarded: 'closed'
};

export type WorkBoardFilter = {
  query?: string;
  module?: string;
};

function searchable(value: string) {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function buildWorkBoard(workflows: readonly WorkWorkflow[], filter: WorkBoardFilter = {}) {
  const scopes = new Set(workflows.map(workflow => workflow.organizationId));
  if (scopes.size > 1 || scopes.has('')) throw new Error('work_board_scope_mismatch');

  const ids = new Set<string>();
  for (const workflow of workflows) {
    if (!workflow.id || ids.has(workflow.id)) throw new Error('work_board_duplicate_workflow');
    ids.add(workflow.id);
    if (!Object.prototype.hasOwnProperty.call(WORK_STATUS_LANE, workflow.status)) {
      throw new Error('work_board_unknown_status');
    }
  }

  const query = searchable((filter.query ?? '').trim());
  const module = (filter.module ?? '').trim();
  const visible = workflows
    .filter(workflow => !module || workflow.ownerModule === module)
    .filter(workflow => !query || searchable([
      workflow.id,
      workflow.ownerModule,
      workflow.currentModule,
      workflow.status
    ].join(' ')).includes(query))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.id.localeCompare(b.id));

  return WORK_BOARD_LANES.map(lane => ({
    ...lane,
    workflows: visible.filter(workflow => WORK_STATUS_LANE[workflow.status] === lane.id)
  }));
}
