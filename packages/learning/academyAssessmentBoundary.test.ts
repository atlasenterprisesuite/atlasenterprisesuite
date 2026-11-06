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
  it('rejects mismatched enrollment identifier and stale course version', async () => {
    await expect(evaluateAuthorizedAcademyAttempt(request, context({
      getEnrollment: async () => ({ id: 'different', userId: 'user-1', organizationId: 'org-1', courseVersion: 'c1', status: 'active' })
    }))).rejects.toThrow('Unauthorized enrollment');
    await expect(evaluateAuthorizedAcademyAttempt(request, context({
      getEnrollment: async () => ({ id: 'enroll-1', userId: 'user-1', organizationId: 'org-1', courseVersion: 'obsolete', status: 'active' })
    }))).rejects.toThrow('Unauthorized enrollment');
  });
  it('rejects malformed authenticated actor identifiers', async () => {
    await expect(evaluateAuthorizedAcademyAttempt(request, context({
      authenticate: async () => ({ userId: ' ', organizationId: 'org-1' })
    }))).rejects.toThrow('Unauthorized assessment');
    await expect(evaluateAuthorizedAcademyAttempt(request, context({
      authenticate: async () => ({ userId: 'user-1', organizationId: '' })
    }))).rejects.toThrow('Unauthorized assessment');
  });
  it('passes only server-authenticated tenant and user scope to trusted dependencies', async () => {
    const enrollmentCalls: unknown[] = [];
    const rubricCalls: unknown[] = [];
    await evaluateAuthorizedAcademyAttempt(request, context({
      getEnrollment: async (args: unknown) => {
        enrollmentCalls.push(args);
        return { id: 'enroll-1', userId: 'user-1', organizationId: 'org-1', courseVersion: 'c1', status: 'active' };
      },
      getRubric: async (args: unknown) => {
        rubricCalls.push(args);
        return { organizationId: 'org-1', ...rubric };
      }
    }));
    expect(enrollmentCalls).toEqual(Array.from({ length: 2 }, () => ({ enrollmentId: 'enroll-1', organizationId: 'org-1', userId: 'user-1' })));
    expect(rubricCalls).toEqual([{ organizationId: 'org-1', courseVersion: 'c1', rubricVersion: 'r1' }]);
  });
  it('fails closed before authentication for malformed request identifiers and answers', async () => {
    let authCalls = 0;
    const server = context({ authenticate: async () => { authCalls++; return { userId: 'user-1', organizationId: 'org-1' }; } });
    await expect(evaluateAuthorizedAcademyAttempt({ ...request, enrollmentId: '   ' }, server)).rejects.toThrow('Invalid attempt');
    await expect(evaluateAuthorizedAcademyAttempt({ ...request, rubricVersion: '' }, server)).rejects.toThrow('Invalid attempt');
    await expect(evaluateAuthorizedAcademyAttempt({ ...request, answers: null } as unknown as typeof request, server)).rejects.toThrow('Invalid attempt');
    expect(authCalls).toBe(0);
  });
  it('fails closed when trusted enrollment or rubric lookup rejects', async () => {
    await expect(evaluateAuthorizedAcademyAttempt(request, context({
      getEnrollment: async () => { throw new Error('storage unavailable'); }
    }))).rejects.toThrow('storage unavailable');
    await expect(evaluateAuthorizedAcademyAttempt(request, context({
      getRubric: async () => { throw new Error('storage unavailable'); }
    }))).rejects.toThrow('storage unavailable');
  });

  it('rejects an enrollment revoked while the rubric is being loaded (TOCTOU regression)', async () => {
    let enrollmentStatus = 'active';
    const server = context({
      getEnrollment: async () => ({
        id: 'enroll-1', userId: 'user-1', organizationId: 'org-1',
        courseVersion: 'c1', status: enrollmentStatus
      }),
      getRubric: async () => {
        // Simulate a committed revocation by another session after the first enrollment read.
        enrollmentStatus = 'revoked';
        return { organizationId: 'org-1', ...rubric };
      }
    });
    await expect(evaluateAuthorizedAcademyAttempt(request, server)).rejects.toThrow('Unauthorized enrollment');
  });

  it('fails closed when enrollment ownership changes during the final authorization read', async () => {
    let reads = 0;
    const server = context({
      getEnrollment: async () => {
        reads++;
        return { id: 'enroll-1', userId: reads === 1 ? 'user-1' : 'other-user', organizationId: 'org-1', courseVersion: 'c1', status: 'active' };
      }
    });
    await expect(evaluateAuthorizedAcademyAttempt(request, server)).rejects.toThrow('Unauthorized enrollment');
    expect(reads).toBe(2);
  });

  it('fails closed when the final enrollment recheck becomes unavailable', async () => {
    let reads = 0;
    const server = context({
      getEnrollment: async () => {
        reads++;
        if (reads === 2) throw new Error('recheck unavailable');
        return { id: 'enroll-1', userId: 'user-1', organizationId: 'org-1', courseVersion: 'c1', status: 'active' };
      }
    });
    await expect(evaluateAuthorizedAcademyAttempt(request, server)).rejects.toThrow('recheck unavailable');
    expect(reads).toBe(2);
  });

});
