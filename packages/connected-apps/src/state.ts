import type { ConnectedAppState } from './types';

type PersistedConnectedAppState = ConnectedAppState | 'unconfigured';

const TRANSITIONS: Record<ConnectedAppState, readonly ConnectedAppState[]> = {
  disconnected: ['authorizing'],
  authorizing: ['connected', 'error', 'disconnected'],
  connected: ['degraded', 'expired', 'revoked', 'error', 'disconnected'],
  degraded: ['connected', 'expired', 'revoked', 'error', 'disconnected'],
  expired: ['authorizing', 'disconnected'],
  revoked: ['authorizing', 'disconnected'],
  error: ['authorizing', 'disconnected']
};

export function normalizeConnectedAppState(state: PersistedConnectedAppState): ConnectedAppState {
  return state === 'unconfigured' ? 'disconnected' : state;
}

export function canTransitionConnectedAppState(
  from: PersistedConnectedAppState,
  to: ConnectedAppState
): boolean {
  return TRANSITIONS[normalizeConnectedAppState(from)].includes(to);
}
