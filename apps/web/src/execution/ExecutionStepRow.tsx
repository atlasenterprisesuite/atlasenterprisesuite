import type { GuidedStep } from './types';

export function humanizeExecutionValue(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type Props = {
  step: GuidedStep;
  selected: boolean;
  onSelect: (stepId: string) => void;
};

export function ExecutionStepRow({ step, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      className="execution-step"
      aria-current={selected ? 'step' : undefined}
      onClick={() => onSelect(step.id)}
    >
      <span className="execution-step-sequence">{step.sequence}</span>
      <span className="execution-step-copy">
        <strong>{humanizeExecutionValue(step.actionType)}</strong>
        <span>{humanizeExecutionValue(step.status)}</span>
      </span>
    </button>
  );
}
