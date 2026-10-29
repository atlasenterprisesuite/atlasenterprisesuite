import { describe, expect, it } from 'vitest';
import {
  evaluateProfessionalLevel,
  evaluateRecertification,
  evaluateSpecialtyBadges,
  scorePracticalReturn,
  scoreWrittenExam,
} from '../../packages/tax-academy/src/index';

describe('ATLAS Tax Academy scoring', () => {
  it('scores 90 correct answers out of 100 as 90 percent', () => {
    const questions = Array.from({ length: 100 }, (_, index) => ({
      id: `q-${index + 1}`,
      correctAnswer: 'A',
      critical: false,
    }));
    const answers = Object.fromEntries(
      questions.map((question, index) => [question.id, index < 90 ? 'A' : 'B'])
    );

    const result = scoreWrittenExam(
      { answers, externalCredentialVerified: true, instructor: true },
      { questions }
    );

    expect(result.score).toBe(90);
    expect(result.correct).toBe(90);
    expect(result.total).toBe(100);
  });

  it('fails a practical when a critical failure exists even with a 97 weighted score', () => {
    const result = scorePracticalReturn({
      passingScore: 90,
      components: [
        { id: 'calculations', weight: 0.97, score: 100 },
        { id: 'documentation', weight: 0.03, score: 0 },
      ],
      criticalFailures: ['fabricated_evidence'],
    });

    expect(result.weightedScore).toBe(97);
    expect(result.criticalFailures).toEqual(['fabricated_evidence']);
    expect(result.passed).toBe(false);
  });

  it('does not let instructor or external-credential flags change the written score', () => {
    const blueprint = {
      questions: [
        { id: 'q-1', correctAnswer: 'A', critical: false },
        { id: 'q-2', correctAnswer: 'B', critical: false },
      ],
    };

    const base = scoreWrittenExam({ answers: { 'q-1': 'A', 'q-2': 'C' } }, blueprint);
    const privileged = scoreWrittenExam(
      {
        answers: { 'q-1': 'A', 'q-2': 'C' },
        externalCredentialVerified: true,
        instructor: true,
      },
      blueprint
    );

    expect(base.score).toBe(50);
    expect(privileged.score).toBe(base.score);
  });
});

describe('ATLAS Tax Academy professional levels', () => {
  it('does not overpromote a 98 percent written scorer without practical and reviewer evidence', () => {
    const decision = evaluateProfessionalLevel({ writtenScore: 98 });

    expect(['A0', 'A1']).toContain(decision.currentLevel);
    expect(decision.productionAuthorized).toBe(false);
    expect(decision.missingRequirements.length).toBeGreaterThan(0);
  });

  it('awards A2 only after written, simple-return, filing-status and reviewer gates pass', () => {
    const decision = evaluateProfessionalLevel({
      writtenScore: 85,
      intakePracticalScore: 90,
      securityCriticalPassed: true,
      simpleReturnPracticalScore: 90,
      filingStatusPracticalScore: 90,
      reviewerApproved: true,
      criticalFailures: [],
    });

    expect(decision.currentLevel).toBe('A2');
    expect(decision.reviewerRequired).toBe(true);
    expect(decision.permittedReturnClasses).toContain('simple_individual');
  });

  it('does not award A3 when a supervised return required a material negligence correction', () => {
    const decision = evaluateProfessionalLevel({
      writtenScore: 90,
      intakePracticalScore: 94,
      securityCriticalPassed: true,
      simpleReturnPracticalScore: 94,
      filingStatusPracticalScore: 94,
      familyCreditsPracticalScore: 94,
      form8867CriticalPassed: true,
      supervisedAcceptedReturns: 3,
      supervisedReturnMaterialCorrections: 1,
      reviewerApproved: true,
      criticalFailures: [],
    });

    expect(decision.currentLevel).toBe('A2');
    expect(decision.missingRequirements).toContain('no material supervised-return correction attributable to preparer negligence');
  });

  it('requires business practical, clean evidence gates and five supervised returns for A4', () => {
    const decision = evaluateProfessionalLevel({
      writtenScore: 90,
      intakePracticalScore: 92,
      securityCriticalPassed: true,
      simpleReturnPracticalScore: 94,
      filingStatusPracticalScore: 94,
      familyCreditsPracticalScore: 93,
      form8867CriticalPassed: true,
      supervisedAcceptedReturns: 3,
      supervisedReturnMaterialCorrections: 0,
      businessPracticalScore: 92,
      criticalEvidenceGatesPassed: true,
      supervisedA4Returns: 5,
      reviewerApproved: true,
      criticalFailures: [],
    });

    expect(decision.currentLevel).toBe('A4');
    expect(decision.permittedReturnClasses).toContain('schedule_c_business');
    expect(decision.productionAuthorized).toBe(true);
  });

  it('requires 94 written, 95 capstone and 95 reviewer calibration for A6', () => {
    const decision = evaluateProfessionalLevel({
      writtenScore: 94,
      intakePracticalScore: 96,
      securityCriticalPassed: true,
      simpleReturnPracticalScore: 96,
      filingStatusPracticalScore: 96,
      familyCreditsPracticalScore: 96,
      form8867CriticalPassed: true,
      supervisedAcceptedReturns: 3,
      supervisedReturnMaterialCorrections: 0,
      businessPracticalScore: 96,
      criticalEvidenceGatesPassed: true,
      supervisedA4Returns: 5,
      advancedPracticalScore: 95,
      reviewedA4A5Returns: 10,
      capstoneScore: 95,
      reviewerCalibrationScore: 95,
      criticalItemsPassed: true,
      reviewerApproved: true,
      criticalFailures: [],
    });

    expect(decision.currentLevel).toBe('A6');
    expect(decision.permittedReturnClasses).toContain('review_a1_a5');
  });

  it('requires 97 master scores, five domains, annual recertification, 32 CE hours and final approval for A8', () => {
    const decision = evaluateProfessionalLevel({
      writtenScore: 97,
      intakePracticalScore: 98,
      securityCriticalPassed: true,
      simpleReturnPracticalScore: 98,
      filingStatusPracticalScore: 98,
      familyCreditsPracticalScore: 98,
      form8867CriticalPassed: true,
      supervisedAcceptedReturns: 3,
      supervisedReturnMaterialCorrections: 0,
      businessPracticalScore: 98,
      criticalEvidenceGatesPassed: true,
      supervisedA4Returns: 5,
      advancedPracticalScore: 98,
      reviewedA4A5Returns: 10,
      capstoneScore: 98,
      secondCapstoneScore: 98,
      reviewerCalibrationScore: 98,
      criticalItemsPassed: true,
      domainCompetencies: 5,
      annualRecertificationCurrent: true,
      ceHours: 32,
      taxDirectorApproved: true,
      finalInternalApproval: true,
      masterPracticalScore: 97,
      reviewerApproved: true,
      criticalFailures: [],
    });

    expect(decision.currentLevel).toBe('A8');
    expect(decision.productionAuthorized).toBe(true);
    expect(decision.reviewerRequired).toBe(false);
  });

  it('fails closed for production when explicit annual recertification is expired', () => {
    const decision = evaluateProfessionalLevel({
      writtenScore: 90,
      intakePracticalScore: 92,
      securityCriticalPassed: true,
      simpleReturnPracticalScore: 94,
      filingStatusPracticalScore: 94,
      reviewerApproved: true,
      annualRecertificationCurrent: false,
      criticalFailures: [],
    });

    expect(decision.currentLevel).toBe('A2');
    expect(decision.productionAuthorized).toBe(false);
  });
});

