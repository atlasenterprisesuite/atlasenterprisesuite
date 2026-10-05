import { describe, expect, it } from 'vitest';
import {
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
