import type { MorningFocusRecord } from './morningFocusModel';
import { isMorningFocusComplete } from './morningFocusModel';

/**
 * Read-only bridge to ATLAS Execution. Never creates a workflow or grants permissions.
 * An evidence note is not a server-side execution audit event.
 */
export type MorningFocusExecutionLink = Readonly<{
  workflowId: string;
  taskId: string;
  record: MorningFocusRecord;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function executionLinkTarget(link: MorningFocusExecutionLink): string | null {
  if (!UUID.test(link.workflowId) || !UUID.test(link.taskId)) return null;
  if (!isMorningFocusComplete(link.record)) return null;
  return `/execution/workflows/${link.workflowId.toLowerCase()}`;
}