describe('ATLAS Tax Academy specialties and external credentials', () => {
  it('can grant an internal specialty without manufacturing an external credential', () => {
    const decisions = evaluateSpecialtyBadges({
      specialtyScores: { small_business: 95 },
      externalCredentials: { EA: { externalCredentialVerified: false } },
    });
    expect(decisions).toContainEqual({ badge: 'Small Business / Schedule C', granted: true, internal: true });
    expect(decisions).toContainEqual({ badge: 'EA Verified', granted: false, internal: false });
  });

  it('requires independent verification for external credential badges', () => {
    const decisions = evaluateSpecialtyBadges({
      externalCredentials: { CPA: { externalCredentialVerified: true } },
    });
    expect(decisions).toContainEqual({ badge: 'CPA Verified', granted: true, internal: false });
  });
});

describe('ATLAS Tax Academy annual recertification', () => {
  it('requires law update, critical compliance, CE and applicable external preparer credentials', () => {
    const decision = evaluateRecertification({
      taxYear: 2027,
      asOfDate: '2027-01-15',
      dueDate: '2027-01-01',
      rulePackStatus: 'production_certified',
      lawUpdateCompleted: false,
      criticalCompliancePassed: true,
      ceHours: 32,
      requiredCeHours: 32,
      ptinRequired: true,
      ptinVerified: true,
      stateCredentialRequired: false,
      stateCredentialVerified: false,
    });

    expect(decision.current).toBe(false);
    expect(decision.productionAuthorized).toBe(false);
    expect(decision.missingRequirements).toContain('current-year law update module');
  });

  it('keeps training-current rule packs blocked even when every person-level annual gate passes', () => {
    const decision = evaluateRecertification({
      taxYear: 2026,
      asOfDate: '2026-10-05',
      dueDate: '2027-01-01',
      rulePackStatus: 'training_current',
      lawUpdateCompleted: true,
      criticalCompliancePassed: true,
      ceHours: 40,
      requiredCeHours: 32,
      ptinRequired: true,
      ptinVerified: true,
      stateCredentialRequired: false,
      stateCredentialVerified: false,
    });

    expect(decision.current).toBe(true);
    expect(decision.productionAuthorized).toBe(false);
    expect(decision.missingRequirements).toContain('production-certified tax-year rule pack');
  });

  it('authorizes the annual layer only when every applicable gate is current', () => {
    const decision = evaluateRecertification({
      taxYear: 2027,
      asOfDate: '2026-12-20',
      dueDate: '2027-12-31',
      rulePackStatus: 'production_certified',
      lawUpdateCompleted: true,
      criticalCompliancePassed: true,
      ceHours: 36,
      requiredCeHours: 32,
      ptinRequired: true,
      ptinVerified: true,
      stateCredentialRequired: true,
      stateCredentialVerified: true,
    });

    expect(decision.current).toBe(true);
    expect(decision.productionAuthorized).toBe(true);
    expect(decision.missingRequirements).toEqual([]);
    expect(decision.nextDueDate).toBe('2027-12-31');
  });
});
