import { describe, expect, it } from 'vitest';
import { assessVisualEvidence, type VisualEvidence } from '../../packages/visual-intelligence/src';
const sha = 'a'.repeat(64);
const valid: VisualEvidence = {
  tenantId: 'org-a', imageSha256: sha, sourceUrl: 'https://example.org/photo',
  observedAt: '2026-10-28T12:00:00Z', similarity: 1, provenanceVerified: true
};
describe('visual intelligence evidence fails closed', () => {
  it('rejects missing tenant or malformed hashes', () => {
    expect(assessVisualEvidence('', sha, [valid]).status).toBe('INCONCLUSIVE');
    expect(assessVisualEvidence('org-a', 'invalid', [valid]).matches).toEqual([]);
  });
  it('never leaks evidence from another tenant', () => {
    expect(assessVisualEvidence('org-b', sha, [valid]).matches).toEqual([]);
  });
  it('rejects unverifiable matches', () => {
    for (const change of [
      { provenanceVerified: false }, { sourceUrl: 'http://example.org' },
      { similarity: Number.NaN }, { observedAt: 'invalid' }, { imageSha256: 'b'.repeat(64) }
    ]) {
      expect(assessVisualEvidence('org-a', sha, [{ ...valid, ...change }]).status).toBe('INCONCLUSIVE');
    }
  });
  it('accepts exact matching hash with recorded provenance only', () => {
    expect(assessVisualEvidence('org-a', sha, [valid]).status).toBe('VERIFIED_MATCH');
  });
});
