import { describe, expect, it } from 'vitest';
import {
  RecruitingRepositoryImpl,
  type RecruitingReadGateway,
} from '../../packages/people/src';

const rows: Record<string, unknown[]> = {
  people_job_requisitions: [
    { id: 'req-a', org_id: 'org-a', title: 'Payroll Specialist', department: 'Finance', status: 'open', created_by: 'user-a', created_at: '2026-09-06T12:00:00Z', updated_at: '2026-09-06T12:00:00Z' },
    { id: 'req-b', org_id: 'org-b', title: 'Other Org', department: null, status: 'open', created_by: 'user-b', created_at: '2026-09-06T12:00:00Z', updated_at: '2026-09-06T12:00:00Z' },
  ],
  people_candidates: [
    { id: 'candidate-a', org_id: 'org-a', full_name: 'Ada Rivera', email: 'ada@example.com', phone: null, created_at: '2026-09-06T12:00:00Z', updated_at: '2026-09-06T12:00:00Z' },
  ],
  people_applications: [
    { id: 'app-a', org_id: 'org-a', requisition_id: 'req-a', candidate_id: 'candidate-a', stage: 'screening', decision_reason: null, created_at: '2026-09-06T12:00:00Z', updated_at: '2026-09-06T12:00:00Z' },
  ],
  people_assessment_results: [
    { id: 'assessment-a', org_id: 'org-a', application_id: 'app-a', assessment_type: 'english', score: 84, max_score: 100, result: { source: 'persisted' }, completed_at: '2026-09-06T12:30:00Z', created_at: '2026-09-06T12:30:00Z' },
  ],
};

class FixtureGateway implements RecruitingReadGateway {
  async select<T>(table: keyof typeof rows, _columns: string, _organizationId: string): Promise<T[]> {
    return (rows[table] ?? []) as T[];
  }
}

describe('ATLAS Recruiting repository', () => {
  it('defensively filters every collection by organization', async () => {
    const repository = new RecruitingRepositoryImpl(new FixtureGateway());

    expect((await repository.listRequisitions('org-a')).map((item) => item.id)).toEqual(['req-a']);
    expect((await repository.listCandidates('org-a')).map((item) => item.id)).toEqual(['candidate-a']);
    expect((await repository.listApplications('org-a')).map((item) => item.id)).toEqual(['app-a']);
    expect((await repository.listAssessmentResults('org-a')).map((item) => item.id)).toEqual(['assessment-a']);
  });

  it('requires an organization id', async () => {
    const repository = new RecruitingRepositoryImpl(new FixtureGateway());
    await expect(repository.listApplications('   ')).rejects.toThrow(/organizationId/i);
  });
});
