import { describe, expect, it } from 'vitest';
import { validateGenesisResearchRecord } from '../../apps/web/src/modules/knowledge/genesisResearch';

const valid = {
  id: 'gen-001',
  trackId: 'GEN-03',
  claim: 'iPSC-derived products require tumorigenicity assessment.',
  evidenceState: 'strongly-supported',
  sourceRefs: ['https://pubmed.ncbi.nlm.nih.gov/12345678/'],
  domainOwner: 'knowledge',
  clinicalReadiness: 'not-evaluated',
  engineeringState: 'specified'
};

describe('ATLAS GENESIS evidence contract', () => {
  it('accepts a well-sourced research claim without asserting clinical approval', () => {
    expect(validateGenesisResearchRecord(valid)).toEqual({ ok: true, errors: [] });
  });

  it.each([
    [{ ...valid, trackId: 'GEN-99' }, 'invalid-track'],
    [{ ...valid, sourceRefs: [] }, 'missing-source'],
    [{ ...valid, evidenceState: 'cured' }, 'invalid-evidence-state'],
    [{ ...valid, domainOwner: '' }, 'missing-owner'],
    [{ ...valid, claim: ' ' }, 'missing-claim'],
    [{ ...valid, clinicalReadiness: 'authorized-use' }, 'unsupported-clinical-readiness'],
    [{ ...valid, engineeringState: 'production-verified' }, 'unsupported-engineering-state']
  ])('fails closed on invalid or unsupported claims', (record, error) => {
    const result = validateGenesisResearchRecord(record);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(error);
  });
});
