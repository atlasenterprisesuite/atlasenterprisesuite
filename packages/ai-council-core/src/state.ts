import type { CouncilTask, CouncilTaskState } from './task';

const transitions: Readonly<Record<CouncilTaskState, readonly CouncilTaskState[]>> = {
  received: ['authorized', 'rejected', 'cancelled'],
  authorized: ['queued', 'blocked', 'cancelled'],
  queued: ['collecting', 'blocked', 'cancelled'],
  collecting: ['ready_for_consensus', 'degraded', 'failed', 'blocked', 'cancelled'],
  ready_for_consensus: ['consensus_complete', 'blocked', 'cancelled'],
  consensus_complete: ['awaiting_human_approval', 'ready_for_handoff', 'blocked', 'cancelled'],
  awaiting_human_approval: ['ready_for_handoff', 'blocked', 'cancelled'],
  ready_for_handoff: ['implementing', 'blocked', 'cancelled'],
  implementing: ['reviewing', 'failed', 'blocked', 'cancelled'],
  reviewing: ['completed', 'implementing', 'failed', 'blocked', 'cancelled'],
  degraded: ['collecting', 'failed', 'blocked', 'cancelled'],
  rejected: [],
  failed: [],
  completed: [],
  cancelled: [],
  blocked: ['cancelled'],
};

export function canTransitionCouncilTask(from: CouncilTaskState, to: CouncilTaskState): boolean {
  return transitions[from].includes(to);
}

export function transitionCouncilTask(
  task: CouncilTask,
  nextState: CouncilTaskState,
  now: () => string = () => new Date().toISOString(),
): CouncilTask {
  if (!canTransitionCouncilTask(task.state, nextState)) {
    throw new Error(`Invalid AI Council task transition: ${task.state} -> ${nextState}`);
  }

  return Object.freeze({ ...task, state: nextState, updatedAt: now() });
}
