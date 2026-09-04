import type { HealthSourceState } from '../../../../../../packages/health/src';

export function HealthDataNotice({ state, text }: { state: HealthSourceState; text: string }) {
  return (
    <div className={state === 'live' ? 'notice' : 'notice strong'} role="status">
      <strong>{state.toUpperCase()}</strong> · {text}
    </div>
  );
}
