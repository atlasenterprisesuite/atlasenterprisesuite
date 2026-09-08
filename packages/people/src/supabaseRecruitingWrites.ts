import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AdvanceApplicationCommand,
  PeopleRecruitingWriteGateway,
  PersistAssessmentCommand,
} from './recruitingWrites';

export class SupabasePeopleRecruitingWriteGateway implements PeopleRecruitingWriteGateway {
  constructor(private readonly client: Pick<SupabaseClient, 'rpc'>) {}

  async advanceApplicationStage(command: AdvanceApplicationCommand): Promise<string> {
    return this.runRpc('advance_people_application_stage', {
      organization_uuid: command.organizationId,
      application_uuid: command.applicationId,
      next_stage_value: command.nextStage,
      decision_reason_value: command.decisionReason,
    });
  }

  async recordAssessmentResult(command: PersistAssessmentCommand): Promise<string> {
    return this.runRpc('record_people_assessment_result', {
      organization_uuid: command.organizationId,
      application_uuid: command.applicationId,
      assessment_type_value: command.assessmentType,
      earned_value: command.earned,
      possible_value: command.possible,
      passing_percent_value: command.passingPercent,
      result_value: {
        ...command.evidence,
        client_score: command.score.score,
        client_passed: command.score.passed,
      },
    });
  }

  private async runRpc(functionName: string, args: Record<string, unknown>): Promise<string> {
    const { data, error } = await this.client.rpc(functionName, args);
    if (error) throw new Error(error.message);
    if (typeof data !== 'string' || !data) {
      throw new Error('Recruiting write did not return an id');
    }
    return data;
  }
}
