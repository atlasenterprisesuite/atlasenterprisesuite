import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/web/src/modules/cloud/AtlasCloudNextLevel.tsx', 'utf8');

describe('ATLAS Cloud zero-cost control surface', () => {
  it('reuses canonical resource and observability authorities through the browser Data API', () => {
    expect(source).toContain('authorizedAtlasFetch');
    expect(source).toContain('getActiveAtlasOrganization');
    expect(source).toContain('/rest/v1/projects');
    expect(source).toContain('/rest/v1/project_tasks');
    expect(source).toContain('/rest/v1/project_milestones');
    expect(source).toContain('/rest/v1/atlas_module_registry');
    expect(source).toContain('/functions/v1/atlas-observability?api=summary');
  });

  it('keeps writes governed by the current user session and existing RLS', () => {
    expect(source).toContain("Prefer: 'return=representation'");
    expect(source).toContain('org_id: organization.id');
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(source).not.toContain('service_role');
    expect(source).not.toContain("localStorage.getItem('atlas_access_token')");
    expect(source).not.toContain('atlas-cloud-control');
  });

  it('exposes a governed OpenAPI contract without allocating another Edge Function', () => {
    expect(source).toContain("openapi: '3.1.0'");
    expect(source).toContain('atlasBearer');
    expect(source).toContain('canonical Supabase Data API');
    expect(source).not.toMatch(/password|recovery_code/i);
  });
});
