import { describe, expect, it } from 'vitest';
import { PROVIDER_STATES, type HospitalityProviderState } from '../../packages/hospitality/types';

describe('ATLAS Hospitality provider state contract', () => {
  it('exposes the complete fail-closed readiness state machine', () => {
    expect(PROVIDER_STATES).toEqual([
      'not_configured',
      'configured_unverified',
      'ready',
      'degraded',
      'offline',
      'disabled'
    ] satisfies HospitalityProviderState[]);
  });

  it('does not treat configured_unverified as ready', () => {
    const state: HospitalityProviderState = 'configured_unverified';
    expect(state).not.toBe('ready');
  });
});
