/** ATLAS Academy F2: pure assessment grading only. NOT a credential issuer.
 * Caller must load rubric from trusted server-side storage and authenticate the enrollment.
 */
export interface AcademyRubricV1 {
  version: string;
  courseVersion: string;
  passThreshold: number;
  questions: ReadonlyArray<{ id: string; correctAnswer: string }>;
}

export interface AcademySubmissionV1 {
  courseVersion: string;
  rubricVersion: string;
  answers: ReadonlyArray<{ questionId: string; answer: string }>;
}

export interface AcademyGradeV1 {
  total: number;
  correct: number;
  scorePercent: number;
  passed: boolean;
}

/** Rejects malformed, duplicate, unknown or version-mismatched submissions. */
export function gradeAcademyAssessment(
  rubric: AcademyRubricV1,
  submission: AcademySubmissionV1
): AcademyGradeV1 {
  if (!rubric || !submission || !Array.isArray(rubric.questions) || !Array.isArray(submission.answers)) {
    throw new Error('Invalid assessment input');
  }
  if (!rubric.version || !rubric.courseVersion ||
      submission.courseVersion !== rubric.courseVersion || submission.rubricVersion !== rubric.version) {
    throw new Error('Assessment version mismatch');
  }
  if (!Number.isFinite(rubric.passThreshold) || rubric.passThreshold < 0 || rubric.passThreshold > 100 ||
      rubric.questions.length === 0) throw new Error('Invalid rubric');
  const keys = new Map<string, string>();
  for (const question of rubric.questions) {
    if (!question.id || !question.correctAnswer || keys.has(question.id)) throw new Error('Invalid rubric questions');
    keys.set(question.id, question.correctAnswer);
  }
  if (submission.answers.length !== keys.size) throw new Error('Incomplete submission');
  const seen = new Set<string>();
  let correct = 0;
  for (const entry of submission.answers) {
    if (!entry.questionId || typeof entry.answer !== 'string' || seen.has(entry.questionId) || !keys.has(entry.questionId)) {
      throw new Error('Invalid submission answers');
    }
    seen.add(entry.questionId);
    if (keys.get(entry.questionId) === entry.answer) correct++;
  }
  const scorePercent = (correct / keys.size) * 100;
  return { total: keys.size, correct, scorePercent, passed: scorePercent >= rubric.passThreshold };
}
