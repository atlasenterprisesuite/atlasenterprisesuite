import { describe, expect, it } from 'vitest';
import { evaluateRecertification } from '../../packages/tax-academy/src';

describe('ATLAS Tax Academy annual recertification', () => {
  it('fails closed when the current-year rule pack is not production certified', () => {
    const result = evaluateRecertification({
      taxYear: 2026,
      currentYearLawModulePassed: true,
      annualExamScore: 96,
      criticalCompliancePassed: true,
      ceHours: 32,
      requiredCeHours: 32,
      externalRequirementsVerified: true,
      rulePackStatus: 'training_current'
    });
    expect(result.activeForProduction).toBe(false);
    expect(result.missingRequirements).toContain('production_certified_rule_pack');
  });

  it('requires current law, exam, critical compliance, CE and external requirements', () => {
    const result = evaluateRecertification({
      taxYear: 2026,
      currentYearLawModulePassed: true,
      annualExamScore: 90,
      criticalCompliancePassed: true,
      ceHours: 32,
      requiredCeHours: 32,
      externalRequirementsVerified: true,
      rulePackStatus: 'production_certified'
    });
    expect(result.activeForProduction).toBe(true);
    expect(result.missingRequirements).toEqual([]);
  });
});
