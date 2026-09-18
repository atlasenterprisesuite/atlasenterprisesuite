import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { listWorkflows } from '../../apps/web/src/work/api';
import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../apps/web/src/lib/atlasSession';

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  getActiveAtlasOrganization: vi.fn(),
  authorizedAtlasFetch: vi.fn()
}));

beforeEach(() => vi.clearAllMocks());

it('drops Work rows from any organization other than the authenticated organization', async () => {
  vi.mocked(getActiveAtlasOrganization).mockResolvedValue({ id: 'org-a', role: 'owner' });
  vi.mocked(authorizedAtlasFetch).mockResolvedValue(new Response(JSON.stringify({
    ok: true,
    workflows: [
      { id: 'wf-a', organization_id: 'org-a', owner_module: 'manager', status: 'now', current_task_id: null, current_module: 'manager', work: {} },
      { id: 'wf-b', organization_id: 'org-b', owner_module: 'manager', status: 'now', current_task_id: null, current_module: 'manager', work: {} }
    ]
  }), { status: 200 }));

  const rows = await listWorkflows();
  expect(rows.map((row) => row.id)).toEqual(['wf-a']);
});

it('keeps pilot persistence and runtime operations organization scoped server-side', () => {
  const pilot = readFileSync('supabase/functions/atlas-execution/openai-domain.ts', 'utf8');
  const runtime = readFileSync('supabase/functions/atlas-execution/work-runtime.ts', 'utf8');
  expect(pilot).toContain(".eq('org_id', deps.context.orgId)");
  expect(pilot).toContain(".eq('tenant_id', deps.context.tenantId)");
  expect(runtime).toContain(".eq('org_id', context.orgId)");
  expect(runtime).toContain(".eq('tenant_id', context.tenantId)");
});
