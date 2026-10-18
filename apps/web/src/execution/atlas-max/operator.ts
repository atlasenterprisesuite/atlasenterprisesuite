export type OperatorState = 'draft' | 'ready' | 'running' | 'waiting' | 'paused' | 'failed' | 'completed' | 'disabled';
export type OperatorEvent = 'prepare' | 'start' | 'wait' | 'pause' | 'fail' | 'complete' | 'disable';
export interface OperatorEvidence { runtimeRef?: string; completionRef?: string; checkpointRef?: string; authorized?: boolean; withinBudget?: boolean; }
export function transitionOperator(state: OperatorState, event: OperatorEvent, evidence: OperatorEvidence): OperatorState {
  if (event === 'disable') return 'disabled';
  if (state === 'draft' && event === 'prepare') return 'ready';
  if (state === 'ready' && event === 'start') {
    return evidence.runtimeRef && evidence.authorized !== false && evidence.withinBudget !== false ? 'running' : 'ready';
  }
  if (state === 'running' && event === 'wait') return 'waiting';
  if ((state === 'running' || state === 'waiting') && event === 'pause') return 'paused';
  if ((state === 'running' || state === 'waiting') && event === 'fail') return 'failed';
  if (state === 'running' && event === 'complete') return evidence.completionRef ? 'completed' : 'running';
  return state;
}
