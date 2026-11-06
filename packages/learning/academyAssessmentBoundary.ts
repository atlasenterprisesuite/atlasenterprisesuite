import { gradeAcademyAssessment, type AcademyRubricV1, type AcademyGradeV1 } from './academyAssessment';

/** F2 isolated contract: dependencies MUST be trusted server-side implementations.
 * This module does not persist attempts or issue credentials. Never expose
 * these dependency callbacks or rubric answer keys to a browser.
 */
export interface AcademyServerContext {
  authenticate(): Promise<{ userId: string; organizationId: string } | null>;
  getEnrollment(args: { enrollmentId: string; organizationId: string; userId: string }): Promise<{
    id: string; userId: string; organizationId: string; courseVersion: string; status: string;
  } | null>;
  getRubric(args: { organizationId: string; courseVersion: string; rubricVersion: string }): Promise<
    (AcademyRubricV1 & { organizationId: string }) | null
  >;
}
export interface AcademyAttemptRequest {
  enrollmentId: string;
  courseVersion: string;
  rubricVersion: string;
  answers: ReadonlyArray<{ questionId: string; answer: string }>;
}
/** Returns a grade only. A passing grade NEVER authorizes credential issuance. */
export async function evaluateAuthorizedAcademyAttempt(
  request: AcademyAttemptRequest,
  server: AcademyServerContext
): Promise<AcademyGradeV1> {
  if (!request || typeof request.enrollmentId !== 'string' || !request.enrollmentId.trim() ||
      typeof request.courseVersion !== 'string' || !request.courseVersion.trim() ||
      typeof request.rubricVersion !== 'string' || !request.rubricVersion.trim() ||
      !Array.isArray(request.answers)) throw new Error('Invalid attempt');
  const actor = await server.authenticate();
  if (!actor || typeof actor.userId !== 'string' || !actor.userId.trim() ||
      typeof actor.organizationId !== 'string' || !actor.organizationId.trim()) {
    throw new Error('Unauthorized assessment');
  }
  const enrollment = await server.getEnrollment({
    enrollmentId: request.enrollmentId, organizationId: actor.organizationId, userId: actor.userId
  });
  if (!enrollment || enrollment.id !== request.enrollmentId ||
      enrollment.userId !== actor.userId || enrollment.organizationId !== actor.organizationId ||
      enrollment.courseVersion !== request.courseVersion || enrollment.status !== 'active') {
    throw new Error('Unauthorized enrollment');
  }
  const rubric = await server.getRubric({
    organizationId: actor.organizationId, courseVersion: request.courseVersion, rubricVersion: request.rubricVersion
  });
  if (!rubric || rubric.organizationId !== actor.organizationId ||
      rubric.courseVersion !== request.courseVersion || rubric.version !== request.rubricVersion) {
    throw new Error('Unauthorized rubric');
  }
  // Recheck after loading the rubric: a concurrent revocation must not be
  // silently accepted by this non-persistent evaluation boundary.
  // Durable issuance still requires an atomic, locked server-side transaction.
  const currentEnrollment = await server.getEnrollment({
    enrollmentId: request.enrollmentId, organizationId: actor.organizationId, userId: actor.userId
  });
  if (!currentEnrollment || currentEnrollment.id !== request.enrollmentId ||
      currentEnrollment.userId !== actor.userId ||
      currentEnrollment.organizationId !== actor.organizationId ||
      currentEnrollment.courseVersion !== request.courseVersion || currentEnrollment.status !== 'active') {
    throw new Error('Unauthorized enrollment');
  }
  return gradeAcademyAssessment(rubric, {
    courseVersion: request.courseVersion, rubricVersion: request.rubricVersion, answers: request.answers
  });
}
