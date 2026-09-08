import {
  advanceApplicationStage,
  scoreAssessment,
  type AssessmentScore,
} from './recruiting';
import type { ApplicationStage } from './types';

export type AdvanceApplicationCommand = {
  organizationId: string;
  applicationId: string;
  currentStage: ApplicationStage;
  nextStage: ApplicationStage;
  decisionReason: string | null;
};

export type RecordAssessmentCommand = {
  organizationId: string;
  applicationId: string;
  assessmentType: string;
  earned: number;
  possible: number;
  passingPercent: number;
  evidence: Record<string, unknown>;
};

export type PersistAssessmentCommand = RecordAssessmentCommand & {
  score: AssessmentScore;
};

export interface PeopleRecruitingWriteGateway {
  advanceApplicationStage(command: AdvanceApplicationCommand): Promise<string>;
  recordAssessmentResult(command: PersistAssessmentCommand): Promise<string>;
}

function requireText(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

export class PeopleRecruitingWriteService {
  constructor(private readonly gateway: PeopleRecruitingWriteGateway) {}

  async advanceApplicationStage(command: AdvanceApplicationCommand): Promise<string> {
    const organizationId = requireText(command.organizationId, 'Organization is required');
    const applicationId = requireText(command.applicationId, 'Application is required');
    advanceApplicationStage(command.currentStage, command.nextStage);

    const decisionReason = command.decisionReason === null
      ? null
      : command.decisionReason.trim() || null;

    if (['rejected', 'withdrawn'].includes(command.nextStage) && !decisionReason) {
      throw new Error('A decision reason is required for rejected or withdrawn applications.');
    }

    return this.gateway.advanceApplicationStage({
      organizationId,
      applicationId,
      currentStage: command.currentStage,
      nextStage: command.nextStage,
      decisionReason,
    });
  }

  async recordAssessmentResult(command: RecordAssessmentCommand): Promise<string> {
    const organizationId = requireText(command.organizationId, 'Organization is required');
    const applicationId = requireText(command.applicationId, 'Application is required');
    const assessmentType = requireText(command.assessmentType, 'Assessment type is required');
    const score = scoreAssessment({
      earned: command.earned,
      possible: command.possible,
      passingPercent: command.passingPercent,
    });

    return this.gateway.recordAssessmentResult({
      ...command,
      organizationId,
      applicationId,
      assessmentType,
      evidence: { ...command.evidence },
      score,
    });
  }
}
