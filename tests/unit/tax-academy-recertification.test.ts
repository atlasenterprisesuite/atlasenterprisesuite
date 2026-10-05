import { describe, expect, it } from 'vitest';
import { evaluateProfessionalLevel, evaluateRecertification } from '../../packages/tax-academy/src';

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

  it('does not authorize production when professional exams pass but annual recertification is expired', () => {
    const decision = evaluateProfessionalLevel({
      writtenScore: 90,
      intakePracticalScore: 92,
      securityCriticalPassed: true,
      simpleReturnPracticalScore: 94,
      filingStatusPracticalScore: 94,
      familyCreditsPracticalScore: 93,
      form8867CriticalPassed: true,
      supervisedAcceptedReturns: 3,
      businessPracticalScore: 92,
      criticalEvidenceGatesPassed: true,
      supervisedA4Returns: 5,
      reviewerApproved: true,
      annualRecertificationCurrent: false,
      criticalFailures: []
    });
    expect(decision.currentLevel).toBe('A4');
    expect(decision.productionAuthorized).toBe(false);
  });
});
