import { describe, expect, it } from 'vitest';
import { evaluateAuthorizedAcademyAttempt } from './academyAssessmentBoundary';
import type { AcademyRubricV1 } from './academyAssessment';

const rubric: AcademyRubricV1 = { version: 'r1', courseVersion: 'c1', passThreshold: 100, questions: [{ id: 'q1', correctAnswer: 'A' }] };
const request = { enrollmentId: 'enroll-1', courseVersion: 'c1', rubricVersion: 'r1', answers: [{ questionId: 'q1', answer: 'A' }], orgId: 'forged', userId: 'forged', scorePercent: 100 };
const context = (overrides: Record<string, unknown> = {}) => ({
  authenticate: async () => ({ userId: 'user-1', organizationId: 'org-1' }),
  getEnrollment: async () => ({ id: 'enroll-1', userId: 'user-1', organizationId: 'org-1', courseVersion: 'c1', status: 'active' }),
  getRubric: async () => ({ organizationId: 'org-1', ...rubric }),
  ...overrides
});
describe('Academy F2 server-only authorization boundary', () => {
  it('uses verified identity and ignores forged client identity and score', async () => {
    const result = await evaluateAuthorizedAcademyAttempt(request, context());
    expect(result).toEqual({ total: 1, correct: 1, scorePercent: 100, passed: true });
  });
  it('rejects missing authenticated identity', async () => {
    await expect(evaluateAuthorizedAcademyAttempt(request, context({ authenticate: async () => null }))).rejects.toThrow();
  });
  it('rejects revoked enrollment', async () => {
    await expect(evaluateAuthorizedAcademyAttempt(request, context({ getEnrollment: async () => ({ id: 'enroll-1', userId: 'user-1', organizationId: 'org-1', courseVersion: 'c1', status: 'revoked' }) }))).rejects.toThrow();
  });
  it('rejects cross-tenant enrollment and rubric', async () => {
    await expect(evaluateAuthorizedAcademyAttempt(request, context({ getEnrollment: async () => ({ id: 'enroll-1', userId: 'user-1', organizationId: 'other', courseVersion: 'c1', status: 'active' }) }))).rejects.toThrow();
    await expect(evaluateAuthorizedAcademyAttempt(request, context({ getRubric: async () => ({ organizationId: 'other', ...rubric }) }))).rejects.toThrow();
  });
  it('rejects another user enrollment and missing rubric', async () => {
    await expect(evaluateAuthorizedAcademyAttempt(request, context({ getEnrollment: async () => ({ id: 'enroll-1', userId: 'other', organizationId: 'org-1', courseVersion: 'c1', status: 'active' }) }))).rejects.toThrow();
    await expect(evaluateAuthorizedAcademyAttempt(request, context({ getRubric: async () => null }))).rejects.toThrow();
  });
});
