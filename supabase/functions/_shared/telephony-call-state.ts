export type AtlasCallState =
  | 'draft'
  | 'queued'
  | 'dialing'
  | 'ringing'
  | 'connected'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'blocked';

const STATE_RANK: Record<AtlasCallState, number> = {
  draft: 0,
  queued: 1,
  dialing: 2,
  ringing: 3,
  connected: 4,
  completed: 5,
  failed: 5,
  canceled: 5,
  blocked: 5
};

const TERMINAL_STATES = new Set<AtlasCallState>([
  'completed',
  'failed',
  'canceled',
  'blocked'
]);

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function shouldApplyProviderState(input: {
  currentState: AtlasCallState;
  currentProviderStateAt: string | null;
  incomingState: AtlasCallState | null;
  incomingOccurredAt: string | null;
}): boolean {
  if (!input.incomingState) return false;

  const incomingAt = timestamp(input.incomingOccurredAt);
  if (incomingAt === null) return false;

  if (TERMINAL_STATES.has(input.currentState)) return false;

  const currentAt = timestamp(input.currentProviderStateAt);
  if (currentAt === null) return true;
  if (incomingAt < currentAt) return false;
  if (incomingAt > currentAt) return true;

  return STATE_RANK[input.incomingState] >= STATE_RANK[input.currentState];
}
