import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

type ResearchRun = {
  id: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  started_at: string;
  completed_at: string | null;
  sources_seen: number;
  sources_upserted: number;
  candidates_created: number;
  error_code: string | null;
};

type ResearchAssessment = {
  disease_key: string;
  classification: 'INSUFFICIENT' | 'CONTRADICTED' | 'HUMAN_REVIEW_ELIGIBLE';
};

export type LiveHealthResearchSummary = {
  source: 'supabase_rls_live';
  organizationId: string;
  loadedAt: string;
  latestRun: ResearchRun | null;
  sourceCount: number;
  diseaseCount: number;
  assessmentCount: number;
  candidateCount: number;
  classifications: Record<ResearchAssessment['classification'], number>;
};

async function parseArray<T>(response: Response): Promise<T[]> {
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error('health_research_invalid_response');
  }

  if (!response.ok) {
    const failure = data as { message?: string; error?: string };
    throw new Error(failure.message || failure.error || `health_research_request_failed_${response.status}`);
  }
  if (!Array.isArray(data)) throw new Error('health_research_invalid_response');
  return data as T[];
}

export async function getLiveHealthResearchSummary(): Promise<LiveHealthResearchSummary> {
  const organization = await getActiveAtlasOrganization();
  const orgFilter = encodeURIComponent(`eq.${organization.id}`);
  const [runsResponse, sourcesResponse, assessmentsResponse, candidatesResponse] = await Promise.all([
    authorizedAtlasFetch(`/rest/v1/health_research_runs?org_id=${orgFilter}&select=id,status,started_at,completed_at,sources_seen,sources_upserted,candidates_created,error_code&order=started_at.desc&limit=1`, { method: 'GET' }),
    authorizedAtlasFetch(`/rest/v1/health_research_sources?org_id=${orgFilter}&select=id,disease_key`, { method: 'GET' }),
    authorizedAtlasFetch(`/rest/v1/health_research_assessments?org_id=${orgFilter}&select=disease_key,classification`, { method: 'GET' }),
    authorizedAtlasFetch(`/rest/v1/health_cure_candidates?org_id=${orgFilter}&select=id`, { method: 'GET' })
  ]);

  const [runs, sources, assessments, candidates] = await Promise.all([
    parseArray<ResearchRun>(runsResponse),
    parseArray<{ id: string; disease_key: string }>(sourcesResponse),
    parseArray<ResearchAssessment>(assessmentsResponse),
    parseArray<{ id: string }>(candidatesResponse)
  ]);

  const classifications: LiveHealthResearchSummary['classifications'] = {
    INSUFFICIENT: 0,
    CONTRADICTED: 0,
    HUMAN_REVIEW_ELIGIBLE: 0
  };
  for (const assessment of assessments) classifications[assessment.classification] += 1;

  return {
    source: 'supabase_rls_live',
    organizationId: organization.id,
    loadedAt: new Date().toISOString(),
    latestRun: runs[0] || null,
    sourceCount: sources.length,
    diseaseCount: new Set(sources.map((source) => source.disease_key)).size,
    assessmentCount: assessments.length,
    candidateCount: candidates.length,
    classifications
  };
}
