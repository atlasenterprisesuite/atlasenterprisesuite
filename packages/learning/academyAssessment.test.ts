import { describe, expect, it } from 'vitest';
import { gradeAcademyAssessment, type AcademyRubricV1 } from './academyAssessment';

const rubric: AcademyRubricV1 = {
  version: 'r1', courseVersion: 'c1', passThreshold: 75,
  questions: [{ id: 'q1', correctAnswer: 'A' }, { id: 'q2', correctAnswer: 'B' }]
};
const answers = [{ questionId: 'q1', answer: 'A' }, { questionId: 'q2', answer: 'B' }];
const submission = { courseVersion: 'c1', rubricVersion: 'r1', answers };

describe('ATLAS Academy assessment F2 isolated grading', () => {
  it('grades from trusted rubric rather than accepting a client score', () => {
    expect(gradeAcademyAssessment(rubric, { ...submission, score: 100 } as typeof submission)).toEqual({
      total: 2, correct: 2, scorePercent: 100, passed: true
    });
    expect(gradeAcademyAssessment(rubric, { ...submission, answers: [answers[0], { questionId: 'q2', answer: 'X' }] }).passed).toBe(false);
  });
  it('rejects rubric or course version mismatch', () => {
    expect(() => gradeAcademyAssessment(rubric, { ...submission, rubricVersion: 'r2' })).toThrow();
    expect(() => gradeAcademyAssessment(rubric, { ...submission, courseVersion: 'c2' })).toThrow();
  });
  it('rejects duplicate, unknown and missing answers', () => {
    expect(() => gradeAcademyAssessment(rubric, { ...submission, answers: [answers[0], answers[0]] })).toThrow();
    expect(() => gradeAcademyAssessment(rubric, { ...submission, answers: [answers[0], { questionId: 'unknown', answer: 'B' }] })).toThrow();
    expect(() => gradeAcademyAssessment(rubric, { ...submission, answers: [answers[0]] })).toThrow();
  });
  it('rejects invalid or duplicate rubric questions', () => {
    expect(() => gradeAcademyAssessment({ ...rubric, questions: [rubric.questions[0], rubric.questions[0]] }, submission)).toThrow();
    expect(() => gradeAcademyAssessment({ ...rubric, passThreshold: Number.NaN }, submission)).toThrow();
  });
});
