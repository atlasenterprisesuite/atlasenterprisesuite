import { sourceStateLabel, type HealthSourceState } from '../healthDomain';

export function HealthStatusBadge({ state }: { state: HealthSourceState }) {
  return <span className={`health-status health-status-${state}`}>{sourceStateLabel(state)}</span>;
}
