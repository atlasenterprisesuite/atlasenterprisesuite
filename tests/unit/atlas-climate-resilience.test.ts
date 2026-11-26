import { describe, expect, it } from 'vitest';
import { evaluateClimateEvidence } from '../../packages/analytics/src/climate-resilience';

const evidence = () => ({
  id: 'NWS-001',
  hazard: 'flood',
  mode: 'forecast',
  latitude: 28.5,
  longitude: -81.3,
  validFrom: '2026-11-26T12:00:00Z',
  validUntil: '2026-11-26T17:00:00Z',
  source: { provider: 'NOAA', url: 'https://api.weather.gov/alerts', publishedAt: '2026-11-26T11:00:00Z', recordId: '001' }
});
const context = () => ({
  now: '2026-11-26T13:00:00Z',
  trustedHosts: ['api.weather.gov'],
  providerAuthenticated: true,
  organizationAuthorized: true
});

describe('ATLAS Climate Resilience 777 — fail-closed evidence policy', () => {
  it('allows timely, authenticated data only for review, never publication', () => {
    expect(evaluateClimateEvidence(evidence(), context())).toEqual({
      state: 'reviewable', reasons: [], mayPublishAlert: false
    });
  });
  it('rejects missing provider or tenant authorization', () => {
    for (const key of ['providerAuthenticated', 'organizationAuthorized'] as const) {
      expect(evaluateClimateEvidence(evidence(), { ...context(), [key]: false }).state).toBe('rejected');
    }
  });
  it('rejects simulations as current evidence', () => {
    expect(evaluateClimateEvidence({ ...evidence(), mode: 'scenario' }, context()).reasons)
      .toContain('scenario_not_live_evidence');
  });
  it('does not trust suffix-spoofed provider domains', () => {
    const input = evidence();
    input.source.url = 'https://api.weather.gov.evil.example/alerts';
    expect(evaluateClimateEvidence(input, context()).reasons).toContain('untrusted_source');
  });
  it('rejects missing source, expired evidence, stale publication and invalid location', () => {
    const samples = [
      { ...evidence(), source: null },
      { ...evidence(), validUntil: '2026-11-26T12:20:00Z' },
      { ...evidence(), source: { ...evidence().source, publishedAt: '2026-11-20T11:00:00Z' } },
      { ...evidence(), latitude: 120 }
    ];
    for (const value of samples) expect(evaluateClimateEvidence(value, context()).state).toBe('rejected');
  });
  it('rejects malformed payloads and invalid clocks', () => {
    expect(evaluateClimateEvidence(null, context()).state).toBe('rejected');
    expect(evaluateClimateEvidence(evidence(), { ...context(), now: 'invalid' }).state).toBe('rejected');
  });
});
