import { describe, expect, it } from 'vitest';
import type { AviationEvidenceRecord } from '../../apps/web/src/modules/aviation/aviation-evidence';
import { deriveCertificationStage } from '../../apps/web/src/modules/aviation/aviation-certification';
import {
  classifyInvestmentFreshness,
  getOfficialInvestmentAction,
  type AviationInvestmentProfile
} from '../../apps/web/src/modules/aviation/aviation-investment';

const NOW = new Date('2026-09-19T12:00:00Z');

function certificationEvidence(overrides: Partial<AviationEvidenceRecord> = {}): AviationEvidenceRecord {
  return {
    id: 'cert-1',
    aircraftId: 'atlas-a1-metro',
    claimKey: 'certification.stage',
    claimValue: 'testing',
    sourceType: 'regulator',
    publisher: 'Example Aviation Authority',
    title: 'Certification program status',
    canonicalUrl: 'https://example.gov/program',
    retrievedAt: '2026-09-18T12:00:00Z',
    publishedAt: '2026-09-18T10:00:00Z',
    trustClass: 'primary_authority',
    ...overrides
  };
}

function investment(overrides: Partial<AviationInvestmentProfile> = {}): AviationInvestmentProfile {
  return {
    status: 'active',
    sharePriceUsd: null,
    minimumInvestmentUsd: null,
    valuationUsd: null,
    officialSourceUrl: null,
    officialSourceVerified: false,
    lastVerifiedAt: '2026-09-18T12:00:00Z',
    ...overrides
  };
}

describe('ATLAS Aviation certification normalization', () => {
  it('never upgrades certification beyond primary-authority evidence', () => {
    expect(deriveCertificationStage([])).toBe('unknown');

    const records = [
      certificationEvidence({ claimValue: 'testing' }),
      certificationEvidence({
        id: 'manufacturer-claim',
        claimValue: 'approved',
        sourceType: 'manufacturer',
        publisher: 'Concept Manufacturer',
        trustClass: 'primary_party'
      })
    ];
    expect(deriveCertificationStage(records)).toBe('testing');
  });

  it('accepts an approved stage when primary-authority evidence says approved', () => {
    expect(deriveCertificationStage([certificationEvidence({ claimValue: 'approved' })])).toBe('approved');
  });
});

describe('ATLAS Aviation investment boundary', () => {
  it('classifies missing and stale investment verification explicitly', () => {
    expect(classifyInvestmentFreshness(investment({ status: 'not_configured', lastVerifiedAt: null }), NOW))
      .toBe('not_configured');
    expect(classifyInvestmentFreshness(investment({ lastVerifiedAt: '2026-07-01T12:00:00Z' }), NOW))
      .toBe('stale');
    expect(classifyInvestmentFreshness(investment(), NOW)).toBe('ready');
  });

  it('exposes an official action only for a verified HTTPS source', () => {
    expect(getOfficialInvestmentAction(investment())).toBeNull();
    expect(getOfficialInvestmentAction(investment({
      officialSourceUrl: 'http://example.com/offering',
      officialSourceVerified: true
    }))).toBeNull();
    expect(getOfficialInvestmentAction(investment({
      officialSourceUrl: 'https://example.com/offering',
      officialSourceVerified: false
    }))).toBeNull();
    expect(getOfficialInvestmentAction(investment({
      officialSourceUrl: 'https://example.com/offering',
      officialSourceVerified: true
    }))).toBe('https://example.com/offering');
  });
});
