import { useId, useState } from 'react';
import type { GuidedStep, GuidedTask } from './types';
import { ExecutionStepRow, humanizeExecutionValue } from './ExecutionStepRow';

type Props = {
  task: GuidedTask;
  taskNumber: number;
  steps: GuidedStep[];
  selectedStepId: string | null;
  current: boolean;
  onSelectStep: (stepId: string) => void;
};

export function TaskGroup({ task, taskNumber, steps, selectedStepId, current, onSelectStep }: Props) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(current);

  return (
    <section className="execution-task-group" data-status={task.status}>
      <button
        type="button"
        className="execution-task-toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
      >
        <span>Task {taskNumber} — {task.title}</span>
        <span>{humanizeExecutionValue(task.status)} · {steps.length} steps</span>
      </button>
      <div id={panelId} hidden={!expanded}>
        {task.blockedReason ? <p className="execution-inline-blocker">Blocked: {task.blockedReason}</p> : null}
        <div className="execution-step-list">
          {steps.length === 0 ? <p>No persisted steps are available for this task.</p> : steps.map((step) => (
            <ExecutionStepRow
              key={step.id}
              step={step}
              selected={selectedStepId === step.id}
              onSelect={onSelectStep}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
