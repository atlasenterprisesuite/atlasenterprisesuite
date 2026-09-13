import type { ExecutionStep } from './types';

export function resolveCurrentStep(
  steps: readonly ExecutionStep[],
  completedDependencyIds: ReadonlySet<string>
) {
  return [...steps]
    .sort((a, b) => a.sequence - b.sequence)
    .find((step) => {
      if (step.status === 'completed' || step.status === 'cancelled') return false;
      return step.dependencyIds.every((id) => completedDependencyIds.has(id));
    }) ?? null;
}
