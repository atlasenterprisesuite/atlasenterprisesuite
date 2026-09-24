import { describe, expect, it } from 'vitest';
import { classifyEvidenceState, type AviationEvidenceRecord } from '../../apps/web/src/modules/aviation/aviation-evidence';

const NOW = new Date('2026-09-19T12:00:00Z');

function evidence(overrides: Partial<AviationEvidenceRecord> = {}): AviationEvidenceRecord {
  return {
    id: 'ev-1',
    aircraftId: 'atlas-a1-metro',
    claimKey: 'certification.stage',
    claimValue: 'testing',
    sourceType: 'regulator',
    publisher: 'Example Aviation Authority',
    title: 'Program status',
    canonicalUrl: 'https://example.gov/status',
    retrievedAt: '2026-09-18T12:00:00Z',
    publishedAt: '2026-09-18T10:00:00Z',
    trustClass: 'primary_authority',
    ...overrides
  };
}

describe('ATLAS Aviation evidence state', () => {
  it('distinguishes not-configured, ready and stale evidence', () => {
    expect(classifyEvidenceState([], NOW)).toBe('not_configured');
    expect(classifyEvidenceState([evidence()], NOW)).toBe('ready');
    expect(classifyEvidenceState([evidence({ retrievedAt: '2026-07-01T12:00:00Z' })], NOW)).toBe('stale');
  });

  it('surfaces contradictory claims as conflict instead of silently choosing one', () => {
    const records = [
      evidence({ id: 'ev-a', claimValue: 'testing' }),
      evidence({ id: 'ev-b', claimValue: 'approved', publisher: 'Manufacturer', sourceType: 'manufacturer', trustClass: 'primary_party' })
    ];
    expect(classifyEvidenceState(records, NOW)).toBe('conflict');
  });
});
