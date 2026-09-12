import type { GuidedExecutionState, GuidedTask } from './types';
import { workflowProgress } from './view-model';

type Props = {
  state: GuidedExecutionState;
  task: GuidedTask | null;
};

function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function WorkflowHeader({ state, task }: Props) {
  const progress = workflowProgress(state);
  return (
    <header className="execution-header">
      <div>
        <p className="eyebrow">ATLAS Guided Execution</p>
        <h1>{task?.title || 'Execution workflow'}</h1>
        <p>{task?.goal || 'No active task is available for this workflow.'}</p>
      </div>
      <div className="execution-header-meta">
        <div role="status" aria-live="polite">
          <span className="execution-meta-label">Workflow status</span>
          <strong>{statusLabel(state.workflow.status)}</strong>
        </div>
        <div>
          <span className="execution-meta-label">Priority</span>
          <strong>{task ? statusLabel(task.priority) : 'Not set'}</strong>
        </div>
        <div aria-label="Verified workflow progress">
          <span className="execution-meta-label">Progress</span>
          <strong>{progress.completed} of {progress.total} steps completed</strong>
        </div>
      </div>
    </header>
  );
}
