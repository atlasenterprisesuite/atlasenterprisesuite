import { describe, expect, it, vi } from 'vitest';
import {
  PeopleRecruitingWriteService,
  type PeopleRecruitingWriteGateway,
} from '../../packages/people/src';

describe('ATLAS People Recruiting write service', () => {
  it('validates application transitions before calling the gateway', async () => {
    const advanceApplicationStage = vi.fn(async () => 'app-a');
    const gateway: PeopleRecruitingWriteGateway = {
      advanceApplicationStage,
      recordAssessmentResult: async () => 'assessment-a',
    };
    const service = new PeopleRecruitingWriteService(gateway);

    await service.advanceApplicationStage({
      organizationId: 'org-a',
      applicationId: 'app-a',
      currentStage: 'screening',
      nextStage: 'assessment',
      decisionReason: null,
    });

    expect(advanceApplicationStage).toHaveBeenCalledWith({
      organizationId: 'org-a',
      applicationId: 'app-a',
      currentStage: 'screening',
      nextStage: 'assessment',
      decisionReason: null,
    });

    await expect(service.advanceApplicationStage({
      organizationId: 'org-a',
      applicationId: 'app-a',
      currentStage: 'hired',
      nextStage: 'screening',
      decisionReason: null,
    })).rejects.toThrow(/terminal/i);
  });

  it('requires a reason for rejection or withdrawal', async () => {
    const gateway: PeopleRecruitingWriteGateway = {
      advanceApplicationStage: async () => 'app-a',
      recordAssessmentResult: async () => 'assessment-a',
    };
    const service = new PeopleRecruitingWriteService(gateway);

    await expect(service.advanceApplicationStage({
      organizationId: 'org-a',
      applicationId: 'app-a',
      currentStage: 'screening',
      nextStage: 'rejected',
      decisionReason: '   ',
    })).rejects.toThrow(/reason/i);
  });

  it('scores assessment evidence before persistence', async () => {
    const recordAssessmentResult = vi.fn(async () => 'assessment-a');
    const gateway: PeopleRecruitingWriteGateway = {
      advanceApplicationStage: async () => 'app-a',
      recordAssessmentResult,
    };
    const service = new PeopleRecruitingWriteService(gateway);

    await service.recordAssessmentResult({
      organizationId: 'org-a',
      applicationId: 'app-a',
      assessmentType: 'english',
      earned: 42,
      possible: 50,
      passingPercent: 70,
      evidence: { source: 'authorized-assessment' },
    });

    expect(recordAssessmentResult).toHaveBeenCalledWith(expect.objectContaining({
      score: { score: 84, passed: true },
    }));
  });
});
