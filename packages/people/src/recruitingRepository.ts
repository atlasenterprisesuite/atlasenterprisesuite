import type { ApplicationStage } from './types';

export type RecruitingTable =
  | 'people_job_requisitions'
  | 'people_candidates'
  | 'people_applications'
  | 'people_assessment_results';

export type JobRequisitionStatus = 'draft' | 'open' | 'paused' | 'closed';

export interface JobRequisitionRecord {
  id: string;
  organizationId: string;
  title: string;
  department: string | null;
  status: JobRequisitionStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateRecord {
  id: string;
  organizationId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitingApplicationRecord {
  id: string;
  organizationId: string;
  requisitionId: string;
  candidateId: string;
  stage: ApplicationStage;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentResultRecord {
  id: string;
  organizationId: string;
  applicationId: string;
  assessmentType: string;
  score: number | null;
  maxScore: number | null;
  result: Record<string, unknown>;
  completedAt: string | null;
  createdAt: string;
}

export interface RecruitingReadGateway {
  select<T>(table: RecruitingTable, columns: string, organizationId: string): Promise<T[]>;
}

export interface RecruitingRepository {
  listRequisitions(organizationId: string): Promise<JobRequisitionRecord[]>;
  listCandidates(organizationId: string): Promise<CandidateRecord[]>;
  listApplications(organizationId: string): Promise<RecruitingApplicationRecord[]>;
  listAssessmentResults(organizationId: string): Promise<AssessmentResultRecord[]>;
}

type RequisitionRow = {
  id: string; org_id: string; title: string; department: string | null; status: string;
  created_by: string | null; created_at: string; updated_at: string;
};
type CandidateRow = {
  id: string; org_id: string; full_name: string; email: string | null; phone: string | null;
  created_at: string; updated_at: string;
};
type ApplicationRow = {
  id: string; org_id: string; requisition_id: string; candidate_id: string; stage: string;
  decision_reason: string | null; created_at: string; updated_at: string;
};
type AssessmentRow = {
  id: string; org_id: string; application_id: string; assessment_type: string; score: number | null;
  max_score: number | null; result: unknown; completed_at: string | null; created_at: string;
};

const requisitionStatuses = new Set<JobRequisitionStatus>(['draft', 'open', 'paused', 'closed']);
const applicationStages = new Set<ApplicationStage>([
  'applied', 'screening', 'assessment', 'interview', 'offer', 'hired', 'rejected', 'withdrawn',
]);

function requireOrganizationId(value: string): string {
  const organizationId = value.trim();
  if (!organizationId) throw new Error('organizationId is required');
  return organizationId;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export class RecruitingRepositoryImpl implements RecruitingRepository {
  constructor(private readonly gateway: RecruitingReadGateway) {}

  async listRequisitions(organizationId: string): Promise<JobRequisitionRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<RequisitionRow>(
      'people_job_requisitions',
      'id,org_id,title,department,status,created_by,created_at,updated_at',
      orgId,
    );
    return rows.filter((row) => row.org_id === orgId).map((row) => {
      if (!requisitionStatuses.has(row.status as JobRequisitionStatus)) {
        throw new Error(`Unsupported requisition status: ${row.status}`);
      }
      return {
        id: row.id,
        organizationId: row.org_id,
        title: row.title,
        department: row.department,
        status: row.status as JobRequisitionStatus,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async listCandidates(organizationId: string): Promise<CandidateRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<CandidateRow>(
      'people_candidates',
      'id,org_id,full_name,email,phone,created_at,updated_at',
      orgId,
    );
    return rows.filter((row) => row.org_id === orgId).map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async listApplications(organizationId: string): Promise<RecruitingApplicationRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<ApplicationRow>(
      'people_applications',
      'id,org_id,requisition_id,candidate_id,stage,decision_reason,created_at,updated_at',
      orgId,
    );
    return rows.filter((row) => row.org_id === orgId).map((row) => {
      if (!applicationStages.has(row.stage as ApplicationStage)) {
        throw new Error(`Unsupported application stage: ${row.stage}`);
      }
      return {
        id: row.id,
        organizationId: row.org_id,
        requisitionId: row.requisition_id,
        candidateId: row.candidate_id,
        stage: row.stage as ApplicationStage,
        decisionReason: row.decision_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async listAssessmentResults(organizationId: string): Promise<AssessmentResultRecord[]> {
    const orgId = requireOrganizationId(organizationId);
    const rows = await this.gateway.select<AssessmentRow>(
      'people_assessment_results',
      'id,org_id,application_id,assessment_type,score,max_score,result,completed_at,created_at',
      orgId,
    );
    return rows.filter((row) => row.org_id === orgId).map((row) => ({
      id: row.id,
      organizationId: row.org_id,
      applicationId: row.application_id,
      assessmentType: row.assessment_type,
      score: row.score,
      maxScore: row.max_score,
      result: objectValue(row.result),
      completedAt: row.completed_at,
      createdAt: row.created_at,
    }));
  }
}
