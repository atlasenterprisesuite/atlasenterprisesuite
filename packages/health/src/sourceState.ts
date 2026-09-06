import type { HealthSourceState } from './types';

export function isLiveSource(state: HealthSourceState) {
  return state === 'live';
}
