import { describe, expect, it } from 'vitest';
import { evaluateProviderIncident, type ProviderIncident } from '../../packages/core/src';

// Synthetic incident fixture. This does not assert that ATLAS uses an R2 bucket.
const regionalR2Incident: ProviderIncident = {
  provider: 'cloudflare',
  incidentId: 'fixture-r2-south-america-2026-11-17',
  title: 'Elevated errors and read timeouts for R2 requests originating in South America',
  status: 'monitoring',
  impact: 'degraded_performance',
  affectedComponents: ['Cloudflare R2'],
  observedAt: '2026-11-17T20:05:00.000Z',
  source: 'https://www.cloudflarestatus.com/'
};

describe('Cloudflare R2 regional incident attribution', () => {
  it('does not block unrelated critical ATLAS workloads without evidence of R2 dependency', () => {
    expect(evaluateProviderIncident(regionalR2Incident, {
      dependencyId: 'atlas-enterprise-worker',
      criticality: 'P0',
      matchesAffectedComponent: false
    })).toMatchObject({
      priority: 'P1',
      gate: 'none',
      attributedTo: 'provider',
      resolved: false
    });
  });

  it('blocks a proven critical R2 read dependency while a regional incident is active', () => {
    expect(evaluateProviderIncident(regionalR2Incident, {
      dependencyId: 'critical-document-read-via-r2',
      criticality: 'P0',
      matchesAffectedComponent: true
    })).toMatchObject({
      priority: 'P0',
      gate: 'blocked',
      attributedTo: 'provider',
      resolved: false
    });
  });

  it('warns but does not globally block an affected optional R2 dependency', () => {
    expect(evaluateProviderIncident(regionalR2Incident, {
      dependencyId: 'optional-r2-media-preview',
      criticality: 'P1',
      matchesAffectedComponent: true
    })).toMatchObject({
      priority: 'P1',
      gate: 'warning',
      resolved: false
    });
  });

  it('removes the provider incident gate when resolved without claiming application recovery', () => {
    expect(evaluateProviderIncident({ ...regionalR2Incident, status: 'resolved' }, {
      dependencyId: 'critical-document-read-via-r2',
      criticality: 'P0',
      matchesAffectedComponent: true
    })).toMatchObject({
      priority: 'P1',
      gate: 'none',
      resolved: true
    });
  });
});
