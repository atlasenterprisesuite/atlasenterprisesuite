import { describe, expect, it } from 'vitest';
import {
  canTransitionBooking,
  canTransitionEvent,
  canTransitionSettlement,
  EVENTS_APPROVAL_GATES,
  EVENTS_EXTERNAL_BOUNDARIES
} from '../../packages/events-entertainment/src/index';

describe('events entertainment domain', () => {
  it('allows governed event lifecycle transitions', () => {
    expect(canTransitionEvent('draft', 'planning')).toBe(true);
    expect(canTransitionEvent('live', 'closed')).toBe(false);
    expect(canTransitionEvent('settling', 'closed')).toBe(true);
  });

  it('governs booking and settlement independently', () => {
    expect(canTransitionBooking('draft', 'sent')).toBe(true);
    expect(canTransitionBooking('accepted', 'contracted')).toBe(true);
    expect(canTransitionBooking('draft', 'contracted')).toBe(false);
    expect(canTransitionSettlement('review', 'approved')).toBe(true);
    expect(canTransitionSettlement('draft', 'paid')).toBe(false);
  });

  it('fails closed for unverified external providers', () => {
    expect(EVENTS_EXTERNAL_BOUNDARIES.ticketing).toBe('authorization_required');
    expect(EVENTS_EXTERNAL_BOUNDARIES.payments).toBe('authorization_required');
    expect(EVENTS_EXTERNAL_BOUNDARIES.accessControl).toBe('authorization_required');
  });

  it('requires approval for financially or legally sensitive actions', () => {
    expect(EVENTS_APPROVAL_GATES.contract).toBe(true);
    expect(EVENTS_APPROVAL_GATES.refund).toBe(true);
    expect(EVENTS_APPROVAL_GATES.settlement).toBe(true);
    expect(EVENTS_APPROVAL_GATES.payment).toBe(true);
  });
});
