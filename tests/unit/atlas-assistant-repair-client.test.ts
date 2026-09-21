import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizedAtlasFetch: vi.fn(),
  getActiveAtlasOrganization: vi.fn()
}));

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  authorizedAtlasFetch: mocks.authorizedAtlasFetch,
  getActiveAtlasOrganization: mocks.getActiveAtlasOrganization
}));

import { enqueueAssistantRepair } from '../../apps/web/src/assistant/repairClient';

describe('ATLAS Assistant repair client', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main><h1>Accounts Payable</h1></main>';
    document.title = 'ATLAS';
    mocks.authorizedAtlasFetch.mockReset().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      job: { id: 'repair-1', status: 'pending' },
      execution: 'supabase-native',
      github_required: false
    }), { status: 201 }));
    mocks.getActiveAtlasOrganization.mockReset().mockResolvedValue({ id: 'org-1', role: 'owner' });
  });

  it('queues a repair with the active organization and structural route context', async () => {
    await enqueueAssistantRepair({
      message: 'Fix the mobile approval controls',
      pathname: '/finance/accounting/accounts-payable',
      conversationId: 'conv-1'
    });

    const [path, init] = mocks.authorizedAtlasFetch.mock.calls[0];
    expect(path).toBe('/functions/v1/atlas-repair-bridge?api=enqueue');
    expect(init.headers).toEqual({ 'x-atlas-org-id': 'org-1' });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      request: 'Fix the mobile approval controls',
      context: {
        source: 'atlas-assistant',
        organization_id: 'org-1',
        module: 'finance.accounting.accounts-payable',
        pathname: '/finance/accounting/accounts-payable',
        conversation_id: 'conv-1'
      }
    });
    expect(body.context.page.headings).toContain('Accounts Payable');
  });
});
