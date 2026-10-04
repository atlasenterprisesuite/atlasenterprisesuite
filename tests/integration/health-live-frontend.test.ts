import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('apps/web/src/modules/health/JaqueMateSentinelPage.tsx', 'utf8');
const repository = readFileSync('apps/web/src/modules/health/healthResearchRepository.ts', 'utf8');

describe('ATLAS Health live frontend contract', () => {
  it('reads organization-scoped research data from Supabase instead of presenting local values as live', () => {
    expect(repository).toContain('getActiveAtlasOrganization');
    expect(repository).toContain('authorizedAtlasFetch');
    expect(repository).toContain('/rest/v1/health_research_runs');
    expect(repository).toContain('/rest/v1/health_research_sources');
    expect(repository).toContain('/rest/v1/health_research_assessments');
    expect(repository).toContain('/rest/v1/health_cure_candidates');
    expect(repository).toContain("source: 'supabase_rls_live'");
  });

  it('fails closed when signed out or the live backend cannot be verified', () => {
    expect(page).toContain("'signed-out' | 'loading' | 'ready' | 'error'");
    expect(page).toContain('Authentication required');
    expect(page).toContain('Live data unavailable.');
    expect(page).toContain('No backend values are being represented as current.');
    expect(page).toContain('Neither count represents a confirmed cure.');
  });
});
