import { describe, expect, it } from 'vitest';
import { shouldApplyProviderState } from '../../supabase/functions/_shared/telephony-call-state';

describe('ATLAS telephony provider-state reconciliation', () => {
  it('advances state for a newer provider event', () => {
    expect(shouldApplyProviderState({
      currentState: 'dialing',
      currentProviderStateAt: '2026-10-04T12:00:00.000Z',
      incomingState: 'connected',
      incomingOccurredAt: '2026-10-04T12:00:05.000Z'
    })).toBe(true);
  });

  it('rejects an older provider event', () => {
    expect(shouldApplyProviderState({
      currentState: 'connected',
      currentProviderStateAt: '2026-10-04T12:00:05.000Z',
      incomingState: 'dialing',
      incomingOccurredAt: '2026-10-04T12:00:00.000Z'
    })).toBe(false);
  });

  it('does not regress a terminal call even when a later non-terminal event arrives', () => {
    expect(shouldApplyProviderState({
      currentState: 'completed',
      currentProviderStateAt: '2026-10-04T12:00:10.000Z',
      incomingState: 'connected',
      incomingOccurredAt: '2026-10-04T12:00:11.000Z'
    })).toBe(false);
  });

  it('uses lifecycle rank to resolve equal timestamps without regression', () => {
    const timestamp = '2026-10-04T12:00:05.000Z';
    expect(shouldApplyProviderState({
      currentState: 'connected',
      currentProviderStateAt: timestamp,
      incomingState: 'dialing',
      incomingOccurredAt: timestamp
    })).toBe(false);
    expect(shouldApplyProviderState({
      currentState: 'dialing',
      currentProviderStateAt: timestamp,
      incomingState: 'connected',
      incomingOccurredAt: timestamp
    })).toBe(true);
  });

  it('requires a valid provider occurrence timestamp before mutating state', () => {
    expect(shouldApplyProviderState({
      currentState: 'dialing',
      currentProviderStateAt: null,
      incomingState: 'connected',
      incomingOccurredAt: null
    })).toBe(false);
    expect(shouldApplyProviderState({
      currentState: 'dialing',
      currentProviderStateAt: null,
      incomingState: 'connected',
      incomingOccurredAt: 'not-a-date'
    })).toBe(false);
  });
});
