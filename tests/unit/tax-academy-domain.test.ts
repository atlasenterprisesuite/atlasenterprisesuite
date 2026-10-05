import { describe, expect, it } from 'vitest';
import {
  evaluateProfessionalLevel,
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
});
