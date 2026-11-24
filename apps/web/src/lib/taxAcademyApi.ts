import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

export type AcademyAttemptRow = {
  id: string;
  org_id: string;
  user_id: string;
  case_id: string;
  case_version: string;
  mode: 'practice' | 'exam' | 'capstone';
  status: 'in_progress' | 'submitted' | 'completed' | 'remediate';
  started_at: string;
  completed_at: string | null;
};

export type StartAttemptInput = {
  caseId: string;
  caseVersion: string;
  mode: AcademyAttemptRow['mode'];
};

export type SubmitAnswerInput = {
  attemptId: string;
  questionId: string;
  value: unknown;
};

export type AcademyAnswerReceipt = {
  id: string;
  attemptId: string;
  accepted: true;
};

export type AcademyAttemptResult = {
  attemptId: string;
  status: 'submitted';
};

export type AcademyRulePackStatus = 'draft' | 'training_current' | 'production_certified' | 'retired';
export type AcademyExamMode = 'exam' | 'manual_practical';

export type AcademyExamOption = {
  value: string;
  label: string;
};

export type AcademyExamQuestion = {
  questionId: string;
  prompt: string;
  options: AcademyExamOption[];
};

export type AcademyExamSummary = {
  examId: string;
  title: string;
  version: string;
  taxYear: number;
  mode: AcademyExamMode;
  passingScore: number;
  rulePackStatus: AcademyRulePackStatus;
  questionCount: number;
};

export type AcademyExamPayload = {
  examId: string;
  title: string;
  version: string;
  taxYear: number;
  mode: AcademyExamMode;
  passingScore: number;
  rulePackStatus: AcademyRulePackStatus;
  questions: AcademyExamQuestion[];
};

export type AcademyExamSubmissionResult = {
  attemptId: string;
  status: 'submitted';
  score: number | null;
  passed: boolean | null;
  criticalFailures: string[];
};

type AcademyExamGradeRow = {
  score: number | null;
  passed: boolean | null;
  critical_failures: string[] | null;
};

export type AcademyCandidateSummary = {
  attempts: number;
  passed_practicals: number;
  current_level: string | null;
};

export type AcademyReviewQueueItem = {
  attempt_id: string;
  org_id: string;
  user_id: string;
  case_id: string;
  case_version: string;
  weighted_score: number | null;
  critical_failure_codes: string[];
  submitted_at: string | null;
  evidence_reference_count: number;
};

export type AcademyReviewerSignoffInput = {
  userId: string;
  subjectType: 'attempt' | 'practical' | 'level';
  subjectId: string;
  decision: 'approved' | 'remediate' | 'rejected';
  noteReference?: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const data = (payload || {}) as { message?: string; error?: string; error_description?: string };
    throw new Error(data.message || data.error_description || data.error || `Academy request failed (${response.status})`);
  }
  return payload as T;
}

async function activeOrgId(): Promise<string> {
  const organization = await getActiveAtlasOrganization();
  if (!organization.id) throw new Error('no_active_organization');
  return organization.id;
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  await activeOrgId();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/' + name, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return parseJson<T>(response);
}

export async function startAcademyAttempt(input: StartAttemptInput): Promise<AcademyAttemptRow> {
  const orgId = await activeOrgId();
  const attemptId = await rpc<string>('tax_academy_start_attempt', {
    p_case_id: input.caseId,
    p_case_version: input.caseVersion,
    p_mode: input.mode
  });
  const response = await authorizedAtlasFetch(
    '/rest/v1/tax_academy_attempts?org_id=eq.' + encodeURIComponent(orgId) +
      '&id=eq.' + encodeURIComponent(attemptId) + '&select=*&limit=1',
    { method: 'GET' }
  );
  const rows = await parseJson<AcademyAttemptRow[]>(response);
  if (!rows[0]) throw new Error('academy_attempt_not_found');
  return rows[0];
}

export async function submitAcademyAnswer(input: SubmitAnswerInput): Promise<AcademyAnswerReceipt> {
  const id = await rpc<string>('tax_academy_submit_answer', {
    p_attempt_id: input.attemptId,
    p_question_id: input.questionId,
    p_value: input.value ?? null
  });
  return { id, attemptId: input.attemptId, accepted: true };
}

export async function completeAcademyAttempt(attemptId: string): Promise<AcademyAttemptResult> {
  await rpc<null>('tax_academy_complete_attempt', { p_attempt_id: attemptId });
  return { attemptId, status: 'submitted' };
}

export async function listAcademyExams(): Promise<AcademyExamSummary[]> {
  return rpc<AcademyExamSummary[]>('tax_academy_list_exams', {});
}

export async function getAcademyExam(examId: string): Promise<AcademyExamPayload> {
  return rpc<AcademyExamPayload>('tax_academy_get_exam_payload', { p_exam_id: examId });
}

export async function completeAcademyExamAttempt(attemptId: string): Promise<AcademyExamSubmissionResult> {
  await completeAcademyAttempt(attemptId);
  const rows = await rpc<AcademyExamGradeRow[]>('tax_academy_grade_attempt', { p_attempt_id: attemptId });
  const grade = rows[0] || { score: null, passed: null, critical_failures: [] };
  return {
    attemptId,
    status: 'submitted',
    score: grade.score,
    passed: grade.passed,
    criticalFailures: grade.critical_failures || []
  };
}

export async function getAcademyCandidateSummary(): Promise<AcademyCandidateSummary> {
  const rows = await rpc<AcademyCandidateSummary[]>('tax_academy_get_candidate_summary', {});
  return rows[0] || { attempts: 0, passed_practicals: 0, current_level: null };
}

export async function hasAcademyPermission(permission: string): Promise<boolean> {
  const orgId = await activeOrgId();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/has_identity_permission', {
    method: 'POST',
    body: JSON.stringify({ o: orgId, p: permission })
  });
  return parseJson<boolean>(response);
}

// INSTRUCTOR-ONLY SURFACE
// Reviewer operations use distinct privileged RPCs. Candidate functions above never request instructor data.
export async function listAcademyReviewQueue(): Promise<AcademyReviewQueueItem[]> {
  return rpc<AcademyReviewQueueItem[]>('tax_academy_list_review_queue', {});
}

export async function recordAcademyReviewerSignoff(input: AcademyReviewerSignoffInput): Promise<string> {
  return rpc<string>('tax_academy_record_reviewer_signoff', {
    p_user_id: input.userId,
    p_subject_type: input.subjectType,
    p_subject_id: input.subjectId,
    p_decision: input.decision,
    p_note_reference: input.noteReference || null
  });
}
