import type { HealthSourceState } from './types';

export function isLiveSource(state: HealthSourceState) {
  return state === 'live';
}

export function sourceStateLabel(state: HealthSourceState) {
  switch (state) {
    case 'demo': return 'DEMO DATA';
    case 'configured': return 'CONFIGURED';
    case 'live': return 'LIVE';
    case 'unavailable': return 'UNAVAILABLE';
  }
}
