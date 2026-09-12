import type { AtlasTaskState } from './types';

const transitions: Record<AtlasTaskState, readonly AtlasTaskState[]> = {
  draft: ['queued', 'blocked', 'failed', 'cancelled'],
  queued: ['planning', 'blocked', 'failed', 'cancelled'],
  planning: ['implementation', 'blocked', 'failed', 'cancelled'],
  implementation: ['review', 'blocked', 'failed', 'cancelled'],
  review: ['qa', 'implementation', 'blocked', 'failed', 'cancelled'],
  qa: ['ci', 'implementation', 'blocked', 'failed', 'cancelled'],
  ci: ['awaiting_human_approval', 'implementation', 'blocked', 'failed', 'cancelled'],
  awaiting_human_approval: ['approved', 'implementation', 'cancelled'],
  approved: ['deploying', 'cancelled'],
  deploying: ['verified', 'failed'],
  verified: ['completed', 'failed'],
  blocked: ['queued', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: []
};

export function canTransition(from: AtlasTaskState, to: AtlasTaskState): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: AtlasTaskState, to: AtlasTaskState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal ATLAS task transition: ${from} -> ${to}`);
  }
}
