import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-cloud-control/index.ts', 'utf8');

describe('ATLAS Cloud control API', () => {
  it('reuses existing resource and observability authorities', () => {
    expect(source).toContain(".from('projects')");
    expect(source).toContain(".from('project_tasks')");
    expect(source).toContain(".from('project_milestones')");
    expect(source).toContain(".from('atlas_module_registry')");
    expect(source).toContain('atlas-observability?api=summary');
    expect(source).not.toContain("create table");
  });

  it('keeps every data operation scoped to the authenticated organization and user RLS', () => {
    expect(source).toContain('client.auth.getUser()');
    expect(source).toContain(".from('organization_members')");
    expect(source).toContain(".eq('org_id', ctx.orgId)");
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(source).not.toContain('service_role');
  });

  it('exposes a governed OpenAPI surface without exposing credentials', () => {
    expect(source).toContain("openapi: '3.1.0'");
    expect(source).toContain('atlasBearer');
    expect(source).toContain("api === 'openapi'");
    expect(source).toContain("api === 'project-create'");
    expect(source).not.toMatch(/password|recovery_code/i);
  });
});
