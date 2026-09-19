import { describe, expect, it } from 'vitest';
import { canTransitionEvent, EVENTS_EXTERNAL_BOUNDARIES } from '../../packages/events-entertainment/src/index';

describe('events entertainment domain', () => {
  it('allows governed lifecycle transitions', () => {
    expect(canTransitionEvent('draft', 'planning')).toBe(true);
    expect(canTransitionEvent('live', 'closed')).toBe(false);
    expect(canTransitionEvent('settling', 'closed')).toBe(true);
  });

  it('fails closed for unverified external providers', () => {
    expect(EVENTS_EXTERNAL_BOUNDARIES.ticketing).toBe('authorization_required');
    expect(EVENTS_EXTERNAL_BOUNDARIES.payments).toBe('authorization_required');
  });
});
