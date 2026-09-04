import type { HealthSourceState } from '../../../../../../packages/health/src';

export function HealthStatusBadge({ state }: { state: HealthSourceState }) {
  return <span className={`status-pill health-${state}`}>{state}</span>;
}
