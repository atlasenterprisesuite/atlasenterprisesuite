import { describe, expect, it } from 'vitest';
import { isLiveSource, validateIntegration } from '../../packages/health/src';

describe('Health source state', () => {
  it('only treats explicit live sources as live', () => {
    expect(isLiveSource('configured')).toBe(false);
    expect(isLiveSource('demo')).toBe(false);
    expect(isLiveSource('unavailable')).toBe(false);
    expect(isLiveSource('live')).toBe(true);
  });

  it('requires authorization and a successful health check for live integrations', () => {
    expect(validateIntegration({ id: 'x', kind: 'fhir', name: 'FHIR', state: 'live', authorized: false, lastHealthCheckAt: null })).toBe(false);
    expect(validateIntegration({ id: 'x', kind: 'fhir', name: 'FHIR', state: 'live', authorized: true, lastHealthCheckAt: '2026-09-04T00:00:00Z' })).toBe(true);
  });
});
