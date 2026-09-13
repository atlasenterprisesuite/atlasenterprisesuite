import type { WorkAutonomyLevel, WorkExecutionMode, WorkRuntimePreference } from '../../../../packages/execution/src/work-types';

const executionModeLabels: Record<WorkExecutionMode, string> = { api: 'API', browser: 'Browser', hybrid: 'Hybrid' };
const autonomyLabels: Record<WorkAutonomyLevel, string> = { manual: 'Manual', guided: 'Guided', autonomous: 'Autonomous' };
const runtimeLabels: Record<WorkRuntimePreference, string> = { auto: 'Auto', local: 'Local', self_hosted: 'Self-hosted', cloud_ephemeral: 'Cloud ephemeral' };

export function ExecutionConfiguration({
  executionMode,
  autonomyLevel,
  runtimePreference,
  budgetLimit
}: {
  executionMode: WorkExecutionMode;
  autonomyLevel: WorkAutonomyLevel;
  runtimePreference: WorkRuntimePreference;
  budgetLimit: number | null;
}) {
  return (
    <dl className="work-preview-facts" aria-label="Execution configuration">
      <div><dt>Mode</dt><dd>{executionModeLabels[executionMode]}</dd></div>
      <div><dt>Autonomy</dt><dd>{autonomyLabels[autonomyLevel]}</dd></div>
      <div><dt>Runtime</dt><dd>{runtimeLabels[runtimePreference]}</dd></div>
      <div><dt>Paid-provider budget</dt><dd>{budgetLimit === null ? '$0 effective' : `$${budgetLimit}`}</dd></div>
    </dl>
  );
}
