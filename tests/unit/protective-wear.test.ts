import { describe, it, expect } from 'vitest';
import { assessWearComponent, PROTECTIVE_WEAR_CONCEPTS, type WearProof } from '../../apps/web/src/modules/device-os/protectiveWearModel';

const claim: WearProof = {
  threat: 'ballistic', panelModelId: 'example-panel', supplier: 'example-supplier',
  standardId: 'NIJ 0101.07', officialRegistryUrl: 'https://nij.ojp.gov/example',
  verifiedConfigurationId: 'example-configuration', reviewedBy: 'reviewer',
  reviewedAt: '2026-10-20T00:00:00Z', reviewStatus: 'independently-reviewed'
};

describe('ATLAS Protective Wear fail-closed research dossier', () => {
  it('has distinct use cases without advertising certification', () => {
    expect(Object.values(PROTECTIVE_WEAR_CONCEPTS)).toHaveLength(3);
    expect(PROTECTIVE_WEAR_CONCEPTS.courier.targetThreats).toContain('stab');
  });
  it('rejects unsupported protective claims without evidence', () => {
    expect(assessWearComponent('ballistic', [])).toEqual({
      state: 'blocked', reason: 'component_evidence_missing', mayAdvertiseProtectivePerformance: false
    });
  });
  it('does not confuse ballistic and stab standards', () => {
    expect(assessWearComponent('stab', [{ ...claim, threat: 'stab' }]).reason).toBe('standard_mismatch');
  });
  it('does not trust marketing pages or supplier-only reports', () => {
    expect(assessWearComponent('ballistic', [{ ...claim, officialRegistryUrl: 'https://example.com/claims' }]).reason)
      .toBe('source_unverified');
    expect(assessWearComponent('ballistic', [{ ...claim, reviewStatus: 'supplier-only' }]).state)
      .toBe('blocked');
  });
  it('requires identification of tested configuration and human evidence review', () => {
    expect(assessWearComponent('ballistic', [{ ...claim, verifiedConfigurationId: '' }]).reason)
      .toBe('configuration_missing');
    expect(assessWearComponent('ballistic', [claim])).toMatchObject({
      state: 'documentation-review', mayAdvertiseProtectivePerformance: false
    });
  });
  it('does not treat cut-resistant workwear as stab or ballistic armor', () => {
    expect(assessWearComponent('abrasion-cut', [{ ...claim, threat: 'abrasion-cut' }]).state).toBe('blocked');
  });
});
