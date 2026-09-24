import type { WorkView, WorkWorkflow } from './types';

const HISTORY_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export function workflowsByView(
  workflows: readonly WorkWorkflow[],
  view: WorkView
): WorkWorkflow[] {
  if (view === 'all') return [...workflows];
  if (view === 'approvals') return workflows.filter((workflow) => workflow.status === 'awaiting_approval');
  if (view === 'history') return workflows.filter((workflow) => HISTORY_STATUSES.has(workflow.status));
  return workflows.filter((workflow) => !HISTORY_STATUSES.has(workflow.status));
}
