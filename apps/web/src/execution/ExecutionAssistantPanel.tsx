import { useEffect, useMemo, useState } from 'react';
import type { GuidedExecutionState } from './types';
import {
  buildExecutionAssistantSnapshot,
  resolveExecutionAssistantCommand,
  type ExecutionAssistantResult
} from './assistant';

function summaryFromState(state: GuidedExecutionState) {
  const snapshot = buildExecutionAssistantSnapshot(state);
  if (state.workflow.status === 'completed') return 'Workflow completed. There is no persisted next action.';
  if (snapshot.pendingApprovalId) return `Approval ${snapshot.pendingApprovalId} is pending before execution can continue.`;
  if (snapshot.status === 'blocked' || snapshot.blockedReason) {
    return `Execution is blocked${snapshot.blockedReason ? `: ${snapshot.blockedReason}` : '.'}`;
  }
  if (snapshot.status === 'failed') return 'The current execution task failed. Review the persisted step before continuing.';
  if (snapshot.currentAction) return `Current persisted action: ${snapshot.currentAction}.`;
  if (snapshot.nextAction) return `Next persisted action: ${snapshot.nextAction}.`;
  return 'No current execution action is persisted for this workflow.';
}

function selectableStep(result: ExecutionAssistantResult) {
  if (
    result.kind === 'focus_step'
    || result.kind === 'show_approval'
    || result.kind === 'show_blocker'
    || result.kind === 'show_failure'
    || result.kind === 'show_next_action'
    || result.kind === 'stopped'
  ) return result.stepId;
  return null;
}

export function ExecutionAssistantPanel({
  state,
  onSelectStep
}: {
  state: GuidedExecutionState;
  onSelectStep: (stepId: string) => void;
}) {
  const stateSummary = useMemo(() => summaryFromState(state), [state]);
  const [summary, setSummary] = useState(stateSummary);

  useEffect(() => {
    setSummary(stateSummary);
  }, [stateSummary]);

  const runCommand = (command: string) => {
    const result = resolveExecutionAssistantCommand(command, state);
    setSummary(result.message);
    const stepId = selectableStep(result);
    if (stepId) onSelectStep(stepId);
  };

  return (
    <aside className="execution-assistant execution-panel" aria-label="ATLAS Assistant">
      <p className="eyebrow">ATLAS Assistant</p>
      <h2>Execution companion</h2>
      <p role="status" aria-live="polite">{summary}</p>
      <div className="execution-assistant-actions">
        <button className="execution-action" type="button" onClick={() => runCommand('continue')}>Continue</button>
        <button className="execution-action" type="button" onClick={() => runCommand('what is next')}>What is next?</button>
        <button className="execution-action" type="button" onClick={() => runCommand('where did we stop')}>Where did we stop?</button>
      </div>
      <p className="execution-assistant-boundary">
        Assistant commands navigate persisted execution context only. They do not authorize or execute provider actions.
      </p>
    </aside>
  );
}
