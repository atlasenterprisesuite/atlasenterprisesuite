import { describe, expect, it } from 'vitest';
import { evaluateCreativeRelease, type CreativeReleaseEvidence } from '../../packages/creator/creative_release_gate';

const SHA = 'a'.repeat(40);
const valid: CreativeReleaseEvidence = {
  commitSha: SHA, ciSha: SHA, ciPassed: true, unitPassed: true,
  integrationPassed: true, buildPassed: true, tenantIsolationPassed: true,
  renderRuntimeHealthy: true, renderE2ePassed: true,
  auditEvidencePresent: true, humanRenderApproved: true,
};
describe('creative release fail-closed gates', () => {
  it('accepts only complete evidence', () => {
    expect(evaluateCreativeRelease(valid)).toEqual({ ready: true, blockers: [] });
  });
  it.each([
    'ciPassed', 'unitPassed', 'integrationPassed', 'buildPassed',
    'tenantIsolationPassed', 'renderRuntimeHealthy', 'renderE2ePassed',
    'auditEvidencePresent', 'humanRenderApproved',
  ] as const)('blocks when %s is missing', (key) => {
    expect(evaluateCreativeRelease({ ...valid, [key]: false }).ready).toBe(false);
  });
  it('rejects mismatched or invalid commit SHAs', () => {
    expect(evaluateCreativeRelease({ ...valid, ciSha: 'b'.repeat(40) }).blockers).toContain('exact-sha');
    expect(evaluateCreativeRelease({ ...valid, commitSha: 'main', ciSha: 'main' }).ready).toBe(false);
  });
});
