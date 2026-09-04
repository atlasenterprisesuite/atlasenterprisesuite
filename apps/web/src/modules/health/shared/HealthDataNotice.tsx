import type { HealthSourceState } from '../healthDomain';
import { HealthStatusBadge } from './HealthStatusBadge';

export function HealthDataNotice({ state, text }: { state: HealthSourceState; text: string }) {
  return <div className="health-data-notice" role="status"><HealthStatusBadge state={state} /><span>{text}</span></div>;
}
