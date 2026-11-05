import { describe, expect, it } from 'vitest';
import { gradeAcademyAssessment, type AcademyRubricV1 } from '../../packages/learning/academyAssessment';

// CI-discovered security smoke tests. Broader domain tests remain in packages/learning.
const rubric: AcademyRubricV1 = {
  version: 'rubric-1', courseVersion: 'course-1', passThreshold: 100,
  questions: [{ id: 'q1', correctAnswer: 'A' }, { id: 'q2', correctAnswer: 'B' }]
};
const submission = {
  courseVersion: 'course-1', rubricVersion: 'rubric-1',
  answers: [{ questionId: 'q1', answer: 'A' }, { questionId: 'q2', answer: 'wrong' }]
};

describe('Academy F2 fail-closed grading in canonical unit CI', () => {
  it('does not accept a client-supplied passing score', () => {
    const result = gradeAcademyAssessment(rubric, { ...submission, scorePercent: 100, passed: true } as typeof submission);
    expect(result).toEqual({ total: 2, correct: 1, scorePercent: 50, passed: false });
  });
  it('rejects unknown and duplicate question identifiers', () => {
    expect(() => gradeAcademyAssessment(rubric, {
      ...submission, answers: [{ questionId: 'q1', answer: 'A' }, { questionId: 'q1', answer: 'A' }]
    })).toThrow();
    expect(() => gradeAcademyAssessment(rubric, {
      ...submission, answers: [{ questionId: 'q1', answer: 'A' }, { questionId: 'other', answer: 'B' }]
    })).toThrow();
  });
  it('rejects malformed runtime answers and stale rubric versions', () => {
    expect(() => gradeAcademyAssessment(rubric, { ...submission, answers: [null, submission.answers[1]] } as unknown as typeof submission)).toThrow();
    expect(() => gradeAcademyAssessment(rubric, { ...submission, rubricVersion: 'stale' })).toThrow();
  });
});
